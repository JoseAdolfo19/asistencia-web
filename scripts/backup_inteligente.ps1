# ============================================================
# Backup inteligente - IES La Salle
# - Omite el respaldo si ya existe uno valido reciente (< MaxHoras)
# - Reintenta hasta $Reintentos veces si falla
# - Registra todo en backups\backup.log (con rotacion)
# ============================================================
param(
  [int]$MaxHoras = 9,     # horas de vigencia de un backup valido
  [int]$Reintentos = 3    # intentos antes de rendirse
)

$raiz    = Split-Path -Parent $PSScriptRoot            # ieslasalle-web
$backups = Join-Path $raiz 'backups'
$script  = Join-Path $PSScriptRoot 'backup.js'
$node    = 'C:\Program Files\nodejs\node.exe'
$log     = Join-Path $backups 'backup.log'

if (-not (Test-Path $node)) {
  $n = (Get-Command node -ErrorAction SilentlyContinue)
  if ($n) { $node = $n.Source } else { Write-Error 'node.exe no encontrado'; exit 1 }
}

function Log($msg) {
  $linea = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), ($msg -join ' ')
  Add-Content -Path $log -Value $linea -Encoding UTF8
}

# Rotar log si crece demasiado (conservar solo el anterior)
if ((Test-Path $log) -and (Get-Item $log).Length -gt 200KB) {
  Move-Item $log "$log.prev" -Force
}

# --- Buscar el ultimo backup VALIDO (>=13 archivos y >=100 KB) ---
$ultimo = Get-ChildItem $backups -Directory -Filter 'backup-*' -ErrorAction SilentlyContinue |
  Where-Object {
    $arch = Get-ChildItem $_.FullName -File -ErrorAction SilentlyContinue
    $kb = ($arch | Measure-Object Length -Sum).Sum / 1KB
    ($arch.Count -ge 13) -and ($kb -ge 100)
  } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($ultimo) {
  $edad = ((Get-Date) - $ultimo.LastWriteTime).TotalHours
  if ($edad -lt $MaxHoras) {
    Log ("OMITIDO: ya hay backup valido de hace {0:N1} h ({1})" -f $edad, $ultimo.Name)
    exit 0
  }
}

# --- Ejecutar backup con reintentos ---
for ($i = 1; $i -le $Reintentos; $i++) {
  Log ("INICIO: intento {0} de {1}" -f $i, $Reintentos)
  $salida = & $node $script 2>&1
  foreach ($l in $salida) { Log ("  {0}" -f $l) }
  if ($LASTEXITCODE -eq 0 -and $salida -match 'Backup completo') {
    Log "OK: backup completado"
    exit 0
  }
  Log ("FALLO: intento {0} (exit {1})" -f $i, $LASTEXITCODE)
  if ($i -lt $Reintentos) { Start-Sleep -Seconds 90 }
}

Log "ERROR: el backup fallo despues de $Reintentos intentos"
exit 1
