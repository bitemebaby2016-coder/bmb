@echo off
REM W-2 full replay — host wrapper (path มีช่องว่าง จึงต้องรันผ่านไฟล์นี้)
cd /d "D:\A PROJECT\Bite Me Baby"
node e2e\ci\normalize_lf.cjs e2e\ci\w2_fresh_replay_full.sh
docker rm -f bmb_replay_w2 2>nul
docker run -d --name bmb_replay_w2 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bmb_replay -v "D:\A PROJECT\Bite Me Baby:/mnt/repo" postgres:16
timeout /t 8 /nobreak >nul
docker exec bmb_replay_w2 pg_isready -U postgres
docker exec bmb_replay_w2 bash /mnt/repo/e2e/ci/w2_fresh_replay_full.sh
echo REPLAY_EXIT=%ERRORLEVEL%
