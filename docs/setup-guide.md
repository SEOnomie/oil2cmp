# OIL2 — Setup-Guide

Schritt-für-Schritt-Einbau für eine Kunden-Website mit Server-Side Tracking
(stape.io). Reihenfolge einhalten — besonders Schritt 1 (Stub vor GTM).

---

## Überblick

```
1. Stub inline in <head>          (synchron, VOR GTM)
2. Konfiguration (#oil2-config)
3. oil2.min.js laden              (defer)
4. sGTM-Templates installieren    (Variable, Keeper, Restore, Probe-Client, Consent-Client*)
5. Server-Side aktivieren         (Config: server.enabled)
6. Verifizieren

* Consent-Client optional (Stufe C, server.consentBeacon)
```

---

## Schritt 1 — Stub (Pflicht, synchron, vor GTM)

Der Inhalt von `src/stub.js` wird **inline** in den `<head>` kopiert — **vor**
dem GTM-Script. Er setzt die Consent Defaults auf `denied`, bevor GTM lädt.

> **Warum kritisch:** Lädt GTM ohne Consent Default, gehen die ersten Events als
> `granted` raus — DSGVO-Verstoß. Der Stub darf **kein** `defer`/`async` haben.

```html
<head>
  <script>
    // Inhalt aus src/stub.js — unverändert kopieren
    (function(){ /* ... */ })();
  </script>
  <!-- erst danach GTM -->
</head>
```

---

## Schritt 2 — Konfiguration

Ein `<script type="application/json" id="oil2-config">` im `<head>`. Alle Felder
optional — fehlende werden mit Defaults gefüllt. Vollständiges Schema:
`CONFIG-SCHEMA.md`.

```html
<script id="oil2-config" type="application/json">
{
  "_v": 1,
  "consentMode": "advanced",
  "server": {
    "enabled": true,
    "endpoint": "/metrics",
    "mode": "same_origin"
  },
  "clarity": { "category": "marketing" },
  "ui": {
    "privacyUrl": "/datenschutz",
    "imprintUrl": "/impressum"
  }
}
</script>
```

**Wichtige Felder:**

| Feld | Bedeutung |
|---|---|
| `_v` | Config-Version. Bei Erhöhung → Re-Consent (neue Einwilligung). |
| `consentMode` | `advanced` (cookieless Pings, Modeling) oder `basic`. |
| `server.endpoint` | sGTM-Pfad. Same Origin: `/metrics`. Own CDN: volle URL. |
| `server.mode` | `same_origin` / `own_cdn` (ITP-Bypass) / `subdomain` (kein Bypass). |
| `server.consentBeacon` | `true` = Consent sofort per Beacon an `/oil2/consent` (Stufe C, erfordert OIL2 Consent Client). Default `false`. |
| `clarity.category` | `marketing` (Default) oder `analytics`. |

---

## Schritt 3 — OIL2 laden

`oil2.min.js` mit `defer` laden — idealerweise über den stape.io File Proxy
(Same Origin → kein Adblock, ITP-resistent):

```html
<script src="/metrics/oil2.min.js" defer></script>
```

Direkt-Einbindung (ohne File Proxy) ist möglich, verliert aber den
Same-Origin-Vorteil:

```html
<script src="https://cdn.example.de/oil2.min.js" defer></script>
```

Nach dem Laden steht `window.OIL2` bereit (siehe `docs/api.md`).

---

## Schritt 4 — sGTM-Templates installieren

Im sGTM-Container (stape.io) in dieser Reihenfolge importieren — Spezifikation:
`SGTM-TEMPLATES.md`.

| # | Template | Typ | Trigger |
|---|---|---|---|
| 1 | OIL2 Variable | Variable | — (von Tags referenziert) |
| 2 | OIL2 Probe Client | Client | lauscht auf `/oil2/restore` |
| 3 | OIL2 Cookie Keeper | Tag | All Pages |
| 4 | OIL2 Cookie Restore | Tag | All Pages |
| 5 | OIL2 Consent Client | Client | lauscht auf `/oil2/consent` (POST) — optional, Stufe C |

- **Keeper** sichert `oil2` → `oil2_srv` (HttpOnly, 400 Tage).
- **Restore** stellt `oil2` aus `oil2_srv` wieder her (OHNE HttpOnly — JS muss lesen).
- **Probe-Client** beantwortet `/oil2/restore` (Fallback im Basic Mode).
- **Consent-Client** (optional) empfängt den Consent-Beacon auf `/oil2/consent`
  und setzt `oil2` + `oil2_srv` **sofort** serverseitig — der HttpOnly-Backup
  entsteht damit ohne Warten auf den nächsten Request, und der Consent steht
  Server-Tags früher bereit. Aktivieren via `server.consentBeacon: true`. Bei
  `revoke()` löscht er beide Cookies (verhindert ein Wiederherstellen des
  widerrufenen Consents durch den Restore-Tag).

---

## Schritt 5 — Server-Side aktivieren

Für den ITP-Bypass muss der sGTM **Same Origin** erreichbar sein (Reverse Proxy
auf `/metrics`) oder über eine **Own-CDN**-Domain mit IP-Matching laufen.

- `same_origin`: Nginx/Cloudflare leitet `/metrics/*` an den sGTM weiter.
- `own_cdn`: Cloudflare Worker mit eigener Analytics-Domain.
- `subdomain`: **kein** ITP-Bypass (CNAME wird von Safari als Third-Party erkannt).

`server.cookieKeeper` und `server.restoreCookie` bleiben auf `true`.

---

## Schritt 6 — Verifizieren

1. **Erstbesuch:** Banner erscheint, Fokus auf „Alle ablehnen".
2. **Accept All:** `oil2`-Cookie wird gesetzt; im GTM Preview gehen
   `gtag('consent','update', …)` (granted) + `oil2_consent_log` raus.
3. **Reload:** Kein Banner, Consent wird sofort wiederhergestellt.
4. **sGTM Preview:** `oil2_srv` (HttpOnly) wird vom Keeper gesetzt.
5. **Safari ITP:** `oil2` manuell löschen → Reload → Cookie wird via Restore-Tag
   wiederhergestellt, kein erneutes Banner.
6. **Probe:** `https://deine-domain.de/metrics/oil2/restore` direkt aufrufen →
   `{"restored":true}` oder Status 204.

Health-Monitoring der Live-Daten: `docs/looker-studio-template.md`.

---

## iFrame-Blocker (optional)

Embeds blocken, bis Consent vorliegt — `data-oil2-category` setzen und `src`
weglassen (vorblockiert, garantiert kein Vorab-Laden):

```html
<iframe data-oil2-category="marketing"
        data-oil2-src="https://www.youtube.com/embed/VIDEO_ID"
        width="560" height="315"></iframe>
```

Erlaubte Kategorien: `functional`, `analytics`, `marketing`. Bei Consent wird der
iframe automatisch geladen, bei Widerruf wieder blockiert.
