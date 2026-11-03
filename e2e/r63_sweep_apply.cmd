@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node "D:\A PROJECT\Bite Me Baby\e2e\r63ImageSweep.cjs" --root=ai-generated --apply > "D:\A PROJECT\Bite Me Baby\e2e\r63_sweep_apply.log" 2>&1
node "D:\A PROJECT\Bite Me Baby\e2e\r63ImageSweep.cjs" --root=uploads --apply >> "D:\A PROJECT\Bite Me Baby\e2e\r63_sweep_apply.log" 2>&1