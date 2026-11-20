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
- **Windows discovery.** Both the settings page and the preparation jobs use the configured executable. With the default names, CFOJ also checks the Codex Windows app package, the standard npm shim, and the Antigravity CLI at `%LOCALAPPDATA%\agy\bin\agy.exe`. Google installs the desktop application and the headless CLI separately. [Antigravity CLI setup](https://antigravity.google/docs/cli/tutorial/)
- **Model and reasoning effort.** In **Settings & Providers**, choose a model and effort for each provider, then save. The selectors use the local Codex model catalog and the models reported by `agy models`. A custom model ID can also be entered. **Use CLI default** preserves the provider's own choice. Translation, test generation, and editorials use the saved selections.
- **Offline demo.** The fixture adapters supply prepared translations for the bundled contest 4 example. Other rounds require a real provider. If a cached translation contains copied English prose, CFOJ exposes the English original and offers regeneration. Previously prepared, valid Chinese statements remain available offline.
- **Cloudflare / Browser Extension One-Click Import (`C:\YX\ICPC\oj\extension`):**
  - By default, Offline CFOJ fetches `/contest/<id>/problems?locale=en` directly over HTTP, validates that all expected problem indices from the contest metadata are present, and caches the statements.
  - When Codeforces returns a browser challenge (`cf-mitigated: challenge`), Offline CFOJ distinguishes it from rate limiting (`429`), ordinary access denial (`403`/`401`), network failure, and parsing errors. It preserves the pending contest import (`status = 'awaiting_browser'`), binds a short-lived (15-minute), single-use token to that contest ID, and displays a bilingual **"Continue in browser" / "在浏览器中继续"** button.
  - Load the unpacked Chrome/Edge extension from `C:\YX\ICPC\oj\extension`. After completing verification in your browser so the statements are visible, click **"Send this contest to CFOJ" / "发送本场比赛至 CFOJ"** once (either from the floating button on the Codeforces page or the extension toolbar popup) to transfer only the displayed contest material to `http://127.0.0.1:4321/api/browser-import/receive` and automatically resume translation, test generation, and editorial preparation.
  - Manual HTML upload (`problems.html`) remains available as a fallback on both the Contests dashboard and the Contest page.

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
