# Offline CFOJ — Local Codeforces Practice & Virtual Contest Judge for Windows

Offline CFOJ is a self-contained local Codeforces practice judge and virtual contest platform for Windows. It lets a competitive programmer import a finished Codeforces round by numeric Contest ID, prepare bilingual (English and Simplified Chinese) statements, generate and validate local test suites (50+ distinct generated cases per ordinary batch problem, or exhaustive coverage for finite domains), compile and judge **GNU C++23** solutions inside a network-disabled Windows **AppContainer + Job Object** sandbox, take virtual contests offline, and read whole-round Markdown editorials (`editorial.en.md` and `editorial.zh-CN.md`).

---

## 1. Windows Prerequisites

- **Operating System:** Windows 10 / 11 (x64) with standard AppContainer and Job Object support.
- **Node.js:** v22.5+ (v24.18.0 tested; uses built-in `node:sqlite`, `node:http`, and native ES modules with zero external runtime npm packages required).
- **Go:** Go 1.22+ (Go 1.27.3 tested; builds `bin\cfoj-sandbox.exe`).
- **GNU C++23 Toolchain:** MinGW-w64 GCC 14+ (`C:\YX\mingw64\bin\g++.exe`, GCC 15.1.0 tested). Solutions compile with:
  ```text
  g++ -std=gnu++23 -O2 -pipe -static -s -Wl,--stack=67108864 -o solution.exe solution.cpp -lstdc++exp
  ```
- **AI Providers (Optional for live preparation; repeatable fixtures bundled):**
  - **OpenAI Codex CLI** (`codex`), invoked via documented non-interactive mode:
    `codex exec --skip-git-repo-check --sandbox read-only --output-schema schema.json --output-last-message result.json -`
  - **Google Antigravity CLI** (`agy`), invoked via documented headless mode:
    `agy -p - --output-format json --json-schema schema.json`

---

## 2. First-Time Setup

Run the setup script once in PowerShell from the repository root (`C:\YX\ICPC\oj`):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

What `setup.ps1` does:
1. Verifies Node.js, Go, and the MinGW-w64 GNU C++23 compiler (`g++.exe`).
2. Builds the isolated sandbox runner `bin\cfoj-sandbox.exe` from `sandbox\`.
3. Registers the capability-less Windows AppContainer profiles `CFOJ.Compile` and `CFOJ.Run` (which have zero network capabilities and zero access to user files outside their explicitly granted scratch directories).
4. Grants `CFOJ.Compile` Read & Execute (`RX`) access to the MinGW toolchain directory (`C:\YX\mingw64`) so `g++` can run inside the compiler AppContainer.

---

## 3. Single PowerShell Startup Command (After Setup)

After setup, start the entire web application and local judge with a single command:

```powershell
node .\src\server.mjs
```

*(Or `powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1`)*

Then open **http://127.0.0.1:4321** in your browser. All frontend scripts, stylesheets, fonts (`geist-*.woff2`, `KaTeX_*.woff2`), code editor, and math renderer (`KaTeX`) are bundled locally under `public/` and require zero external requests.

---

## 4. AI Provider Configuration

Provider credentials always remain with their respective CLI tools (`codex login` or interactive `agy` login).

- In the web UI under **Settings & Providers** (`#/settings`), select either **OpenAI Codex (`codex exec`)** or **Google Antigravity (`agy -p`)** and configure the executable path (`codex` / `agy`), or set environment variables before starting:
  ```powershell
  $env:CFOJ_CODEX_BIN = "codex"
  $env:CFOJ_AGY_BIN   = "agy"
  ```
- Each AI job runs inside an isolated temporary directory containing only `problem-materials.json` and `schema.json` for that single problem task. Structured outputs are schema-validated before saving.
- **Repeatable Fixture Adapters:** When `codex` or `agy` is not installed or signed in, Offline CFOJ includes repeatable CLI fixture executables (`fixtures\providers\mock-codex.cmd` and `fixtures\providers\mock-agy.cmd`) that speak the exact `codex exec` and `agy -p` CLI flags and JSON schemas, plus deterministic failure injection via `CFOJ_MOCK_PROVIDER_FAIL` (`auth_error`, `version_error`, `malformed_json`, `corrupt_fragments`, `oracle_disagreement`).
- **Cloudflare / Offline HTML Import Fallback:** If Codeforces gates `/contest/<id>/problems` behind an anti-bot challenge, Offline CFOJ never attempts to bypass the CAPTCHA; you can save the contest problems page (`Ctrl+S`) from your own browser and upload the `.html` file directly in the **Import a Round** card, or use the bundled offline fixture (`fixtures\codeforces\contest4\`).

---

## 5. Data Location & Backup

All user state, contest materials, localized assets,editorials, and versioned test packages are stored under:

```text
C:\YX\ICPC\oj\data\
├── cfoj.sqlite                                  # SQLite database (WAL mode): contests, problems, test_packages, submissions, drafts, virtual_participations, settings
└── contests\
    └── <contestId>\                             # e.g. C:\YX\ICPC\oj\data\contests\4\
        ├── editorial.en.md                      # Whole-round English Markdown editorial (with TOC & #problem-A..D sections)
        ├── editorial.zh-CN.md                   # Whole-round Simplified Chinese Markdown editorial (with TOC & relative assets)
        ├── assets\                              # Localized diagrams and illustrations (e.g. 4a-watermelon.svg, 4d-envelopes.svg)
        ├── cache\                               # Cached API standings JSON, problems HTML, tutorial HTML
        └── problems\
            └── <index>\                         # e.g. A, B, C, D
                ├── statement.en.json            # Preserved English statement + protected fragments
                ├── statement.zh-CN.json         # Validated Simplified Chinese statement
                ├── editorial.section.json       # Problem editorial metadata & solution verification report
                └── packages\
                    └── rev-<N>\                 # Atomically published test package revision
                        ├── manifest.json        # Test cases & checker rule
                        ├── seeds.json           # Deterministic generator seeds & categories
                        ├── validation.json      # Validator, checker self-test, oracle cross-check & wrong-solution report
                        ├── checker.exe          # Compiled semantic checker (for multi-answer problems such as 4B, 4D)
                        ├── src\                 # Saved generator.cpp, validator.cpp, reference.cpp, oracle.cpp, checker.cpp
                        ├── wrong_solutions\     # Representative incorrect C++23 solutions rejected during validation
                        └── tests\               # *.in and *.ans test files
```

To back up your entire practice history, drafts, virtual contests, and prepared rounds, back up the **`C:\YX\ICPC\oj\data`** directory.
