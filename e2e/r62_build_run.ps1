# R62 — launch build detached (30s terminal cut) via cmd so `&&` works
$root = 'D:\A PROJECT\Bite Me Baby'
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npx tsc --noEmit && npx vite build' `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput "$root\e2e\r62_build.log" `
  -RedirectStandardError "$root\e2e\r62_build_err.log"
Write-Output 'LAUNCHED_BUILD'
