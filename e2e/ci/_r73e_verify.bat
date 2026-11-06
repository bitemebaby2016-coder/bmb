@echo off
REM R73e verify — ปิดคลาส UTC/BKK date gate ของสายโปรโมชัน (m190 + night-sim + guard)
REM ใช้: cmd /c e2e\ci\_r73e_verify.bat   (path มีช่องว่าง จึงต้องรันผ่านไฟล์นี้)
cd /d "D:\A PROJECT\Bite Me Baby"
node e2e\ci\normalize_lf.cjs e2e\ci\_r73e_verify.sh
node e2e\ci\normalize_lf.cjs e2e\ci\_r73_verify.sh
node e2e\ci\normalize_lf.cjs e2e\contracts_190_bkk_date_gates.sql
node e2e\ci\normalize_lf.cjs e2e\ci\_r73_old_017_018.sql
node e2e\ci\_r73e_mk190.cjs
node e2e\ci\_r73e_mk191.cjs
node e2e\ci\_r73g_mk193.cjs
del e2e\_r73e_verify_progress.log 2>nul
docker rm -f bmb-pg 2>nul
docker run -d --name bmb-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bmb_contract -v "D:\A PROJECT\Bite Me Baby:/mnt/repo" postgres:16
ping -n 8 127.0.0.1 >nul
docker exec bmb-pg pg_isready -U postgres
docker exec -d bmb-pg bash /mnt/repo/e2e/ci/_r73e_verify.sh
echo R73E_EXEC_DETACHED
:wait
ping -n 6 127.0.0.1 >nul
findstr /c:"R73E_VERIFY" e2e\_r73e_verify_progress.log >nul 2>&1
if %ERRORLEVEL%==0 goto collect
echo ...waiting
goto wait
:collect
docker exec bmb-pg cat /tmp/verify.log > e2e\_r73e_verify.log 2>nul
type e2e\_r73e_verify_progress.log >> e2e\_r73e_verify.log 2>nul
docker rm -f bmb-pg
echo VERIFY_DONE