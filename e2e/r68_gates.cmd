@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
call npx tsc --noEmit > "d:\A PROJECT\Bite Me Baby\e2e\r68_gates.log" 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates.log"
call npm run lint >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates.log" 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates.log"
call npx vitest run >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates.log" 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates.log"
call npm run build >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates.log" 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates.log"
echo GATES_DONE >> "d:\A PROJECT\Bite Me Baby\e2e\r68_gates.log"