@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node e2e\_r67_co_probe.cjs > "D:\A PROJECT\Bite Me Baby\e2e\_r67_co_probe.log" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_co_probe.log"