# OIL2 — API-Referenz

`window.OIL2` ist nach dem Laden von `oil2.min.js` verfügbar. Alle Methoden sind
no-ops, solange die Engine nicht initialisiert ist (kein Crash).

---

## Methoden

### `getConsent(): ConsentChoices`
Aktuellen Consent abfragen.

```js
OIL2.getConsent();
// → { functional: false, analytics: true, marketing: true }
```

### `show(): void`
Banner erneut anzeigen — z. B. für einen Footer-Link „Cookie-Einstellungen".

```html
<a href="#" onclick="OIL2.show(); return false;">Cookie-Einstellungen</a>
```

### `showPreferences(): void`
Preference Center öffnen (lazy geladen).

### `setConsent(choices): void`
Consent programmatisch setzen (Action: `custom`). Schreibt Cookie, feuert alle
Bridges, schließt das Banner.

```js
OIL2.setConsent({ functional: true, analytics: true, marketing: false });
```

### `revoke(): void`
Consent widerrufen — alles `denied`, Cookie gelöscht, Bridges feuern denied,
Banner erscheint erneut.

### `on(event, callback)` / `off(event, callback)`
Event-Listener registrieren/entfernen. Callback erhält die aktuellen
`ConsentChoices`.

```js
OIL2.on('consent:granted', function (choices) {
  if (choices.marketing) loadRemarketingPixel();
});
```

### `version: string`
Build-Version (read-only).

---

## Events

Über `on()` / `off()`:

| Event | Wann |
|---|---|
| `consent:granted` | `setConsent` mit mindestens einer erteilten Kategorie |
| `consent:denied` | `setConsent` oder `revoke` mit allen Kategorien abgelehnt |
| `consent:updated` | Jede Consent-Änderung (`setConsent` **und** `revoke`) — generisches Change-Signal |
| `consent:restored` | Consent aus Cookie/Backup wiederhergestellt (Init / Safari-ITP) |
| `banner:shown` | Banner wurde angezeigt |
| `banner:hidden` | Banner wurde geschlossen |

---

## ConsentChoices

```ts
interface ConsentChoices {
  functional: boolean;
  analytics:  boolean;
  marketing:  boolean;
}
```

`necessary` ist immer aktiv und nicht Teil des Objekts.

---

## Signal-Mapping (Bridges)

Was OIL2 bei `setConsent` an die Plattformen sendet:

| Kategorie | Google CM v2 | UET | Clarity |
|---|---|---|---|
| `functional` | `functionality_storage`, `personalization_storage` | — | — |
| `analytics` | `analytics_storage` | — | `analytics_Storage`¹ |
| `marketing` | `ad_storage`, `ad_user_data`, `ad_personalization` | `ad_storage` | `ad_Storage` |
| `necessary` | `security_storage` (immer granted) | — | — |

¹ Bei `clarity.category: "analytics"`. Default `"marketing"` → `analytics_Storage`
hängt an Marketing.

> **Clarity CamelCase:** `ad_Storage` / `analytics_Storage` (großes S) — Google
> und UET nutzen Kleinschreibung. Verwechslung = Consent wird ignoriert.

---

## dataLayer-Events

Zusätzlich zu den `gtag('consent','update', …)`-Pushes:

### `oil2_consent_update`
Bei jeder Consent-Änderung:

```js
{ event: 'oil2_consent_update',
  oil2_functional: true, oil2_analytics: true, oil2_marketing: false }
```

### `oil2_consent_log`
Für die Analytics-Pipeline (nur wenn `consentLog.enabled`):

```js
{ event: 'oil2_consent_log',
  oil2_consent_id: '…uuid…',
  oil2_action: 'accept_all',          // | reject_all | custom | update | revoke
  oil2_functional: true, oil2_analytics: true, oil2_marketing: true,
  oil2_timestamp: '2026-06-27T…Z',
  oil2_url: '…', oil2_referrer: '…',
  oil2_config_version: 1, oil2_banner_variant: 'A',
  oil2_version: '…', oil2_screen: '1920x1080' }
```

---

## Konfiguration

Über `<script id="oil2-config" type="application/json">`. Vollständiges Schema,
Validierungsregeln und Beispiele: `CONFIG-SCHEMA.md`. Kurzreferenz der
wichtigsten Felder im `docs/setup-guide.md`.

Die Config wird **einmal** beim Init gelesen (kein Hot-Reload). Änderungen
erfordern einen Reload. Nur `_v` und `_ab` werden im Cookie persistiert.
