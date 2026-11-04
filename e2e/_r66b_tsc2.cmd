@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
echo STARTED=%TIME% > "d:\A PROJECT\Bite Me Baby\e2e\_r66b_tsc2.log"
call npx tsc --noEmit -p tsconfig.json >> "d:\A PROJECT\Bite Me Baby\e2e\_r66b_tsc2.log" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\_r66b_tsc2.log"