@echo off
cd /d D:\A PROJECT\Bite Me Baby
rem R78 stage-1 = CLEANUP DRY-RUN เท่านั้น (ไม่ลบอะไร) — inventory ใหม่ + แผนลบ 3 ตัว
node e2e\_r74CleanInv.cjs > e2e\_r78_inv.log 2>&1
node e2e\_r74CleanRun.cjs > nul 2>&1
node e2e\_r74CleanSweep.cjs > e2e\_r78_sweep_dry.log 2>&1
node e2e\_r74CleanResidue.cjs > nul 2>&1
echo STAGE1_DONE >> e2e\_r78_stage1.done