@echo off
REM r33 — ยิงสคริปต์ซ่อมพอร์ตปริ้นเตอร์แบบ elevated (ดับเบิลคลิกได้เอง หรือเรียกจากโปรเซสอื่น)
REM หน้าที่ Owner: กด "Yes" ที่ UAC ที่เด้งขึ้นมา แล้วรอ ~15 วิ (ผล = e2e\r33_out.txt)
start "r33-elevated" powershell -NoProfile -Command "Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','D:\A PROJECT\Bite Me Baby\e2e\r33_fix.ps1' -Verb RunAs"
echo LAUNCHED_DETACHED
