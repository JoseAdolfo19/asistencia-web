@echo off
REM Rota el log: conserva solo la ejecucion anterior
if exist "C:\xampp\htdocs\ieslasalle-web\backups\backup.log" (
  copy /y "C:\xampp\htdocs\ieslasalle-web\backups\backup.log" "C:\xampp\htdocs\ieslasalle-web\backups\backup.log.prev" > nul
  del "C:\xampp\htdocs\ieslasalle-web\backups\backup.log"
)
"C:\Program Files\nodejs\node.exe" "C:\xampp\htdocs\ieslasalle-web\scripts\backup.js" > "C:\xampp\htdocs\ieslasalle-web\backups\backup.log" 2>&1
