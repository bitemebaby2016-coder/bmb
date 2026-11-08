@echo off
rem R82 — detached launcher: ปล่อย gates รันต่อหลัง tool call จบ (Start-Process = process ใหม่จริง)
powershell.exe -NoProfile -NonInteractive -Command "Start-Process -FilePath 'D:\A PROJECT\Bite Me Baby\e2e\_r82GatesRun.cmd' -WindowStyle Minimized"
echo LAUNCHED