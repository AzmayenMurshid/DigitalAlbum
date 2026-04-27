$ErrorActionPreference = "Stop"

$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $backendDir
$envFile = Join-Path $backendDir ".env"
$imageName = "digitalalbum-backend"
$containerName = "digitalalbum-backend"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker CLI not found. Install Docker Desktop first."
}

if (-not (Test-Path $envFile)) {
  Write-Error "Missing .env file in backend folder. Copy .env.example to .env and set DATABASE_URL."
}

$dockerReady = $true
try {
  cmd /c "docker info >nul 2>&1"
  if ($LASTEXITCODE -ne 0) {
    $dockerReady = $false
  }
} catch {
  $dockerReady = $false
}

if (-not $dockerReady) {
  Write-Error "Docker daemon is not running. Start Docker Desktop and retry."
}

Write-Host "Building Docker image..." -ForegroundColor Cyan
docker build -t $imageName $backendDir
if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker build failed. Resolve the build error and retry."
}

Write-Host "Removing old container (if any)..." -ForegroundColor Cyan
cmd /c "docker rm -f $containerName >nul 2>&1"

Write-Host "Starting container on http://localhost:3001 ..." -ForegroundColor Green
docker run --name $containerName --rm -p 3001:3001 --env-file $envFile $imageName
if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker run failed. Check container logs and configuration."
}
