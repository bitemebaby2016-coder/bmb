@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
set LOG=e2e\_r86_gates.log
echo === R86 GATES %DATE% %TIME% === > %LOG%
call npx tsc --noEmit >> %LOG% 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> %LOG%
call npx eslint . --max-warnings=0 >> %LOG% 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> %LOG%
call npx vitest run >> %LOG% 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> %LOG%
call npx vite build >> %LOG% 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> %LOG%
echo === GATES_DONE %TIME% === >> %LOG%
