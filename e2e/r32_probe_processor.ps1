# r32_probe_processor.ps1 — เจาะ error 2: PrintProcessor ของคิว + DLL spool + monitors + BT/USB ports
$ErrorActionPreference = 'SilentlyContinue'
Write-Output '=== PRINTER FULL (Nimbot) ==='
Get-Printer -Name 'Nimbot B1Pro_BmB' | Select-Object Name, DriverName, PortName, PrintProcessor, PrinterStatus, Shared, Type | Format-List | Out-String | Write-Output
Write-Output '=== PRTPROCS DLL present ==='
Get-ChildItem "$env:SystemRoot\System32\spool\prtprocs" -Recurse -Filter *.dll | Select-Object FullName | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
Write-Output '=== winprint.dll / usbmon.dll exist? ==='
@(
  "$env:SystemRoot\System32\spool\prtprocs\x64\winprint.dll",
  "$env:SystemRoot\System32\winprint.dll",
  "$env:SystemRoot\System32\usbmon.dll",
  "$env:SystemRoot\System32\spool\DRIVERS\x64\3\usbmon.dll"
) | ForEach-Object { Write-Output (($_) + ' = ' + (Test-Path $_)) }
Write-Output '=== REG printer key ==='
reg query "HKLM\SYSTEM\CurrentControlSet\Control\Print\Printers\Nimbot B1Pro_BmB" /s 2>$null | Select-Object -First 60 | Write-Output
Write-Output '=== REG monitors (DLL entries) ==='
reg query "HKLM\SYSTEM\CurrentControlSet\Control\Print\Monitors" /s 2>$null | Select-String -Pattern 'HKEY|Monitor DLL|^\s*\(Default\)' | ForEach-Object { $_.Line } | Select-Object -First 60 | Write-Output
Write-Output '=== BT serial / COM ports ==='
Get-CimInstance Win32_SerialPort | Select-Object DeviceID, Name, PNPDeviceID | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match 'B1 Pro|Nimbot|COM\d' -and $_.Name -match 'COM' } | Select-Object DeviceID, Name, Status | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
Write-Output '=== USB devices with VID/PID ==='
Get-CimInstance Win32_PnPEntity | Where-Object { $_.DeviceID -match 'VID_' } | Select-Object DeviceID, Name, Status | Format-Table -AutoSize | Out-String -Width 240 | Write-Output
