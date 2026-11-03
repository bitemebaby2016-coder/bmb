@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node "e2e\r61ImageGenSmoke.cjs" > "e2e\r61ImageGenSmoke.log" 2>&1
echo DONE > "e2e\r61ImageGenSmoke.done"
