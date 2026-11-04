@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
call npx vitest run --reporter=basic > e2e\r66_vitest_full.log 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> e2e\r66_vitest_full.log
call npx tsc --noEmit > e2e\r66_tsc.log 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> e2e\r66_tsc.log
call npm run lint > e2e\r66_lint.log 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> e2e\r66_lint.log