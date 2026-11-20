$ErrorActionPreference = 'Stop'
cd c:\YX\ICPC\oj
$t = "c:\YX\ICPC\oj\data\tmp\t1"
Remove-Item -Recurse -Force $t -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $t | Out-Null
Set-Content -Encoding ascii "$t\a.cpp" @'
#include <bits/stdc++.h>
int main(){
    long long w;
    if (!(std::cin >> w)) return 1;
    std::println("{}", (w % 2 == 0 && w > 2) ? "YES" : "NO");
    FILE* f = fopen("C:/YX/ICPC/oj/prompt.md", "r");
    std::println(stderr, "read prompt: {}", f ? "yes" : "no");
}
'@
Set-Content -Encoding ascii "$t\in.txt" "8"

$compileSpec = @{
    container = 'CFOJ.Compile'
    args = @(
        'C:\YX\mingw64\bin\g++.exe',
        '-std=gnu++23', '-O2', '-pipe', '-static', '-Wl,--stack=268435456',
        '-o', "$t\a.exe", "$t\a.cpp", '-lstdc++exp'
    )
    cwd = $t
    env = @("PATH=C:\YX\mingw64\bin;C:\Windows\System32", "TEMP=$t", "TMP=$t")
    stdoutFile = "$t\compile.out"
    stderrFile = "$t\compile.err"
    timeLimitMs = 15000
    wallLimitMs = 30000
    memoryLimitBytes = 1073741824
    maxProcesses = 16
    outputLimitBytes = 1048576
    grantRW = @($t)
} | ConvertTo-Json -Compress

Write-Host "=== COMPILE ==="
$compileSpec | .\bin\cfoj-sandbox.exe run
if (Test-Path "$t\compile.err") { Get-Content "$t\compile.err" }

$runSpec = @{
    container = 'CFOJ.Run'
    args = @("$t\a.exe")
    cwd = $t
    env = @("SystemRoot=C:\Windows")
    stdinFile = "$t\in.txt"
    stdoutFile = "$t\out.txt"
    stderrFile = "$t\err.txt"
    timeLimitMs = 1000
    memoryLimitBytes = 268435456
    maxProcesses = 1
    outputLimitBytes = 1000000
    grantRW = @($t)
} | ConvertTo-Json -Compress

Write-Host "=== RUN ==="
$runSpec | .\bin\cfoj-sandbox.exe run
Get-Content "$t\out.txt"
Get-Content "$t\err.txt"
