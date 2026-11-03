@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
node "D:\A PROJECT\Bite Me Baby\e2e\r63ImageSweep.cjs" --root=ai-generated > "D:\A PROJECT\Bite Me Baby\e2e\r63_sweep_audit.log" 2>&1
node "D:\A PROJECT\Bite Me Baby\e2e\r63ImageSweep.cjs" --root=uploads >> "D:\A PROJECT\Bite Me Baby\e2e\r63_sweep_audit.log" 2>&1