@echo off
REM W-1 fresh replay — host wrapper (path มีช่องว่าง จึงต้องรันผ่านไฟล์นี้)
cd /d "D:\A PROJECT\Bite Me Baby"
node e2e\ci\normalize_lf.cjs e2e\ci\w1_fresh_replay.sh
docker rm -f bmb_replay_w1 2>nul
docker run -d --name bmb_replay_w1 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bmb_replay -v "D:\A PROJECT\Bite Me Baby:/mnt/repo" postgres:17
timeout /t 6 /nobreak >nul
docker exec bmb_replay_w1 pg_isready -U postgres
docker exec bmb_replay_w1 bash /mnt/repo/e2e/ci/w1_fresh_replay.sh
echo REPLAY_EXIT=%ERRORLEVEL%