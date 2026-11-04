@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
npx vitest run src/__tests__/r67Contracts.test.ts src/__tests__/seo.test.ts src/__tests__/socialAiContinuity.test.ts > "D:\A PROJECT\Bite Me Baby\e2e\_r67_vitest_target.log" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_vitest_target.log"