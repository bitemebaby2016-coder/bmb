# r30_raw.ps1 — ทดสอบ RAW กับ Nimbot B1Pro_BmB (Generic/Text Only USB001) — ล้างคิวก่อน แล้วยิงทีละภาษา
# ผล: RESULT=ชื่อภาษาที่ job ผ่าน (ไม่ Error) · เครื่องพิมพ์กระดาษต้องออกมาจริง
$ErrorActionPreference = 'SilentlyContinue'
$PRINTER = 'Nimbot B1Pro_BmB'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawP {
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
  if (-not [RawP]::OpenPrinter($PRINTER, [ref]$h, [IntPtr]::Zero)) { return 'OPEN_FAIL_' + $LASTEXITCODE }
  $di = New-Object RawP+DOCINFO
  $di.pDocName = $docName; $di.pOutputFile = $null; $di.pDatatype = 'Raw'
  $ok = [RawP]::StartDocPrinter($h, 1, [ref]$di)
  [RawP]::StartPagePrinter($h) | Out-Null
  $w = 0
  [RawP]::WritePrinter($h, $bytes, $bytes.Length, [ref]$w) | Out-Null
  [RawP]::EndPagePrinter($h) | Out-Null
  [RawP]::EndDocPrinter($h) | Out-Null
  [RawP]::ClosePrinter($h) | Out-Null
  return ('SENT=' + $w)
}
function Clear-Jobs { Get-PrintJob -PrinterName $PRINTER -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue }

Clear-Jobs
Start-Sleep -Milliseconds 500

$cands = @()
# 1) ESC/POS: init + center + text + feed
$esc = [byte[]](0x1B, 0x40, 0x1B, 0x61, 0x01) + [Text.Encoding]::ASCII.GetBytes("BMB ESCPOS TEST`r`n`r`n`r`n`r`n")
$cands += ,@{ name = 'ESCPOS'; bytes = $esc }
# 2) TSPL (TSC clone)
$tspl = [Text.Encoding]::ASCII.GetBytes("CLS`r`nSIZE 40 mm,60 mm`r`nDIRECTION 1`r`nTEXT 40,60,""3"",0,1,1,""BMB TSPL TEST""`r`nPRINT 1`r`n")
$cands += ,@{ name = 'TSPL'; bytes = $tspl }
# 3) CPCL
$cpcl = [Text.Encoding]::ASCII.GetBytes("! 0 200 200 200 1`r`nTEXT 40 0 40 40 BMB CPCL TEST`r`nPRINT`r`n")
$cands += ,@{ name = 'CPCL'; bytes = $cpcl }

foreach ($c in $cands) {
  Clear-Jobs
  Start-Sleep -Milliseconds 400
  $sent = Send-Raw $c.bytes $c.name
  Start-Sleep -Seconds 3
  $jobs = @(Get-PrintJob -PrinterName $PRINTER -ErrorAction SilentlyContinue)
  $status = if ($jobs.Count -eq 0) { 'GONE_MAYBE_PRINTED' } else { ($jobs | ForEach-Object { $_.JobStatus }) -join ';' }
  Write-Output ('CANDIDATE ' + $c.name + ' ' + $sent + ' STATUS=' + $status)
  if ($status -notmatch 'Error') {
    Write-Output ('RESULT=' + $c.name)
    if ($jobs.Count -eq 0) { Write-Output 'JOBS_EMPTY=paper should have fed' }
    break
  }
  Clear-Jobs
}
Write-Output '=== FINAL QUEUE ==='
@(Get-PrintJob -PrinterName $PRINTER -ErrorAction SilentlyContinue) | ForEach-Object { Write-Output ($_.Id.ToString() + ' ' + $_.JobStatus + ' ' + $_.DocumentName) }
