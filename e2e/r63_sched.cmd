@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
powershell -NoProfile -Command "Start-Process -FilePath 'D:\A PROJECT\Bite Me Baby\e2e\r63_sweep_run.cmd' -WorkingDirectory 'D:\A PROJECT\Bite Me Baby'"
powershell -NoProfile -Command "Start-Process -FilePath 'D:\A PROJECT\Bite Me Baby\e2e\r63_gates.cmd' -WorkingDirectory 'D:\A PROJECT\Bite Me Baby'"
ping -n 6 127.0.0.1 > nul
if exist "D:\A PROJECT\Bite Me Baby\e2e\r63_sweep_audit.log" (echo SWEEP_STARTED=YES) else echo SWEEP_STARTED=NO
if exist "D:\A PROJECT\Bite Me Baby\e2e\r63_tsc_final.log" (echo GATES_STARTED=YES) else echo GATES_STARTED=NO