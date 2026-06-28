# OIL2 — Testmatrix

**Zweck:** Vollständige Testmatrix mit Unit Tests pro Modul, Integration Tests, Safari ITP Szenarien und Edge Cases. Alle Tests werden mit Vitest + happy-dom geschrieben.

---

## 1. Test-Setup

### Framework
- **Vitest** mit `happy-dom` Environment (DOM-Simulation)
- **Coverage:** v8 Provider, Schwellenwerte: 90% Statements, 85% Branches, 90% Functions, 90% Lines
- **Stub-JS ausgenommen** von Coverage (kein TypeScript, nicht testbar via Vitest)

### Test-Helpers

```typescript
// test/helpers.ts

/** Simuliert document.cookie */
export function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/`;
}

export function clearCookies(): void {
  document.cookie.split(';').forEach(c => {
    document.cookie = c.trim().split('=')[0] + '=; max-age=0; path=/';
  });
}

/** Erstellt Base64-encoded Cookie-Payload */
export function makeCookiePayload(overrides?: Partial<CookiePayload>): string {
  const payload: CookiePayload = {
    f: 1, a: 1, m: 0, t: Math.floor(Date.now() / 1000), v: 1, ab: 'A',
    ...overrides
  };
  return btoa(JSON.stringify(payload));
}

/** Injiziert OIL2 Config ins DOM */
export function injectConfig(config: Partial<OIL2Config>): void {
  const el = document.createElement('script');
  el.id = 'oil2-config';
  el.type = 'application/json';
  el.textContent = JSON.stringify(config);
  document.head.appendChild(el);
}

/** Cleanup nach jedem Test */
export function cleanup(): void {
  clearCookies();
  document.getElementById('oil2-config')?.remove();
  document.getElementById('oil2-banner-host')?.remove();
  (window as any).dataLayer = undefined;
  (window as any).uetq = undefined;
  (window as any).clarity = undefined;
  (window as any).OIL2 = undefined;
}

/** Mock für window.dataLayer */
export function mockDataLayer(): any[] {
  const dl: any[] = [];
  (window as any).dataLayer = dl;
  return dl;
}

/** Mock für window.clarity */
export function mockClarity(): jest.Mock {
  const fn = vi.fn();
  (window as any).clarity = fn;
  return fn;
}
```

---

## 2. Unit Tests — Config Parser

### Datei: `test/storage/config.test.ts`

```
describe('parseConfig', () => {

  T01: Config-Element vorhanden → gibt geparste Config zurück
  T02: Config-Element fehlt → gibt Default-Config zurück + console.warn
  T03: Config-Element mit leerem JSON {} → gibt Default-Config zurück
  T04: Config-Element mit ungültigem JSON → gibt Default-Config zurück + console.warn
  T05: Partial Config → mergt mit Defaults (fehlende Felder werden aufgefüllt)
  T06: Deep-Merge: nested Objekte korrekt gemergt (z.B. nur ui.labels.title überschrieben)
  T07: Unbekannte Felder werden ignoriert (kein Error)
  T08: _v = 0 → Fallback auf 1 + warn
  T09: _v = -5 → Fallback auf 1 + warn
  T10: _v = 'abc' → Fallback auf 1 + warn
  T11: consentMode = 'invalid' → Fallback auf 'advanced' + warn
  T12: server.restoreTimeout = 50 (unter Minimum) → Fallback auf 500 + warn
  T13: server.restoreTimeout = 5000 (über Maximum) → Fallback auf 500 + warn
  T14: cookie.days = 0 → Fallback auf 365 + warn
  T15: cookie.days = 400 → Fallback auf 365 + warn
  T16: clarity.category = 'invalid' → Fallback auf 'marketing' + warn
  T17: server.enabled = true, endpoint = '' → Warn ausgeben
  T18: server.mode = 'subdomain' → Warn ausgeben (kein ITP Bypass)

})

describe('getConfigHash', () => {

  T19: Gibt config._v als Hash zurück
  T20: Verschiedene _v Werte → verschiedene Hashes

})

describe('hasConfigChanged', () => {

  T21: storedVersion === config._v → false
  T22: storedVersion !== config._v → true
  T23: storedVersion = 0 (korrupter Cookie) → true

})
```

---

## 3. Unit Tests — Cookie Storage

### Datei: `test/storage/cookies.test.ts`

```
describe('readConsent', () => {

  T01: Cookie vorhanden → gibt CookiePayload zurück
  T02: Kein Cookie → gibt null zurück
  T03: Cookie mit korruptem Base64 → gibt null zurück + console.warn
  T04: Cookie mit validem Base64 aber ungültigem JSON → gibt null zurück
  T05: Cookie mit gültigem JSON aber falscher Struktur (f fehlt) → gibt null zurück
  T06: Cookie mit f=2 (nicht 0 oder 1) → gibt null zurück
  T07: Mehrere Cookies, oil2 ist einer davon → findet korrekten Cookie

})

describe('writeConsent', () => {

  T08: Schreibt Cookie mit korrektem Format
  T09: Cookie enthält Base64-encodierten JSON-Payload
  T10: max-age berechnet aus config.cookie.days × 86400
  T11: SameSite=Lax gesetzt
  T12: Secure Flag gesetzt
  T13: Domain wird gesetzt wenn in Config definiert
  T14: Domain wird nicht gesetzt wenn Config leer

})

describe('deleteConsent', () => {

  T15: Löscht Cookie via max-age=0
  T16: Cookie existiert nicht → kein Error

})

describe('encodeCookie / decodeCookie', () => {

  T17: Roundtrip: encode → decode → identisches Objekt
  T18: Encode produziert gültigen Base64-String
  T19: Decode mit leerem String → null
  T20: Decode mit null → null

})

describe('choicesToPayload / payloadToChoices', () => {

  T21: Alle true → f=1, a=1, m=1
  T22: Alle false → f=0, a=0, m=0
  T23: Mixed → korrekte Zuordnung
  T24: Timestamp wird automatisch gesetzt (innerhalb ±2 Sekunden)
  T25: Config-Version wird aus config._v übernommen
  T26: A/B-Variante wird aus config._ab übernommen
  T27: Roundtrip: choices → payload → choices → identisch

})
```

---

## 4. Unit Tests — Consent Engine

### Datei: `test/core/engine.test.ts`

```
describe('createEngine', () => {

  T01: Gibt OIL2Engine Objekt mit allen Methoden zurück
  T02: Initialer State ist 'INIT'

})

describe('init — Cookie vorhanden', () => {

  T03: Cookie vorhanden, gleiche Config-Version → State = ACTIVE
  T04: Cookie vorhanden → getConsent() gibt gespeicherte Choices zurück
  T05: Cookie vorhanden → Bridges werden gefeuert (Google, UET, Clarity, dataLayer)
  T06: Cookie vorhanden → 'consent:restored' Event wird emittiert
  T07: Cookie vorhanden, andere Config-Version → Cookie wird gelöscht, State = PENDING

})

describe('init — Kein Cookie, kein Server', () => {

  T08: Kein Cookie, server.enabled = false → State = PENDING
  T09: State PENDING → Banner wird gezeigt
  T10: State PENDING → 'banner:shown' Event wird emittiert

})

describe('init — Kein Cookie, mit Server', () => {

  T11: server.enabled, restoreCookie → State = WAITING → Polling startet
  T12: Polling findet Cookie → State = ACTIVE, Bridges feuern
  T13: Polling Timeout → probeEndpoint aktiv → Probe-Request wird gesendet
  T14: Probe erfolgreich → State = ACTIVE
  T15: Probe fehlgeschlagen → State = PENDING, Banner gezeigt
  T16: probeEndpoint = false → nach Polling-Timeout direkt Banner

})

describe('setConsent', () => {

  T17: Aktualisiert interne Choices
  T18: Schreibt Cookie
  T19: Feuert Google CM v2 Update
  T20: Feuert UET Update
  T21: Feuert Clarity Update
  T22: Pusht dataLayer consent_update Event
  T23: consentLog.enabled → pusht consent_log Event
  T24: consentLog.enabled = false → kein consent_log Event
  T25: Mindestens eine Kategorie true → emittiert 'consent:granted'
  T26: Alle Kategorien false → emittiert 'consent:denied'
  T27: State wird ACTIVE
  T28: Banner wird geschlossen, 'banner:hidden' emittiert
  T28a: Stufe C aktiv → pushConsentBeacon(choices, action, config) aufgerufen

})

describe('show / showPreferences', () => {

  T29: show() → Banner erscheint, State = UPDATING
  T30: showPreferences() → Preference Center erscheint
  T31: show() im ACTIVE State → State = UPDATING

})

describe('revoke', () => {

  T32: Setzt alle Choices auf false
  T33: Löscht Cookie
  T34: Feuert Bridges mit denied
  T35: State = PENDING, Banner gezeigt
  T35a: Stufe C aktiv → pushConsentBeacon(choices, 'revoke', config) aufgerufen

})

describe('Event Bus', () => {

  T36: on() registriert Callback
  T37: Callback wird bei Event aufgerufen
  T38: off() entfernt Callback
  T39: off() → Callback wird nicht mehr aufgerufen
  T40: Mehrere Callbacks auf ein Event → alle aufgerufen
  T41: Callback auf nicht-existierendes Event → kein Error
  T42: Doppelter init() Aufruf → idempotent, zweiter wird ignoriert

})
```

---

## 5. Unit Tests — Cookie Restore

### Datei: `test/core/restore.test.ts`

```
describe('waitForCookieRestore', () => {

  T01: Cookie erscheint innerhalb Timeout → success = true, source = 'polling'
  T02: Cookie erscheint nicht innerhalb Timeout → success = false, source = 'none'
  T03: Cookie erscheint nach 200ms bei 500ms Timeout → success = true, duration ≈ 200
  T04: Timeout = 0 → sofort null zurückgeben
  T05: Cookie erscheint exakt am Timeout-Punkt → akzeptieren (success = true)
  T06: Interval-Timing: wird alle 50ms geprüft
  T07: Duration wird korrekt gemessen

})

describe('probeRestore', () => {

  T08: fetch wird mit credentials: 'include' aufgerufen
  T09: fetch URL = endpoint + '/oil2/restore'
  T10: Probe erfolgreich, Cookie erscheint → success = true, source = 'probe'
  T11: Probe erfolgreich, Cookie erscheint nicht → success = false
  T12: Netzwerkfehler → success = false, console.warn
  T13: 404 Response → success = false (Template nicht installiert)

})
```

---

## 6. Unit Tests — Bridges

### Datei: `test/bridges/gcm.test.ts`

```
describe('pushGoogleConsent', () => {

  T01: Pusht 'consent' 'update' mit 7 Signals in dataLayer
  T02: analytics:true → analytics_storage:'granted'
  T03: analytics:false → analytics_storage:'denied'
  T04: marketing:true → ad_storage, ad_user_data, ad_personalization alle 'granted'
  T05: marketing:false → ad_storage, ad_user_data, ad_personalization alle 'denied'
  T06: functional:true → functionality_storage, personalization_storage 'granted'
  T07: security_storage immer 'granted'
  T08: urlPassthrough:true → gtag('set', 'url_passthrough', true) aufgerufen
  T09: urlPassthrough:false → kein url_passthrough gesetzt
  T10: adsDataRedaction:true → gtag('set', 'ads_data_redaction', true)
  T11: dataLayer existiert nicht → console.warn, kein Crash

})

describe('buildGoogleConsentState', () => {

  T12: Alle true → alle 'granted' (außer security immer granted)
  T13: Alle false → alle 'denied' (außer security immer granted)
  T14: Mixed → korrekte Zuordnung

})
```

### Datei: `test/bridges/uet.test.ts`

```
describe('pushUETConsent', () => {

  T01: Pusht consent update in uetq Array
  T02: marketing:true → ad_storage:'granted'
  T03: marketing:false → ad_storage:'denied'
  T04: uetq existiert nicht → wird als leeres Array initialisiert
  T05: Nur ad_storage wird gesendet (kein analytics_storage)

})
```

### Datei: `test/bridges/clarity.test.ts`

```
describe('pushClarityConsent', () => {

  T01: Ruft clarity('consentv2', {...}) auf
  T02: CamelCase korrekt: ad_Storage (großes S)
  T03: CamelCase korrekt: analytics_Storage (großes S)
  T04: clarity.category='marketing' → analytics_Storage hängt an marketing-Consent
  T05: clarity.category='analytics' → analytics_Storage hängt an analytics-Consent
  T06: marketing:true → ad_Storage:'granted'
  T07: marketing:false → ad_Storage:'denied'
  T08: clarity nicht geladen → console.warn, kein Crash
  T09: clarity Funktion existiert aber ist kein Funktionsaufruf → handled gracefully

})
```

### Datei: `test/bridges/datalayer.test.ts`

```
describe('pushConsentUpdate', () => {

  T01: Pusht oil2_consent_update Event in dataLayer
  T02: Event enthält oil2_functional, oil2_analytics, oil2_marketing
  T03: Boolean-Werte korrekt (nicht 0/1 sondern true/false)
  T04: dataLayer existiert nicht → wird als leeres Array initialisiert

})

describe('pushConsentLog', () => {

  T05: Pusht consent_log Event mit allen Feldern
  T06: oil2_consent_id ist gültige UUID
  T07: oil2_timestamp ist ISO 8601 Format
  T08: oil2_action enthält korrekte Action (accept_all, reject_all, custom)
  T09: oil2_config_version kommt aus config._v
  T10: oil2_banner_variant kommt aus config._ab
  T11: oil2_url ist location.href
  T12: oil2_screen ist 'widthxheight' Format

})
```

### Datei: `test/bridges/beacon.test.ts`

```
describe('pushConsentBeacon', () => {

  T01: server.enabled=false → kein Beacon (no-op, kein sendBeacon/fetch)
  T02: server.consentBeacon=false → kein Beacon (no-op)
  T03: server.endpoint='' → kein Beacon (no-op)
  T04: Alle Bedingungen erfüllt → navigator.sendBeacon wird aufgerufen
  T05: URL = endpoint (ohne trailing Slash) + '/oil2/consent'
  T06: Payload enthält c (base64 oil2-Wert) + action
  T07: Blob hat type 'text/plain' (CORS simple request, kein Preflight)
  T08: sendBeacon liefert false → fetch-Fallback mit keepalive + credentials:'include'
  T09: navigator.sendBeacon nicht verfügbar → fetch-Fallback
  T10: action='revoke' → wird in Payload durchgereicht (Client löscht beide Cookies)

})
```

---

## 7. Unit Tests — Banner UI

### Datei: `test/ui/banner.test.ts`

```
describe('createBanner', () => {

  T01: Erstellt Container mit Shadow DOM
  T02: Container hat id="oil2-banner-host"
  T03: Shadow DOM enthält Banner-HTML
  T04: Banner hat role="dialog" und aria-modal="true"
  T05: Banner enthält Title, Description, Links, Buttons

})

describe('Banner Buttons', () => {

  T06: "Alle akzeptieren" Button → onAcceptAll Callback
  T07: "Alle ablehnen" Button → onRejectAll Callback
  T08: "Einstellungen" Button → onCustomize Callback
  T09: Buttons nutzen Labels aus Config

})

describe('Banner Display', () => {

  T10: show() → Banner wird sichtbar (display not none)
  T11: hide() → Banner wird unsichtbar
  T12: destroy() → Container aus DOM entfernt
  T13: Doppelter show() → nur ein Banner im DOM

})

describe('Banner Accessibility', () => {

  T14: Focus Trap: Tab bleibt im Banner
  T15: Focus Trap: Shift+Tab wraps um
  T16: ESC-Taste → onRejectAll wird aufgerufen
  T17: Erster Focus auf "Alle ablehnen" Button
  T18: aria-label entspricht config.ui.labels.title

})

describe('Banner Responsive', () => {

  T19: position:'bottom' → Banner am unteren Rand
  T20: position:'top' → Banner am oberen Rand
  T21: position:'center' → Banner als Modal-Overlay
  T22: equalButtons:true → Alle Buttons gleich gestylt
  T23: theme:'light' → Helle Farben
  T24: theme:'dark' → Dunkle Farben

})
```

---

## 8. Integration Tests

### Datei: `test/integration/consent-flow.test.ts`

```
describe('Vollständiger Consent-Flow', () => {

  IT01: Erstbesuch → Banner erscheint → Accept All → Cookie gesetzt → Bridges feuern → Banner weg
  IT02: Erstbesuch → Banner → Reject All → Cookie gesetzt (alles 0) → Bridges denied → Banner weg
  IT03: Erstbesuch → Banner → Einstellungen → Custom-Auswahl → Save → Cookie → Bridges
  IT04: Wiederkehrender User → Cookie vorhanden → kein Banner → Bridges sofort
  IT05: Wiederkehrender User → OIL2.show() → Banner → Update → neuer Cookie → Bridges
  IT06: Wiederkehrender User → OIL2.revoke() → Cookie gelöscht → Bridges denied → Banner
  IT07: Config-Version geändert → Re-Consent → Banner erscheint trotz vorhandenem Cookie
  IT08: Consent-Log Event enthält alle erwarteten Felder

})
```

### Datei: `test/integration/safari-itp.test.ts`

```
describe('Safari ITP Cookie-Restore', () => {

  IT09: JS-Cookie fehlt, oil2_srv vorhanden → Polling startet → Cookie erscheint → Consent restored
  IT10: JS-Cookie fehlt, oil2_srv vorhanden → Polling Timeout → Probe-Request → Cookie restored
  IT11: JS-Cookie fehlt, oil2_srv vorhanden → Polling + Probe fehlgeschlagen → Banner gezeigt
  IT12: Beide Cookies fehlen → kein Polling → Banner direkt
  IT13: Restore erfolgreich → Bridges feuern mit restored Consent
  IT14: Restore erfolgreich → 'consent:restored' Event emittiert
  IT15: Restore Timing: < 500ms für erfolgreichen Polling-Restore

})
```

### Datei: `test/integration/basic-mode.test.ts`

```
describe('Basic Mode', () => {

  IT16: consentMode='basic' → wait_for_update im Stub
  IT17: Basic Mode + Cookie-Restore → Probe-Request als Fallback
  IT18: Basic Mode + Consent erteilt → GTM wird geladen
  IT19: Basic Mode + Consent denied → GTM wird NICHT geladen
  IT20: Basic Mode → kein cookieless Ping (kein Conversion Modeling)

})
```

---

## 9. Edge-Case Tests

### Datei: verteilt über alle Test-Dateien

```
describe('Edge Cases', () => {

  EC01: Cookie > 4KB (theoretisch unmöglich bei ~60 Bytes) → graceful failure
  EC02: localStorage nicht verfügbar (Private Browsing) → kein Crash
  EC03: crypto.randomUUID nicht verfügbar → Fallback UUID-Generator
  EC04: Shadow DOM nicht verfügbar → Fallback auf normales DOM
  EC05: document.cookie read-only (Browser-Blockierung) → Banner bei jedem Besuch
  EC06: Mehrere OIL2-Instanzen auf einer Seite → nur eine initialisiert
  EC07: OIL2 init() vor DOMContentLoaded → funktioniert trotzdem (defer garantiert DOM ready)
  EC08: GTM nicht geladen → Bridges feuern trotzdem (Queue-Mechanismus)
  EC09: Config mit null-Werten → Defaults greifen
  EC10: Config mit leeren Strings → Defaults wo nötig
  EC11: Cookie-Payload mit Extra-Feldern → werden ignoriert, kein Error
  EC12: Concurrent setConsent() Aufrufe → letzter gewinnt (kein Race Condition)
  EC13: Banner show() während WAITING State → Banner erst nach Polling-Ende
  EC14: XSS in Config-Labels → Shadow DOM verhindert Ausbruch
  EC15: fetch() Timeout bei Probe-Request → graceful failure nach 5s

})
```

---

## 10. Browser-Kompatibilitäts-Checkliste (manuell)

Diese Tests können nicht automatisiert werden und müssen manuell durchgeführt werden:

| Test | Chrome 80+ | Firefox 63+ | Safari 13.1+ | iOS Safari | Android Chrome |
|---|---|---|---|---|---|
| Banner erscheint | ☐ | ☐ | ☐ | ☐ | ☐ |
| Shadow DOM Isolation | ☐ | ☐ | ☐ | ☐ | ☐ |
| Cookie Read/Write | ☐ | ☐ | ☐ | ☐ | ☐ |
| ITP Cookie-Restore | — | — | ☐ | ☐ | — |
| Focus Trap | ☐ | ☐ | ☐ | ☐ | ☐ |
| Responsive Layout | ☐ | ☐ | ☐ | ☐ | ☐ |
| Google CM v2 Update | ☐ | ☐ | ☐ | ☐ | ☐ |
| UET Update | ☐ | ☐ | ☐ | ☐ | ☐ |
| Clarity Update | ☐ | ☐ | ☐ | ☐ | ☐ |
| Ad-Blocker (uBlock) | ☐ | ☐ | — | — | — |
| Ad-Blocker (Brave) | ☐ | — | — | — | — |
| Preference Center | ☐ | ☐ | ☐ | ☐ | ☐ |
| Keyboard Navigation | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## 11. sGTM Template Tests (manuell)

Diese Tests werden im sGTM Preview Mode durchgeführt:

| Test | Erwartet |
|---|---|
| Variable: Consent Status nach Accept All | `{functional: true, analytics: true, marketing: true}` |
| Variable: Consent Status nach Reject All | `{functional: false, analytics: false, marketing: false}` |
| Variable: Kein Cookie | `{functional: false, analytics: false, marketing: false}` |
| Variable: Korrupter Cookie | Fallback auf false |
| Variable: returnFormat='category', category='marketing' | `true` oder `false` |
| Keeper: oil2 gesetzt → oil2_srv wird erstellt | oil2_srv = oil2, HttpOnly Flag |
| Keeper: oil2 aktualisiert → oil2_srv wird aktualisiert | oil2_srv = neuer oil2 Wert |
| Keeper: oil2 und oil2_srv identisch → kein Update | Kein setCookie Aufruf |
| Keeper: oil2 fehlt → kein oil2_srv Update | Kein setCookie Aufruf |
| Restore: oil2 fehlt, oil2_srv vorhanden → oil2 gesetzt | oil2 = oil2_srv, KEIN HttpOnly |
| Restore: beide vorhanden → kein Update | Kein setCookie Aufruf |
| Probe: GET /oil2/restore → 200 + Set-Cookie | oil2 Cookie in Response |
| Probe: GET /oil2/restore ohne oil2_srv → 204 | Leere Response |
| Consent-Client: POST /oil2/consent {action:accept_all} → 200 | `{"ok":true}` + Set-Cookie oil2 + oil2_srv |
| Consent-Client: POST {action:revoke} → 200 | `{"ok":true,"cleared":true}` + beide Cookies gelöscht |
| Consent-Client: POST mit ungültigem c (f/a/m ∉ {0,1}) → 400 | `{"ok":false}` |
| Consent-Client: GET statt POST → 405 | `{"ok":false}` |
| Consent-Client: OPTIONS (Preflight) → 204 | CORS-Header gesetzt |

---

## 12. Performance Tests

| Test | Schwellenwert |
|---|---|
| Bundle-Größe gzipped (ohne Preferences) | ≤ 10 KB |
| Stub-Execution Time | < 5ms |
| Cookie Read + Parse Time | < 2ms |
| Banner Render Time (DOM ready) | < 50ms |
| Cookie-Restore-Polling Overhead | < 1ms pro Intervall |
| Memory Usage (idle, nach Init) | < 500 KB |

Performance Tests werden via `vitest bench` oder manuelle Performance API Messungen durchgeführt.

---

## 13. Consent Health Monitoring Tests

| Test | Erwartet |
|---|---|
| consent_log Events ≈ page_view Events (±10%) | Kein Alert |
| consent_log Events < 90% von page_views | Alert: CMP wird geblockt |
| consent_log Events > 110% von page_views | Alert: Doppelte Events |
| Alle consent_log Events haben gültige UUID | Keine Duplikate |
| config_version in Logs = aktuelle Config-Version | Kein Mismatch |

Diese Tests laufen im Live-System über BigQuery Queries und sind nicht Teil der Vitest-Suite.
