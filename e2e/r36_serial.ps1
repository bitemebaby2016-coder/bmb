# r36_serial.ps1 — เขียนตรง COM3 ไม่ผ่าน spooler (ถ้าผ่าน = web จะใช้ qz.serial เอง ไม่ต้องง้อคิว)
$ErrorActionPreference = 'Continue'
$out = 'D:\A PROJECT\Bite Me Baby\e2e\r36_out.txt'
function Log($m) { Add-Content -Path $out -Value $m; Write-Output $m }
Set-Content -Path $out -Value '=== r36 start ==='

Write-Output '=== fresh PrintService events (6m) ==='
try {
  $evs = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-PrintService/Admin'; StartTime = (Get-Date).AddMinutes(-6) } -ErrorAction Stop | Select-Object -First 5
  foreach ($e in $evs) { Log ('EVT ' + $e.TimeCreated.ToString('HH:mm:ss') + ' ' + (($e.Message -replace '\s+', ' ')).Substring(0, [Math]::Min(260, $e.Message.Length))) }
} catch { Log 'EVT_NONE' }

$q = Get-Printer -Name 'Nimbot B1Pro_BmB'
Log ('QUEUE port=' + $q.PortName + ' status=' + $q.PrinterStatus)

$cands = @(
  @{ n = 'ESCPOS'; b = [byte[]](0x1B, 0x40, 0x1B, 0x61, 0x01) + [Text.Encoding]::ASCII.GetBytes("BMB SERIAL ESCPOS`r`n`r`n`r`n") },
  @{ n = 'TSPL'; b = [Text.Encoding]::ASCII.GetBytes("CLS`r`nSIZE 40 mm,60 mm`r`nTEXT 40,60,""3"",0,1,1,""BMB SERIAL TSPL""`r`nPRINT 1`r`n") },
  @{ n = 'CPCL'; b = [Text.Encoding]::ASCII.GetBytes("! 0 200 200 200 1`r`nTEXT 40 0 40 40 BMB SERIAL CPCL`r`nPRINT`r`n") }
)
foreach ($c in $cands) {
  try {
    $sp = New-Object System.IO.Ports.SerialPort('COM3', 115200, 'None', 8, 'One')
    $sp.ReadTimeout = 1500
    $sp.WriteTimeout = 1500
    $sp.Open()
    Log ('OPEN_OK ' + $c.n)
    Start-Sleep -Milliseconds 300
    $sp.Write($c.b, 0, $c.b.Length)
    Log ('WRITE_OK ' + $c.n + ' bytes=' + $c.b.Length)
    Start-Sleep -Milliseconds 1200
    try { $ack = $sp.ReadExisting(); if ($ack) { Log ('ACK ' + $c.n + ' len=' + $ack.Length) } } catch { }
    $sp.Close()
    Log ('CLOSED ' + $c.n)
  } catch {
    Log ('SERIAL_FAIL ' + $c.n + ' :: ' + $_.Exception.Message)
  }
}
Log '=== r36 end — ถาม Owner: กระดาษออกไหม ภาษาไหน ==='
