@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
powershell -NoProfile -Command "Start-Process -FilePath 'D:\A PROJECT\Bite Me Baby\e2e\r63_gates2.cmd' -WorkingDirectory 'D:\A PROJECT\Bite Me Baby'"
powershell -NoProfile -Command "Start-Process -FilePath 'D:\A PROJECT\Bite Me Baby\e2e\r63_sweep_apply.cmd' -WorkingDirectory 'D:\A PROJECT\Bite Me Baby'"
ping -n 6 127.0.0.1 > nul
if exist "D:\A PROJECT\Bite Me Baby\e2e\r63_lint_final2.log" (echo CHECK_lintlog=present) else echo CHECK_lintlog=absent
if exist "D:\A PROJECT\Bite Me Baby\e2e\r63_sweep_apply.log" (echo CHECK_applylog=present) else echo CHECK_applylog=absent