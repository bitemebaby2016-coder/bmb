@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
node e2e\r66_sticker_fit.cjs > e2e\r66_fit_result.txt 2>&1
echo EXITCODE=%ERRORLEVEL% >> e2e\r66_fit_result.txt