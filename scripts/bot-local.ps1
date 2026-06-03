# ============================================================================
# Bot SIGSA local + túnel gratis (sin Docker, sin tarjeta).
# Corre el endpoint /api/sigsa/declarar usando el Google Chrome instalado y lo
# expone con un túnel cloudflared (URL pública gratuita *.trycloudflare.com).
#
# Uso:   powershell -ExecutionPolicy Bypass -File scripts\bot-local.ps1
# Frenar: Ctrl+C (corta el túnel y el server).
#
# La URL que imprime va en Vercel como NEXT_PUBLIC_BOT_URL (Settings → Env Vars),
# luego redeploy. OJO: la URL de trycloudflare cambia cada vez que reiniciás el
# túnel; para una URL estable gratis usá un "named tunnel" de Cloudflare (requiere
# cuenta + dominio). Ver DEPLOY.md.
#
# Nota: la automatización SIGSA (navegar/subir archivo) todavía es placeholder en
# src/lib/sigsa-bot.ts; el bot llega hasta el login de AFIP y falla en el paso SIGSA.
# ============================================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 1. Build si falta
if (-not (Test-Path "$root\.next")) {
  Write-Host "==> Building (npm run build)..." -ForegroundColor Cyan
  npm run build
}

# 2. cloudflared portable (se baja una vez)
$cf = "$env:TEMP\cloudflared.exe"
if (-not (Test-Path $cf)) {
  Write-Host "==> Descargando cloudflared..." -ForegroundColor Cyan
  Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cf -UseBasicParsing
}

# 3. Arrancar el bot con el Chrome del sistema
$env:BOT_CHROME_CHANNEL = "chrome"
$env:PORT = "3000"
Write-Host "==> Arrancando el bot en http://localhost:3000 (Chrome del sistema)..." -ForegroundColor Cyan
$bot = Start-Process -FilePath "cmd" -ArgumentList "/c", "npm start" -PassThru -WindowStyle Hidden

# Esperar a que levante
for ($i = 0; $i -lt 30; $i++) {
  try { Invoke-WebRequest "http://localhost:3000/api/sigsa/declarar" -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep 1 }
}
Write-Host "==> Bot listo (PID $($bot.Id))." -ForegroundColor Green

# 4. Túnel (foreground; imprime la URL pública y queda corriendo)
Write-Host "==> Levantando túnel cloudflared. Copiá la URL https://...trycloudflare.com a NEXT_PUBLIC_BOT_URL en Vercel." -ForegroundColor Yellow
try {
  & $cf tunnel --url http://localhost:3000 --no-autoupdate
} finally {
  Write-Host "==> Cerrando el bot..." -ForegroundColor Cyan
  Stop-Process -Id $bot.Id -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*next*start*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
