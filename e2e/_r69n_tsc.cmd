@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
set LOG="D:\A PROJECT\Bite Me Baby\e2e\_r69n_tsc.log"
echo === TSC %DATE% %TIME% > %LOG%
call npx tsc --noEmit >> %LOG% 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> %LOG%
echo ALL_DONE >> %LOG%