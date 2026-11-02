# e2e/r55_smoke_qwen.ps1 — แยก process ให้ทดสอบโมเดลรอง (qwen) รันต่อได้เกิน 30s ของ terminal
Start-Process -FilePath node -ArgumentList '"d:\A PROJECT\Bite Me Baby\e2e\r55_model_smoke.cjs" 1' -WindowStyle Hidden
Write-Output 'LAUNCHED'
