@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npx tsc --noEmit > "D:\A PROJECT\Bite Me Baby\e2e\r64_tsc_final.log" 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\r64_tsc_final.log"
call npm run lint > "D:\A PROJECT\Bite Me Baby\e2e\r64_lint_final.log" 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\r64_lint_final.log"
call npx vitest run > "D:\A PROJECT\Bite Me Baby\e2e\r64_vitest_full.log" 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\r64_vitest_full.log"
call npm run build > "D:\A PROJECT\Bite Me Baby\e2e\r64_build.log" 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\r64_build.log"
echo R64_GATES_DONE > "D:\A PROJECT\Bite Me Baby\e2e\r64_gates_done.flag"