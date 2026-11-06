@echo off
cd /d D:\A PROJECT\Bite Me Baby
echo === TSC === > D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log
call npx tsc --noEmit >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log
echo === ESLINT === >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log
call npx eslint . >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log
echo === VITEST FULL === >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log
call npx vitest run >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log
echo === BUILD === >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log
call npx vite build >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log
echo GATES_DONE >> D:\A PROJECT\Bite Me Baby\e2e\_r74_gates.log