# r34_state.ps1 — snapshot สถานะล่าสุด: ผล r33 / พอร์ตคิว / งานค้าง / QZ process / port listen
$ErrorActionPreference = 'SilentlyContinue'
$out = 'D:\A PROJECT\Bite Me Baby\e2e\r33_out.txt'
Write-Output '=== r33_out (LastWrite + tail 30) ==='
if (Test-Path $out) {
  $fi = Get-Item $out
  Write-Output ('LastWrite=' + $fi.LastWriteTime.ToString('HH:mm:ss') + ' now=' + (Get-Date).ToString('HH:mm:ss'))
  Get-Content $out -Tail 30 | Write-Output
} else { Write-Output 'NO_FILE' }

Write-Output '=== QUEUE Nimbot ==='
Get-Printer -Name 'Nimbot B1Pro_BmB' | Select-Object PortName, PrinterStatus, PrintProcessor, DriverName | Format-List | Out-String | Write-Output

Write-Output '=== PRINTER PORTS registered ==='
Get-PrinterPort | Select-Object Name, Description | Format-Table -AutoSize | Out-String -Width 160 | Write-Output

Write-Output '=== JOBS ==='
$jobs = @(Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB')
if ($jobs.Count -eq 0) { Write-Output 'EMPTY' } else { $jobs | Select-Object Id, DocumentName, JobStatus | Format-Table -AutoSize | Out-String | Write-Output }

Write-Output '=== QZ PROCESS ==='
$qz = @(Get-Process | Where-Object { $_.ProcessName -match 'qz' })
if ($qz.Count -eq 0) { Write-Output 'QZ_NOT_RUNNING' } else { $qz | Select-Object Id, ProcessName | Format-Table -AutoSize | Out-String | Write-Output }

Write-Output '=== QZ PORTS LISTENING ==='
$listen = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 8181, 8182, 8183, 8282, 8484 } | Select-Object LocalPort, OwningProcess)
if ($listen.Count -eq 0) { Write-Output 'NO_QZ_PORTS' } else { $listen | Format-Table -AutoSize | Out-String | Write-Output }

Write-Output '=== BT PAIRED (B1 Pro) ==='
$btd = Get-PnpDevice | Where-Object { $_.FriendlyName -match 'B1 Pro' } | Select-Object -First 1
if ($btd) { Write-Output ($btd.Status + ' ' + $btd.FriendlyName) } else { Write-Output 'B1PRO_NOT_FOUND' }
