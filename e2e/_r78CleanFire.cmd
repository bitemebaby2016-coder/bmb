@echo off
cd /d D:\A PROJECT\Bite Me Baby
rem R78 stage-2 = CLEANUP FIRE (ลบออเดอร์เทสต์ 4 ใบรอบ 18:19 + children + sweep + residue · backup ก่อนเสมอ)
node e2e\_r74CleanRun.cjs --fire > nul 2>&1
node e2e\_r74CleanSweep.cjs --fire > e2e\_r78_sweep_fire.log 2>&1
node e2e\_r74CleanResidue.cjs --fire > nul 2>&1
echo STAGE2_DONE >> e2e\_r78_stage2.done