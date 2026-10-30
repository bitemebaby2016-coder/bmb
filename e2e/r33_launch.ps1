# r33_launch.ps1 — ยิง r33_fix.ps1 แบบ elevated (UAC เด้งที่หน้าจอ Owner 1 ครั้ง) + poll ผลจากไฟล์
$fix = 'D:\A PROJECT\Bite Me Baby\e2e\r33_fix.ps1'
$out = 'D:\A PROJECT\Bite Me Baby\e2e\r33_out.txt'
if (Test-Path $out) { Remove-Item $out -Force }
try {
  # ไม่ -Wait: UAC เด้งค้างที่จอ Owner → เขา กด Yes → ผลเข้าไฟล์ → เรา poll เอง
  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $fix) -Verb RunAs
  Write-Output 'UAC_PROMPT_LAUNCHED — กด Yes ที่หน้าจอ'
} catch {
  Write-Output ('UAC_OR_START_FAIL ' + $_.Exception.Message)
}
for ($i = 0; $i -lt 30; $i++) {
  if (Test-Path $out) {
    $t = Get-Content $out -Raw
    if ($t -match 'r33 end') { break }
  }
  Start-Sleep -Milliseconds 800
}
if (Test-Path $out) { Get-Content $out | Write-Output } else { Write-Output 'NO_OUT_FILE' }
