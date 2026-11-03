@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node node_modules\vitest\vitest.mjs run > "D:\A PROJECT\Bite Me Baby\e2e\r61_vitest_full.log" 2>&1
echo DONE > "D:\A PROJECT\Bite Me Baby\e2e\r61_vitest_full.done"
