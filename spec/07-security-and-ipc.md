# WIP 07 — Security and IPC

## 25. Security model

### 25.1 Key rules
- no execution of arbitrary JavaScript from presentation script
- no Node integration in browser content
- all file access goes through explicit IPC
- allowlist presentation commands
- keep preload bridge narrow and audited

### 25.2 File access
Recommended v1 modes:

#### Option A: unrestricted local access
Fastest for internal use.

#### Option B: allowed roots
Safer.

Config example:
```json
{
  "allowedRoots": [
    "/Users/jack/projects",
    "/Users/jack/demos"
  ]
}
```

Recommendation:
Implement allowed roots in v1 if practical.

### 25.3 External pages
Opening arbitrary URLs is allowed, but browser automation only operates inside the embedded guest page and must not expose Node/Electron internals.

---

## 26. IPC specification

### 26.1 Main -> renderer boundary
Expose only these initial methods in v1:
- `readTextFile(path)`
- `fileExists(path)`
- `resolveRealPath(path)`
- `getAppConfig()`

### 26.2 Shared types
```ts
interface AppConfig {
  allowedRoots?: string[];
  defaultBrowserTimeoutMs: number;
  defaultNavigationTimeoutMs: number;
}
```
