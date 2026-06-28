# OIL2 — Projekt-Briefing

**Zweck:** Dieses Dokument ist das Master-Briefing für die Implementierung von OIL2. Es definiert Projektziel, Architektur, Dateistruktur, Abhängigkeiten und Build-Setup. Lies dieses Dokument zuerst, dann SPEZIFIKATION.md für Modul-Details, SGTM-TEMPLATES.md für Server-Templates, CONFIG-SCHEMA.md für die Konfiguration und TESTS.md für die Testmatrix.

---

## 1. Projektziel

OIL2 ist eine schlanke, selbst gehostete Consent Management Platform (CMP) für Performance-Marketing-Kunden. Zielgröße: ~10 KB gzipped (Client-Side, ohne lazy-loaded Preferences).

**Kernfunktionen:**
- Google Consent Mode v2 (alle 7 Signals, Advanced + Basic Mode)
- Microsoft UET Consent Mode
- Microsoft Clarity ConsentV2 (CamelCase-API)
- Dual-Cookie-Strategie (JS-Cookie + HttpOnly-Backup via sGTM)
- Server-Side Loading via stape.io (Same Origin / Own CDN)
- Safari ITP Bypass mit Cookie-Restore-Polling + Probe-Request
- Consent-Beacon (Stufe C): Entscheidung sofort serverseitig spiegeln (sofortiger HttpOnly-Backup)
- Consent-Analytics Pipeline (dataLayer → sGTM → BigQuery → Looker Studio)
- Config-Versionierung mit Re-Consent bei Änderungen

**Nicht im Scope:**
- IAB TCF (nicht nötig für Zielgruppe)
- Automatischer Cookie-Scan
- Multi-Regulation (CCPA, LGPD etc.)
- Service-Templates (manuell konfiguriert)

---

## 2. Architektur — 5-Layer-Modell

```
┌─────────────────────────────────────────────────────────┐
│  Layer 0 · DELIVERY (stape.io + Same Origin / Own CDN)  │
│  Custom Loader │ File Proxy │ Cookie Keeper │ Reverse   │
│  Proxy (Nginx/Cloudflare) für IP-Matching               │
├─────────────────────────────────────────────────────────┤
│  Layer 1 · UI                                           │
│  Shadow DOM Banner │ Preference Center │ iFrame Blocker │
├─────────────────────────────────────────────────────────┤
│  Layer 2 · CONSENT ENGINE                               │
│  Core (State Machine) │ Storage │ Config Parser         │
│  Cookie-Restore-Polling │ Probe-Request Fallback        │
├─────────────────────────────────────────────────────────┤
│  Layer 3 · BRIDGES                                      │
│  Google CM v2 │ Microsoft UET │ Clarity │ dataLayer     │
├─────────────────────────────────────────────────────────┤
│  Layer 4 · SERVER (sGTM @ stape.io)                     │
│  Variable Template │ Cookie Keeper │ Cookie Restore     │
│  Probe-Request Client │ Consent-Client (Stufe C)        │
│  BigQuery Log │ Looker Dashboard                        │
└─────────────────────────────────────────────────────────┘
```

**Datenfluss:**
1. User lädt Seite → `oil2-stub.js` (inline, synchron) setzt Consent Defaults
2. `oil2.min.js` lädt (defer, via stape.io File Proxy)
3. Kein Cookie → Banner zeigen → User entscheidet
4. Cookie vorhanden → Consent sofort wiederherstellen
5. Safari ITP: Cookie fehlt → Polling → Probe-Request → Restore oder Banner
6. Bridges feuern: Google CM v2 + UET + Clarity + dataLayer
7. Stufe C: Consent-Beacon → sGTM Consent-Client setzt `oil2` + `oil2_srv` sofort autoritativ
8. sGTM: Cookie Keeper sichert als HttpOnly, Restore stellt wieder her
9. Consent-Log → BigQuery → Looker Studio

---

## 3. Dateistruktur

```
oil2/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── .eslintrc.cjs
├── README.md
│
├── src/
│   ├── index.ts                 # Public API + Barrel Export
│   ├── stub.js                  # Inline-Script (kein TypeScript, muss copy-paste-fähig sein)
│   │
│   ├── core/
│   │   ├── engine.ts            # State Machine + Event Bus
│   │   ├── restore.ts           # Cookie-Restore-Polling + Probe-Request
│   │   └── types.ts             # Shared Types + Interfaces
│   │
│   ├── storage/
│   │   ├── cookies.ts           # Dual-Cookie Read/Write
│   │   └── config.ts            # JSON Config Parser + Version Hash
│   │
│   ├── bridges/
│   │   ├── gcm.ts               # Google Consent Mode v2
│   │   ├── uet.ts               # Microsoft UET
│   │   ├── clarity.ts           # Microsoft Clarity ConsentV2
│   │   ├── datalayer.ts         # dataLayer Events
│   │   └── beacon.ts            # Consent-Beacon → sGTM Consent-Client (Stufe C)
│   │
│   ├── ui/
│   │   ├── banner.ts            # Shadow DOM Banner
│   │   ├── preferences.ts       # Preference Center (lazy loaded)
│   │   ├── styles.ts            # CSS-in-JS (Shadow DOM Styles)
│   │   └── a11y.ts              # WCAG 2.1 AA Utilities
│   │
│   └── blocker/
│       └── blocker.ts           # iFrame/Script Blocker (P1)
│
├── sgtm/
│   ├── oil2-variable.tpl        # sGTM Variable Template
│   ├── oil2-keeper.tpl          # sGTM Cookie Keeper Tag
│   ├── oil2-restore.tpl         # sGTM Cookie Restore Tag
│   ├── oil2-probe-client.tpl    # sGTM Probe-Request Client
│   └── oil2-consent-client.tpl  # sGTM Consent-Client (Stufe C)
│
├── sql/
│   └── bq-consent-log.sql       # BigQuery Schema + Queries
│
├── test/
│   ├── core/
│   │   ├── engine.test.ts
│   │   └── restore.test.ts
│   ├── storage/
│   │   ├── cookies.test.ts
│   │   └── config.test.ts
│   ├── bridges/
│   │   ├── gcm.test.ts
│   │   ├── uet.test.ts
│   │   ├── clarity.test.ts
│   │   └── datalayer.test.ts
│   ├── ui/
│   │   ├── banner.test.ts
│   │   └── preferences.test.ts
│   └── integration/
│       ├── consent-flow.test.ts
│       ├── safari-itp.test.ts
│       └── basic-mode.test.ts
│
├── dist/                        # Build Output (gitignored)
│   ├── oil2.min.js              # Bundled + Minified
│   ├── oil2.min.js.map          # Source Map
│   └── oil2.es.js               # ES Module Build
│
└── docs/
    ├── setup-guide.md
    ├── api.md
    └── gtm-examples.md
```

---

## 4. Technologie-Stack

| Komponente | Technologie | Version | Begründung |
|---|---|---|---|
| Sprache | TypeScript | 5.x | Type Safety, IDE Support |
| Bundler | Vite | 6.x | Tree-Shaking, kleine Bundles, schneller Dev-Server |
| Test Runner | Vitest | 3.x | Vite-nativ, schnell, gute TS-Integration |
| Linting | ESLint | 9.x | Code-Qualität |
| Package Manager | npm | — | Standard, keine Exotic-Deps |
| sGTM Templates | Sandboxed JavaScript | — | sGTM-Pflicht (kein Node.js, kein ES6) |

**Keine weiteren Abhängigkeiten.** OIL2 hat null Runtime-Dependencies. Alles wird vanilla implementiert.

---

## 5. Build-Setup

### 5.1 package.json

```json
{
  "name": "oil2",
  "version": "0.1.0",
  "description": "Lean Consent Management Platform for Performance Marketing",
  "type": "module",
  "main": "dist/oil2.min.js",
  "module": "dist/oil2.es.js",
  "types": "dist/index.d.ts",
  "files": ["dist/", "src/stub.js"],
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "size": "vite build && gzip -c dist/oil2.min.js | wc -c"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0",
    "eslint": "^9.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "happy-dom": "^17.0.0"
  },
  "license": "MIT"
}
```

### 5.2 vite.config.ts

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'OIL2',
      formats: ['es', 'iife'],
      fileName: (format) => format === 'iife' ? 'oil2.min.js' : 'oil2.es.js'
    },
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2, pure_getters: true, unsafe_arrows: true },
      mangle: { properties: { regex: /^_/ } }
    },
    rollupOptions: {
      output: { inlineDynamicImports: false }
    },
    sourcemap: true,
    target: 'es2020',
    reportCompressedSize: true
  }
});
```

### 5.3 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationDir": "dist",
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### 5.4 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/stub.js'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 }
    }
  }
});
```

---

## 6. Build-Ziele

| Build | Output | Zweck |
|---|---|---|
| `oil2.min.js` | IIFE Bundle | Produktions-Script, via `<script>` oder stape.io File Proxy |
| `oil2.es.js` | ES Module | npm-Import für Build-Systeme |
| `oil2.min.js.map` | Source Map | Debugging |
| `src/stub.js` | Raw JS | Copy-paste in `<head>`, wird NICHT gebundelt |

**Bundle-Size-Budget:** ≤10 KB gzipped (Banner + Engine + Bridges, ohne Preferences).

Preferences (`oil2-preferences.ts`) wird als separater Chunk lazy-loaded und zählt nicht zum Core-Budget.

---

## 7. Coding-Konventionen

### 7.1 Allgemein
- Kein `any` — strikt typisiert
- Kein `class` — funktional, Closures, Module Pattern
- Keine externen Dependencies — alles vanilla
- Private Funktionen/Variablen mit `_` Prefix (werden beim Build gemangled)
- Alle exports über `src/index.ts` barrel

### 7.2 Naming
- Dateien: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Funktionen: `camelCase`
- Konstanten: `SCREAMING_SNAKE_CASE`
- Events: `oil2_snake_case` (dataLayer-kompatibel)

### 7.3 Error Handling
- Keine `throw` — alle Fehler werden per `console.warn('[OIL2]', ...)` geloggt
- Fehler dürfen nie das Consent-Signaling blockieren
- Bei korruptem Cookie → denied state, kein Banner-Crash
- Bei fehlgeschlagenem Restore → Banner zeigen (DSGVO-konform)

### 7.4 Browser-APIs
- `document.cookie` — direkter Zugriff, kein Wrapper
- `crypto.randomUUID()` — für Consent-IDs (Browser-Support seit 2021)
- `atob()`/`btoa()` — Base64 Encode/Decode
- `JSON.parse()`/`JSON.stringify()` — Cookie-Payload
- `ShadowRoot.attachShadow({mode: 'open'})` — Banner-Isolation

### 7.5 sGTM Templates
- Sandboxed JavaScript — kein ES6+, kein Node.js
- Verfügbare APIs: `getCookieValues`, `setCookie`, `getEventData`, `claimRequest`, `returnResponse`, `setResponseHeader`, `setResponseBody`, `getRequestHeader`, `JSON`, `fromBase64`, `generateRandom`, `getTimestampMillis`, `logToConsole`, `templateDataStorage`
- Kein `let`/`const` — nur `var`
- Kein Arrow Functions — nur `function`
- Kein Template Literals

---

## 8. Consent-Kategorien

Genau 4 Kategorien, nicht erweiterbar:

| ID | Label | Google CM Signals | UET | Clarity |
|---|---|---|---|---|
| `necessary` | Notwendig | `security_storage: granted` | — | — |
| `functional` | Funktional | `functionality_storage`, `personalization_storage` | — | — |
| `analytics` | Statistik | `analytics_storage` | — | `analytics_Storage` |
| `marketing` | Marketing | `ad_storage`, `ad_user_data`, `ad_personalization` | `ad_storage` | `ad_Storage` |

`necessary` ist immer `granted` und nicht toggle-bar.

**Clarity-Sonderfall:** Default-Kategorie ist `marketing`. Konfigurierbar über `clarity.category` auf `"analytics"`. CamelCase-API (`ad_Storage`, `analytics_Storage`) ist Pflicht.

---

## 9. Cookie-Spezifikation

### 9.1 Zwei Cookies

| | `oil2` | `oil2_srv` |
|---|---|---|
| Typ | JS-Cookie | HttpOnly-Cookie |
| Gesetzt von | OIL2 JavaScript | sGTM (Cookie Keeper / Restore / Consent-Client) |
| Lesbar von | JavaScript + sGTM | Nur sGTM |
| Lebensdauer | 365 Tage (Safari ITP: 7d) | 400 Tage (ITP-immun bei IP-Matching) |
| Flags | `SameSite=Lax; Secure` | `HttpOnly; SameSite=Lax; Secure` |

### 9.2 Cookie-Payload (Base64-encoded JSON)

```json
{
  "f": 1,
  "a": 1,
  "m": 0,
  "t": 1707744000,
  "v": 3,
  "ab": "A"
}
```

Größe: ~60 Bytes (Base64). Cookie-Name nicht konfigurierbar (`oil2` / `oil2_srv` sind hart kodiert für sGTM-Kompatibilität).

---

## 10. State Machine

```
              ┌─────────┐
              │  INIT    │  (Stub hat Default gesetzt)
              └────┬─────┘
                   │
         ┌─────────┴──────────┐
         │ Cookie vorhanden?  │
         └─────────┬──────────┘
           Ja      │      Nein
           ▼       │       ▼
    ┌──────────┐   │  ┌──────────┐
    │ RESTORED │   │  │ WAITING  │  (Cookie-Restore-Polling läuft)
    └──────────┘   │  └────┬─────┘
                   │       │
                   │  ┌────┴──────┐
                   │  │ Restore?  │
                   │  └────┬──────┘
                   │  Ja   │   Nein (Timeout)
                   │   ▼   │    ▼
                   │ ┌─────┴──┐ ┌──────────┐
                   │ │RESTORED│ │ PENDING  │  (Banner wird angezeigt)
                   │ └────────┘ └────┬─────┘
                   │                 │
                   │            User-Aktion
                   │                 │
                   │       ┌─────────┴────────┐
                   │       ▼                  ▼
                   │  ┌──────────┐      ┌──────────┐
                   │  │ GRANTED  │      │ DENIED   │
                   │  └──────────┘      └──────────┘
                   │       │                  │
                   │       └──────┬───────────┘
                   │              ▼
                   │       Bridges feuern
                   │       Cookie setzen
                   │       dataLayer Event
                   │
                   ▼
           ┌──────────────┐
           │  ACTIVE      │  (Consent steht, normale Nutzung)
           └──────────────┘
                   │
              OIL2.show()
                   │
                   ▼
           ┌──────────────┐
           │  UPDATING    │  (Preference Center offen)
           └──────┬───────┘
                  │
             Save/Close
                  │
                  ▼
           ┌──────────────┐
           │  ACTIVE      │
           └──────────────┘
```

**States:** `INIT` → `WAITING` → `PENDING`/`RESTORED` → `GRANTED`/`DENIED` → `ACTIVE` → `UPDATING` → `ACTIVE`

---

## 11. Public API

```typescript
// Globales Objekt auf window
window.OIL2 = {
  // Consent-Status abfragen
  getConsent(): ConsentChoices;

  // Banner manuell öffnen (für Footer-Link "Cookie-Einstellungen")
  show(): void;

  // Preference Center öffnen
  showPreferences(): void;

  // Consent programmatisch setzen (für Custom-Implementierungen)
  setConsent(choices: Partial<ConsentChoices>): void;

  // Consent widerrufen (alle denied, Banner zeigen)
  revoke(): void;

  // Event Listener
  on(event: OIL2Event, callback: (data: ConsentChoices) => void): void;
  off(event: OIL2Event, callback: (data: ConsentChoices) => void): void;

  // Version
  version: string;
};
```

**Events:**
- `consent:granted` — User hat (teilweise) zugestimmt
- `consent:denied` — User hat abgelehnt
- `consent:updated` — Consent wurde geändert
- `consent:restored` — Cookie wurde aus Backup wiederhergestellt
- `banner:shown` — Banner wurde angezeigt
- `banner:hidden` — Banner wurde geschlossen

---

## 12. Implementierungsreihenfolge

Die Module werden in dieser Reihenfolge implementiert. Jedes Modul muss komplett getestet sein, bevor das nächste begonnen wird.

### Phase 1 — Core + Bridges + Server (Priorität 0)

1. `src/core/types.ts` — Alle Types und Interfaces
2. `src/storage/config.ts` — Config Parser + Version Hash
3. `src/storage/cookies.ts` — Dual-Cookie Read/Write
4. `src/core/engine.ts` — State Machine + Event Bus
5. `src/core/restore.ts` — Cookie-Restore-Polling + Probe-Request
6. `src/bridges/gcm.ts` — Google Consent Mode v2
7. `src/bridges/uet.ts` — Microsoft UET
8. `src/bridges/clarity.ts` — Microsoft Clarity
9. `src/bridges/datalayer.ts` — dataLayer Events
10. `src/bridges/beacon.ts` — Consent-Beacon (Stufe C)
11. `src/stub.js` — Inline-Script
12. `src/index.ts` — Public API + Barrel Export
13. `sgtm/oil2-variable.tpl` — sGTM Variable
14. `sgtm/oil2-keeper.tpl` — sGTM Cookie Keeper
15. `sgtm/oil2-restore.tpl` — sGTM Cookie Restore
16. `sgtm/oil2-probe-client.tpl` — sGTM Probe-Request Client
17. `sgtm/oil2-consent-client.tpl` — sGTM Consent-Client (Stufe C)

### Phase 2 — Banner UI + Accessibility (Priorität 0)

16. `src/ui/styles.ts` — CSS-in-JS
17. `src/ui/a11y.ts` — WCAG Utilities
18. `src/ui/banner.ts` — Shadow DOM Banner
19. `src/ui/preferences.ts` — Preference Center (lazy loaded)

### Phase 3 — Integration + Blocker (Priorität 1)

20. `src/blocker/blocker.ts` — iFrame/Script Blocker
21. Integration Tests

### Phase 4 — Analytics (Priorität 1-2)

22. `sql/bq-consent-log.sql` — BigQuery Schema
23. Looker Studio Template

---

## 13. Kritische Implementierungshinweise

### 13.1 Safari ITP — Timing ist alles

Der Cookie-Restore-Flow hat eine Race Condition: Der GA4-Request muss rausgehen, bevor der Restore-Cookie zurückkommt. OIL2 nutzt `wait_for_update: 500` im Consent Default, um GTM zu sagen: "Warte maximal 500ms auf ein Consent Update." In dieser Zeit:

1. GA4 feuert cookieless Ping (Advanced Mode)
2. sGTM empfängt Request mit `oil2_srv` HttpOnly-Cookie
3. sGTM Restore Tag setzt `oil2` via `Set-Cookie` Response-Header
4. OIL2 Polling erkennt neuen Cookie
5. OIL2 feuert `consent:update` → GTM weiß Bescheid

**Im Basic Mode** geht kein GA4-Ping raus → OIL2 muss den Probe-Request als Fallback nutzen.

### 13.2 Consent Default MUSS synchron sein

Der Stub (`oil2-stub.js`) MUSS inline und synchron im `<head>` stehen, VOR dem GTM-Script. Wenn GTM ohne Consent Default lädt, gehen die ersten Events als `granted` raus → DSGVO-Verstoß.

### 13.3 Shadow DOM — CSS Isolation

Der Banner läuft in einem Shadow DOM, damit Kunden-CSS nicht das Banner-Styling bricht. Alle Styles werden per CSS-in-JS injiziert. Custom Properties (CSS Variables) ermöglichen Theming von außen.

### 13.4 Microsoft Clarity CamelCase

Clarity nutzt `ad_Storage` und `analytics_Storage` (großes S). Google und UET nutzen `ad_storage` und `analytics_storage` (kleines s). Falsches Casing = Consent wird ignoriert.

### 13.5 Config-Version Re-Consent

Jede Config hat einen `_v` Wert. Dieser wird als Hash im Cookie gespeichert. Bei Mismatch (Webmaster hat Config aktualisiert) → Banner erneut zeigen. Pflicht nach DSGVO: Bei Änderung der Datenverarbeitung muss neuer Consent eingeholt werden.

### 13.6 Consent-Beacon (Stufe C) — nur bei echten Entscheidungen

Der Consent-Beacon (`src/bridges/beacon.ts`) feuert ausschließlich bei `setConsent` und `revoke`, NIEMALS bei `restore`/`init`. Andernfalls entstünde eine Schleife: Server setzt Cookie → Client restored → Beacon → Server setzt Cookie. Bei `action === 'revoke'` löscht der sGTM Consent-Client BEIDE Cookies (auch das HttpOnly-`oil2_srv`) — sonst würde der Restore-Tag den widerrufenen Consent beim nächsten Load wiederherstellen. Transport als `text/plain` via `navigator.sendBeacon` (Fallback `fetch` mit `keepalive`) → CORS-„simple request", kein Preflight. Aktivierung: `server.enabled` + `server.consentBeacon` + `server.endpoint`.

---

## 14. Referenz-Dokumente

| Dokument | Inhalt |
|---|---|
| `SPEZIFIKATION.md` | Modul-für-Modul-Spezifikation mit Interfaces, Funktionen, Ein-/Ausgaben |
| `SGTM-TEMPLATES.md` | Vollständige sGTM Template-Spezifikationen mit Sandboxed JS |
| `CONFIG-SCHEMA.md` | JSON-Schema, Validierungsregeln, Defaults, Beispiele |
| `TESTS.md` | Testmatrix: Unit Tests, Integration Tests, Safari ITP Szenarien |
| `OIL2-Konzept.md` | Konzeptdokument v4.0 (Hintergrund, Wettbewerb, Roadmap) |
