# r33_fix.ps1 — ต้องรันในฐานะ Administrator (UAC จาก launcher) — ลงทะเบียน COM port → สลับพอร์ตคิว → ทดสอบ RAW จริง
$ErrorActionPreference = 'Stop'
$out = 'D:\A PROJECT\Bite Me Baby\e2e\r33_out.txt'
function Log($m) { Add-Content -Path $out -Value $m; Write-Output $m }
Set-Content -Path $out -Value ("=== r33 start " + (Get-Date -Format 'HH:mm:ss') + " ===")

# 1) หา COM ของ B1 Pro — match ด้วย hash 12 หลัก (parent = DEV_<hash> / child = &<hash>_C...)
$dev = Get-PnpDevice | Where-Object { $_.FriendlyName -match 'B1 Pro' } | Select-Object -First 1
$inst = if ($dev) { $dev.InstanceId } else { '' }
Log ('B1PRO=' + $(if ($dev) { $dev.FriendlyName + ' ' + $inst } else { 'NOT_FOUND' }))
$spp = @(Get-CimInstance Win32_SerialPort | Where-Object { $_.PNPDeviceID -match 'BTHENUM' })
Log ('SPP=' + (($spp | ForEach-Object { $_.DeviceID + '|' + $_.PNPDeviceID }) -join ' ;; '))
$hash = ''
if ($inst -match '([0-9A-Fa-f]{12})') { $hash = $Matches[1] }
Log ('HASH=' + $hash)
$port = $null
foreach ($s in $spp) { if ($hash -and $s.PNPDeviceID -match [regex]::Escape($hash)) { $port = $s.DeviceID; break } }
if (-not $port -and $spp.Count -eq 1) { $port = $spp[0].DeviceID }
Log ('PORT_PICK=' + $(if ($port) { $port } else { 'NONE' }))
if (-not $port) { Log 'ABORT=no com'; exit 1 }

# 2) สลับพอร์ตคิว — COM3: (มี ':' = ชื่อ Local Port ที่จดทะเบียนแล้ว · ไม่มี ':' = 0x80070057 ที่เคยพลาด)
$portLocal = ($port + ':')
try {
  if (-not (Get-PrinterPort -Name $portLocal -ErrorAction SilentlyContinue)) {
    Add-PrinterPort -Name $portLocal | Out-Null
    Log ('ADD_PRINTERPORT_OK ' + $portLocal)
  } else { Log ('PORT_EXISTS ' + $portLocal) }
  Set-Printer -Name 'Nimbot B1Pro_BmB' -PortName $portLocal
  Log ('SET_PORT_OK ' + $portLocal)
} catch {
  Log ('PORT_STEP_FAIL ' + $_.Exception.Message)
  try {
    Remove-Printer -Name 'Nimbot B1Pro_BmB'
    Add-Printer -Name 'Nimbot B1Pro_BmB' -DriverName 'Generic / Text Only' -PortName $portLocal
    Log 'RECREATED_OK'
  } catch { Log ('RECREATE_FAIL ' + $_.Exception.Message) }
}
$p2 = (Get-Printer -Name 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue)
if ($p2) { Log ('QUEUE_NOW port=' + $p2.PortName + ' status=' + $p2.PrinterStatus) }

# 2b) ตั้ง BAUD ของ COM (BT SPP มักไม่สน แต่ตั้งไว้ครบ) — mode ใช้ชื่อไม่มี ':'
try { & mode ($port + ' BAUD=115200 parity=n data=8 stop=1') | Out-Null; Log 'MODE_OK' } catch { Log ('MODE_FAIL ' + $_.Exception.Message) }

# 3) restart spooler (ล้มเหลว = ไม่เป็นไร ทำงานต่อ — ถ้า elevate จะผ่าน) + ล้างงานค้าง
try { Restart-Service Spooler -Force; Log 'SPOOLER_RESTARTED' } catch { Log ('SPOOLER_SKIP ' + $_.Exception.Message) }
Start-Sleep -Seconds 1
Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
Log 'JOBS_CLEARED_PRE_TEST'

# 4) RAW language test บนพอร์ตจริง
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawP2 {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr pd);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool StartDocPrinter(IntPtr h, int l, ref DOCINFO d);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
}
"@
function Send-Raw([byte[]]$bytes, [string]$docName) {
  $h = [IntPtr]::Zero
  if (-not [RawP2]::OpenPrinter('Nimbot B1Pro_BmB', [ref]$h, [IntPtr]::Zero)) { return 'OPEN_FAIL' }
  $di = New-Object RawP2+DOCINFO
  $di.pDocName = $docName; $di.pOutputFile = $null; $di.pDatatype = 'Raw'
  [RawP2]::StartDocPrinter($h, 1, [ref]$di) | Out-Null
  [RawP2]::StartPagePrinter($h) | Out-Null
  $w = 0; [RawP2]::WritePrinter($h, $bytes, $bytes.Length, [ref]$w) | Out-Null
  [RawP2]::EndPagePrinter($h) | Out-Null; [RawP2]::EndDocPrinter($h) | Out-Null; [RawP2]::ClosePrinter($h) | Out-Null
  return ('SENT=' + $w)
}

$cands = @(
  @{ name = 'ESCPOS'; bytes = [byte[]](0x1B, 0x40, 0x1B, 0x61, 0x01) + [Text.Encoding]::ASCII.GetBytes("BMB ESCPOS TEST`r`n`r`n`r`n`r`n") },
  @{ name = 'TSPL'; bytes = [Text.Encoding]::ASCII.GetBytes("CLS`r`nSIZE 40 mm,60 mm`r`nDIRECTION 1`r`nTEXT 40,60,""3"",0,1,1,""BMB TSPL TEST""`r`nPRINT 1`r`n") },
  @{ name = 'CPCL'; bytes = [Text.Encoding]::ASCII.GetBytes("! 0 200 200 200 1`r`nTEXT 40 0 40 40 BMB CPCL TEST`r`nPRINT`r`n") }
)
foreach ($c in $cands) {
  Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 400
  $sent = Send-Raw $c.bytes $c.name
  Start-Sleep -Seconds 3
  $jobs = @(Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue)
  $status = if ($jobs.Count -eq 0) { 'GONE_MAYBE_PRINTED' } else { (($jobs | ForEach-Object { $_.JobStatus }) -join ';') }
  Log ('CANDIDATE ' + $c.name + ' ' + $sent + ' STATUS=' + $status)
  if ($status -notmatch 'Error') { Log ('RESULT=' + $c.name); break }
  Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
}
Log ("=== r33 end " + (Get-Date -Format 'HH:mm:ss') + " ===")
