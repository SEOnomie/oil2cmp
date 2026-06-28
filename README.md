# OIL2

Schlanke, selbst gehostete Consent Management Platform (CMP) für
Performance-Marketing. DSGVO-konform, ~9 KB gzipped (Budget < 10 KB), ohne Runtime-Dependencies.

- **Google Consent Mode v2** — alle 7 Signale, Advanced + Basic Mode
- **Microsoft UET** Consent + **Microsoft Clarity** ConsentV2 (CamelCase-API)
- **Dual-Cookie-Strategie** — JS-Cookie (`oil2`) + HttpOnly-Backup (`oil2_srv`) via sGTM
- **Safari ITP Bypass** — Cookie-Restore via Polling + Probe-Request
- **Consent-Beacon** (optional) — autoritative serverseitige Cookie-Sync + sofortiger HttpOnly-Backup (Stufe C)
- **Server-Side Loading** über stape.io (Same Origin / Own CDN)
- **Shadow-DOM-Banner** + Preference Center, WCAG 2.1 AA
- **iFrame-Blocker** für YouTube/Maps/Social-Embeds
- **Consent-Analytics** — dataLayer → sGTM → BigQuery → Looker Studio

---

## Quick Start

Drei Schritte im HTML, Details in [`docs/setup-guide.md`](docs/setup-guide.md):

```html
<head>
  <!-- 1. Stub: synchron, VOR GTM (setzt Consent Defaults) -->
  <script>/* Inhalt aus src/stub.js */</script>

  <!-- 2. Konfiguration -->
  <script id="oil2-config" type="application/json">
    { "_v": 1, "consentMode": "advanced",
      "server": { "enabled": true, "endpoint": "/metrics", "mode": "same_origin" } }
  </script>

  <!-- 3. OIL2 laden (defer) -->
  <script src="/metrics/oil2.min.js" defer></script>
</head>
```

Danach steht `window.OIL2` bereit — siehe [`docs/api.md`](docs/api.md).

---

## Entwicklung

```bash
npm install
npm test            # Vitest (285 Tests)
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # ESLint
npm run build       # IIFE + ES (zwei Paesse)
npm run size        # gzipped Bundle-Groesse (IIFE)
```

**Build-Ausgaben:**

| Datei | Format | Zweck |
|---|---|---|
| `dist/oil2.min.js` | IIFE | Produktion, self-hosted (Preferences inline) |
| `dist/oil2.es.js` | ES Module | npm/Bundler (Preferences als Lazy-Chunk) |
| `src/stub.js` | Raw JS | Copy-paste in `<head>`, wird **nicht** gebundelt |

---

## Architektur

5-Layer-Modell (Details in `PROJEKT.md`):

```
Layer 0  Delivery   stape.io File Proxy / Reverse Proxy
Layer 1  UI         Shadow-DOM-Banner · Preference Center · iFrame-Blocker
Layer 2  Engine     State Machine · Storage · Config · Cookie-Restore
Layer 3  Bridges    Google CM v2 · Microsoft UET · Clarity · dataLayer
Layer 4  Server     sGTM: Variable · Cookie Keeper · Restore · Probe-Client · Consent-Client
```

**Consent-Kategorien:** `necessary` (immer aktiv), `functional`, `analytics`,
`marketing`.

---

## Projektstruktur

```
src/
  core/      types · engine · restore · version
  storage/   config · cookies
  bridges/   gcm · uet · clarity · datalayer · beacon
  ui/        banner · preferences · styles · a11y · controller
  blocker/   blocker
  index.ts · stub.js
sgtm/        5 Server-Templates (.tpl)
sql/         bq-consent-log.sql
test/        Unit- + Integrationstests (mirrors src/)
docs/        setup-guide · api · gtm-examples · looker-studio-template
```

---

## Dokumentation

| Datei | Inhalt |
|---|---|
| [`docs/setup-guide.md`](docs/setup-guide.md) | Schritt-für-Schritt-Einbau |
| [`docs/api.md`](docs/api.md) | `window.OIL2`-API, Events, Config |
| [`docs/gtm-examples.md`](docs/gtm-examples.md) | GTM/sGTM-Trigger & Consent-Gating |
| [`docs/looker-studio-template.md`](docs/looker-studio-template.md) | Consent-Analytics-Dashboard |
| `CONFIG-SCHEMA.md` | Vollständiges Config-Schema |
| `SGTM-TEMPLATES.md` | Server-Template-Spezifikationen |

---

## Lizenz

MIT
