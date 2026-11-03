@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
call npm run build > "d:\A PROJECT\Bite Me Baby\e2e\r65_build.log" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\r65_build.log"
