@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
echo STARTED=%TIME% > "d:\A PROJECT\Bite Me Baby\e2e\_r66b_vitest3.log"
call npx vitest run src/__tests__/adminSettingsTypedKeys.test.ts src/__tests__/r12SeoAdminCopy.test.ts src/__tests__/socialAiContinuity.test.ts src/__tests__/r66AdminSwitches.test.ts >> "d:\A PROJECT\Bite Me Baby\e2e\_r66b_vitest3.log" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\_r66b_vitest3.log"