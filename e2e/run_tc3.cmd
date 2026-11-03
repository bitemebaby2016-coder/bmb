@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node "e2e\tProdProbe.cjs" --only=T-C3 > "e2e\r61_tc3.log" 2>&1
echo DONE > "e2e\r61_tc3.done"
