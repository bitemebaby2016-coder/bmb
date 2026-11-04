@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npx vitest run src/__tests__/bmbSticker.test.ts > "D:\A PROJECT\Bite Me Baby\e2e\_r67_vitest_sticker.log" 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_vitest_sticker.log"