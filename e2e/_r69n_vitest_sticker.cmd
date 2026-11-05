@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
set LOG="D:\A PROJECT\Bite Me Baby\e2e\_r69n_vitest_sticker.log"
echo === VITEST sticker %DATE% %TIME% > %LOG%
call npx vitest run src/__tests__/stickerPng.test.ts src/__tests__/bmbSticker.test.ts src/__tests__/stickerQueueR31.test.ts >> %LOG% 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> %LOG%
echo ALL_DONE >> %LOG%