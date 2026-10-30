# r31_diag.ps1 — หา error จริงของคิว Nimbot (Admin log + USB + processes) · ล้างคิวท้ายสุด
$ErrorActionPreference = 'SilentlyContinue'
Write-Output '=== NIMBOT-ISH PROCESSES ==='
Get-Process | Where-Object { $_.ProcessName -match 'nimbot|hanin|label|b1print|漢印|汉印' -or $_.MainWindowTitle -match 'Nimbot|B1' } | Select-Object Id, ProcessName, MainWindowTitle | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
Write-Output '=== PnP devices (printer-ish / usb printing) ==='
Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -match 'Nimbot|B1|Label|POS|Printing|USB Printing|40x60' -or $_.Class -eq 'Printer' } | Select-Object Status, Class, FriendlyName | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
Write-Output '=== PRINT CONFIG Nimbot B1Pro_BmB ==='
Get-PrintConfiguration -PrinterName 'Nimbot B1Pro_BmB' | Format-List | Out-String | Write-Output
Write-Output '=== PrintService/Admin LOG (60m) ==='
try {
  Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-PrintService/Admin'; StartTime = (Get-Date).AddMinutes(-60) } -ErrorAction Stop |
    Select-Object -First 8 TimeCreated, Id, Message | Format-List | Out-String -Width 220 | Write-Output
} catch { Write-Output ('adminlog: ' + $_.Exception.Message) }
Write-Output '=== System LOG print/spooler events (60m) ==='
try {
  Get-WinEvent -FilterHashtable @{ LogName = 'System'; StartTime = (Get-Date).AddMinutes(-60) } -ErrorAction Stop |
    Where-Object { $_.ProviderName -match 'Print|Spooler|Service' -and ($_.Message -match 'Nimbot|print|spooler' -or $_.ProviderName -match 'Print') } |
    Select-Object -First 8 TimeCreated, ProviderName, Id, LevelDisplayName, Message | Format-List | Out-String -Width 220 | Write-Output
} catch { Write-Output ('syslog: ' + $_.Exception.Message) }
Write-Output '=== SPOOLER SERVICE ==='
Get-Service Spooler | Select-Object Status, Name, StartType | Format-Table -AutoSize | Out-String | Write-Output
Write-Output '=== CLEAR JOBS ==='
Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB' | Remove-PrintJob -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600
$left = @(Get-PrintJob -PrinterName 'Nimbot B1Pro_BmB')
Write-Output ('JOBS_LEFT=' + $left.Count)
