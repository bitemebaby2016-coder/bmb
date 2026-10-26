@echo off
REM W-1 — เตรียม container replay สะอาด (ไม่รัน migration เอง ใช้ w1_fresh_replay.sh)
cd /d "D:\A PROJECT\Bite Me Baby"
node e2e\ci\normalize_lf.cjs e2e\ci\w1_fresh_replay.sh
docker rm -f bmb_replay_w1 2>nul
docker run -d --name bmb_replay_w1 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bmb_replay -v "D:\A PROJECT\Bite Me Baby:/mnt/repo" postgres:17
docker inspect --format "{{.State.Status}}" bmb_replay_w1
docker exec bmb_replay_w1 bash -c "for i in $(seq 1 30); do pg_isready -U postgres && exit 0; sleep 1; done; exit 1"
echo SETUP_DONE