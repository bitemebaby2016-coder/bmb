@echo off
REM R28 — ล้างคิวพิมพ์ค้าง (งาน Error ค้างขวาง) — รันคลิกขวา "Run as administrator"
REM ใช้เมื่อ: คิวขึ้น Error 556KB ค้าง / พิมพ์ใหม่ไม่ออก / รีสตารทแล้วยังไม่หาย
net stop spooler /y
del /q /f "%SystemRoot%\System32\spool\PRINTERS\*.*" 2>nul
net start spooler
echo SPOOLER_CLEARED - เปิดคิวอีกครั้งต้องว่าง แล้วทดสอบสติกเกอร์ใหม่
pause
