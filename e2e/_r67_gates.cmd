@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
echo === TSC === > "D:\A PROJECT\Bite Me Baby\e2e\_r67_gates.log"
call npx tsc --noEmit >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_gates.log" 2>&1
echo TSC_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_gates.log"
echo === LINT === >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_gates.log"
call npm run lint >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_gates.log" 2>&1
echo LINT_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_gates.log"
echo === BUILD === >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_gates.log"
call npm run build >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_gates.log" 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_gates.log"
echo GATES_DONE >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_gates.log"
