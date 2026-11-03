@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npm run lint > "D:\A PROJECT\Bite Me Baby\e2e\r63_lint_final2.log" 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\r63_lint_final2.log"
call npx vitest run > "D:\A PROJECT\Bite Me Baby\e2e\r63_vitest_full2.log" 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\r63_vitest_full2.log"
echo GATES2_DONE > "D:\A PROJECT\Bite Me Baby\e2e\r63_gates2_done.flag"