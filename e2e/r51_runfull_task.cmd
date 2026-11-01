@echo off
cd /d "%~dp0.."
call npx vitest run > e2e\r51_vitest_full.log 2>&1
echo EXIT=%ERRORLEVEL%>> e2e\r51_vitest_full.log
