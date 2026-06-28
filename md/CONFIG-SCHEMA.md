# OIL2 — Konfigurations-Schema

**Zweck:** Vollständige Definition des OIL2 JSON-Konfigurationsschemas mit Validierungsregeln, Defaults und Beispiel-Konfigurationen für verschiedene Kundenszenarien.

---

## 1. Schema-Definition

OIL2 wird über ein `<script type="application/json">` Element im HTML konfiguriert:

```html
<script id="oil2-config" type="application/json">
{
  ...
}
</script>
```

### 1.1 Vollständiges Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OIL2 Configuration",
  "type": "object",
  "properties": {

    "_v": {
      "type": "integer",
      "minimum": 1,
      "description": "Config-Version. Wird im Cookie gespeichert. Bei Änderung → Re-Consent.",
      "default": 1
    },

    "_ab": {
      "type": "string",
      "pattern": "^[A-Z]$",
      "description": "A/B-Banner-Variante. Einzelner Buchstabe (A, B, C, ...).",
      "default": "A"
    },

    "consentMode": {
      "type": "string",
      "enum": ["advanced", "basic"],
      "description": "Google Consent Mode. Advanced: Tags feuern cookieless Pings bei denied (Conversion Modeling). Basic: Tags erst nach Consent. Default: advanced.",
      "default": "advanced"
    },

    "categories": {
      "type": "object",
      "properties": {
        "functional": { "$ref": "#/definitions/CategoryConfig" },
        "analytics": { "$ref": "#/definitions/CategoryConfig" },
        "marketing": { "$ref": "#/definitions/CategoryConfig" }
      },
      "additionalProperties": false
    },

    "cookie": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "const": "oil2",
          "description": "Cookie-Name. Nicht änderbar (hart kodiert für sGTM-Kompatibilität).",
          "default": "oil2"
        },
        "domain": {
          "type": "string",
          "description": "Cookie-Domain. Leer = aktuelle Domain. Z.B. '.example.de' für Subdomains.",
          "default": ""
        },
        "days": {
          "type": "integer",
          "minimum": 1,
          "maximum": 365,
          "description": "Cookie-Lebensdauer in Tagen.",
          "default": 365
        },
        "sameSite": {
          "type": "string",
          "enum": ["Lax", "Strict", "None"],
          "description": "SameSite-Attribut. Lax empfohlen.",
          "default": "Lax"
        }
      },
      "additionalProperties": false
    },

    "server": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "description": "Server-Side Loading aktivieren (stape.io).",
          "default": false
        },
        "endpoint": {
          "type": "string",
          "description": "sGTM-Endpoint. Same Origin: '/metrics'. Own CDN: 'https://analytics.example.de'.",
          "default": ""
        },
        "mode": {
          "type": "string",
          "enum": ["same_origin", "own_cdn", "subdomain"],
          "description": "IP-Matching-Strategie. same_origin = Reverse Proxy. own_cdn = Cloudflare. subdomain = CNAME (kein ITP Bypass!).",
          "default": "same_origin"
        },
        "cookieKeeper": {
          "type": "boolean",
          "description": "HttpOnly-Cookie-Backup via sGTM Cookie Keeper Tag.",
          "default": true
        },
        "restoreCookie": {
          "type": "boolean",
          "description": "Safari ITP Cookie-Restore aktivieren.",
          "default": true
        },
        "restoreTimeout": {
          "type": "integer",
          "minimum": 100,
          "maximum": 2000,
          "description": "Max. Wartezeit (ms) auf Cookie-Restore per Polling.",
          "default": 500
        },
        "probeEndpoint": {
          "type": "boolean",
          "description": "Dedizierten Probe-Request für Cookie-Restore aktivieren (Fallback bei Basic Mode).",
          "default": true
        },
        "consentBeacon": {
          "type": "boolean",
          "description": "Stufe C: Consent-Entscheidung sofort per navigator.sendBeacon an <endpoint>/oil2/consent senden (sGTM Consent-Client setzt oil2 + oil2_srv autoritativ serverseitig). Benötigt server.enabled + server.endpoint.",
          "default": false
        }
      },
      "additionalProperties": false
    },

    "google": {
      "type": "object",
      "properties": {
        "urlPassthrough": {
          "type": "boolean",
          "description": "Bei denied: Click-IDs als URL-Parameter an nächste Seite weitergeben.",
          "default": true
        },
        "adsDataRedaction": {
          "type": "boolean",
          "description": "Bei ad_storage denied: Ad-Click-Identifier aus Requests entfernen.",
          "default": false
        }
      },
      "additionalProperties": false
    },

    "clarity": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": ["marketing", "analytics"],
          "description": "Consent-Kategorie für Clarity. 'marketing' (Default, empfohlen wegen §4.4c Nutzungsbedingungen) oder 'analytics'.",
          "default": "marketing"
        }
      },
      "additionalProperties": false
    },

    "ui": {
      "type": "object",
      "properties": {
        "position": {
          "type": "string",
          "enum": ["bottom", "top", "center"],
          "description": "Banner-Position. bottom/top = Leiste. center = Modal-Overlay.",
          "default": "bottom"
        },
        "theme": {
          "type": "string",
          "enum": ["light", "dark", "auto"],
          "description": "Banner-Theme. auto = prefers-color-scheme.",
          "default": "light"
        },
        "equalButtons": {
          "type": "boolean",
          "description": "Alle Buttons gleichwertig (gleiche Größe, Farbe). DSGVO-empfohlen.",
          "default": true
        },
        "privacyUrl": {
          "type": "string",
          "description": "URL zur Datenschutzerklärung.",
          "default": "/datenschutz"
        },
        "imprintUrl": {
          "type": "string",
          "description": "URL zum Impressum.",
          "default": "/impressum"
        },
        "labels": {
          "type": "object",
          "properties": {
            "title": { "type": "string", "default": "Cookie-Einstellungen" },
            "description": { "type": "string", "default": "Wir nutzen Cookies zur Analyse und Verbesserung unserer Website." },
            "acceptAll": { "type": "string", "default": "Alle akzeptieren" },
            "rejectAll": { "type": "string", "default": "Alle ablehnen" },
            "customize": { "type": "string", "default": "Einstellungen" },
            "save": { "type": "string", "default": "Auswahl speichern" }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },

    "consentLog": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "description": "Consent-Log Events in dataLayer pushen.",
          "default": true
        },
        "dataLayerEvent": {
          "type": "string",
          "description": "Event-Name für Consent-Log.",
          "default": "oil2_consent_log"
        }
      },
      "additionalProperties": false
    },

    "geo": {
      "type": "object",
      "properties": {
        "scope": {
          "type": "string",
          "enum": ["eu_only", "worldwide", "custom"],
          "description": "Geo-Scope. eu_only: Banner nur für EU-Besucher. worldwide: Immer. custom: Nur für Regionen in regions-Array.",
          "default": "eu_only"
        },
        "regions": {
          "type": "array",
          "items": { "type": "string", "pattern": "^[A-Z]{2}$" },
          "description": "ISO 3166-1 alpha-2 Ländercodes. Nur bei scope='custom'.",
          "default": []
        },
        "fallback": {
          "type": "string",
          "enum": ["show_banner", "grant_all"],
          "description": "Verhalten für Besucher außerhalb des Scopes. show_banner: Banner zeigen. grant_all: Alle Kategorien auto-granted.",
          "default": "show_banner"
        }
      },
      "additionalProperties": false
    }
  },

  "definitions": {
    "CategoryConfig": {
      "type": "object",
      "properties": {
        "label": { "type": "string" },
        "description": { "type": "string" },
        "default": { "type": "boolean", "default": false }
      },
      "additionalProperties": false
    }
  },

  "additionalProperties": false
}
```

---

## 2. Validierungsregeln

Der Config Parser (`src/storage/config.ts`) validiert folgende Regeln. Bei Verstoß → `console.warn` + Fallback auf Default.

| Feld | Regel | Fallback |
|---|---|---|
| `_v` | Positive Ganzzahl ≥ 1 | `1` |
| `_ab` | Einzelner Großbuchstabe A-Z | `"A"` |
| `consentMode` | `"advanced"` oder `"basic"` | `"advanced"` |
| `cookie.days` | Ganzzahl 1-365 | `365` |
| `cookie.sameSite` | `"Lax"`, `"Strict"`, `"None"` | `"Lax"` |
| `server.mode` | `"same_origin"`, `"own_cdn"`, `"subdomain"` | `"same_origin"` |
| `server.restoreTimeout` | Ganzzahl 100-2000 | `500` |
| `server.endpoint` | Nicht-leerer String wenn `server.enabled` | `""` (warn) |
| `clarity.category` | `"marketing"` oder `"analytics"` | `"marketing"` |
| `ui.position` | `"bottom"`, `"top"`, `"center"` | `"bottom"` |
| `ui.theme` | `"light"`, `"dark"`, `"auto"` | `"light"` |
| `geo.scope` | `"eu_only"`, `"worldwide"`, `"custom"` | `"eu_only"` |
| `geo.regions` | Array von 2-Buchstaben ISO-Codes | `[]` |
| Unbekannte Felder | — | Ignorieren (kein Error) |

### Warnungen (nicht-kritisch)

- `server.enabled === true` aber `server.endpoint === ""` → Warn: "Server enabled but no endpoint configured"
- `server.consentBeacon === true` aber `server.enabled !== true` oder `server.endpoint === ""` → Warn: "consentBeacon requires server.enabled and a server.endpoint"
- `server.mode === 'subdomain'` → Warn: "Subdomain mode does not bypass Safari ITP. Consider same_origin or own_cdn."
- `consentMode === 'basic'` und `server.restoreCookie === true` → Warn: "Basic mode limits cookie restore to probe requests only"
- `geo.scope === 'custom'` und `geo.regions.length === 0` → Warn: "Custom geo scope with empty regions list"

---

## 3. Deep-Merge Logik

Der Config Parser merged die User-Config mit den Defaults. Regeln:

1. **Primitives (string, number, boolean):** User-Wert überschreibt Default
2. **Objekte:** Rekursives Merge (User-Felder überschreiben Default-Felder, nicht gesetzte Default-Felder bleiben)
3. **Arrays:** User-Array ersetzt Default-Array komplett (kein Merge von Array-Elementen)
4. **`null` / `undefined`:** Wird als "nicht gesetzt" behandelt → Default bleibt

```typescript
function deepMerge(defaults: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    const val = overrides[key];
    if (val === null || val === undefined) continue;
    if (typeof val === 'object' && !Array.isArray(val) && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      result[key] = deepMerge(defaults[key] as Record<string, unknown>, val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }
  return result;
}
```

---

## 4. Beispiel-Konfigurationen

### 4.1 Minimal-Config (nur Google Ads, kein Server-Side)

```json
{
  "_v": 1,
  "consentMode": "advanced"
}
```

Alles andere wird vom Default gefüllt. Ergebnis: Banner unten, Light Theme, Google CM v2 Advanced, kein Server-Side, kein Microsoft, kein Consent-Log.

### 4.2 Standard InBiz-Kunde (Google + Microsoft + stape.io)

```json
{
  "_v": 1,
  "_ab": "A",
  "consentMode": "advanced",

  "server": {
    "enabled": true,
    "endpoint": "/metrics",
    "mode": "same_origin",
    "consentBeacon": true
  },

  "clarity": {
    "category": "marketing"
  },

  "ui": {
    "privacyUrl": "/datenschutz",
    "imprintUrl": "/impressum",
    "labels": {
      "description": "Wir verwenden Cookies für Analyse und personalisierte Werbung. Details finden Sie in unserer Datenschutzerklärung."
    }
  }
}
```

### 4.3 Österreichischer Kunde (Basic Mode, konservativ)

```json
{
  "_v": 1,
  "consentMode": "basic",

  "server": {
    "enabled": true,
    "endpoint": "/tracking",
    "mode": "same_origin"
  },

  "google": {
    "adsDataRedaction": true
  },

  "clarity": {
    "category": "marketing"
  },

  "ui": {
    "position": "center",
    "equalButtons": true,
    "labels": {
      "title": "Cookie-Einstellungen",
      "description": "Wir verwenden Cookies nur mit Ihrer ausdrücklichen Zustimmung.",
      "acceptAll": "Alle akzeptieren",
      "rejectAll": "Alle ablehnen"
    }
  }
}
```

### 4.4 Shopify-Kunde (Own CDN via Cloudflare)

```json
{
  "_v": 1,
  "consentMode": "advanced",

  "server": {
    "enabled": true,
    "endpoint": "https://analytics.meinshop.de",
    "mode": "own_cdn"
  },

  "cookie": {
    "domain": ".meinshop.de"
  },

  "ui": {
    "theme": "auto",
    "labels": {
      "description": "Wir nutzen Cookies, um Ihr Einkaufserlebnis zu verbessern und unsere Werbung zu optimieren."
    }
  }
}
```

### 4.5 A/B-Test Konfigurationen

**Variante A (Standard-Banner unten):**
```json
{
  "_v": 2,
  "_ab": "A",
  "ui": {
    "position": "bottom"
  }
}
```

**Variante B (Modal-Banner zentriert):**
```json
{
  "_v": 2,
  "_ab": "B",
  "ui": {
    "position": "center"
  }
}
```

Die A/B-Zuweisung geschieht pro User und wird im Cookie (`ab` Feld) gespeichert. Die Config-Datei enthält die aktuell aktive Variante. Wechsel der `_ab` Werte erfordert serverseitiges A/B-Testing (z.B. via Cloudflare Worker oder GTM-Variablen).

### 4.6 Nur DACH, kein Server-Side, Clarity unter Analytics

```json
{
  "_v": 1,
  "consentMode": "advanced",

  "clarity": {
    "category": "analytics"
  },

  "geo": {
    "scope": "custom",
    "regions": ["DE", "AT", "CH"],
    "fallback": "grant_all"
  },

  "ui": {
    "theme": "dark"
  }
}
```

---

## 5. Config-Version und Re-Consent

### Wann muss `_v` erhöht werden?

| Änderung | `_v` erhöhen? | Begründung |
|---|---|---|
| Neuer Tracking-Dienst hinzugefügt | JA | Neue Datenverarbeitung → DSGVO: neuer Consent nötig |
| Kategorie-Beschreibung geändert | JA | Informationspflicht → User muss informiert neu entscheiden |
| Clarity von Marketing auf Analytics verschoben | JA | Andere Consent-Zuordnung |
| UI-Position geändert (bottom → center) | NEIN | Keine Änderung der Datenverarbeitung |
| Labels/Texte angepasst (Tippfehler) | NEIN | Keine inhaltliche Änderung |
| `_ab` Variante gewechselt | NEIN | A/B-Test betrifft nicht die Datenverarbeitung |
| `server.endpoint` geändert | NEIN | Technische Änderung, keine Auswirkung auf Consent |

### Re-Consent Ablauf

1. User besucht Seite
2. OIL2 liest Cookie → `payload.v = 2`
3. OIL2 liest Config → `config._v = 3`
4. Mismatch → Cookie löschen → Banner zeigen
5. User entscheidet erneut → neuer Cookie mit `v = 3`

---

## 6. Geo-Scope Implementierung

### Hinweis zur Geo-Detection

OIL2 selbst implementiert keine Geo-Detection. Die Geo-Logik muss serverseitig gelöst werden:

**Option A: sGTM Variable** — Der sGTM kennt die IP und kann das Land bestimmen. Ein Custom Variable Template kann die Region als Cookie oder HTTP-Header zurückgeben.

**Option B: Cloudflare Header** — `cf-ipcountry` Header enthält den ISO-Ländercode. Kann via JavaScript oder Server-Side gelesen werden.

**Option C: Server-Side Rendering** — Der Webserver setzt die Config-Variante basierend auf der User-IP.

Wenn keine Geo-Detection konfiguriert ist und `geo.scope !== 'worldwide'`, wird der `geo.fallback` Wert verwendet:
- `"show_banner"` → Banner immer zeigen (sicherste Option)
- `"grant_all"` → Alle Kategorien auto-granted (nur für Non-EU Use Case)

---

## 7. Laufzeit-Hinweise

- Die Config wird einmal beim OIL2-Init gelesen und danach nicht erneut geprüft (kein Hot-Reload)
- Änderungen an der Config erfordern einen Page Reload, um wirksam zu werden
- Die Config wird NICHT im Cookie gespeichert — nur `_v` und `_ab` werden persistiert
- Unbekannte Felder werden still ignoriert (Forward-Kompatibilität)
