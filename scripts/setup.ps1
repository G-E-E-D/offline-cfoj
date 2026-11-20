$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Offline CFOJ Windows Setup ===" -ForegroundColor Cyan

# 1. Check Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    throw "Node.js is not installed or not in PATH. Install Node.js v22.5+ (v24 recommended)."
}
$nodeVer = (& node --version).Trim()
Write-Host "[1/4] Node.js detected: $nodeVer ($($nodeCmd.Source))" -ForegroundColor Green

# 2. Check Go & build Windows AppContainer + Job Object sandbox runner
$goCmd = Get-Command go -ErrorAction SilentlyContinue
if (-not $goCmd) {
    throw "Go toolchain not found in PATH. Install Go 1.22+ to build bin\cfoj-sandbox.exe."
}
$goVer = (& go version).Trim()
Write-Host "[2/4] Go detected: $goVer" -ForegroundColor Green

New-Item -ItemType Directory -Force "$Root\bin" | Out-Null
Push-Location "$Root\sandbox"
try {
    & go vet .
    & go build -o "$Root\bin\cfoj-sandbox.exe" .
} finally {
    Pop-Location
}
if (-not (Test-Path "$Root\bin\cfoj-sandbox.exe")) {
    throw "Failed to build bin\cfoj-sandbox.exe"
}
Write-Host "      Built sandbox runner: $Root\bin\cfoj-sandbox.exe" -ForegroundColor Green

# 3. Check GNU C++23 compiler (MinGW-w64 g++)
$gppPath = if ($env:CFOJ_GPP_BIN) { $env:CFOJ_GPP_BIN } elseif (Test-Path "C:\YX\mingw64\bin\g++.exe") { "C:\YX\mingw64\bin\g++.exe" } else { (Get-Command g++ -ErrorAction SilentlyContinue).Source }
if (-not $gppPath -or -not (Test-Path $gppPath)) {
    throw "GNU C++23 compiler (g++.exe) not found. Install MinGW-w64 GCC 14+ (e.g. C:\YX\mingw64\bin\g++.exe) or set CFOJ_GPP_BIN."
}
$gppVer = (& $gppPath --version | Select-Object -First 1).Trim()
Write-Host "[3/4] GNU C++23 compiler detected: $gppVer ($gppPath)" -ForegroundColor Green

# 4. Register AppContainer profiles and ensure compiler directory has Read & Execute ACL for CFOJ.Compile
$compileSid = (& "$Root\bin\cfoj-sandbox.exe" check CFOJ.Compile).Trim()
$runSid = (& "$Root\bin\cfoj-sandbox.exe" check CFOJ.Run).Trim()
Write-Host "[4/4] AppContainer profiles verified:" -ForegroundColor Green
Write-Host "      CFOJ.Compile => $compileSid"
Write-Host "      CFOJ.Run     => $runSid"

$toolchainRoot = Split-Path -Parent (Split-Path -Parent $gppPath)
Write-Host "      Ensuring CFOJ.Compile has Read & Execute access to $toolchainRoot ..."
& "$Root\bin\cfoj-sandbox.exe" grant CFOJ.Compile rx $toolchainRoot | Out-Null

Write-Host ""
Write-Host "Setup complete! Start Offline CFOJ with:" -ForegroundColor Cyan
Write-Host "  node .\src\server.mjs" -ForegroundColor Yellow
