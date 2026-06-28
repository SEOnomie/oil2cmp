-- =============================================================================
-- OIL2 — BigQuery Consent-Log Schema & Queries
--
-- Script:    bq-consent-log.sql
-- Version:   1.1
-- Datum:     2026-06-27
-- Autor:     Marco Brenn | InBiz Online Marketing
-- Zweck:     Tabellen-DDL, Dedup-/Kennzahlen-Views, Consent-Health-Monitoring
--            (TESTS.md §13) und Performance-Marketing-Auswertungen fuer den
--            OIL2 Consent-Log (dataLayer-Event 'oil2_consent_log' -> sGTM -> BQ).
-- Changelog:
--   1.0  2026-06-27  Erstanlage
--   1.1  2026-06-27  Action 'revoke' in Beschreibung + Tagesaggregation (revokes)
--
-- Pipeline:  Browser (dataLayer 'oil2_consent_log')
--              -> sGTM BigQuery-Tag (mappt oil2_* Felder auf Spalten)
--              -> BigQuery (diese Tabelle)
--              -> Looker Studio (siehe docs/looker-studio-template.md)
--
-- DSGVO-Hinweis: Der Consent-Log ist der NACHWEIS der Einwilligung (Art. 7 Abs. 1
--   DSGVO, Rechenschaftspflicht). consent_id ist eine zufaellige Event-UUID OHNE
--   Personenbezug — der Log dient der Nachweis-/Health-Auswertung, NICHT dem
--   Tracking einzelner Nutzer. ip_country ist grobe Geo-Info (kein IP-Speicher);
--   user_agent ist optional und nur bei Bedarf zu befuellen.
--
-- Platzhalter vor Ausfuehrung ersetzen:
--   `project`            -> GCP-Projekt-ID
--   `oil2`               -> Ziel-Dataset (BigQuery)
--   `analytics_XXXXXXXX` -> GA4-BigQuery-Export-Dataset (fuer Page-View-Abgleich)
-- =============================================================================


-- =============================================================================
-- 1. DATASET & TABELLE
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS `project.oil2`
OPTIONS (location = 'EU');

CREATE TABLE IF NOT EXISTS `project.oil2.consent_log` (
  consent_id      STRING   NOT NULL OPTIONS (description = 'Zufaellige Event-UUID (oil2_consent_id), Dedup-Key'),
  action          STRING            OPTIONS (description = 'accept_all | reject_all | custom | update | revoke'),
  functional      BOOL              OPTIONS (description = 'Einwilligung Funktional'),
  analytics       BOOL              OPTIONS (description = 'Einwilligung Statistik'),
  marketing       BOOL              OPTIONS (description = 'Einwilligung Marketing'),
  client_time     TIMESTAMP         OPTIONS (description = 'oil2_timestamp (ISO 8601, Client)'),
  server_time     TIMESTAMP         OPTIONS (description = 'Eingang in sGTM/BQ (Server)'),
  page_url        STRING            OPTIONS (description = 'oil2_url'),
  referrer        STRING            OPTIONS (description = 'oil2_referrer'),
  config_version  INT64             OPTIONS (description = 'oil2_config_version (_v)'),
  banner_variant  STRING            OPTIONS (description = 'oil2_banner_variant (_ab, A/B-Test)'),
  oil2_version    STRING            OPTIONS (description = 'Build-Version der CMP'),
  screen          STRING            OPTIONS (description = 'Aufloesung BREITExHOEHE'),
  hostname        STRING            OPTIONS (description = 'Server-seitig: Host'),
  ip_country      STRING            OPTIONS (description = 'Server-seitig: grobe Geo (ISO-2)'),
  user_agent      STRING            OPTIONS (description = 'Optional, server-seitig')
)
PARTITION BY DATE(server_time)
CLUSTER BY action, banner_variant, config_version
OPTIONS (
  partition_expiration_days = 400,
  description = 'OIL2 Consent-Log — Nachweis & Health-Monitoring. Dedup ueber consent_id.'
);


-- =============================================================================
-- 2. DEDUP-VIEW
-- Der Client kann denselben Consent-Log (gleiche consent_id) mehrfach senden
-- (Retry/Doppel-Tag). Hier auf den fruehesten Eingang reduzieren.
-- =============================================================================

CREATE OR REPLACE VIEW `project.oil2.v_consent_dedup` AS
SELECT * EXCEPT (rn)
FROM (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY consent_id
      ORDER BY server_time
    ) AS rn
  FROM `project.oil2.consent_log`
)
WHERE rn = 1;


-- =============================================================================
-- 3. TAGES-KENNZAHLEN-VIEW
-- Grundlage fuer Looker Studio: Consent-Quoten und Opt-in-Raten pro Tag,
-- Banner-Variante und Config-Version.
-- =============================================================================

CREATE OR REPLACE VIEW `project.oil2.v_consent_daily` AS
SELECT
  DATE(server_time)                                            AS day,
  banner_variant,
  config_version,
  COUNT(*)                                                     AS total,
  COUNTIF(action = 'accept_all')                              AS accept_all,
  COUNTIF(action = 'reject_all')                              AS reject_all,
  COUNTIF(action = 'custom')                                  AS custom,
  COUNTIF(action = 'update')                                  AS updates,
  COUNTIF(action = 'revoke')                                  AS revokes,
  -- Opt-in-Raten (Anteil mit Einwilligung je Kategorie)
  ROUND(SAFE_DIVIDE(COUNTIF(marketing),  COUNT(*)), 4)        AS rate_marketing,
  ROUND(SAFE_DIVIDE(COUNTIF(analytics),  COUNT(*)), 4)        AS rate_analytics,
  ROUND(SAFE_DIVIDE(COUNTIF(functional), COUNT(*)), 4)        AS rate_functional,
  -- "Vollzustimmung" (alle 3 Kategorien)
  ROUND(SAFE_DIVIDE(COUNTIF(functional AND analytics AND marketing), COUNT(*)), 4) AS rate_all
FROM `project.oil2.v_consent_dedup`
GROUP BY day, banner_variant, config_version;


-- =============================================================================
-- 4. CONSENT-HEALTH-MONITORING (TESTS.md §13)
-- Diese Queries laufen idealerweise als Scheduled Queries / Alerts.
-- =============================================================================

-- 4.1  consent_log vs. page_view (Soll: ±10 %).
--      page_view aus dem GA4-BigQuery-Export. Dataset-Namen anpassen.
--      Alert-Logik:
--        ratio < 0.90  -> CMP wird geblockt (Adblocker/Fehler)
--        ratio > 1.10  -> doppelte Events
WITH consent AS (
  SELECT DATE(server_time) AS day, COUNT(*) AS consent_events
  FROM `project.oil2.v_consent_dedup`
  WHERE DATE(server_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY day
),
pageviews AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS day,
    COUNTIF(event_name = 'page_view') AS page_views
  FROM `project.analytics_XXXXXXXX.events_*`
  WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
  GROUP BY day
)
SELECT
  c.day,
  c.consent_events,
  p.page_views,
  ROUND(SAFE_DIVIDE(c.consent_events, p.page_views), 3) AS ratio,
  CASE
    WHEN SAFE_DIVIDE(c.consent_events, p.page_views) < 0.90 THEN 'ALERT: CMP geblockt?'
    WHEN SAFE_DIVIDE(c.consent_events, p.page_views) > 1.10 THEN 'ALERT: doppelte Events?'
    ELSE 'OK'
  END AS status
FROM consent c
LEFT JOIN pageviews p USING (day)
ORDER BY c.day DESC;


-- 4.2  Doppelte consent_id (sollte leer sein — Dedup deckt es ab, hier zur Kontrolle).
SELECT
  consent_id,
  COUNT(*) AS hits
FROM `project.oil2.consent_log`
WHERE DATE(server_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY consent_id
HAVING COUNT(*) > 1
ORDER BY hits DESC;


-- 4.3  Ungueltige / fehlende UUID (Format-Pruefung).
SELECT
  DATE(server_time) AS day,
  COUNTIF(consent_id IS NULL) AS null_ids,
  COUNTIF(NOT REGEXP_CONTAINS(
    consent_id,
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  )) AS malformed_ids
FROM `project.oil2.consent_log`
WHERE DATE(server_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY day
HAVING null_ids > 0 OR malformed_ids > 0
ORDER BY day DESC;


-- 4.4  Config-Version-Mismatch: Events mit veralteter Config-Version
--      (Re-Consent nach Config-Aenderung greift verzoegert). @current_version setzen.
SELECT
  config_version,
  COUNT(*) AS events,
  MIN(server_time) AS first_seen,
  MAX(server_time) AS last_seen
FROM `project.oil2.v_consent_dedup`
WHERE DATE(server_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND config_version <> @current_version
GROUP BY config_version
ORDER BY events DESC;


-- =============================================================================
-- 5. PERFORMANCE-MARKETING-AUSWERTUNGEN
-- =============================================================================

-- 5.1  A/B-Banner-Vergleich: Opt-in-Raten je Variante (letzte 30 Tage).
--      Signifikanz separat pruefen — hier nur die Roh-Raten.
SELECT
  banner_variant,
  COUNT(*)                                              AS total,
  ROUND(SAFE_DIVIDE(COUNTIF(action = 'accept_all'), COUNT(*)), 4) AS rate_accept_all,
  ROUND(SAFE_DIVIDE(COUNTIF(marketing),  COUNT(*)), 4) AS rate_marketing,
  ROUND(SAFE_DIVIDE(COUNTIF(analytics),  COUNT(*)), 4) AS rate_analytics
FROM `project.oil2.v_consent_dedup`
WHERE DATE(server_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY banner_variant
ORDER BY banner_variant;


-- 5.2  Marketing-Opt-in-Trend (taeglich) — relevant fuer Consent-Mode-Modeling.
--      Sinkt die Marketing-Quote, leidet das Conversion-Modeling in Google Ads.
SELECT
  day,
  SUM(total)                                            AS total,
  ROUND(SAFE_DIVIDE(SUM(total * rate_marketing), SUM(total)), 4) AS rate_marketing
FROM `project.oil2.v_consent_daily`
WHERE day >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY day
ORDER BY day;


-- 5.3  Consent-Quote je Config-Version (Re-Consent-Wirkung nach Aenderungen).
SELECT
  config_version,
  COUNT(*)                                              AS total,
  ROUND(SAFE_DIVIDE(COUNTIF(action = 'reject_all'), COUNT(*)), 4) AS rate_reject,
  ROUND(SAFE_DIVIDE(COUNTIF(marketing),  COUNT(*)), 4) AS rate_marketing
FROM `project.oil2.v_consent_dedup`
GROUP BY config_version
ORDER BY config_version;


-- 5.4  Aktion-Verteilung (Wie entscheiden Nutzer? Accept vs Reject vs Custom).
SELECT
  action,
  COUNT(*)                                              AS events,
  ROUND(SAFE_DIVIDE(COUNT(*), SUM(COUNT(*)) OVER ()), 4) AS share
FROM `project.oil2.v_consent_dedup`
WHERE DATE(server_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY action
ORDER BY events DESC;
