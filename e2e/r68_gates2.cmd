@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
call npx tsc --noEmit > "d:\A PROJECT\Bite Me Baby\e2e\r68_gates2.log" 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates2.log"
call npm run lint >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates2.log" 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates2.log"
call npx vitest run >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates2.log" 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates2.log"
echo GATES2_DONE >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates2.log"