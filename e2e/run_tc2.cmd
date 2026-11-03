@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node "e2e\tProdProbe.cjs" --only=T-C2 > "e2e\r61_tc2.log" 2>&1
echo DONE > "e2e\r61_tc2.done"
