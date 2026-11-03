# R62 — launch full vitest single-run detached (terminal cuts at 30s; no polling)
$root = 'D:\A PROJECT\Bite Me Baby'
Start-Process -FilePath 'npx.cmd' -ArgumentList 'vitest', 'run' `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput "$root\e2e\r62_vitest_full.log" `
  -RedirectStandardError "$root\e2e\r62_vitest_err.log"
Write-Output 'LAUNCHED_VITEST'
