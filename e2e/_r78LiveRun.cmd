@echo off
cd /d D:\A PROJECT\Bite Me Baby
rem R78 — live deploy check (deep scan เกิน 30s command timeout → detached)
node e2e\_r78LiveCheck.cjs > e2e\_r78_live_check.log 2>&1
echo LIVE_DONE >> e2e\_r78_live.done