# Running SignalVane and ngrok as Windows Services

## Prerequisites

- Standalone `ngrok.exe` at `C:\Tools\ngrok\ngrok.exe` (not the Microsoft Store version — Store apps live under `WindowsApps\` and can't be launched by services)
- NSSM at `C:\Users\Todd\OneDrive\Documents\Non-Sucking-Service-Manager\win64\nssm.exe` (version 2.24, from nssm.cc)
- ngrok authtoken from https://dashboard.ngrok.com/get-started/your-authtoken

## ngrok service

**Config file** at `C:\Tools\ngrok\ngrok.yml`:

```yaml
version: "3"
agent:
    authtoken: <your-authtoken>
    log: C:\Tools\ngrok\ngrok.log
    log_level: info
tunnels:
    signalvane:
        proto: http
        addr: 127.0.0.1:8000
        basic_auth:
            - "user:longrandompassword"
```

Notes on v3 syntax: `log` and `log_level` go **under `agent:`**, not at the top level. The `version: "3"` line is required.

**Install as a service** (admin prompt):

```
C:\Tools\ngrok\ngrok.exe service install --config "C:\Tools\ngrok\ngrok.yml"
C:\Tools\ngrok\ngrok.exe service start
```

Pass `--config` explicitly on install — otherwise the service runs as LocalSystem and looks in a different default config location, and authentication fails with `ERR_NGROK_4018`.

**Verify:** `sc query ngrok` shows `RUNNING`. Check `C:\Tools\ngrok\ngrok.log` for clean connection.

**Management:**

```
C:\Tools\ngrok\ngrok.exe service stop
C:\Tools\ngrok\ngrok.exe service start
C:\Tools\ngrok\ngrok.exe service uninstall
```

## SignalVane service (via NSSM)

App is a FastAPI/uvicorn app. uvicorn is installed under `AppData\Roaming\` (per-user Python install), so the service must run as the user account, not LocalSystem.

A dedicated **`service-serve.bat`** at `C:\Users\Todd\OneDrive\Documents\Finance\strat-opt\service-serve.bat` launches the app — separate from the dev startup script so dev-only steps (tests, npm build, `--reload`) stay out of the service path:

```bat
@echo off
echo strat-opt running at http://localhost:8000
C:\Users\Todd\AppData\Roaming\Python\Python313\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000 --app-dir "%~dp0api"
```

**NSSM configuration:**

- *Application path:* `C:\Windows\System32\cmd.exe`
- *Startup directory:* `C:\Users\Todd\OneDrive\Documents\Finance\strat-opt`
- *Arguments:* `/c "C:\Users\Todd\OneDrive\Documents\Finance\strat-opt\service-serve.bat"`
- *Log on:* `.\Todd` (this account — required for access to per-user uvicorn install)
- *Startup type:* Automatic

**Install command** (if rebuilding from scratch):

```
"C:\Users\Todd\OneDrive\Documents\Non-Sucking-Service-Manager\win64\nssm.exe" install SignalVane
```

Then fill in the GUI with the values above.

**Management:**

```
nssm start SignalVane
nssm stop SignalVane
nssm restart SignalVane
nssm status SignalVane
nssm edit SignalVane           REM reopens GUI to view/change settings
nssm remove SignalVane confirm
```

## Things kept out of service startup

The dev `serve.bat` runs pytest and `npm run build` before launching uvicorn. Those are dev steps — kept out of the service via the separate `service-serve.bat`. Reasons:

- `pause` calls hang services (no console, no keypress)
- Transient test failures would block startup and kill remote access
- `npm` and bare `python` rely on PATH entries the service doesn't have
- `--reload` on uvicorn is a dev-only flag, complicates shutdown

Tests and builds run manually in the dev workflow. The service serves the already-built artifacts.

## Pre-departure checklist

- [ ] Both services show `RUNNING` in `sc query`
- [ ] Both have Startup type **Automatic** in `services.msc`
- [ ] Local browser hits `http://127.0.0.1:8000`
- [ ] Phone on cellular hits the ngrok URL → basic auth prompt → app loads
- [ ] Power settings: sleep = Never on AC, lid close = Do nothing
- [ ] Reboot the laptop, do NOT log in, retest the ngrok URL from phone
- [ ] Windows Defender on, definitions current
- [ ] Windows Update active hours set so a forced reboot won't strand you

## Security recap

- App bound to `127.0.0.1` only — no LAN exposure
- ngrok tunnel protected by basic auth — blocks drive-by scanners
- App has no auth of its own, no confidential data, no trade execution, only writes its own config files (recoverable from source control)

## Known fragility

NSSM lives under `OneDrive\Documents\`. If OneDrive ever moves or unsyncs that folder, the service breaks because Windows won't find `nssm.exe` at the registered path. The `service-serve.bat` is also under OneDrive — same risk. Consider moving both to a local-only path like `C:\Tools\` next time you have downtime.
