@echo off
rem R56 — full vitest รอบเดียว (single-run ตาม rule 12.1 · เด้งออกจาก timeout 30s ของ terminal)
cd /d D:\A PROJECT\Bite Me Baby
npx vitest run > e2e\r56_vitest_full.log 2>&1
echo VITEST_EXIT=%errorlevel% >> e2e\r56_vitest_full.log