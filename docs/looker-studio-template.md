# OIL2 — Looker Studio Template

**Version:** 1.0 · **Stand:** 2026-06-27 · **Autor:** Marco Brenn | InBiz Online Marketing

Dashboard-Vorlage für die Auswertung des OIL2 Consent-Logs. Datenbasis sind die
BigQuery-Views aus `sql/bq-consent-log.sql`. Looker Studio kennt kein
exportierbares Dateiformat — diese Vorlage beschreibt Datenquelle, berechnete
Felder und Charts zum Nachbau.

---

## 1. Datenquellen

| Zweck | BigQuery-Quelle |
|---|---|
| Haupt-Dashboard (Kennzahlen, Trends) | `project.oil2.v_consent_daily` |
| Detail / Drill-down (einzelne Events) | `project.oil2.v_consent_dedup` |
| Health-Abgleich Page-Views | GA4-Export `analytics_XXXXXXXX.events_*` |

BigQuery-Connector verwenden, **nicht** den GA4-Connector. `v_consent_daily` ist
vorggregiert (eine Zeile je Tag/Variante/Config-Version) — schnell und günstig.
Für tagesaktuelle Daten den View-Cache in Looker auf 1–4 h stellen.

---

## 2. Berechnete Felder

Im Datenquellen-Editor anlegen (Formeln in Looker-Studio-Syntax):

| Feldname | Formel | Typ |
|---|---|---|
| `Opt-in Marketing %` | `SUM(total * rate_marketing) / SUM(total)` | Prozent |
| `Opt-in Analytics %` | `SUM(total * rate_analytics) / SUM(total)` | Prozent |
| `Accept-Rate %` | `SUM(accept_all) / SUM(total)` | Prozent |
| `Reject-Rate %` | `SUM(reject_all) / SUM(total)` | Prozent |
| `Custom-Rate %` | `SUM(custom) / SUM(total)` | Prozent |
| `Widerruf-Rate %` | `SUM(revokes) / SUM(total)` | Prozent |

Wichtig: Raten **gewichtet** über `total` aggregieren (`SUM(total * rate) /
SUM(total)`), nicht den Tagesschnitt der Raten — sonst verzerren Tage mit wenig
Traffic das Bild.

---

## 3. Seiten & Charts

### Seite 1 — Überblick
- **Scorecards:** Events gesamt (`total`), Accept-Rate %, Marketing-Opt-in %, Reject-Rate %
- **Zeitreihe:** `day` (X) gegen Opt-in Marketing %, Opt-in Analytics %, Accept-Rate % (Y)
- **Datumsbereich-Steuerung** + Filter auf `banner_variant`, `config_version`

### Seite 2 — A/B-Banner-Vergleich
- **Balkendiagramm:** Dimension `banner_variant`, Metriken Accept-Rate %, Marketing-Opt-in %
- **Tabelle:** Variante · total · Accept-Rate · Marketing-Opt-in · Analytics-Opt-in
- Grundlage: Query 5.1 bzw. `v_consent_daily` nach Variante gruppiert
- Hinweis: Signifikanz separat prüfen — Looker zeigt nur Roh-Raten

### Seite 3 — Consent-Health
- **Zeitreihe:** Consent-Events vs. Page-Views (zwei Achsen) — basiert auf Query 4.1
- **Scorecard mit Schwelle:** Ratio `consent/page_view`; bedingte Formatierung
  rot < 0,90 (CMP geblockt) bzw. > 1,10 (Doppel-Events)
- **Tabelle:** Tage mit Status ≠ OK

### Seite 4 — Config-Version & Re-Consent
- **Balken:** `config_version` gegen total und Reject-Rate %
- Zeigt die Wirkung eines Re-Consent nach Config-Änderung (neuer `_v`)

---

## 4. Health-Alerts

Looker Studio hat keine robusten Schwellen-Alerts. Empfehlung:

1. Queries 4.1–4.4 aus `bq-consent-log.sql` als **Scheduled Queries** in BigQuery
   einrichten (täglich), Ergebnis in eine `*_alerts`-Tabelle schreiben.
2. Bei Treffern per Cloud Function / E-Mail benachrichtigen.
3. Looker dient der **Visualisierung**, BigQuery dem **Alerting**.

Kern-Schwellen (TESTS.md §13):

| Signal | Schwelle | Bedeutung |
|---|---|---|
| consent ÷ page_view | < 0,90 | CMP wird geblockt (Adblocker/Fehler) |
| consent ÷ page_view | > 1,10 | doppelte Events |
| doppelte `consent_id` | > 0 | Dedup/Tag-Problem |
| veraltete `config_version` | dauerhaft | Re-Consent greift nicht |

---

## 5. Hinweise

- `v_consent_daily` enthält **keinen** Personenbezug — `consent_id` ist eine
  zufällige Event-UUID. Das Dashboard ist eine Nachweis-/Health-Sicht, kein
  Nutzer-Tracking.
- Marketing-Opt-in % ist die wichtigste Kennzahl für das Conversion-Modeling in
  Google Ads: sinkt sie, sinkt die modellierte Conversion-Abdeckung.
- Datumsbereich-Default auf „letzte 30 Tage"; Vergleichszeitraum „vorherige
  Periode" aktivieren, um Trends sofort zu sehen.
