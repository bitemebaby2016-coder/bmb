@echo off
REM R22 deploy tenant-proxy worker — thin wrapper (Owner: ทำ deploy ให้เสร็จ ห้ามค้าง)
REM Logic ทั้งหมดอยู่ใน r22_deploy_worker.cjs (อ่าน token เอง · CI=true · timeout กันค้าง)
cd /d "D:\A PROJECT\Bite Me Baby"
node "e2e\r22_deploy_worker.cjs"
exit /b %ERRORLEVEL%