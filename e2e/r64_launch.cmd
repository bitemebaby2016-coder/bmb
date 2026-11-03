@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
powershell -NoProfile -Command "Start-Process -FilePath 'D:\A PROJECT\Bite Me Baby\e2e\r64_gates.cmd' -WorkingDirectory 'D:\A PROJECT\Bite Me Baby'"
ping -n 6 127.0.0.1 > nul
if exist "D:\A PROJECT\Bite Me Baby\e2e\r64_tsc_final.log" (echo R64_GATES_STARTED=YES) else echo R64_GATES_STARTED=NO