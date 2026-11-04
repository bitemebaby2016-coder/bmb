@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npm run build > "D:\A PROJECT\Bite Me Baby\e2e\_r67_build.log" 2>&1
if errorlevel 1 (echo BUILD_FAIL>> "D:\A PROJECT\Bite Me Baby\e2e\_r67_build.log") else (echo BUILD_OK>> "D:\A PROJECT\Bite Me Baby\e2e\_r67_build.log")
