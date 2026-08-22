$ErrorActionPreference = 'Stop'

Write-Host 'Preparing Windows environment for SUIT PRO London POS...'

$executionPolicy = Get-ExecutionPolicy -Scope Process
if ($executionPolicy -ne 'RemoteSigned' -and $executionPolicy -ne 'Bypass') {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force
}

$venvPath = Join-Path $PSScriptRoot '..\.venv\Scripts\Activate.ps1'
if (Test-Path $venvPath) {
  & $venvPath
  Write-Host 'Python virtual environment activated.'
} else {
  Write-Host 'No Python virtual environment found; continuing with Node setup.'
}

npm install
npm run build
Write-Host 'Windows setup completed. You can now run npm run electron:start or npm run electron:pack.'
