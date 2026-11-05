@echo off
cd /d D:\A PROJECT\Bite Me Baby
echo START %TIME% > e2e\_r72_gates.log
echo TSC_BEGIN %TIME% >> e2e\_r72_gates.log
call npx tsc --noEmit > e2e\_r72_tsc.log 2>&1
echo TSC_EXIT=%ERRORLEVEL% %TIME% >> e2e\_r72_gates.log
echo LINT_BEGIN %TIME% >> e2e\_r72_gates.log
call npm run lint > e2e\_r72_lint.log 2>&1
echo LINT_EXIT=%ERRORLEVEL% %TIME% >> e2e\_r72_gates.log
echo VIT_BEGIN %TIME% >> e2e\_r72_gates.log
call npx vitest run > e2e\_r72_vitest.log 2>&1
echo VIT_EXIT=%ERRORLEVEL% %TIME% >> e2e\_r72_gates.log
echo BUILD_BEGIN %TIME% >> e2e\_r72_gates.log
call npm run build > e2e\_r72_build.log 2>&1
echo BUILD_EXIT=%ERRORLEVEL% %TIME% >> e2e\_r72_gates.log
echo GATES_DONE %TIME% >> e2e\_r72_gates.log
