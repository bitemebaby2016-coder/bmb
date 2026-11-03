@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node "e2e\r61PromoUi.cjs" > "e2e\r61_promoui.log" 2>&1
echo DONE > "e2e\r61_promoui.done"
