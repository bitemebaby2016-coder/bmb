@echo off
rem R82 — detached launcher สำหรับ deploy EF (process ใหม่จริงผ่าน Start-Process)
powershell.exe -NoProfile -NonInteractive -Command "Start-Process -FilePath 'D:\A PROJECT\Bite Me Baby\e2e\_r82DeployRun.cmd' -WindowStyle Minimized"
echo DEPLOY_LAUNCHED