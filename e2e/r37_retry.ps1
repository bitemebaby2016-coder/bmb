# r37 — A: spooler raw ซ้ำ (คิว Normal แล้ว) + B: CreateFile เขียนตรง COM3 — ASCII only (PS5.1 no-BOM safe)
$ErrorActionPreference = 'Continue'
$out = 'D:\A PROJECT\Bite Me Baby\e2e\r37_out.txt'
function Log($m) { Add-Content -Path $out -Value $m; Write-Output $m }
Set-Content -Path $out -Value '=== r37 start ==='

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawP3 {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr pd);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool StartDocPrinter(IntPtr h, int l, ref DOCINFO d);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool WriteFile(IntPtr h, byte[] b, int c, out int written, IntPtr ov);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool CloseHandle(IntPtr h);
}
"@

function Send-SpoolRaw([byte[]]$bytes, [string]$docName) {
  $h = [IntPtr]::Zero
  if (-not [RawP3]::OpenPrinter('Nimbot B1Pro_BmB', [ref]$h, [IntPtr]::Zero)) { return 'OPEN_FAIL' }
  $di = New-Object RawP3+DOCINFO
  $di.pDocName = $docName; $di.pOutputFile = $null; $di.pDatatype = 'Raw'
  [RawP3]::StartDocPrinter($h, 1, [ref]$di) | Out-Null
  [RawP3]::StartPagePrinter($h) | Out-Null
  $w = 0; [RawP3]::WritePrinter($h, $bytes, $bytes.Length, [ref]$w) | Out-Null
  [RawP3]::EndPagePrinter($h) | Out-Null; [RawP3]::EndDocPrinter($h) | Out-Null; [RawP3]::ClosePrinter($h) | Out-Null
  return ('SENT=' + $w)
}

$cands = @(
  @{ n = 'ESCPOS'; b = [byte[]](0x1B, 0x40, 0x1B, 0x61, 0x01) + [Text.Encoding]::ASCII.GetBytes("BMB SPOOL ESCPOS`r`n`r`n`r`n") },
  @{ n = 'TSPL'; b = [Text.Encoding]::ASCII.GetBytes("CLS`r`nSIZE 40 mm,60 mm`r`nTEXT 40,60,""3"",0,1,1,""BMB SPOOL TSPL""`r`nPRINT 1`r`n") },
  @{ n = 'CPCL'; b = [Text.Encoding]::ASCII.GetBytes("! 0 200 200 200 1`r`nTEXT 40 0 40 40 BMB SPOOL CPCL`r`nPRINT`r`n") }
)

Log '--- A: SPOOLER RAW on COM3: (queue Normal) ---'
foreach ($c in $cands) {
  Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 400
  $sent = Send-SpoolRaw $c.b $c.n
  Start-Sleep -Seconds 3
  $jobs = @(Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue)
  $status = if ($jobs.Count -eq 0) { 'GONE_MAYBE_PRINTED' } else { (($jobs | ForEach-Object { $_.JobStatus }) -join ';') }
  Log ('SPOOL ' + $c.n + ' ' + $sent + ' STATUS=' + $status)
  if ($status -notmatch 'Error') { Log ('SPOOL_RESULT=' + $c.n); break }
  Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
}

Log '--- B: DIRECT CreateFile COM3 (bypass spooler) ---'
foreach ($c in $cands) {
  $handle = [RawP3]::CreateFile('\\.\COM3', 0x40000000, 0, [IntPtr]::Zero, 3, 0, [IntPtr]::Zero)
  $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  if ($handle -eq [IntPtr]::Zero -or $handle -eq [IntPtr](-1)) {
    Log ('DIRECT_OPEN_FAIL ' + $c.n + ' win32=' + $err)
    break
  }
  $w = 0
  $ok = [RawP3]::WriteFile($handle, $c.b, $c.b.Length, [ref]$w, [IntPtr]::Zero)
  $werr = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  [RawP3]::CloseHandle($handle) | Out-Null
  Log ('DIRECT_WRITE ' + $c.n + ' ok=' + $ok + ' written=' + $w + ' win32=' + $werr)
  Start-Sleep -Milliseconds 1500
}
Log '=== r37 end ==='
