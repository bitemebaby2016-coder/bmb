# r40_lang.ps1 — battery รอบ 2: spooler retest (หลัง Owner restart) + direct COM3 ชุดภาษาจีน/หลายฟอร์แมต
# ASCII-safe source (Chinese strings สร้างจาก codepoints — PS5.1 no-BOM ไม่เพี้ยน)
$ErrorActionPreference = 'Continue'
$out = 'D:\A PROJECT\Bite Me Baby\e2e\r40_out.txt'
function Log($m) { Add-Content -Path $out -Value $m; Write-Output $m }
Set-Content -Path $out -Value '=== r40 start ==='

$sp = Get-Service Spooler
Log ('SPOOLER=' + $sp.Status)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawP4 {
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

function Send-Spool([byte[]]$bytes, [string]$docName) {
  $h = [IntPtr]::Zero
  if (-not [RawP4]::OpenPrinter('Nimbot B1Pro_BmB', [ref]$h, [IntPtr]::Zero)) { return 'OPEN_FAIL' }
  $di = New-Object RawP4+DOCINFO
  $di.pDocName = $docName; $di.pOutputFile = $null; $di.pDatatype = 'Raw'
  [RawP4]::StartDocPrinter($h, 1, [ref]$di) | Out-Null
  [RawP4]::StartPagePrinter($h) | Out-Null
  $w = 0; [RawP4]::WritePrinter($h, $bytes, $bytes.Length, [ref]$w) | Out-Null
  [RawP4]::EndPagePrinter($h) | Out-Null; [RawP4]::EndDocPrinter($h) | Out-Null; [RawP4]::ClosePrinter($h) | Out-Null
  return ('SENT=' + $w)
}
function Send-Direct([byte[]]$bytes, [string]$tag) {
  $handle = [RawP4]::CreateFile('\\.\COM3', 0x40000000, 0, [IntPtr]::Zero, 3, 0, [IntPtr]::Zero)
  if ($handle -eq [IntPtr]::Zero -or $handle -eq [IntPtr](-1)) { Log ('DIRECT_OPEN_FAIL ' + $tag + ' win32=' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()); return }
  $w = 0
  $ok = [RawP4]::WriteFile($handle, $bytes, $bytes.Length, [ref]$w, [IntPtr]::Zero)
  $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  [RawP4]::CloseHandle($handle) | Out-Null
  Log ('DIRECT ' + $tag + ' ok=' + $ok + ' written=' + $w + ' win32=' + $err)
  Start-Sleep -Milliseconds 1400
}

# Chinese strings จาก codepoints: 0x6C49 0x5370 = 汉印 · 0x6D4B 0x8BD5 0x6807 0x7B7E = 测试标签 · 0x6253 0x5370 0x673A = 打印机
$gbk = [System.Text.Encoding]::GetEncoding(936)
$hanin = -join ([char[]](0x6C49, 0x5370))
$testLabel = -join ([char[]](0x6D4B, 0x8BD5, 0x6807, 0x7B7E))
$printer = -join ([char[]](0x6253, 0x5370, 0x673A))
Log ('CHINESE_STR ' + $hanin + ' / ' + $testLabel)

# ---- A: SPOOLER raw retest (post-restart) ----
Log '--- A: SPOOLER retest ---'
Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
$s1 = [Text.Encoding]::ASCII.GetBytes("SPOOL-RETEST-TSPL`r`nCLS`r`nSIZE 40 mm,60 mm`r`nTEXT 30,30,""3"",0,1,1,""SPOOL TSPL OK""`r`nPRINT 1`r`n")
$st = Send-Spool $s1 'spool-tspl'
Start-Sleep -Seconds 3
$jobs = @(Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue)
$jobSt = if ($jobs.Count -eq 0) { 'GONE_MAYBE_PRINTED' } else { (($jobs | ForEach-Object { $_.JobStatus }) -join ';') }
Log ('SPOOL_TSPL ' + $st + ' STATUS=' + $jobSt)
Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue

# ---- B: DIRECT battery ----
Log '--- B: DIRECT battery ---'

# B1 TSPL ป้ายเต็ม
$b1 = $gbk.GetBytes("CLS`r`nSIZE 40 mm,60 mm`r`nGAP 2 mm,0 mm`r`nDIRECTION 1`r`nCLS`r`nTEXT 30,40,""3"",0,1,1,""NIMBOT-TSPL""`r`nTEXT 30,120,""3"",0,1,1,""$testLabel""`r`nPRINT 1`r`n")
Send-Direct $b1 'TSPL-full'

# B2 ESC/POS + codepage GBK (ESC t 25 = 0x19) + จีน
$b2 = [byte[]](0x1B, 0x40, 0x1B, 0x61, 0x01, 0x1B, 0x74, 0x19) + $gbk.GetBytes("ESCPOS-GBK $hanin $testLabel`r`n`r`n`r`n")
Send-Direct $b2 'ESCPOS-GBK'

# B3 ESC/POS default + GB18030-ish bytes (codepage 31 = 0x1F)
$b3 = [byte[]](0x1B, 0x40, 0x1B, 0x61, 0x01, 0x1B, 0x74, 0x1F) + $gbk.GetBytes("$hanin-CP31 $printer`r`n`r`n`r`n")
Send-Direct $b3 'ESCPOS-CP31'

# B4 CPCL + จีน
$b4 = $gbk.GetBytes("! 0 200 300 200 1`r`nTEXT 30 0 30 40 CPCL-TEST`r`nTEXT 30 0 30 120 $hanin$testLabel`r`nPRINT`r`n")
Send-Direct $b4 'CPCL-GBK'

# B5 ZPL (แบรนด์จีนบางรุ่นเป็น ZPL clone)
$b5 = [Text.Encoding]::ASCII.GetBytes("^XA^FO30,40^A0N,40,40^FDNIMBOT-ZPL^FS^FO30,120^A0N,40,40^FDTEST^FS^XZ")
Send-Direct $b5 'ZPL'

# B6 TSPL + ฟอนต์จีน 0 (TEXT แบบ default โค้ดเพจ)
$b6 = $gbk.GetBytes("CLS`r`nSIZE 40 mm,60 mm`r`nTEXT 30,40,""3"",0,1,1,""$hanin $printer""`r`nPRINT 1`r`n")
Send-Direct $b6 'TSPL-CHINESE'

Log '=== r40 end ==='
