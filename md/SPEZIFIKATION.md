# OIL2 — Modul-Spezifikation

**Zweck:** Detaillierte Spezifikation jedes TypeScript-Moduls mit Interfaces, Types, Funktionssignaturen, Ein-/Ausgaben und Edge Cases. Implementiere jedes Modul exakt nach dieser Spezifikation.

---

## 1. Shared Types — `src/core/types.ts`

Dieses Modul definiert alle Types und Interfaces. Keine Logik, nur Typen.

```typescript
// === Consent Categories ===

export type ConsentCategory = 'functional' | 'analytics' | 'marketing';

export interface ConsentChoices {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export type ConsentAction = 'accept_all' | 'reject_all' | 'custom' | 'update' | 'revoke';

// === Cookie Payload ===

export interface CookiePayload {
  f: 0 | 1;    // functional
  a: 0 | 1;    // analytics
  m: 0 | 1;    // marketing
  t: number;    // unix timestamp (seconds)
  v: number;    // config version
  ab: string;   // A/B variant
}

// === State Machine ===

export type ConsentState =
  | 'INIT'       // Stub hat Default gesetzt, OIL2 Main noch nicht geladen
  | 'WAITING'    // Cookie-Restore-Polling läuft (Safari ITP)
  | 'PENDING'    // Banner wird angezeigt, wartet auf User
  | 'RESTORED'   // Consent aus Cookie wiederhergestellt
  | 'GRANTED'    // User hat (teilweise) zugestimmt
  | 'DENIED'     // User hat alles abgelehnt
  | 'ACTIVE'     // Consent steht, normale Nutzung
  | 'UPDATING';  // Preference Center ist offen

// === Events ===

export type OIL2Event =
  | 'consent:granted'
  | 'consent:denied'
  | 'consent:updated'
  | 'consent:restored'
  | 'banner:shown'
  | 'banner:hidden';

export type EventCallback = (data: ConsentChoices) => void;

// === Config ===

export type ConsentModeType = 'advanced' | 'basic';
export type ClarityCategory = 'marketing' | 'analytics';
export type ServerMode = 'same_origin' | 'own_cdn' | 'subdomain';
export type GeoScope = 'eu_only' | 'worldwide' | 'custom';
export type BannerPosition = 'bottom' | 'top' | 'center';
export type BannerTheme = 'light' | 'dark' | 'auto';

export interface OIL2Config {
  _v: number;
  _ab: string;
  consentMode: ConsentModeType;

  categories: {
    functional: CategoryConfig;
    analytics: CategoryConfig;
    marketing: CategoryConfig;
  };

  cookie: {
    name: string;       // immer 'oil2', nicht änderbar
    domain: string;
    days: number;
    sameSite: 'Lax' | 'Strict' | 'None';
  };

  server: {
    enabled: boolean;
    endpoint: string;
    mode: ServerMode;
    cookieKeeper: boolean;
    restoreCookie: boolean;
    restoreTimeout: number;    // ms, default 500
    probeEndpoint: boolean;
    consentBeacon: boolean;    // Stufe C: Consent-Beacon an /oil2/consent
  };

  google: {
    urlPassthrough: boolean;
    adsDataRedaction: boolean;
  };

  clarity: {
    category: ClarityCategory;
  };

  ui: UIConfig;

  consentLog: {
    enabled: boolean;
    dataLayerEvent: string;
  };

  geo: {
    scope: GeoScope;
    regions: string[];
    fallback: 'show_banner' | 'grant_all';
  };
}

export interface CategoryConfig {
  label: string;
  description: string;
  default: boolean;
}

export interface UIConfig {
  position: BannerPosition;
  theme: BannerTheme;
  equalButtons: boolean;
  privacyUrl: string;
  imprintUrl: string;
  labels: UILabels;
}

export interface UILabels {
  title: string;
  description: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  save: string;
}

// === Google Consent Mode Signals ===

export interface GoogleConsentState {
  analytics_storage: 'granted' | 'denied';
  ad_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
  functionality_storage: 'granted' | 'denied';
  personalization_storage: 'granted' | 'denied';
  security_storage: 'granted';
}

// === DataLayer Events ===

export interface ConsentLogEvent {
  event: string;
  oil2_consent_id: string;
  oil2_action: ConsentAction;
  oil2_functional: boolean;
  oil2_analytics: boolean;
  oil2_marketing: boolean;
  oil2_timestamp: string;      // ISO 8601
  oil2_url: string;
  oil2_referrer: string;
  oil2_config_version: number;
  oil2_banner_variant: string;
  oil2_version: string;
  oil2_screen: string;
}

export interface ConsentUpdateEvent {
  event: 'oil2_consent_update';
  oil2_functional: boolean;
  oil2_analytics: boolean;
  oil2_marketing: boolean;
}

// === Internal ===

export interface RestoreResult {
  success: boolean;
  source: 'cookie' | 'polling' | 'probe' | 'none';
  choices: ConsentChoices | null;
  duration: number;   // ms
}
```

---

## 2. Config Parser — `src/storage/config.ts`

### Verantwortlichkeit
Liest die JSON-Config aus dem DOM (`<script id="oil2-config">`), validiert sie, füllt Defaults auf und berechnet den Version-Hash.

### Exports

```typescript
export function parseConfig(): OIL2Config;
export function getConfigHash(config: OIL2Config): number;
export function hasConfigChanged(storedVersion: number, currentConfig: OIL2Config): boolean;
```

### `parseConfig()`

**Input:** Keins (liest aus DOM).

**Ablauf:**
1. `document.getElementById('oil2-config')` suchen
2. Wenn nicht gefunden → `console.warn('[OIL2] Config element #oil2-config not found, using defaults')` → Default-Config zurückgeben
3. `textContent` parsen mit `JSON.parse()`
4. Bei Parse-Error → `console.warn('[OIL2] Invalid config JSON')` → Default-Config
5. Deep-Merge mit Default-Config (User-Werte überschreiben Defaults)
6. Validierung:
   - `_v` muss eine positive Ganzzahl sein
   - `consentMode` muss `'advanced'` oder `'basic'` sein
   - `server.restoreTimeout` muss zwischen 100 und 2000 liegen
   - `cookie.days` muss zwischen 1 und 365 liegen
   - `clarity.category` muss `'marketing'` oder `'analytics'` sein
7. Bei Validierungsfehler → `console.warn` + Fallback auf Default für das betroffene Feld

**Output:** Vollständiges `OIL2Config` Objekt (immer gültig, nie partial).

**Default-Config:**
```typescript
const DEFAULT_CONFIG: OIL2Config = {
  _v: 1,
  _ab: 'A',
  consentMode: 'advanced',
  categories: {
    functional: { label: 'Funktionale Cookies', description: 'Chat-Widgets, Videos, Karten.', default: false },
    analytics: { label: 'Statistik-Cookies', description: 'Anonyme Nutzungsanalyse.', default: false },
    marketing: { label: 'Marketing-Cookies', description: 'Werbung, Conversion-Messung.', default: false }
  },
  cookie: { name: 'oil2', domain: '', days: 365, sameSite: 'Lax' },
  server: { enabled: false, endpoint: '', mode: 'same_origin', cookieKeeper: true, restoreCookie: true, restoreTimeout: 500, probeEndpoint: true },
  google: { urlPassthrough: true, adsDataRedaction: false },
  clarity: { category: 'marketing' },
  ui: {
    position: 'bottom', theme: 'light', equalButtons: true,
    privacyUrl: '/datenschutz', imprintUrl: '/impressum',
    labels: {
      title: 'Cookie-Einstellungen',
      description: 'Wir nutzen Cookies zur Analyse und Verbesserung unserer Website.',
      acceptAll: 'Alle akzeptieren', rejectAll: 'Alle ablehnen',
      customize: 'Einstellungen', save: 'Auswahl speichern'
    }
  },
  consentLog: { enabled: true, dataLayerEvent: 'oil2_consent_log' },
  geo: { scope: 'eu_only', regions: [], fallback: 'show_banner' }
};
```

### `getConfigHash(config)`

**Input:** `OIL2Config`
**Ablauf:** Nimmt `config._v` und gibt den Wert direkt zurück. Kein komplexes Hashing nötig — die `_v` Versionsnummer ist der Hash.
**Output:** `number`

### `hasConfigChanged(storedVersion, currentConfig)`

**Input:** Version aus Cookie, aktuelle Config
**Output:** `true` wenn `storedVersion !== currentConfig._v`

### Edge Cases
- `<script id="oil2-config">` fehlt → Default-Config, kein Error
- JSON ist leer `{}` → Default-Config (Deep-Merge)
- Unbekannte Felder in JSON → ignorieren (kein Error)
- `cookie.domain` leer → Browser setzt Domain automatisch auf aktuelle Domain

---

## 3. Cookie Storage — `src/storage/cookies.ts`

### Verantwortlichkeit
Lesen und Schreiben des `oil2` JS-Cookies. Encode/Decode der Cookie-Payload (Base64 JSON). Hat keinen Zugriff auf `oil2_srv` (das ist sGTM-only).

### Exports

```typescript
export function readConsent(): CookiePayload | null;
export function writeConsent(choices: ConsentChoices, config: OIL2Config): void;
export function deleteConsent(config: OIL2Config): void;
export function encodeCookie(payload: CookiePayload): string;
export function decodeCookie(raw: string): CookiePayload | null;
export function payloadToChoices(payload: CookiePayload): ConsentChoices;
export function choicesToPayload(choices: ConsentChoices, config: OIL2Config): CookiePayload;
```

### `readConsent()`

**Ablauf:**
1. `document.cookie` nach `oil2=([^;]+)` durchsuchen (Regex)
2. Wenn nicht gefunden → `null`
3. Match[1] durch `decodeCookie()` dekodieren
4. Bei Fehler → `null`

**Output:** `CookiePayload | null`

### `writeConsent(choices, config)`

**Ablauf:**
1. Payload erstellen via `choicesToPayload(choices, config)`
2. Payload enkodieren via `encodeCookie(payload)`
3. Cookie setzen: `document.cookie = 'oil2=' + encoded + '; max-age=' + (config.cookie.days * 86400) + '; path=/; SameSite=' + config.cookie.sameSite + '; Secure' + (config.cookie.domain ? '; domain=' + config.cookie.domain : '')`

### `deleteConsent(config)`

Cookie löschen via `max-age=0`.

### `encodeCookie(payload)`

`btoa(JSON.stringify(payload))`

### `decodeCookie(raw)`

**Ablauf:**
1. `JSON.parse(atob(raw))`
2. Validierung: `f`, `a`, `m` müssen 0 oder 1 sein, `t` muss positive Zahl sein, `v` muss positive Zahl sein
3. Bei Validierungsfehler → `console.warn('[OIL2] Corrupt cookie payload')` → `null`

### `choicesToPayload(choices, config)`

```typescript
return {
  f: choices.functional ? 1 : 0,
  a: choices.analytics ? 1 : 0,
  m: choices.marketing ? 1 : 0,
  t: Math.floor(Date.now() / 1000),
  v: config._v,
  ab: config._ab
};
```

### `payloadToChoices(payload)`

```typescript
return {
  functional: payload.f === 1,
  analytics: payload.a === 1,
  marketing: payload.m === 1
};
```

### Edge Cases
- Base64 Decode Fehler (korrupte Daten) → `null`, kein throw
- Cookie > 4KB (sehr unwahrscheinlich bei ~60 Bytes) → Browser schneidet ab, `readConsent` gibt `null`
- `atob()` mit ungültigen Zeichen → try/catch fängt ab
- Mehrere `oil2=` Cookies (sollte nicht vorkommen) → Regex nimmt den ersten Match

---

## 4. Consent Engine — `src/core/engine.ts`

### Verantwortlichkeit
State Machine, Event Bus und zentrale Steuerung. Orchestriert alle anderen Module.

### Exports

```typescript
export function createEngine(config: OIL2Config): OIL2Engine;

export interface OIL2Engine {
  init(): Promise<void>;
  getState(): ConsentState;
  getConsent(): ConsentChoices;
  setConsent(choices: ConsentChoices, action: ConsentAction): void;
  show(): void;
  showPreferences(): void;
  revoke(): void;
  on(event: OIL2Event, callback: EventCallback): void;
  off(event: OIL2Event, callback: EventCallback): void;
}
```

### `createEngine(config)` — Factory Function

Erstellt den Engine mit interner State-Verwaltung.

**Interner State:**
```typescript
let _state: ConsentState = 'INIT';
let _choices: ConsentChoices = { functional: false, analytics: false, marketing: false };
const _listeners: Map<OIL2Event, Set<EventCallback>> = new Map();
```

### `init()` — Hauptinitialisierung

**Ablauf:**

1. Cookie lesen via `readConsent()`

2. **Cookie vorhanden:**
   a. Config-Version prüfen via `hasConfigChanged(payload.v, config)`
   b. Version gleich → `_choices = payloadToChoices(payload)` → State `RESTORED`
   c. Version anders → Cookie löschen → weiter wie "kein Cookie"
   d. Bridges feuern (Google, UET, Clarity, dataLayer)
   e. Emit `consent:restored`
   f. State → `ACTIVE`

3. **Kein Cookie + Server-Restore aktiv:**
   a. State → `WAITING`
   b. `waitForCookieRestore(config.server.restoreTimeout)` aufrufen
   c. Restore erfolgreich → wie Schritt 2
   d. Restore fehlgeschlagen + probeEndpoint aktiv → `probeRestore(config.server.endpoint)` aufrufen
   e. Probe erfolgreich → wie Schritt 2
   f. Probe fehlgeschlagen → weiter zu Schritt 4

4. **Kein Cookie, kein Restore:**
   a. State → `PENDING`
   b. Banner zeigen
   c. Emit `banner:shown`

### `setConsent(choices, action)`

**Ablauf:**
1. `_choices` aktualisieren
2. Cookie schreiben via `writeConsent(choices, config)`
3. Bridges feuern: Google CM, UET, Clarity, dataLayer
4. dataLayer Consent-Log Event pushen (wenn `consentLog.enabled`)
5. Stufe C: `pushConsentBeacon(choices, action, config)` (no-op wenn nicht aktiv)
6. Banner schließen
7. State → `ACTIVE`
8. Emit `consent:granted` (wenn mindestens eine Kategorie true) oder `consent:denied` (wenn alle false)
9. Emit `banner:hidden`

### `show()`

Banner erneut anzeigen. State → `UPDATING`. Emit `banner:shown`.

### `showPreferences()`

Preference Center öffnen (lazy load). State → `UPDATING`.

### `revoke()`

1. `_choices` auf alles `false` setzen
2. Cookie löschen
3. Bridges feuern (alle denied)
4. Consent-Log Event mit action `'revoke'` pushen (wenn `consentLog.enabled`)
5. Stufe C: `pushConsentBeacon(choices, 'revoke', config)` → Consent-Client löscht serverseitig BEIDE Cookies
6. State → `PENDING`
7. Banner zeigen

### `on(event, callback)` / `off(event, callback)`

Standard Event Bus mit `Map<string, Set<Function>>`.

### Edge Cases
- `init()` wird doppelt aufgerufen → Idempotent, zweiter Aufruf ignorieren (Guard via State)
- Cookie ist vorhanden aber korrupt → `readConsent()` gibt `null` → behandeln wie "kein Cookie"
- Browser blockiert Cookies → `readConsent()` gibt immer `null` → Banner bei jedem Besuch (korrektes DSGVO-Verhalten)
- `setConsent()` mit Partial-Objekt → TypeScript verhindert das, aber zur Sicherheit mit Default-Werten mergen

---

## 5. Cookie Restore — `src/core/restore.ts`

### Verantwortlichkeit
Cookie-Restore-Polling für Safari ITP und Probe-Request als Fallback.

### Exports

```typescript
export function waitForCookieRestore(timeout: number, interval?: number): Promise<RestoreResult>;
export function probeRestore(endpoint: string): Promise<RestoreResult>;
```

### `waitForCookieRestore(timeout, interval = 50)`

**Ablauf:**
1. Start-Timestamp merken
2. Interval starten (alle `interval` ms):
   a. `document.cookie` nach `oil2=` durchsuchen
   b. Cookie gefunden → Interval stoppen → Payload dekodieren → Return `{ success: true, source: 'polling', choices, duration }`
   c. Timeout erreicht (`Date.now() - start >= timeout`) → Interval stoppen → Return `{ success: false, source: 'none', choices: null, duration }`
3. Als Promise wrappen

**Wichtig:** Nutzt `setInterval`, nicht `setTimeout`-Rekursion (konsistenteres Timing).

### `probeRestore(endpoint)`

**Ablauf:**
1. `fetch(endpoint + '/oil2/restore', { method: 'GET', credentials: 'include' })` aufrufen
2. `credentials: 'include'` ist Pflicht — sonst wird `oil2_srv` HttpOnly-Cookie nicht mitgeschickt
3. Response ignorieren (der Cookie kommt via `Set-Cookie` Header)
4. Nach fetch: `document.cookie` nach `oil2=` durchsuchen
5. Cookie gefunden → Return `{ success: true, source: 'probe', choices, duration }`
6. Kein Cookie → Return `{ success: false, source: 'none', choices: null, duration }`
7. Bei Netzwerkfehler → `console.warn('[OIL2] Probe request failed')` → Return failure

### Edge Cases
- `fetch` nicht verfügbar (sehr alte Browser) → try/catch → Return failure
- CORS-Fehler (falsche sGTM-Konfiguration) → Return failure, nicht crashen
- Probe-Response ist 404 (sGTM Template nicht installiert) → Return failure
- Timeout = 0 → Sofort null zurückgeben (kein Polling)
- Cookie erscheint exakt am Timeout-Punkt → Rennen gewinnen, Cookie akzeptieren

---

## 6. Google Consent Mode v2 Bridge — `src/bridges/gcm.ts`

### Verantwortlichkeit
Sendet `gtag('consent', 'update', {...})` an Google Tag Manager.

### Exports

```typescript
export function pushGoogleConsent(choices: ConsentChoices, config: OIL2Config): void;
export function buildGoogleConsentState(choices: ConsentChoices): GoogleConsentState;
```

### `pushGoogleConsent(choices, config)`

**Ablauf:**
1. `window.dataLayer` prüfen (muss existieren, vom Stub angelegt)
2. Google Consent State bauen via `buildGoogleConsentState(choices)`
3. `gtag('consent', 'update', state)` aufrufen

**Dabei:** `gtag` ist die globale Funktion, die via `dataLayer.push(arguments)` implementiert ist (im Stub definiert).

4. Wenn `config.google.urlPassthrough === true`:
   `gtag('set', 'url_passthrough', true)`
5. Wenn `config.google.adsDataRedaction === true`:
   `gtag('set', 'ads_data_redaction', true)`

### `buildGoogleConsentState(choices)`

```typescript
return {
  analytics_storage:       choices.analytics  ? 'granted' : 'denied',
  ad_storage:              choices.marketing  ? 'granted' : 'denied',
  ad_user_data:            choices.marketing  ? 'granted' : 'denied',
  ad_personalization:      choices.marketing  ? 'granted' : 'denied',
  functionality_storage:   choices.functional ? 'granted' : 'denied',
  personalization_storage: choices.functional ? 'granted' : 'denied',
  security_storage:        'granted'
};
```

### Edge Cases
- `window.dataLayer` existiert nicht → `console.warn('[OIL2] dataLayer not found')`, kein Crash
- `gtag` Funktion existiert nicht → Definiere sie inline: `function gtag() { dataLayer.push(arguments); }`

---

## 7. Microsoft UET Bridge — `src/bridges/uet.ts`

### Verantwortlichkeit
Sendet Consent-Status an Microsoft UET.

### Exports

```typescript
export function pushUETConsent(choices: ConsentChoices): void;
```

### `pushUETConsent(choices)`

**Ablauf:**
1. `window.uetq` prüfen — wenn nicht vorhanden, `window.uetq = []` initialisieren
2. `uetq.push('consent', 'update', { ad_storage: choices.marketing ? 'granted' : 'denied' })`

**Wichtig:** UET kennt nur `ad_storage`. Kein `analytics_storage`, kein `functionality_storage`.

### Edge Cases
- UET Script nicht geladen → `uetq` ist Array, Events werden gequeued und bei UET-Ladung nachgeholt (UET-eigenes Verhalten)
- Kein Microsoft Ads auf der Seite → kein Schaden, Events werden gepusht aber nie verarbeitet

---

## 8. Microsoft Clarity Bridge — `src/bridges/clarity.ts`

### Verantwortlichkeit
Sendet Consent-Status an Microsoft Clarity mit korrektem CamelCase.

### Exports

```typescript
export function pushClarityConsent(choices: ConsentChoices, config: OIL2Config): void;
```

### `pushClarityConsent(choices, config)`

**Ablauf:**
1. `window.clarity` prüfen — wenn nicht vorhanden → `console.warn('[OIL2] Clarity not loaded, skipping')` → Return
2. Clarity-Kategorie aus Config lesen (`config.clarity.category`)
3. Consent-Objekt bauen:

```typescript
const clarityConsent: Record<string, string> = {
  ad_Storage: choices.marketing ? 'granted' : 'denied'
};

if (config.clarity.category === 'marketing') {
  clarityConsent.analytics_Storage = choices.marketing ? 'granted' : 'denied';
} else {
  clarityConsent.analytics_Storage = choices.analytics ? 'granted' : 'denied';
}
```

4. `clarity('consentv2', clarityConsent)` aufrufen

**KRITISCH:** CamelCase! `ad_Storage` (großes S), `analytics_Storage` (großes S). Google und UET nutzen `ad_storage` (kleines s). Verwechslung = Consent wird von Clarity ignoriert.

### Edge Cases
- Clarity nicht geladen → Skip, kein Error (viele Kunden nutzen kein Clarity)
- `clarity.category = 'analytics'` → Clarity Analytics-Consent hängt an `choices.analytics` statt `choices.marketing`
- Clarity Script lädt nach OIL2 → Consent wird nicht nachträglich gesetzt (Limitation — Clarity muss vor oder gleichzeitig mit OIL2 laden)

---

## 9. dataLayer Bridge — `src/bridges/datalayer.ts`

### Verantwortlichkeit
Pusht Consent-Events in den dataLayer für GTM und sGTM.

### Exports

```typescript
export function pushConsentUpdate(choices: ConsentChoices): void;
export function pushConsentLog(choices: ConsentChoices, action: ConsentAction, config: OIL2Config): void;
```

### `pushConsentUpdate(choices)`

```typescript
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event: 'oil2_consent_update',
  oil2_functional: choices.functional,
  oil2_analytics: choices.analytics,
  oil2_marketing: choices.marketing
});
```

### `pushConsentLog(choices, action, config)`

```typescript
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event: config.consentLog.dataLayerEvent,   // default: 'oil2_consent_log'
  oil2_consent_id: crypto.randomUUID(),
  oil2_action: action,
  oil2_functional: choices.functional,
  oil2_analytics: choices.analytics,
  oil2_marketing: choices.marketing,
  oil2_timestamp: new Date().toISOString(),
  oil2_url: location.href,
  oil2_referrer: document.referrer,
  oil2_config_version: config._v,
  oil2_banner_variant: config._ab,
  oil2_version: OIL2_VERSION,   // Build-Konstante
  oil2_screen: screen.width + 'x' + screen.height
});
```

### Edge Cases
- `crypto.randomUUID()` nicht verfügbar (Pre-2021 Browser) → Fallback: `'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(...)` mit `Math.random()`
- `consentLog.enabled === false` → `pushConsentLog` wird nicht aufgerufen (Engine-Entscheidung)

---

## 9a. Consent-Beacon Bridge — `src/bridges/beacon.ts` (Stufe C)

### Verantwortlichkeit
Schiebt eine Consent-**Entscheidung** sofort an den sGTM Consent-Client (`<endpoint>/oil2/consent`). Der Client setzt `oil2` + `oil2_srv` autoritativ serverseitig — der HttpOnly-Backup entsteht damit sofort (nicht erst beim nächsten Request über den Cookie Keeper) und der Consent steht Server-Tags ab dem nächsten Hit bereit. Fire-and-forget via `navigator.sendBeacon`, Fallback `fetch({keepalive})`.

### Exports

```typescript
export function pushConsentBeacon(choices: ConsentChoices, action: ConsentAction, config: OIL2Config): void;
```

### `pushConsentBeacon(choices, action, config)`

**Ablauf:**
1. Gate: Wenn `!config.server.enabled || !config.server.consentBeacon || !config.server.endpoint` → sofort `return` (Stufe C nicht aktiv)
2. URL bauen: `config.server.endpoint.replace(/\/+$/, '') + '/oil2/consent'` (trailing Slashes entfernt)
3. Payload bauen: `{ c: encodeCookie(choicesToPayload(choices, config)), action }` → `JSON.stringify`
4. `navigator.sendBeacon(url, blob)` mit `Blob([body], { type: 'text/plain' })` — `text/plain` → CORS-„simple request", kein Preflight
5. Wenn `sendBeacon` `false` liefert (Queue voll) oder nicht verfügbar → `_fetchFallback`
6. `_fetchFallback`: `fetch(url, { method: 'POST', body, keepalive: true, credentials: 'include', headers: { 'Content-Type': 'text/plain' } })` — `keepalive` überlebt Page-Unload direkt nach dem Klick

### Payload-Format

```typescript
interface BeaconPayload {
  c: string;            // base64-kodierter oil2-Cookie-Wert (encodeCookie)
  action: ConsentAction; // 'accept_all' | 'reject_all' | 'custom' | 'update' | 'revoke'
}
```

### KRITISCH: Nur bei Entscheidungen feuern

`pushConsentBeacon` wird ausschließlich aus `setConsent` und `revoke` aufgerufen — NIEMALS aus `restore`/`init`. Andernfalls entstünde eine Schleife: Server setzt Cookie → Client restored → Beacon → Server setzt Cookie. Bei `action === 'revoke'` löscht der Consent-Client serverseitig BEIDE Cookies (auch `oil2_srv`); ohne diesen Schritt würde der Restore-Tag den widerrufenen Consent beim nächsten Load wiederherstellen.

### Edge Cases
- Stufe C nicht aktiv (`consentBeacon=false` oder kein Endpoint) → no-op, kein Netzwerk-Request
- `navigator.sendBeacon` nicht verfügbar → `fetch`-Fallback
- `fetch` ebenfalls nicht verfügbar → still verworfen (kein Crash)
- Netzwerkfehler → `console.warn('[OIL2] ...')`, kein throw (fire-and-forget)

---

## 10. Inline Stub — `src/stub.js`

### Verantwortlichkeit
Synchrones Inline-Script im `<head>`. Setzt Consent Defaults VOR GTM-Ladung. Muss als Raw-JavaScript copy-paste-fähig sein (kein TypeScript, kein Build).

### Code

```javascript
// OIL2 Stub v1.0 — inline in <head>, VOR GTM
(function(){
  window.dataLayer=window.dataLayer||[];
  function gtag(){dataLayer.push(arguments);}

  // 1. Bestehenden Consent aus Cookie lesen
  var c=document.cookie.match(/oil2=([^;]+)/);
  if(c){
    try{
      var s=JSON.parse(atob(c[1]));
      gtag('consent','default',{
        analytics_storage:       s.a?'granted':'denied',
        ad_storage:              s.m?'granted':'denied',
        ad_user_data:            s.m?'granted':'denied',
        ad_personalization:      s.m?'granted':'denied',
        functionality_storage:   s.f?'granted':'denied',
        personalization_storage: s.f?'granted':'denied',
        security_storage:        'granted'
      });
    }catch(e){
      // Korrupter Cookie → denied
      gtag('consent','default',{
        analytics_storage:'denied', ad_storage:'denied',
        ad_user_data:'denied', ad_personalization:'denied',
        functionality_storage:'denied', personalization_storage:'denied',
        security_storage:'granted', wait_for_update:500
      });
    }
  }else{
    // Kein Cookie → denied + wait
    gtag('consent','default',{
      analytics_storage:'denied', ad_storage:'denied',
      ad_user_data:'denied', ad_personalization:'denied',
      functionality_storage:'denied', personalization_storage:'denied',
      security_storage:'granted', wait_for_update:500
    });
  }

  // 2. Microsoft UET Default
  window.uetq=window.uetq||[];
  uetq.push('consent','default',{ad_storage:'denied'});
})();
```

### Wichtige Regeln
- KEIN `defer`, KEIN `async` — muss synchron laden
- KEIN ES6 — `var` statt `let`/`const`, keine Arrow Functions
- `wait_for_update: 500` nur wenn KEIN Cookie vorhanden (bei vorhandenem Cookie ist Default sofort `granted`/`denied` ohne Wait)
- Muss vor GTM-Script stehen
- Darf NICHT gebundelt werden — copy-paste in HTML

---

## 11. Public API — `src/index.ts`

### Verantwortlichkeit
Barrel Export, globale OIL2-API auf `window`, Auto-Init.

### Code-Struktur

```typescript
import { createEngine } from './core/engine';
import { parseConfig } from './storage/config';
import type { OIL2Engine } from './core/engine';

const OIL2_VERSION = '__VERSION__';  // Wird beim Build ersetzt

let _engine: OIL2Engine | null = null;

function init(): void {
  if (_engine) return;  // Idempotent
  const config = parseConfig();
  _engine = createEngine(config);
  _engine.init();
}

// Public API auf window
const publicAPI = {
  getConsent: () => _engine?.getConsent() ?? { functional: false, analytics: false, marketing: false },
  show: () => _engine?.show(),
  showPreferences: () => _engine?.showPreferences(),
  setConsent: (choices) => _engine?.setConsent(choices, 'custom'),
  revoke: () => _engine?.revoke(),
  on: (event, cb) => _engine?.on(event, cb),
  off: (event, cb) => _engine?.off(event, cb),
  version: OIL2_VERSION
};

// Auf window setzen
(window as any).OIL2 = publicAPI;

// Auto-Init bei DOMContentLoaded oder sofort wenn DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Named Exports für ES Module Nutzer
export { publicAPI as OIL2, OIL2_VERSION };
export type { ConsentChoices, OIL2Config, OIL2Event } from './core/types';
```

### Wichtige Details
- `__VERSION__` wird via Vite `define` beim Build ersetzt
- Auto-Init bei DOMContentLoaded (Script wird mit `defer` geladen)
- `window.OIL2` ist sofort verfügbar nach Script-Execution
- Wenn Engine nicht initialisiert → alle Getter geben Defaults, alle Setter sind no-ops

---

## 12. Banner UI — `src/ui/banner.ts`

### Verantwortlichkeit
Shadow DOM Banner mit Responsive Design und WCAG 2.1 AA Accessibility.

### Exports

```typescript
export function createBanner(config: OIL2Config, callbacks: BannerCallbacks): BannerInstance;

export interface BannerCallbacks {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onCustomize: () => void;
}

export interface BannerInstance {
  show(): void;
  hide(): void;
  destroy(): void;
}
```

### `createBanner(config, callbacks)`

**Ablauf:**
1. Container-Element erstellen: `document.createElement('div')` mit `id="oil2-banner-host"`
2. Shadow DOM anhängen: `container.attachShadow({ mode: 'open' })`
3. Styles injizieren (aus `styles.ts`)
4. Banner-HTML in Shadow DOM rendern
5. Event Listener auf Buttons
6. `document.body.appendChild(container)`

### Banner-Struktur (Shadow DOM)

```html
<div class="oil2-banner" role="dialog" aria-modal="true" aria-label="{config.ui.labels.title}">
  <div class="oil2-banner-content">
    <h2 class="oil2-banner-title">{config.ui.labels.title}</h2>
    <p class="oil2-banner-description">{config.ui.labels.description}</p>
    <div class="oil2-banner-links">
      <a href="{config.ui.privacyUrl}">{Datenschutzerklärung}</a>
      <a href="{config.ui.imprintUrl}">{Impressum}</a>
    </div>
  </div>
  <div class="oil2-banner-actions">
    <button class="oil2-btn oil2-btn-reject" type="button">{config.ui.labels.rejectAll}</button>
    <button class="oil2-btn oil2-btn-customize" type="button">{config.ui.labels.customize}</button>
    <button class="oil2-btn oil2-btn-accept" type="button">{config.ui.labels.acceptAll}</button>
  </div>
</div>
```

### WCAG 2.1 AA Anforderungen (aus `a11y.ts`)

- `role="dialog"` + `aria-modal="true"` + `aria-label`
- Focus Trap: Tab/Shift+Tab bleibt im Banner
- Erster Focus auf "Alle ablehnen" Button (nicht "Akzeptieren" — DSGVO)
- ESC-Taste → "Alle ablehnen" auslösen
- Kontrastverhältnis ≥ 4.5:1 für Text
- Minimum Touch Target: 44x44px
- `prefers-reduced-motion` respektieren

### Responsive Design

- Mobile (≤768px): Banner full-width, Buttons gestapelt (vertikal)
- Desktop (>768px): Banner full-width, Buttons nebeneinander (horizontal)
- Position konfigurierbar: `bottom` (Default), `top`, `center` (Modal-Overlay)

### `equalButtons`-Logik

Wenn `config.ui.equalButtons === true`: Alle Buttons haben identische Größe, Farbe und Font-Weight. "Akzeptieren" darf NICHT hervorgehoben sein (DSGVO-Anforderung für gleichwertige Buttons).

### Edge Cases
- Shadow DOM nicht verfügbar (Opera Mini) → Fallback auf reguläres DOM mit scoped Styles
- Mehrere `show()` Aufrufe → Idempotent, nur ein Banner gleichzeitig
- `destroy()` → Container aus DOM entfernen, Event Listener aufräumen

---

## 13. Preference Center — `src/ui/preferences.ts`

### Verantwortlichkeit
Detaillierte Consent-Einstellungen pro Kategorie. Lazy loaded (separater Chunk).

### Exports

```typescript
export function createPreferences(config: OIL2Config, currentChoices: ConsentChoices, callbacks: PreferenceCallbacks): PreferenceInstance;

export interface PreferenceCallbacks {
  onSave: (choices: ConsentChoices) => void;
  onClose: () => void;
}

export interface PreferenceInstance {
  show(): void;
  hide(): void;
  destroy(): void;
}
```

### Preference Center Struktur

```html
<div class="oil2-prefs" role="dialog" aria-modal="true">
  <h2>{config.ui.labels.title}</h2>

  <!-- Notwendig: immer aktiv, nicht toggle-bar -->
  <div class="oil2-prefs-category">
    <label>Notwendige Cookies</label>
    <span>Immer aktiv</span>
  </div>

  <!-- Funktional -->
  <div class="oil2-prefs-category">
    <label for="oil2-functional">{config.categories.functional.label}</label>
    <p>{config.categories.functional.description}</p>
    <input type="checkbox" id="oil2-functional" checked="{currentChoices.functional}">
  </div>

  <!-- Statistik -->
  <div class="oil2-prefs-category">
    <label for="oil2-analytics">{config.categories.analytics.label}</label>
    <p>{config.categories.analytics.description}</p>
    <input type="checkbox" id="oil2-analytics" checked="{currentChoices.analytics}">
  </div>

  <!-- Marketing -->
  <div class="oil2-prefs-category">
    <label for="oil2-marketing">{config.categories.marketing.label}</label>
    <p>{config.categories.marketing.description}</p>
    <input type="checkbox" id="oil2-marketing" checked="{currentChoices.marketing}">
  </div>

  <div class="oil2-prefs-actions">
    <button class="oil2-btn" type="button">{config.ui.labels.save}</button>
  </div>
</div>
```

### Wichtige Details
- Toggle-Inputs als native Checkboxes (nicht Custom — Accessibility)
- "Notwendig" Kategorie ist disabled/always-on
- Aktueller Consent-Status wird als Default-Checked gesetzt
- Save-Button liest Toggle-States und ruft `onSave(choices)` auf
- Focus Trap + ESC-Taste = Close
- Lazy Loaded: Wird erst bei Bedarf importiert (`import('./preferences')`)

---

## 14. CSS-in-JS — `src/ui/styles.ts`

### Verantwortlichkeit
Generiert CSS-String für Shadow DOM Injection.

### Exports

```typescript
export function getBannerStyles(config: OIL2Config): string;
export function getPreferencesStyles(config: OIL2Config): string;
```

### Theming via CSS Custom Properties

```css
:host {
  --oil2-bg: #ffffff;
  --oil2-text: #1a1a1a;
  --oil2-btn-bg: #1a1a1a;
  --oil2-btn-text: #ffffff;
  --oil2-btn-border: #1a1a1a;
  --oil2-link: #0066cc;
  --oil2-border: #e0e0e0;
  --oil2-radius: 8px;
  --oil2-font: system-ui, -apple-system, sans-serif;
  --oil2-z: 999999;
}
```

Dark-Theme überschreibt die Custom Properties. `auto` Theme nutzt `prefers-color-scheme` Media Query.

Kunden können die Custom Properties von außen überschreiben:
```css
#oil2-banner-host {
  --oil2-bg: #f5f5f5;
  --oil2-btn-bg: #0066cc;
}
```

---

## 15. WCAG Utilities — `src/ui/a11y.ts`

### Exports

```typescript
export function trapFocus(container: HTMLElement): () => void;  // Returns cleanup function
export function announceToScreenReader(message: string): void;
```

### `trapFocus(container)`

1. Alle fokussierbaren Elemente in `container` finden (`button, [href], input, select, textarea, [tabindex]`)
2. `keydown` Listener auf `container`:
   - Tab → Focus auf nächstes Element (wrap around)
   - Shift+Tab → Focus auf vorheriges Element (wrap around)
3. Returns Cleanup-Funktion die den Listener entfernt

### `announceToScreenReader(message)`

Erstellt ein `<div role="status" aria-live="polite">` Element, setzt Text, entfernt nach 1 Sekunde. Für Aktionen wie "Einstellungen gespeichert".

---

## 16. iFrame Blocker — `src/blocker/blocker.ts` (Phase 2, Priorität 1)

### Verantwortlichkeit
Blockt iFrames (YouTube, Maps, Social Embeds) bis Consent erteilt wird. Zeigt Placeholder mit Consent-Aufforderung.

### Exports

```typescript
export function initBlocker(getConsent: () => ConsentChoices, onConsentNeeded: () => void): void;
```

### Ablauf
1. Alle `<iframe>` mit `data-oil2-category` Attribut finden
2. `src` Attribut in `data-oil2-src` verschieben
3. Placeholder anzeigen: "Diesen Inhalt laden? [Kategorie] Cookies werden benötigt."
4. Bei Consent-Change: iFrames mit passendem Consent wiederherstellen (`data-oil2-src` → `src`)

### HTML-Markup (Website-Seite)

```html
<iframe data-oil2-category="marketing" data-oil2-src="https://www.youtube.com/embed/..." width="560" height="315"></iframe>
```

### Edge Cases
- iFrame ohne `data-oil2-category` → nicht blocken (normales Verhalten)
- Consent wird widerrufen → iFrame src entfernen + Placeholder wieder zeigen
- Lazy Loading (`loading="lazy"`) → Kompatibel, data-oil2-src wird bei Consent gesetzt

---

## Modul-Abhängigkeits-Graph

```
types.ts ← (wird von allen importiert)
    ↑
config.ts ← cookies.ts
    ↑           ↑
    └─────┬─────┘
          ↑
      engine.ts ← restore.ts
          ↑
    ┌─────┼─────────────┬─────────────┐
    ↑     ↑             ↑             ↑
  gcm.ts uet.ts    clarity.ts   beacon.ts (→ cookies.ts)
    ↑     ↑             ↑             ↑
    └─────┼─────────────┴─────────────┘
          ↑
    datalayer.ts
          ↑
      index.ts → banner.ts → styles.ts + a11y.ts
                    ↑
              preferences.ts (lazy)
```

Keine zirkulären Abhängigkeiten. `types.ts` ist Leaf-Modul (keine Imports). `beacon.ts` importiert zusätzlich `choicesToPayload` + `encodeCookie` aus `cookies.ts`.
