@echo off
cd /d "d:\A PROJECT\Bite Me Baby"
npx tsc --noEmit -p tsconfig.json > e2e\_r66b_tsc.log 2>&1
echo EXIT=%errorlevel% >> e2e\_r66b_tsc.log