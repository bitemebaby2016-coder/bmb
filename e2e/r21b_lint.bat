@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npm run lint > "e2e\gates_r21b_lint.log" 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> "e2e\gates_r21b_lint.log"