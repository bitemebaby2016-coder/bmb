@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
npx vitest run > "d:\A PROJECT\Bite Me Baby\e2e\r65b_vitest_result.txt" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\r65b_vitest_result.txt"