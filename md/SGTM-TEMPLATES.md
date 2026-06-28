# OIL2 — sGTM Template-Spezifikationen

**Zweck:** Vollständige Spezifikation der 5 Server-Side Google Tag Manager Templates. Jedes Template enthält die Sandboxed JavaScript Implementierung, Feldkonfiguration und Berechtigungen.

**Wichtig:** sGTM Templates nutzen Sandboxed JavaScript — kein ES6+, kein Node.js, kein `let`/`const`, keine Arrow Functions, keine Template Literals. Nur die in der sGTM Sandbox verfügbaren APIs.

---

## 1. OIL2 Variable Template — `sgtm/oil2-variable.tpl`

### Zweck
Liest den OIL2 Consent-Status aus den Cookies (`oil2` oder `oil2_srv`) und gibt ein strukturiertes Consent-Objekt zurück. Wird von allen sGTM-Tags verwendet, die Consent-Gating brauchen (Meta CAPI, TikTok Events API, LinkedIn CAPI, etc.).

### Template-Typ
**Variable** (nicht Tag, nicht Client)

### Feldkonfiguration (template.json fields)

```json
[
  {
    "type": "SELECT",
    "name": "cookiePriority",
    "displayName": "Cookie-Priorität",
    "selectItems": [
      { "value": "js_first", "displayValue": "JS-Cookie zuerst (oil2), dann HttpOnly (oil2_srv)" },
      { "value": "srv_first", "displayValue": "HttpOnly-Cookie zuerst (oil2_srv), dann JS (oil2)" }
    ],
    "defaultValue": "js_first",
    "help": "Bestimmt welcher Cookie zuerst gelesen wird. Standard: JS-Cookie (oil2) zuerst."
  },
  {
    "type": "SELECT",
    "name": "returnFormat",
    "displayName": "Rückgabe-Format",
    "selectItems": [
      { "value": "object", "displayValue": "Consent-Objekt {functional, analytics, marketing}" },
      { "value": "category", "displayValue": "Einzelne Kategorie (true/false)" }
    ],
    "defaultValue": "object"
  },
  {
    "type": "SELECT",
    "name": "category",
    "displayName": "Kategorie",
    "selectItems": [
      { "value": "functional", "displayValue": "Funktional" },
      { "value": "analytics", "displayValue": "Statistik" },
      { "value": "marketing", "displayValue": "Marketing" }
    ],
    "defaultValue": "marketing",
    "enablingConditions": [{ "paramName": "returnFormat", "paramValue": "category", "type": "EQUALS" }]
  }
]
```

### Sandboxed JavaScript

```javascript
// sGTM Variable: OIL2 Consent Status
var getCookieValues = require('getCookieValues');
var JSON = require('JSON');
var fromBase64 = require('fromBase64');
var logToConsole = require('logToConsole');

var cookiePriority = data.cookiePriority || 'js_first';
var returnFormat = data.returnFormat || 'object';
var category = data.category || 'marketing';

// Cookie lesen (Priorität konfigurierbar)
var raw = null;
if (cookiePriority === 'js_first') {
  raw = getCookieValues('oil2')[0];
  if (!raw) raw = getCookieValues('oil2_srv')[0];
} else {
  raw = getCookieValues('oil2_srv')[0];
  if (!raw) raw = getCookieValues('oil2')[0];
}

// Kein Cookie gefunden
if (!raw) {
  logToConsole('[OIL2 Variable] No consent cookie found');
  if (returnFormat === 'category') return false;
  return { functional: false, analytics: false, marketing: false, timestamp: 0, version: 0, variant: '' };
}

// Base64 dekodieren + JSON parsen
var decoded = null;
try {
  decoded = JSON.parse(fromBase64(raw));
} catch(e) {
  logToConsole('[OIL2 Variable] Failed to decode cookie: ' + e);
  if (returnFormat === 'category') return false;
  return { functional: false, analytics: false, marketing: false, timestamp: 0, version: 0, variant: '' };
}

// Consent-Objekt bauen
var consent = {
  functional: decoded.f === 1,
  analytics: decoded.a === 1,
  marketing: decoded.m === 1,
  timestamp: decoded.t || 0,
  version: decoded.v || 0,
  variant: decoded.ab || ''
};

// Rückgabe
if (returnFormat === 'category') {
  if (category === 'functional') return consent.functional;
  if (category === 'analytics') return consent.analytics;
  if (category === 'marketing') return consent.marketing;
  return false;
}

return consent;
```

### Berechtigungen (permissions)

```json
{
  "read_cookies": {
    "cookieNames": ["oil2", "oil2_srv"]
  },
  "logging": {
    "environments": ["debug"]
  }
}
```

### Nutzung in sGTM Tags

```
// In einem Meta CAPI Tag als Trigger-Bedingung:
{{OIL2 Consent}}.marketing === true

// Oder als einzelne Variable (returnFormat = category, category = marketing):
{{OIL2 Marketing Consent}} === true
```

---

## 2. Cookie Keeper Tag — `sgtm/oil2-keeper.tpl`

### Zweck
Sichert den `oil2` JS-Cookie als `oil2_srv` HttpOnly-Cookie. Feuert bei jedem Request. Aktualisiert nur wenn `oil2` neuer als `oil2_srv` ist oder `oil2_srv` nicht existiert.

### Template-Typ
**Tag**

### Feldkonfiguration

```json
[
  {
    "type": "TEXT",
    "name": "cookieMaxAge",
    "displayName": "Cookie Max-Age (Sekunden)",
    "defaultValue": "34560000",
    "help": "Lebensdauer des HttpOnly-Cookies in Sekunden. 34560000 = 400 Tage (Maximum für Cookies).",
    "valueValidators": [{ "type": "POSITIVE_NUMBER" }]
  },
  {
    "type": "TEXT",
    "name": "cookieDomain",
    "displayName": "Cookie-Domain (optional)",
    "defaultValue": "",
    "help": "Leer lassen für auto-detect. Sonst z.B. '.example.de'"
  },
  {
    "type": "CHECKBOX",
    "name": "enableLogging",
    "displayName": "Debug-Logging aktivieren",
    "defaultValue": false
  }
]
```

### Sandboxed JavaScript

```javascript
// sGTM Tag: OIL2 Cookie Keeper
var getCookieValues = require('getCookieValues');
var setCookie = require('setCookie');
var logToConsole = require('logToConsole');

var maxAge = data.cookieMaxAge || '34560000';
var cookieDomain = data.cookieDomain || '';
var enableLogging = data.enableLogging || false;

// JS-Cookie lesen
var jsCookie = getCookieValues('oil2')[0];
// HttpOnly-Cookie lesen
var srvCookie = getCookieValues('oil2_srv')[0];

// Nur aktualisieren wenn:
// 1. JS-Cookie vorhanden UND
// 2. HttpOnly-Cookie fehlt oder unterschiedlich
if (jsCookie && jsCookie !== srvCookie) {
  var options = {
    'max-age': maxAge,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  };

  if (cookieDomain) {
    options.domain = cookieDomain;
  }

  setCookie('oil2_srv', jsCookie, options);

  if (enableLogging) {
    logToConsole('[OIL2 Keeper] Synced oil2 → oil2_srv');
  }
} else if (enableLogging) {
  if (!jsCookie) {
    logToConsole('[OIL2 Keeper] No oil2 cookie found, skipping');
  } else {
    logToConsole('[OIL2 Keeper] Cookies already in sync');
  }
}

data.gtmOnSuccess();
```

### Berechtigungen

```json
{
  "read_cookies": {
    "cookieNames": ["oil2", "oil2_srv"]
  },
  "write_cookies": {
    "cookieNames": ["oil2_srv"]
  },
  "logging": {
    "environments": ["debug"]
  }
}
```

### Trigger-Empfehlung
**All Pages** (bei jedem eingehenden Request feuern). Muss keine spezifischen Events filtern.

---

## 3. Cookie Restore Tag — `sgtm/oil2-restore.tpl`

### Zweck
Stellt den `oil2` JS-Cookie aus `oil2_srv` wieder her, wenn Safari ITP den JS-Cookie gelöscht hat. Feuert bei jedem Request. Setzt den Cookie nur wenn `oil2_srv` vorhanden, aber `oil2` fehlt.

### Template-Typ
**Tag**

### Feldkonfiguration

```json
[
  {
    "type": "TEXT",
    "name": "cookieMaxAge",
    "displayName": "Cookie Max-Age (Sekunden)",
    "defaultValue": "31536000",
    "help": "Lebensdauer des wiederhergestellten JS-Cookies. 31536000 = 365 Tage."
  },
  {
    "type": "TEXT",
    "name": "cookieDomain",
    "displayName": "Cookie-Domain (optional)",
    "defaultValue": ""
  },
  {
    "type": "CHECKBOX",
    "name": "enableLogging",
    "displayName": "Debug-Logging aktivieren",
    "defaultValue": false
  }
]
```

### Sandboxed JavaScript

```javascript
// sGTM Tag: OIL2 Cookie Restore
var getCookieValues = require('getCookieValues');
var setCookie = require('setCookie');
var logToConsole = require('logToConsole');

var maxAge = data.cookieMaxAge || '31536000';
var cookieDomain = data.cookieDomain || '';
var enableLogging = data.enableLogging || false;

var jsCookie = getCookieValues('oil2')[0];
var srvCookie = getCookieValues('oil2_srv')[0];

// Restore nur wenn:
// 1. HttpOnly-Cookie vorhanden UND
// 2. JS-Cookie fehlt (ITP hat es gelöscht)
if (!jsCookie && srvCookie) {
  var options = {
    'max-age': maxAge,
    secure: true,
    sameSite: 'lax',
    path: '/'
    // KEIN httpOnly! JS muss den Cookie lesen können
  };

  if (cookieDomain) {
    options.domain = cookieDomain;
  }

  setCookie('oil2', srvCookie, options);

  if (enableLogging) {
    logToConsole('[OIL2 Restore] Restored oil2 from oil2_srv');
  }
} else if (enableLogging) {
  if (jsCookie) {
    logToConsole('[OIL2 Restore] oil2 already present, no restore needed');
  } else {
    logToConsole('[OIL2 Restore] No oil2_srv found, cannot restore');
  }
}

data.gtmOnSuccess();
```

### Berechtigungen

```json
{
  "read_cookies": {
    "cookieNames": ["oil2", "oil2_srv"]
  },
  "write_cookies": {
    "cookieNames": ["oil2"]
  },
  "logging": {
    "environments": ["debug"]
  }
}
```

### Trigger-Empfehlung
**All Pages** — identisch zum Keeper Tag.

### Kritischer Hinweis
Der Restore Tag setzt `oil2` OHNE `httpOnly` Flag — das ist Absicht. JavaScript auf der Client-Seite muss den Cookie lesen können, um den Consent-State wiederherzustellen. Wenn `httpOnly` gesetzt wird, funktioniert das Client-Side Cookie-Restore-Polling nicht.

---

## 4. Probe-Request Client — `sgtm/oil2-probe-client.tpl`

### Zweck
Leichtgewichtiger sGTM Client, der auf `/oil2/restore` Requests lauscht. Wird als Fallback genutzt, wenn das Cookie-Restore-Polling im Browser fehlschlägt (z.B. im Basic Mode, wo kein GA4-Ping rausgeht).

### Template-Typ
**Client** (nicht Tag, nicht Variable)

### Feldkonfiguration

```json
[
  {
    "type": "TEXT",
    "name": "requestPath",
    "displayName": "Request-Pfad",
    "defaultValue": "/oil2/restore",
    "help": "Pfad auf dem der Client lauscht. Standard: /oil2/restore"
  },
  {
    "type": "CHECKBOX",
    "name": "enableLogging",
    "displayName": "Debug-Logging aktivieren",
    "defaultValue": false
  }
]
```

### Sandboxed JavaScript

```javascript
// sGTM Client: OIL2 Probe-Request Handler
var claimRequest = require('claimRequest');
var getCookieValues = require('getCookieValues');
var getRequestPath = require('getRequestPath');
var returnResponse = require('returnResponse');
var setCookie = require('setCookie');
var setResponseBody = require('setResponseBody');
var setResponseHeader = require('setResponseHeader');
var setResponseStatus = require('setResponseStatus');
var logToConsole = require('logToConsole');

var requestPath = data.requestPath || '/oil2/restore';
var enableLogging = data.enableLogging || false;

// Nur auf konfigurierten Pfad reagieren
var path = getRequestPath();
if (path !== requestPath) {
  return;  // Nicht unser Request → nächster Client darf claimen
}

// Request claimen
claimRequest();

// CORS-Header setzen (wichtig für fetch mit credentials: 'include')
setResponseHeader('Access-Control-Allow-Origin', getRequestHeader('Origin') || '*');
setResponseHeader('Access-Control-Allow-Credentials', 'true');
setResponseHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

// oil2_srv Cookie lesen
var srvCookie = getCookieValues('oil2_srv')[0];

if (srvCookie) {
  // JS-Cookie wiederherstellen
  var options = {
    'max-age': '31536000',
    secure: true,
    sameSite: 'lax',
    path: '/'
    // KEIN httpOnly!
  };

  setCookie('oil2', srvCookie, options);

  if (enableLogging) {
    logToConsole('[OIL2 Probe] Restored oil2 from oil2_srv via probe request');
  }

  setResponseStatus(200);
  setResponseBody('{"restored":true}');
} else {
  if (enableLogging) {
    logToConsole('[OIL2 Probe] No oil2_srv cookie found');
  }

  setResponseStatus(204);
  setResponseBody('');
}

setResponseHeader('Content-Type', 'application/json');
returnResponse();
```

### Berechtigungen

```json
{
  "read_cookies": {
    "cookieNames": ["oil2_srv"]
  },
  "write_cookies": {
    "cookieNames": ["oil2"]
  },
  "read_request": {
    "requestAccess": "specific",
    "headerWhitelist": ["origin"],
    "pathAllowed": true
  },
  "return_response": {
    "headerWhitelist": [
      "access-control-allow-origin",
      "access-control-allow-credentials",
      "cache-control",
      "content-type"
    ]
  },
  "logging": {
    "environments": ["debug"]
  }
}
```

### Wichtiger Hinweis: `getRequestHeader`

Im Probe-Client Code wird `getRequestHeader` verwendet, aber es muss auch importiert werden:

```javascript
var getRequestHeader = require('getRequestHeader');
```

Dieses `require` muss im Code-Block oben ergänzt werden (es fehlt in der Sandbox-API Liste im Projekt-Briefing, ist aber verfügbar für Client Templates).

### Ablauf im Detail

```
Browser                          sGTM (stape.io)
   │                                    │
   │  GET /oil2/restore                 │
   │  Cookie: oil2_srv=eyJmIj...        │
   │  ──────────────────────────►       │
   │                                    │
   │                          Probe Client empfängt Request
   │                          Liest oil2_srv Cookie
   │                          Setzt oil2 Cookie via Set-Cookie
   │                                    │
   │  200 OK                            │
   │  Set-Cookie: oil2=eyJmIj...        │
   │  ◄──────────────────────────       │
   │                                    │
   │  Browser hat jetzt oil2 Cookie     │
   │  OIL2 Polling erkennt Cookie       │
   │  → consent:restored               │
```

---

## 5. Consent Client — `sgtm/oil2-consent-client.tpl`

### Zweck
Empfängt den **Consent-Beacon** (`src/bridges/beacon.ts`), den OIL2 bei jeder **Entscheidung** (`setConsent`/`revoke`) clientseitig per `navigator.sendBeacon` an `<endpoint>/oil2/consent` (POST) sendet, und setzt `oil2` + `oil2_srv` **autoritativ serverseitig**. Damit:
- entsteht der HttpOnly-Backup `oil2_srv` **sofort** — nicht erst beim nächsten Request über den Cookie Keeper (#2),
- steht der Consent Server-Tags ab dem nächsten Hit bereit,
- wird der Consent-Log **nicht** hier geschrieben (das übernimmt weiterhin der dataLayer → sGTM → BigQuery Pfad; kein Doppel-Logging).

Dies ist die optionale **Stufe C** (Cookie-Sync + sofortiger ITP-Backup). Aktivierung clientseitig: `server.enabled = true` **und** `server.consentBeacon = true` (+ `server.endpoint`).

### Template-Typ
**Client** (wie Probe-Client #4)

### Feldkonfiguration

```json
[
  {
    "type": "TEXT",
    "name": "requestPath",
    "displayName": "Request-Pfad",
    "defaultValue": "/oil2/consent",
    "help": "Pfad auf dem der Client lauscht. Standard: /oil2/consent"
  },
  {
    "type": "TEXT",
    "name": "jsCookieMaxAge",
    "displayName": "oil2 Max-Age (Sekunden)",
    "defaultValue": "31536000",
    "help": "Lebensdauer des JS-lesbaren oil2-Cookies. 31536000 = 365 Tage."
  },
  {
    "type": "TEXT",
    "name": "srvCookieMaxAge",
    "displayName": "oil2_srv Max-Age (Sekunden)",
    "defaultValue": "34560000",
    "help": "Lebensdauer des HttpOnly oil2_srv-Backups. 34560000 = 400 Tage."
  },
  {
    "type": "TEXT",
    "name": "cookieDomain",
    "displayName": "Cookie-Domain (optional)",
    "defaultValue": "",
    "help": "Leer lassen für auto-detect. Sonst z.B. '.example.de'"
  },
  {
    "type": "CHECKBOX",
    "name": "enableLogging",
    "checkboxText": "Debug-Logging aktivieren",
    "defaultValue": false
  }
]
```

### Sandboxed JavaScript

```javascript
// sGTM Client: OIL2 Consent Beacon Handler
var claimRequest = require('claimRequest');
var getRequestPath = require('getRequestPath');
var getRequestMethod = require('getRequestMethod');
var getRequestBody = require('getRequestBody');
var getRequestHeader = require('getRequestHeader');
var setCookie = require('setCookie');
var setResponseStatus = require('setResponseStatus');
var setResponseHeader = require('setResponseHeader');
var setResponseBody = require('setResponseBody');
var returnResponse = require('returnResponse');
var fromBase64 = require('fromBase64');
var JSON = require('JSON');
var logToConsole = require('logToConsole');

var requestPath = data.requestPath || '/oil2/consent';
var jsMaxAge = data.jsCookieMaxAge || '31536000';
var srvMaxAge = data.srvCookieMaxAge || '34560000';
var cookieDomain = data.cookieDomain || '';
var enableLogging = data.enableLogging || false;

// Nur auf konfigurierten Pfad reagieren
if (getRequestPath() !== requestPath) {
  return; // Nicht unser Request -> naechster Client darf claimen
}

claimRequest();

// CORS + Cache (Origin echoen, weil der Beacon credentials mitschickt)
setResponseHeader('Access-Control-Allow-Origin', getRequestHeader('Origin') || '*');
setResponseHeader('Access-Control-Allow-Credentials', 'true');
setResponseHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
setResponseHeader('Content-Type', 'application/json');

var method = getRequestMethod();

// Preflight (bei text/plain eigentlich nicht noetig, aber defensiv)
if (method === 'OPTIONS') {
  setResponseHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  setResponseHeader('Access-Control-Allow-Headers', 'content-type');
  setResponseStatus(204);
  setResponseBody('');
  returnResponse();
  return;
}

if (method !== 'POST') {
  setResponseStatus(405);
  setResponseBody('{"ok":false}');
  returnResponse();
  return;
}

var body = getRequestBody();
var parsed = body ? JSON.parse(body) : null;

if (!parsed) {
  if (enableLogging) logToConsole('[OIL2 Consent] invalid or empty body');
  setResponseStatus(400);
  setResponseBody('{"ok":false}');
  returnResponse();
  return;
}

// Cookie-Optionen
var jsOpts = { 'max-age': jsMaxAge, secure: true, sameSite: 'lax', path: '/' };
var srvOpts = { 'max-age': srvMaxAge, httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
if (cookieDomain) {
  jsOpts.domain = cookieDomain;
  srvOpts.domain = cookieDomain;
}

// Widerruf: BEIDE Cookies loeschen (auch oil2_srv), sonst wuerde der Restore-Tag
// den widerrufenen Consent beim naechsten Load wiederherstellen.
if (parsed.action === 'revoke') {
  var delJs = { 'max-age': '0', secure: true, sameSite: 'lax', path: '/' };
  var delSrv = { 'max-age': '0', httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
  if (cookieDomain) {
    delJs.domain = cookieDomain;
    delSrv.domain = cookieDomain;
  }
  setCookie('oil2', '', delJs);
  setCookie('oil2_srv', '', delSrv);
  if (enableLogging) logToConsole('[OIL2 Consent] revoke -> cleared oil2 + oil2_srv');
  setResponseStatus(200);
  setResponseBody('{"ok":true,"cleared":true}');
  returnResponse();
  return;
}

// Sonst: Consent-Wert validieren + autoritativ setzen
var encoded = parsed.c;
var decoded = encoded ? JSON.parse(fromBase64(encoded)) : null;
var valid = decoded &&
  (decoded.f === 0 || decoded.f === 1) &&
  (decoded.a === 0 || decoded.a === 1) &&
  (decoded.m === 0 || decoded.m === 1);

if (valid) {
  setCookie('oil2', encoded, jsOpts);
  setCookie('oil2_srv', encoded, srvOpts);
  if (enableLogging) logToConsole('[OIL2 Consent] set oil2 + oil2_srv from beacon');
  setResponseStatus(200);
  setResponseBody('{"ok":true}');
} else {
  if (enableLogging) logToConsole('[OIL2 Consent] invalid consent payload');
  setResponseStatus(400);
  setResponseBody('{"ok":false}');
}

returnResponse();
```

### Berechtigungen

```json
{
  "set_cookies": {
    "allowedCookies": ["oil2", "oil2_srv"]
  },
  "read_request": {
    "requestAccess": "specific",
    "headerWhitelist": ["origin", "content-type"],
    "pathAllowed": true,
    "bodyAllowed": true,
    "methodAllowed": true
  },
  "return_response": {
    "headerWhitelist": [
      "access-control-allow-origin",
      "access-control-allow-credentials",
      "access-control-allow-methods",
      "access-control-allow-headers",
      "cache-control",
      "content-type"
    ]
  },
  "logging": {
    "environments": ["debug"]
  }
}
```

### Payload (Beacon → Client)

text/plain, JSON-Body:

```json
{ "c": "<base64 oil2-Cookie-Wert>", "action": "accept_all|reject_all|custom|revoke" }
```

`c` ist der base64-kodierte `oil2`-Cookie-Wert (gleiche Kodierung wie der clientseitige Cookie). `action` spiegelt die Entscheidung; nur `revoke` löst das Löschen beider Cookies aus.

### Ablauf im Detail

```
Browser                          sGTM (stape.io)
   │                                    │
   │  POST /oil2/consent                │
   │  Content-Type: text/plain          │
   │  { "c":"eyJmIj...","action":"...} │
   │  ──────────────────────────►       │
   │                                    │
   │                          Consent Client claimt Request
   │                          action=revoke? → oil2 + oil2_srv löschen (max-age=0)
   │                          sonst → c validieren (f/a/m ∈ {0,1})
   │                                   → oil2 (365d) + oil2_srv (HttpOnly, 400d) setzen
   │                                    │
   │  200 {"ok":true}                   │
   │  Set-Cookie: oil2, oil2_srv        │
   │  ◄──────────────────────────       │
   │                                    │
   │  HttpOnly-Backup existiert sofort  │
```

### Warum `revoke` beide Cookies löscht

`revoke()` löscht clientseitig nur `oil2` (JS hat keinen Zugriff auf das HttpOnly-`oil2_srv`). Ohne serverseitiges Löschen von `oil2_srv` würde der Restore-Tag (#3) beim nächsten Load `oil2` aus dem alten, noch auf *granted* stehenden `oil2_srv` wiederherstellen — der Widerruf wäre unwirksam. Der Beacon mit `action=revoke` schließt diese Lücke serverseitig.

### Transport / CORS

Der Beacon sendet als `text/plain` → CORS-„simple request", kein Preflight. `navigator.sendBeacon` schickt Credentials automatisch mit; die `Set-Cookie` der Antwort greift im Same-Origin-/Own-CDN-Setup (gleiches IP-Matching wie der Rest). Im echten Cross-Origin-Subdomain-Setup können Drittanbieter-Cookie-Restriktionen das `Set-Cookie` blockieren — daher **`same_origin`/`own_cdn` empfohlen**.

### Kritischer Hinweis

Feuert **nur** bei echten Entscheidungen (`setConsent`/`revoke`), **nie** bei `restore`/`init` — sonst entstünde eine Schleife (Server setzt Cookie → Client restored → Beacon → Server setzt Cookie …). Diese Trennung liegt in `engine.ts`/`beacon.ts`, nicht im Template.

---

## 6. Template-Installation — Zusammenfassung

### Installationsreihenfolge im sGTM Container

1. **OIL2 Variable** — Zuerst, wird von Tags referenziert
2. **OIL2 Probe Client** — Client-Template, lauscht auf `/oil2/restore`
3. **OIL2 Consent Client** — Client-Template, lauscht auf `/oil2/consent` (nur bei Stufe C / `consentBeacon`)
4. **OIL2 Cookie Keeper** — Tag, Trigger: All Pages
5. **OIL2 Cookie Restore** — Tag, Trigger: All Pages

### Trigger-Konfiguration

| Template | Trigger | Bedingung |
|---|---|---|
| Variable | — | Wird von Tags als Variable referenziert |
| Cookie Keeper | All Pages | Jeder eingehende Request |
| Cookie Restore | All Pages | Jeder eingehende Request |
| Probe Client | — | Client lauscht automatisch auf `/oil2/restore` |
| Consent Client | — | Client lauscht automatisch auf `/oil2/consent` (Stufe C) |

### Prüfung nach Installation

1. **Variable testen:** Im sGTM Preview Mode prüfen, ob die Variable den Consent-Status korrekt liest
2. **Keeper testen:** Consent erteilen → In sGTM Preview prüfen, ob `oil2_srv` gesetzt wird
3. **Restore testen:** `oil2` JS-Cookie manuell löschen → Seite neu laden → Prüfen ob `oil2` wiederhergestellt wird
4. **Probe testen:** URL `example.de/metrics/oil2/restore` direkt aufrufen → Response sollte `{"restored":true}` oder Status 204 sein
5. **Consent Client testen** (nur Stufe C): `curl -X POST 'https://<domain>/<sgtm-pfad>/oil2/consent' --data '{"c":"<base64>","action":"accept_all"}'` → Response `{"ok":true}` + `Set-Cookie: oil2, oil2_srv`. Mit `action":"revoke"` → `{"ok":true,"cleared":true}` und beide Cookies werden gelöscht.

---

## 7. Hinweise zur sGTM Sandbox

### Verfügbare APIs (relevant für OIL2)

| API | Zweck |
|---|---|
| `getCookieValues(name)` | Cookie-Werte als Array lesen |
| `setCookie(name, value, options)` | Cookie setzen (mit httpOnly, secure, etc.) |
| `getEventData(key)` | Event-Daten aus eingehendem Request |
| `claimRequest()` | Request für diesen Client claimen |
| `returnResponse()` | Response an Browser senden |
| `setResponseHeader(key, value)` | Response-Header setzen |
| `setResponseBody(body)` | Response-Body setzen |
| `setResponseStatus(code)` | HTTP-Status-Code setzen |
| `getRequestHeader(key)` | Request-Header lesen |
| `getRequestPath()` | Request-Pfad lesen |
| `JSON.parse(str)` | JSON dekodieren |
| `JSON.stringify(obj)` | JSON enkodieren |
| `fromBase64(str)` | Base64 dekodieren |
| `logToConsole(msg)` | Debug-Ausgabe (nur in Preview Mode sichtbar) |

### Nicht verfügbare APIs (häufige Fehlerquelle)

- `console.log` → Nutze `logToConsole`
- `atob` / `btoa` → Nutze `fromBase64` (kein `toBase64` nötig, sGTM schreibt keine Base64)
- `fetch` → Nicht direkt verfügbar (nutze `sendHttpRequest` für Tag Templates)
- `setTimeout` / `setInterval` → Nicht verfügbar
- `Promise` → Nicht verfügbar
- ES6 Syntax → Nicht verfügbar

### Cookie-Besonderheiten in sGTM

- `getCookieValues()` gibt ein **Array** zurück, nicht einen einzelnen Wert
- `setCookie()` setzt Cookies via `Set-Cookie` Response-Header
- Cookies werden erst beim nächsten Request des Browsers sichtbar
- `httpOnly: true` in `setCookie()` macht den Cookie für JavaScript unsichtbar
