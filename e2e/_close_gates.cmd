@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
set LOG="D:\A PROJECT\Bite Me Baby\e2e\_close_gates.log"
echo === CLOSE-OUT GATES %DATE% %TIME% > %LOG%
echo === TSC === >> %LOG%
call npx tsc --noEmit >> %LOG% 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> %LOG%
echo === LINT === >> %LOG%
call npm run lint >> %LOG% 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> %LOG%
echo === VITEST FULL === >> %LOG%
call npx vitest run >> %LOG% 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> %LOG%
echo === BUILD === >> %LOG%
call npm run build >> %LOG% 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> %LOG%
echo === E2E MATRIX === >> %LOG%
call node e2e\_r67_e2e_run.cjs >> %LOG% 2>&1
echo E2E_EXIT=%ERRORLEVEL% >> %LOG%
echo === CHAT LIVE === >> %LOG%
call node e2e\_r67_chat_live.cjs >> %LOG% 2>&1
echo CHAT_EXIT=%ERRORLEVEL% >> %LOG%
echo ALL_DONE >> %LOG%