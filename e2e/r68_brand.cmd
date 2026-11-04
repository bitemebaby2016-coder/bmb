@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
call node scripts\brandNameGuard.cjs > "d:\A PROJECT\Bite Me Baby\e2e\r68_brand.log" 2>&1
echo BRAND_EXIT=%ERRORLEVEL% >> "d:\A PROJECT\Bite Me Baby\e2e\r68_brand.log"