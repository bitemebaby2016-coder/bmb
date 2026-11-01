@echo off
schtasks /create /f /tn BMB_R51_VITEST /tr "D:\A PROJECT\Bite Me Baby\e2e\r51_runfull_task.cmd" /sc once /st 23:58
if errorlevel 1 exit /b 1
schtasks /run /tn BMB_R51_VITEST
