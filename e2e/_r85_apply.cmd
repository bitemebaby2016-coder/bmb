@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node e2e\_r85_apply.cjs > e2e\_r85_apply.log 2>&1
echo APPLY_EXIT=%ERRORLEVEL% >> e2e\_r85_apply.log
