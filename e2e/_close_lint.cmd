@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npm run lint > "D:\A PROJECT\Bite Me Baby\e2e\_close_lint.log" 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_close_lint.log"