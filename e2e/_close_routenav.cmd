@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
call npx playwright test routeNav > "D:\A PROJECT\Bite Me Baby\e2e\_close_routenav.log" 2>&1
echo ROUTENAV_EXIT=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_close_routenav.log"