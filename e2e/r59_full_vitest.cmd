@echo off
rem R59 — full vitest รอบเดียว (single-run ตาม rule 12.1)
cd /d D:\A PROJECT\Bite Me Baby
npx vitest run > e2e\r59_vitest_full.log 2>&1
echo VITEST_EXIT=%errorlevel% >> e2e\r59_vitest_full.log