# r29_probe_print.ps1 — อ่านสถานะเครื่องพิมพ์ทั้งหมด (คิว/สถานะ/error ล่าสุด) — รันแล้วลบ
Write-Output '=== PRINTERS ==='
Get-Printer | Select-Object Name, DriverName, PrinterStatus, PortName | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
Write-Output '=== JOBS Nimbot B1Pro_BmB ==='
Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' -ErrorAction SilentlyContinue | Select-Object Id, DocumentName, JobStatus, Size, SubmittedTime | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
Write-Output '=== JOBS B1 Pro-I808030310 ==='
Get-PrintJob -PrinterName 'B1 Pro-I808030310' -ErrorAction SilentlyContinue | Select-Object Id, DocumentName, JobStatus, Size, SubmittedTime | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
Write-Output '=== LAST PrintService EVENTS (45m) ==='
try {
  Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-PrintService/Operational'; StartTime = (Get-Date).AddMinutes(-45) } -ErrorAction Stop |
    Select-Object -First 12 TimeCreated, Id, LevelDisplayName, Message |
    Format-List | Out-String -Width 220 | Write-Output
} catch { Write-Output ('eventlog unavailable: ' + $_.Exception.Message) }
Write-Output '=== PRINTER PORTS (Nimbot) ==='
Get-PrinterPort -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'USB|PRINT|Nimbot|DOT' } | Select-Object Name, Description, PrinterDriver | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
