@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
set LOG=e2e\_r84b_gates.log
echo === BMB GATES R84b (void payment — full set incl. display fixes) START %DATE% %TIME% === > %LOG%
call npx tsc --noEmit >> %LOG% 2>&1
if errorlevel 1 (echo TSC=FAIL>>%LOG%) else (echo TSC=PASS>>%LOG%)
call npm run lint >> %LOG% 2>&1
if errorlevel 1 (echo LINT=FAIL>>%LOG%) else (echo LINT=PASS>>%LOG%)
call npm test >> %LOG% 2>&1
if errorlevel 1 (echo VITEST=FAIL>>%LOG%) else (echo VITEST=PASS>>%LOG%)
call npx vite build >> %LOG% 2>&1
if errorlevel 1 (echo BUILD=FAIL>>%LOG%) else (echo BUILD=PASS>>%LOG%)
echo === GATES_DONE %TIME% === >> %LOG%
