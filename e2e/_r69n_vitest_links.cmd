@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
set LOG="D:\A PROJECT\Bite Me Baby\e2e\_r69n_vitest_links.log"
echo === VITEST notificationLinks %DATE% %TIME% > %LOG%
call npx vitest run src/__tests__/notificationLinks.test.ts >> %LOG% 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> %LOG%
echo ALL_DONE >> %LOG%