@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
set LOG="D:\A PROJECT\Bite Me Baby\e2e\_r73_gates.log"
echo === R73 FULL GATES %DATE% %TIME% > %LOG%
echo === TSC === >> %LOG%
call npx tsc --noEmit >> %LOG% 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> %LOG%
echo === LINT === >> %LOG%
call npm run lint >> %LOG% 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> %LOG%
echo === VITEST FULL === >> %LOG%
call npx vitest run >> %LOG% 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> %LOG%
echo === BUILD === >> %LOG%
call npm run build >> %LOG% 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> %LOG%
echo ALL_DONE >> %LOG%