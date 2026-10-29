@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npx vitest run > "e2e\gates_r19b_vitest.log" 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> "e2e\gates_r19b_vitest.log"
