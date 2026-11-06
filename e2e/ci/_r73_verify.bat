@echo off
REM R73b verify — local replica ของ CI legacy-contract stage (night-state repro + fix verify)
REM ใช้: cmd /c e2e\ci\_r73_verify.bat   (path มีช่องว่าง จึงต้องรันผ่านไฟล์นี้)
cd /d "D:\A PROJECT\Bite Me Baby"
git show HEAD:e2e/contracts_017_018.sql > e2e\ci\_r73_old_017_018.sql
node e2e\ci\normalize_lf.cjs e2e\ci\_r73_verify.sh
node e2e\ci\normalize_lf.cjs e2e\ci\_r73_old_017_018.sql
docker rm -f bmb-pg 2>nul
docker run -d --name bmb-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bmb_contract -v "D:\A PROJECT\Bite Me Baby:/mnt/repo" postgres:16
timeout /t 6 /nobreak >nul
docker exec bmb-pg pg_isready -U postgres
docker exec bmb-pg bash /mnt/repo/e2e/ci/_r73_verify.sh
echo VERIFY_EXIT=%ERRORLEVEL%
docker exec bmb-pg cat /tmp/verify.log > e2e\_r73_verify.log 2>nul
docker rm -f bmb-pg
echo VERIFY_DONE