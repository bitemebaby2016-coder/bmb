@echo off
echo ==== %1 ====
findstr /C:"Test Files" "%~1"
findstr /C:"failed" "%~1" | findstr /V /C:"0 failed"
findstr /C:"EXIT=" "%~1"
