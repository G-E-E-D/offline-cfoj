# Offline CFOJ — Implementation & Verification Summary

Completed 2026-11-20. All specification requirements and acceptance checks in [prompt.md](prompt.md) are implemented, verified, and committed on `main`. See [README.md](README.md) for setup, startup, and backup documentation.

## Milestones Committed

1. **Milestone 1 (`13d449e`)** — Local GNU C++23 compiler (`g++ -std=gnu++23 -O2 -pipe -static -s -Wl,--stack=67108864 ... -lstdc++exp`), Windows AppContainer + Job Object sandbox runner ([sandbox/main.go](sandbox/main.go), [sandbox/win.go](sandbox/win.go)), and SQLite judge queue ([src/db.mjs](src/db.mjs), [src/judge.mjs](src/judge.mjs)).
2. **Milestone 2 & 3 (`c7aa367`)** — Contest import by numeric ID ([src/importer.mjs](src/importer.mjs)), statement parser/sanitizer/asset localizer & protected-fragment validator ([src/statement.mjs](src/statement.mjs)), OpenAI Codex (`codex exec`) & Google Antigravity (`agy -p`) adapters ([src/providers.mjs](src/providers.mjs)), deterministic test generation & oracle validation ([src/testgen.mjs](src/testgen.mjs)), and whole-round Markdown editorials ([src/editorial.mjs](src/editorial.mjs)).
3. **Milestone 4 (`6315c82`)** — Virtual participation engine & contest integrity enforcement ([src/vp.mjs](src/vp.mjs)), HTTP/SSE server ([src/server.mjs](src/server.mjs)), and locally bundled bilingual web UI ([public/index.html](public/index.html), [public/styles.css](public/styles.css), [public/app.js](public/app.js)).
4. **Milestone 5** — Full automated acceptance suite ([scripts/verify-acceptance.mjs](scripts/verify-acceptance.mjs)) and Windows setup/startup documentation ([README.md](README.md)).
