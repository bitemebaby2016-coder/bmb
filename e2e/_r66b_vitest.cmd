@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
echo STARTED=%TIME% > "d:\A PROJECT\Bite Me Baby\e2e\_r66b_vitest.log"
call npx vitest run >> "d:\A PROJECT\Bite Me Baby\e2e\_r66b_vitest.log" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\_r66b_vitest.log"