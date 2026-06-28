# Changelog

Alle nennenswerten Änderungen an OIL2 werden in dieser Datei dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und das Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

## [0.1.0] – 2026-06-28

### Hinzugefügt

- **Consent Engine** – State Machine (INIT → WAITING → PENDING/RESTORED → GRANTED/DENIED → ACTIVE → UPDATING) mit Event-Bus und Public API auf `window.OIL2`.
- **Google Consent Mode v2** – alle 7 Signale, Advanced- und Basic-Mode, `url_passthrough` und `ads_data_redaction`.
- **Microsoft UET** – Consent-Bridge (`ad_storage`).
- **Microsoft Clarity** – ConsentV2 mit korrekter CamelCase-API (`ad_Storage`, `analytics_Storage`), Kategorie wahlweise `marketing` oder `analytics`.
- **dataLayer-Bridge** – `oil2_consent_update`- und `oil2_consent_log`-Events für GTM/sGTM.
- **Dual-Cookie-Strategie** – JS-Cookie `oil2` plus HttpOnly-Backup `oil2_srv` über sGTM.
- **Safari-ITP-Bypass** – Cookie-Restore-Polling und Probe-Request-Fallback.
- **Consent-Beacon (Stufe C)** – `navigator.sendBeacon` an `/oil2/consent` spiegelt jede Entscheidung sofort serverseitig; der sGTM Consent-Client setzt `oil2` + `oil2_srv` autoritativ. Bei `revoke` werden serverseitig beide Cookies gelöscht.
- **Shadow-DOM-Banner** – WCAG 2.1 AA (Focus-Trap, ESC, gleichwertige Buttons), Theming über CSS Custom Properties, Light/Dark/Auto, lazy-loaded Preference Center.
- **iFrame-Blocker** – blockt eingebettete Inhalte bis zur passenden Einwilligung.
- **Config-Parser** – JSON-Schema mit Deep-Merge, Validierung und Config-Versionierung (`_v`) inkl. Re-Consent bei Änderungen.
- **sGTM-Templates** – Variable, Cookie Keeper, Cookie Restore, Probe-Request-Client und Consent-Client (Sandboxed JavaScript).
- **BigQuery-Schema** – Consent-Log inkl. Revoke-Auswertung.
- **Tests** – 285 Tests (Vitest + happy-dom) über Unit-, Integrations- und Edge-Case-Ebene.

### Bekannte Einschränkungen

- IAB TCF ist bewusst nicht im Scope (Zielgruppe: reine Advertiser).
- Geo-Detection wird nicht clientseitig gelöst, sondern serverseitig erwartet (sGTM/Cloudflare).

[Unveröffentlicht]: https://github.com/SEOnomie/oil2cmp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/SEOnomie/oil2cmp/releases/tag/v0.1.0
