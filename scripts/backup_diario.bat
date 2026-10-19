@echo off
REM Respaldo de Supabase con reintentos y omision de duplicados.
REM Toda la logica vive en backup_inteligente.ps1; el log esta en backups\backup.log
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\xampp\htdocs\ieslasalle-web\scripts\backup_inteligente.ps1"
