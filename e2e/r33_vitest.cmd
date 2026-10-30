@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
npx vitest run > "e2e\r33_vitest_full.log" 2>&1
echo EXIT=%ERRORLEVEL% >> "e2e\r33_vitest_full.log"
