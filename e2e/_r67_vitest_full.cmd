@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npx vitest run > "D:\A PROJECT\Bite Me Baby\e2e\_r67_vitest_full.log" 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_vitest_full.log"