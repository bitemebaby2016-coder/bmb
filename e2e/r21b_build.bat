@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npx vite build > "e2e\gates_r21b_build.log" 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> "e2e\gates_r21b_build.log"