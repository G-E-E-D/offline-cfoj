$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path "$Root\bin\cfoj-sandbox.exe")) {
    & powershell -ExecutionPolicy Bypass -File "$Root\scripts\setup.ps1"
}

& node "$Root\src\server.mjs"
