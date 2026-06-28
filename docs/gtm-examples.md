# OIL2 — GTM & sGTM Beispiele

Praktische Trigger und Consent-Gating-Muster für (Web-)GTM und Server-Side GTM.

---

## 1. Web-GTM: Consent-Mode-gesteuerte Tags

Wenn Google Consent Mode v2 aktiv ist (OIL2 sendet `gtag('consent','update', …)`),
übernimmt GTM das Gating automatisch — du musst Tags **nicht** manuell triggern.
Im Tag die **Consent-Einstellungen** auf „Zusätzliche Einwilligung erforderlich"
setzen, z. B. `ad_storage` für ein Google-Ads-Conversion-Tag.

Für Tags **ohne** native Consent-Mode-Unterstützung: eigenen Trigger über die
dataLayer-Events bauen.

---

## 2. Web-GTM: Trigger über dataLayer-Events

### Custom-Event-Trigger auf Consent-Änderung

- **Trigger-Typ:** Benutzerdefiniertes Ereignis
- **Ereignisname:** `oil2_consent_update`

Dazu Data-Layer-Variablen:

| Variable | Data-Layer-Key |
|---|---|
| `DLV - oil2 marketing` | `oil2_marketing` |
| `DLV - oil2 analytics` | `oil2_analytics` |
| `DLV - oil2 functional` | `oil2_functional` |

### Beispiel: Remarketing-Tag nur bei Marketing-Consent

- Trigger: Custom Event `oil2_consent_update`
- Bedingung: `DLV - oil2 marketing` **ist gleich** `true`

```
Trigger:  Custom Event = oil2_consent_update
Filter:   {{DLV - oil2 marketing}}  equals  true
```

---

## 3. sGTM: Consent aus dem Cookie lesen (OIL2 Variable)

Die **OIL2 Variable** liest `oil2` / `oil2_srv` und gibt den Consent-Status zurück
— unabhängig vom dataLayer, direkt aus dem Cookie. Ideal für server-seitige Tags
(Meta CAPI, TikTok Events API, LinkedIn CAPI).

### Variante A — Objekt

`returnFormat: object` → `{ functional, analytics, marketing, timestamp, version, variant }`

```
// Tag-Trigger-Bedingung (Meta CAPI):
{{OIL2 Consent}}.marketing  equals  true
```

### Variante B — Einzelkategorie

`returnFormat: category`, `category: marketing` → `true` / `false`

```
{{OIL2 Marketing Consent}}  equals  true
```

---

## 4. sGTM: Meta CAPI Consent-Gating

1. OIL2 Variable anlegen (`returnFormat: category`, `category: marketing`).
2. Im Meta-CAPI-Tag eine **Ausnahme** ergänzen:

```
Trigger:    (dein Conversion-Event)
Ausnahme:   {{OIL2 Marketing Consent}}  equals  false
```

So feuert das CAPI-Tag nur, wenn Marketing-Consent vorliegt. Analog für TikTok
Events API, LinkedIn CAPI, Pinterest CAPI.

---

## 5. Cookie-Priorität in der Variable

Die Variable liest standardmäßig **JS-Cookie zuerst** (`oil2`), dann HttpOnly
(`oil2_srv`). Bei Safari-ITP-Restores kann `oil2_srv` aktueller sein —
dann `cookiePriority: srv_first` wählen.

| Einstellung | Reihenfolge |
|---|---|
| `js_first` (Default) | `oil2` → `oil2_srv` |
| `srv_first` | `oil2_srv` → `oil2` |

---

## 6. Consent-Log nach BigQuery (Analytics-Pipeline)

Das `oil2_consent_log`-Event (Web-dataLayer) wird per GTM an den sGTM
weitergereicht und dort von einem **BigQuery-Tag** in die Tabelle geschrieben.

- Web-GTM: Trigger auf `oil2_consent_log`, GA4-/Server-Event an sGTM senden.
- sGTM: BigQuery-Tag mappt die `oil2_*`-Parameter auf die Spalten aus
  `sql/bq-consent-log.sql`.
- Auswertung: `docs/looker-studio-template.md`.

Feld-Mapping (dataLayer → BigQuery-Spalte):

| dataLayer | Spalte |
|---|---|
| `oil2_consent_id` | `consent_id` |
| `oil2_action` | `action` |
| `oil2_functional/analytics/marketing` | `functional/analytics/marketing` |
| `oil2_timestamp` | `client_time` |
| `oil2_config_version` | `config_version` |
| `oil2_banner_variant` | `banner_variant` |
| `oil2_screen` | `screen` |

---

## 7. Eigene Logik per JavaScript

Wenn ein Tag weder Consent Mode noch dataLayer-Trigger nutzt, direkt die API
abfragen (Custom HTML Tag, nach OIL2-Load):

```html
<script>
  if (window.OIL2 && OIL2.getConsent().marketing) {
    // Tag-Logik
  }
  OIL2 && OIL2.on('consent:granted', function (c) {
    if (c.marketing) { /* nachladen */ }
  });
</script>
```
