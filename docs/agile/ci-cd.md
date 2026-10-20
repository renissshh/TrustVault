# CI/CD pipeline

File: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). Runs on every push, every pull request, and on demand (Actions → CI/CD → Run workflow).

```
push / pull request
   │
   ├── Unit tests + build ─────┐   server unit tests (node --test), website production build (artifact kept 7 days)
   ├── End-to-end API tests ───┼── real API + MongoDB 7: sign-up, 3-step sign-in, uploads, checks, consent, batches, export…
   └── Browser tests (Chrome) ─┘   every page × every role × dark/light × 1900/1366/768/390 px, real sign-ins, no console errors
                │
        all three green and branch = main
                │
             Deploy ── Render deploy hook (if the RENDER_DEPLOY_HOOK secret is set)
```

The three test jobs run in parallel. A newer push to the same branch cancels the older run.

## Continuous deployment

Two ways to make sure the live site only gets tested code - use **one**:

1. **Render waits for the checks** (default, nothing to set up): `render.yaml` has `autoDeployTrigger: checksPass`, so Render deploys a commit on `main` only after the GitHub checks pass. If the service was created before this line existed, set *Settings → Build & Deploy → Auto-Deploy* to **After CI checks pass** once in the Render dashboard.
2. **Deploy hook**: turn Render auto-deploy **off**, copy the service's *Deploy hook* URL, and add it as the repository secret `RENDER_DEPLOY_HOOK` (GitHub → Settings → Secrets and variables → Actions). The `Deploy` job then calls it after the tests pass.

Pull requests and other branches never deploy.

## Running the same checks on your laptop

```bash
npm test
```

```bash
npm run test:e2e
```

```bash
npm run test:ui
```

The browser tests use Chrome by default; set `CHROME_PATH` to test another Chromium browser, for example Microsoft Edge:

```bash
CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npm run test:ui
```
