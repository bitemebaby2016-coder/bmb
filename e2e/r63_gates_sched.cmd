@echo off
schtasks /create /tn r63_gates /tr "D:\A PROJECT\Bite Me Baby\e2e\r63_gates.cmd" /sc once /st 00:00 /f
schtasks /run /tn r63_gates
echo SCHEDULED_R63_GATES