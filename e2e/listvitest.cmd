@echo off
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*vitest*' } | ForEach-Object { Write-Output ($_.ProcessId.ToString() + ' :: ' + $_.CommandLine) }"
