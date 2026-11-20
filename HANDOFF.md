# Offline CFOJ: Handoff

Paused 2026-11-20 17:23 (+08:00). The specification and acceptance checklist are in [prompt.md](prompt.md).
This document covers everything that was done before the pause. **The project is at a very early stage.** Only a prototype of the
Windows judge sandbox exists, and it doesn't work yet.

---

## 1. Current state

| Item | Value |
|---|---|
| Branch | `main` (no remote is configured) |
| Latest commit | `54d56cf` "Document requirements and acceptance tests for Offline CFOJ". It only adds `prompt.md`. **No implementation has been committed.** |
| Uncommitted work | All untracked, and all left as-is on purpose (see below) |

Untracked files that matter:

| Path | What it is | Keep in Git? |
|---|---|---|
| `sandbox/go.mod`, `sandbox/main.go`, `sandbox/win.go` | Go source for `cfoj-sandbox.exe`, the isolated runner (AppContainer + Job Object). Builds with Go 1.27. | **Yes.** Commit once the AppContainer launch works. |
| `sandbox/smoke-test.ps1` | Manual smoke test: compiles a C++23 program with MinGW, then runs it through the sandbox | Yes, or replace it with a proper test |
| `fixtures/codeforces/contest4/contest.standings.json` | **Real** response from `https://codeforces.com/api/contest.standings?contestId=4`, fetched live on 2026-11-20 (159 KB). It has the contest metadata (ICPC, 7200 s), problems A–D with ratings and tags, and 282 historical standings rows. | Yes. This is the small, repeatable offline fixture. |
| `bin/cfoj-sandbox.exe` | Build output | **No.** Add `bin/` to `.gitignore`. |
| `data/tmp/t1/*` | Scratch output from the smoke test | **No.** Add `data/` to `.gitignore`. |

There is no `.gitignore`, `package.json`, README, web app, backend, or database yet.

### Changes made outside the repository (important)

1. **ACL change on the compiler directory.** `bin\cfoj-sandbox.exe grant CFOJ.Compile rx C:\YX\mingw64` was run outside the agent sandbox. It added an inheritable Read & Execute ACE for AppContainer SID
   `S-1-15-2-1441906141-3374960700-369273073-2681791740-2176939068-1899757088-3823107829` (profile `CFOJ.Compile`) to all 13,756 files under `C:\YX\mingw64`.
   This lets a compiler running inside the AppContainer read the toolchain. To revert:
   `icacls C:\YX\mingw64 /remove *S-1-15-2-1441906141-3374960700-369273073-2681791740-2176939068-1899757088-3823107829 /T`
2. **AppContainer profiles registered for the current user:** `CFOJ.Run`, `CFOJ.Compile`, `CFOJ.Check`. They are harmless. To remove one, call `DeleteAppContainerProfile` or delete it under `HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Mappings`.

---

## 2. Feature status (checklist from prompt.md)

| prompt.md area | Status | Notes / files |
|---|---|---|
| Local GNU C++23 compile | **Works outside the sandbox only** | MinGW-w64 GCC 15.1.0 at `C:\YX\mingw64\bin\g++.exe`. Working flags: `g++ -std=gnu++23 -O2 -pipe -static -Wl,--stack=268435456 -o a.exe a.cpp -lstdc++exp`. `-lstdc++exp` is **required** for `std::print`/`std::println` with GCC 15 on MinGW; without it, linking fails with undefined `std::__open_terminal`. |
| Isolated runner: Job Object limits (CPU and wall time, committed memory, process count, output limit, UI restrictions, kill-on-close, tree cleanup, MLE via `JOB_OBJECT_MSG_JOB_MEMORY_LIMIT` completion-port messages) | **Partial: works with `noContainer:true`** | [sandbox/main.go](sandbox/main.go). Result for sample `8`: `{"status":"OK","cpuMs":15,"wallMs":19,"peakMemoryBytes":1970176}`, with output `YES`. TLE, MLE, OLE, and RE paths are written but **untested**. |
| Isolated runner: AppContainer (no network, no user-file access) | **Broken (current blocker)** | `CreateProcessW` with `PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES` fails both inside and outside the agent sandbox. It reports error 203 ("The system could not find the environment option"), which is probably a stale `GetLastError`. See section 5. |
| ACL helper (`grant <container or SID> <rx or rw> <paths>`) | Works | [sandbox/win.go](sandbox/win.go): `grantPath`, `hasAllowAce`, `parseSid` |
| Codeforces API import | Probe only; no code yet | `contest.standings?contestId=<id>` works anonymously **only with no extra parameters**. With `from` or `count`, the API returns HTTP 400 for non-gym contests. That one call returns contest info, problems, and historical standings. Respect the 1 request per 2 s rate limit. |
| Statement HTML fetch | **Blocked** | The first request to `/contest/4/problems` returned 200. All later HTML requests (`/contest/4`, `/contest/4/problems`, `/contest/4/problem/A`) returned **403 Cloudflare "Just a moment..." managed challenge** pages. **Do not bypass this** (no spoofed browser headers, mirror switching, or automated waiting). Planned design: detect the challenge page and mark the problem "blocked by Codeforces anti-bot check". Offer two repair actions: (a) a retry started by the user, (b) **upload a page the user saved from their own browser** (Ctrl+S on `/contest/<id>/problems`), parsed by the same code path. |
| Statement parse/sanitize/assets/KaTeX, translation, AI providers (Codex `codex exec`, Antigravity `agy -p`), test generation and validation, checkers, editorials (`editorial.en.md` / `editorial.zh-CN.md`), submissions DB, queue, practice, VP, bilingual UI, README, setup and start scripts | **Pending (no code)** | See the plan in section 5 |

---

## 3. How to run what works today

Prerequisites found on this PC: Windows, Node v24.18.0 (`npm.ps1` is blocked by the execution policy, so call `npm.cmd`), Go 1.27.3, MinGW-w64 GCC 15.1.0 at `C:\YX\mingw64`, Edge, and Chrome.
Not available: WSL distro, Docker, Python (only the Store stub), `codex`, and `agy`. Neither provider CLI is installed.

```powershell
cd C:\YX\ICPC\oj\sandbox
go build -o ..\bin\cfoj-sandbox.exe .
cd ..
.\bin\cfoj-sandbox.exe check CFOJ.Run              # prints the AppContainer SID (works)
powershell -ExecutionPolicy Bypass -File .\sandbox\smoke-test.ps1
#   compiles data\tmp\t1\a.cpp with g++ -std=gnu++23, then runs it via the sandbox.
#   Currently prints status FAIL (AppContainer CreateProcess). To see the Job-Object-only path work,
#   add  noContainer=$true  to the $spec hashtable in the script; expected output: OK ... YES
```

Runner protocol: `cfoj-sandbox run` reads a JSON spec on stdin. The fields are `container, args[], cwd, env[], stdinFile, stdoutFile, stderrFile, timeLimitMs, wallLimitMs, memoryLimitBytes, maxProcesses, outputLimitBytes, stderrLimitBytes, grantRW[], noContainer`. It prints a single JSON result with `status` (`OK|RE|TLE|MLE|OLE|FAIL`), `exitCode, cpuMs, wallMs, peakMemoryBytes, outputBytes, detail, containerSid`.

There is no web app to start yet.

---

## 4. Verification

| Check | Result |
|---|---|
| prompt.md acceptance steps 1–5 | **None have run.** No application exists yet. |
| Codeforces API (live) | Ran: `contest.standings?contestId=4` → 200, saved as a fixture |
| Codeforces statement pages (live) | Ran: blocked by the Cloudflare challenge after the first request (see above). Nothing parseable was saved. |
| C++23 compile with MinGW (`std::println`, `-lstdc++exp`) | Ran: success |
| Job Object runner, sample `8` for 4A → `YES` | Ran with `noContainer:true`: OK |
| AppContainer runner | Ran: **fails** (CreateProcess) |
| OpenAI Codex / Google Antigravity adapters | **Not tested.** Neither CLI is installed or authenticated, so live integration isn't possible on this machine for now. Plan: test both adapters with fixture executables for success and failure paths, and report the live ones as not exercised. |

Nothing has been tested with fixtures yet beyond what's listed above.

---

## 5. How to resume

### Exact task at pause
Getting the first sandboxed C++23 run to work (milestone 1: one submission compiles and gets a real verdict locally).
`run()` in [sandbox/main.go](sandbox/main.go) fails at `procCreateProcessW.Call(...)` when the AppContainer security-capabilities attribute is present. It works without it.

### Debugging leads for the AppContainer CreateProcess failure
1. Check each `procUpdateProcThreadAttribute.Call` return value. The **handle-list** call is currently unchecked. Log the real error from every call. `Proc.Call`'s third return value is always set, so trust it only when `r == 0`.
2. Suspect `startupInfoEx` layout: it embeds `syscall.StartupInfo`. Check that `unsafe.Sizeof(si)` is 112 on amd64, and that `Cb` gets that value.
3. Suspect that `env` lacks variables AppContainer processes need. Try passing `nil` (inherit the parent environment) to isolate the problem. Then build the env block with `SystemRoot`, `SystemDrive`, `PATH`, `TEMP`, and `TMP`.
4. Try without `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`, keeping only security capabilities, to see which attribute breaks.
5. Make sure the exe and its directory are readable by the container SID (`grantRW` on the scratch dir), and that every parent directory allows traverse.
6. Another limitation: the agent's own command sandbox runs at **Low integrity**. Inside it, `DeriveAppContainerSidFromAppContainerName` returns a *different (child-style, 11-subauthority)* SID than a normal process gets, and changing ACLs on medium-IL paths (such as `C:\YX\mingw64`) is denied. Normal app runs are unaffected. The `grant` command accepts a raw `S-1-15-...` SID so the extra SID can be granted from an unsandboxed shell if needed.
7. Fallback, only if AppContainer can't be made to work: keep Job Objects and add a different network block. A WSL2 container isn't possible here because no distro is installed. Document whichever single backend you choose.

### Key decisions made so far (my calls; revisit if needed)
- **Judge backend:** native Windows. MinGW-w64 GCC 15 (`-std=gnu++23 -O2 -pipe -static -Wl,--stack=268435456 … -lstdc++exp`) runs inside a capability-less **AppContainer**, which gives no network and no user files, plus a **Job Object** for limits. Separate containers: `CFOJ.Compile` (RX on the toolchain), `CFOJ.Run` (contestant programs: per-run scratch only, input through an inherited stdin handle, expected answers never in scratch), and `CFOJ.Tool` (generators, validators, checkers). Tests run one at a time. Static linking means contestant binaries need no toolchain access.
- **Planned stack:** Node 24 backend in TypeScript run through native type stripping, `node:http`, and `node:sqlite`. Frontend: React + Vite with locally bundled CodeMirror 6, KaTeX, markdown-it, and @fontsource fonts (Inter, JetBrains Mono, Noto Sans SC). Live progress over SSE.
- **Provider adapters:** write the job materials into a temp working directory and pass a short prompt argument. Avoid long or quoted arguments, because npm-installed CLIs on Windows are `.cmd` shims.
  - Codex: `codex exec --skip-git-repo-check --sandbox read-only --output-schema schema.json -o result.json "<prompt>"` with cwd set to the job dir.
  - Antigravity: `agy -p "<prompt>" --output-format json --json-schema schema.json`, then read `structured_output` and check `status`.
  - Both: validate the JSON before saving it. Test with fake provider executables under `fixtures/providers/`.
- **Offline fixture for contest 4:** the real API JSON (already saved), plus a problems-page HTML fixture in Codeforces statement markup. Because live HTML is challenge-gated, the fixture HTML would have to come from a page the user saves in their own browser, or be reconstructed. **If you reconstruct it, label it as such.**
- **Checkers:** own protocol `checker input output answer` (exit 0 = OK, 1 = WA, anything else = judge failure). 4B and 4D need semantic checkers. 4A has a finite domain (w = 1..100), so it gets exhaustive tests.
- **Network-off acceptance runs:** the agent's command sandbox blocks external network but allows loopback inside a single command. Plan: start the server and headless Edge (fresh `--user-data-dir`, driven through CDP or puppeteer-core) in one sandboxed command, and record every request.

### First concrete action for the next developer
Add `.gitignore` (`bin/`, `data/`, `node_modules/`, `dist/`). Then fix the AppContainer `CreateProcessW` failure in `sandbox/main.go` using leads 1–4 above, and rerun `sandbox\smoke-test.ps1` until it prints `{"status":"OK",...}` and `YES` with the AppContainer enabled. Also check that `read prompt: no` appears in `err.txt`, which proves the container can't read user files.
Commit that as the "sandboxed runner" milestone, then move on to the Node backend and the first offline submission.
