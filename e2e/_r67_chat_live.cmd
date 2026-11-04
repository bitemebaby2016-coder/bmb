@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node e2e\_r67_chat_live.cjs > "D:\A PROJECT\Bite Me Baby\e2e\_r67_chat_live.log" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "D:\A PROJECT\Bite Me Baby\e2e\_r67_chat_live.log"