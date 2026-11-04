@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node e2e\_r67_rrtrace.cjs > e2e\_r67_rrtrace.log 2>&1
echo EXITCODE=%ERRORLEVEL% >> e2e\_r67_rrtrace.log