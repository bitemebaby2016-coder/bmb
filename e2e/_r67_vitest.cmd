@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npx vitest run src/__tests__/r67Contracts.test.ts src/__tests__/seo.test.ts src/__tests__/socialAiContinuity.test.ts src/__tests__/mascotClosed.test.ts src/__tests__/adminSettingsTypedKeys.test.ts > "D:\A PROJECT\Bite Me Baby\e2e\_r67_vitest.log" 2>&1
echo VITEST_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_vitest.log"
