---
title: "OIL2 — Konzeptdokument (Hintergrund, Wettbewerb, Roadmap)"
version: "4.0"
date_created: "2026-06-28"
date_modified: "2026-06-28"
author: "Marco Brenn"
project: "OIL2"
status: "review"
tags: [cmp, consent-mode-v2, sgtm, stape, dsgvo, tracking, inbiz]
---

## Changelog

| Version | Datum      | Autor       | Änderung                                                                 |
|---------|------------|-------------|--------------------------------------------------------------------------|
| 4.0     | 2026-06-28 | Marco Brenn | Rekonstruktion aus Feinkonzept-Quellen (PROJEKT/SPEZIFIKATION/CONFIG-SCHEMA/SGTM-TEMPLATES/TESTS), Stand inkl. Stufe C (Consent-Beacon). Ersetzt das verlorene Original v4.0. |

> **Hinweis zur Rekonstruktion:** Das Original-v4.0 (896 Zeilen) ging verloren. Dieses Dokument wurde aus den fünf Feinkonzept-Dokumenten und dem aktuellen Repo-Stand (Stufe C) neu aufgebaut. Inhaltlich bildet es den Stand inkl. Consent-Beacon ab — also etwas weiter als das ursprüngliche v4.0. Versionsnummer bleibt 4.0, damit die Querverweise aus PROJEKT.md gültig bleiben. Bei der nächsten inhaltlichen Änderung auf 4.1 hochzählen.

---

# OIL2 — Konzeptdokument

**OIL2** = **O**wn **I**nternal **L**ayer **2** — eine schlanke, selbst gehostete Consent Management Platform (CMP) für Performance-Marketing-Kunden.

Dieses Dokument ist das strategische Dach über dem technischen Feinkonzept. Es beantwortet *warum* OIL2 existiert, *für wen*, *wogegen es antritt* und *wohin es geht*. Die technische Umsetzung steht in den fünf Referenz-Dokumenten (siehe Abschnitt 13).

---

## 1. Executive Summary

OIL2 ist eine CMP, die InBiz selbst betreibt und an Kunden ausliefert — ohne SaaS-Lizenz pro Domain, ohne Datenabfluss an Drittanbieter, mit nativer Server-Side-Tracking-Integration über stape.io.

Der Kern in vier Punkten:

- **Klein:** ≤10 KB gzipped für Banner, Engine und Bridges. Keine Runtime-Dependencies, reines Vanilla TypeScript.
- **Vollständig:** Google Consent Mode v2 (alle 7 Signals), Microsoft UET Consent, Microsoft Clarity ConsentV2, dataLayer-Events.
- **Server-gestützt:** Dual-Cookie-Strategie mit HttpOnly-Backup, Cookie-Restore über sGTM, Safari-ITP-Bypass, Consent-Beacon für sofortige serverseitige Spiegelung.
- **Auswertbar:** Consent-Analytics-Pipeline von dataLayer über sGTM nach BigQuery und Looker Studio.

OIL2 löst ein konkretes Agenturproblem: Kunden brauchen eine DSGVO-konforme CMP, die Google-Vorgaben erfüllt, das Tracking nicht ausbremst und nicht für jede Domain SaaS-Gebühren verursacht. Bestehende CMPs erfüllen je einzelne dieser Anforderungen — keine erfüllt alle gleichzeitig im InBiz-Setup.

---

## 2. Hintergrund & Motivation

### 2.1 Regulatorischer Druck

Drei Entwicklungen erzwingen bei nahezu jedem Kunden eine echte CMP:

1. **DSGVO + TDDDG (vormals TTDSG):** Einwilligung muss vor dem Setzen nicht-notwendiger Cookies eingeholt werden. Kein Tracking ohne aktiven Consent.
2. **Google EU User Consent Policy:** Google auditiert aktiv. Bei Verstößen droht der Verlust von Personalisierung und Conversion-Messung. Beanstandungen wie „Cookies set before consent" oder „Consent signals not set up correctly" treffen Kunden direkt im Konto.
3. **Consent Mode v2 (Pflicht seit März 2024):** Ohne korrekt verdrahtete Consent-Signale verliert Google Ads die Datenbasis für Smart Bidding und Conversion-Modeling.

Consent Mode v2 ist dabei nur der Signalweg — er teilt Google mit, ob zugestimmt wurde, holt aber selbst keine Einwilligung ein. Dafür braucht es eine CMP. Genau diese Lücke füllt OIL2.

### 2.2 Probleme bestehender CMPs im InBiz-Kontext

InBiz betreut eine zweistellige Zahl Kunden über eine Multi-Client-MCC-Struktur. Klassische CMPs erzeugen dabei wiederkehrende Reibung:

- **Lizenzkosten pro Domain:** SaaS-CMPs rechnen pro Domain oder pro Pageview ab. Bei vielen Kunden mit mehreren Märkten/Domains summiert sich das.
- **Bloat:** Viele CMPs laden 50–150 KB an JavaScript, oft synchron, und verschlechtern die Core Web Vitals — kontraproduktiv bei performance-getriebenen Kunden.
- **Datenabfluss:** Consent-Entscheidungen laufen über fremde Server. Für Kunden mit hohem Datenschutzanspruch ein Problem.
- **Fehlende sGTM-Integration:** Kaum eine Standard-CMP berücksichtigt Server-Side-Tracking, HttpOnly-Cookies oder Safari ITP auf Server-Ebene.
- **Black Box bei Safari ITP:** Intelligent Tracking Prevention kürzt JS-Cookies auf 7 Tage. Die meisten CMPs haben dagegen keine serverseitige Antwort.

### 2.3 Warum eigenbauen statt einkaufen

InBiz hat die Kompetenz für Consent Mode v2, sGTM, stape.io und das aGTM-Framework bereits im Haus. Eine eigene CMP macht aus dieser Kompetenz ein ausliefertes Produkt: volle Kontrolle über Cookie-Logik und Datenfluss, kein wiederkehrender Lizenz-Posten, und eine Architektur, die exakt zum bestehenden Tracking-Stack passt.

---

## 3. Zielgruppe & Abgrenzung

### 3.1 Für wen OIL2 gebaut ist

- Performance-Marketing-Kunden mit Google Ads und/oder Microsoft Ads
- Schwerpunkt DACH (Deutschland, Österreich, Schweiz)
- Kunden mit Server-Side-Tracking über stape.io / sGTM
- Setups, in denen Conversion-Datenqualität geschäftskritisch ist

### 3.2 Bewusst nicht im Scope

| Nicht enthalten | Begründung |
|---|---|
| IAB TCF (Transparency & Consent Framework) | Für die Zielgruppe nicht erforderlich. TCF richtet sich an Publisher mit Ad-Vermarktung über viele Drittanbieter. |
| Automatischer Cookie-Scan | Services werden manuell konfiguriert. Spart Komplexität und vermeidet Fehlerkennungen. |
| Multi-Regulation (CCPA, LGPD etc.) | Fokus DACH. US-Privacy-Gesetze sind Opt-out-Systeme mit anderer Logik. |
| Service-Templates / Vendor-Datenbank | Keine gepflegte Vendor-Liste. Die vier Kategorien reichen für das Zielsetup. |

Diese Abgrenzung ist Absicht. Jede weggelassene Funktion hält das Bundle klein und die Wartung niedrig. OIL2 ist eine fokussierte CMP, kein universelles Consent-Framework.

---

## 4. Wettbewerb

### 4.1 Marktüberblick

| CMP | Modell | Stärke | Schwäche im InBiz-Setup |
|---|---|---|---|
| **CCM19** | SaaS (DE) | Komfortable Oberfläche, nativer CM v2, Auto-Cookie-Scan, Support | Lizenzkosten pro Domain, kein sGTM-natives Cookie-Handling |
| **Usercentrics / Cookiebot** | SaaS | Marktführer, TCF, große Vendor-DB | Teuer bei vielen Domains, Bloat, Datenfluss über Anbieter |
| **Klaro** | Open Source (DE) | Kostenlos, DSGVO-konform, solide | Mehr manuelle Konfiguration, kein Server-Side, kein ITP-Bypass |
| **Borlabs Cookie** | WordPress-Plugin | Tief in WordPress integriert, deutsch | WordPress-gebunden, kein sGTM-Cookie-Restore |
| **Consentmanager.net** | SaaS | TCF, viele Sprachen | Mapping-Aufwand, Lizenzkosten, kein HttpOnly-Backup |
| **OIL2** | Self-Hosted (InBiz) | ≤10 KB, sGTM-nativ, ITP-Bypass, kein Lizenz-Posten, voller Datenhoheit | Manuelle Service-Konfig, DACH-Fokus, kein TCF, kein Auto-Scan |

### 4.2 Positionierung

OIL2 tauscht Komfort-Funktionen (Auto-Scan, Vendor-Datenbank, TCF, Klick-Oberfläche) gegen drei Dinge ein, die im InBiz-Setup mehr zählen:

1. **Größe** — ein Zehntel des Footprints klassischer SaaS-CMPs.
2. **Server-Side-Tiefe** — HttpOnly-Backup, Cookie-Restore und Safari-ITP-Bypass auf sGTM-Ebene. Das hat keine der Standard-CMPs.
3. **Kontrolle & Kosten** — kein Datenabfluss an Dritte, keine Lizenzgebühr pro Domain.

Für einen Kunden mit einer einzelnen WordPress-Seite und ohne Server-Side-Tracking ist CCM19 oder Klaro die einfachere Wahl — das ist bewusst so. OIL2 spielt seine Stärke bei Kunden mit Server-Side-Tracking, mehreren Domains/Märkten und hohem Anspruch an Datenqualität und Datenhoheit aus.

---

## 5. Architektur-Überblick

OIL2 folgt einem 5-Layer-Modell. Details in PROJEKT.md, Abschnitt 2.

```
Layer 0 · DELIVERY    stape.io File Proxy / Same Origin / Own CDN, Reverse Proxy (IP-Matching)
Layer 1 · UI          Shadow DOM Banner, Preference Center, iFrame Blocker
Layer 2 · ENGINE      State Machine, Storage, Config Parser, Cookie-Restore-Polling, Probe-Request
Layer 3 · BRIDGES     Google CM v2, Microsoft UET, Clarity, dataLayer, Consent-Beacon
Layer 4 · SERVER      sGTM @ stape.io: Variable, Cookie Keeper, Cookie Restore, Probe-Client,
                      Consent-Client, BigQuery-Log, Looker-Dashboard
```

Der entscheidende Architekturgedanke: Consent lebt nicht nur im Browser. Ein JS-Cookie (`oil2`) und ein HttpOnly-Cookie (`oil2_srv`) arbeiten zusammen. Das JS-Cookie ist für das clientseitige Signaling da, das HttpOnly-Cookie ist ITP-immun (bei IP-Matching) und stellt den Consent serverseitig wieder her, wenn Safari das JS-Cookie gelöscht hat.

---

## 6. Funktionsumfang

### 6.1 Consent-Signaling (Bridges)

- **Google Consent Mode v2** — alle 7 Signals: `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`, `functionality_storage`, `personalization_storage`, `security_storage`. Advanced + Basic Mode.
- **Microsoft UET** — `ad_storage` Consent.
- **Microsoft Clarity ConsentV2** — CamelCase-API (`ad_Storage`, `analytics_Storage`), Default-Kategorie `marketing`, konfigurierbar.
- **dataLayer** — `oil2_consent_update` + `oil2_consent_log` Events für GTM.

### 6.2 Vier Consent-Kategorien

Fest definiert, nicht erweiterbar: `necessary` (immer granted), `functional`, `analytics`, `marketing`. Das Mapping auf die Google/UET/Clarity-Signale ist fest verdrahtet (PROJEKT.md, Abschnitt 8).

### 6.3 Dual-Cookie & Safari-ITP-Bypass

- `oil2` (JS, 365 Tage, ITP: 7d) und `oil2_srv` (HttpOnly, 400 Tage, ITP-immun bei IP-Matching).
- Bei fehlendem JS-Cookie: Cookie-Restore-Polling + Probe-Request über sGTM.
- `wait_for_update: 500` gibt dem Restore-Flow das nötige Timing-Fenster, bevor GA4-Requests final rausgehen.

### 6.4 Consent-Beacon (Stufe C)

Spiegelt die Consent-Entscheidung sofort serverseitig: Bei `setConsent` und `revoke` (nie bei `restore`/`init`) sendet OIL2 einen Beacon an den sGTM Consent-Client, der `oil2` + `oil2_srv` autoritativ setzt. Bei `revoke` werden beide Cookies gelöscht. Transport als `text/plain` via `sendBeacon` (CORS-simple, kein Preflight).

### 6.5 Consent-Analytics-Pipeline

dataLayer → sGTM → BigQuery → Looker Studio. Jede Consent-Entscheidung wird protokolliert (Audit-Trail nach DSGVO) und auswertbar gemacht: Consent-Rate, Kategorie-Verteilung, Re-Consent-Quoten.

### 6.6 Config-Versionierung & Re-Consent

Jede Config trägt einen Versionswert `_v`. Ändert der Webmaster die Datenverarbeitung, erzwingt der Hash-Mismatch ein erneutes Banner — Pflicht nach DSGVO bei geänderter Verarbeitung.

### 6.7 Barrierefreiheit

Banner und Preference Center erfüllen WCAG 2.1 AA: Focus-Trap, Screenreader-Announcements, gleichwertige Buttons (`equalButtons`), Tastaturbedienbarkeit. Der Banner läuft im Shadow DOM, damit Kunden-CSS das Styling nicht bricht.

---

## 7. Technische Leitentscheidungen

| Entscheidung | Begründung |
|---|---|
| Vanilla TypeScript, null Runtime-Deps | Kleines Bundle, keine Supply-Chain-Risiken, volle Kontrolle |
| Kein `class` — funktional, Closures, Module Pattern | Bessere Minifizierung, kleineres Bundle |
| Vite + Terser, IIFE + ES-Build | Tree-Shaking, ≤10 KB Budget einhaltbar |
| Synchroner Inline-Stub im `<head>` | Consent Default MUSS vor GTM stehen, sonst gehen erste Events als `granted` raus (DSGVO-Verstoß) |
| sGTM Sandboxed JS (kein ES6, nur `var`/`function`) | sGTM-Pflicht für serverseitige Templates |
| Auslieferung über stape.io File Proxy / Own CDN | Same-Origin, ITP-resistent, kein Drittanbieter-Request |
| Kein `throw` — Fehler nur `console.warn` | Consent-Signaling darf nie durch einen Fehler blockiert werden |

Bundle-Budget: ≤10 KB gzipped für Banner + Engine + Bridges. Das Preference Center wird als separater Chunk lazy-geladen und zählt nicht zum Core-Budget.

---

## 8. Datenschutz-Konzept

OIL2 ist nicht nur DSGVO-konform — Datenschutz ist die Architektur-Prämisse:

- **Consent vor Tracking:** Synchroner Stub setzt alle nicht-notwendigen Signale auf `denied`, bevor irgendein Tag lädt.
- **Keine Drittanbieter:** Consent-Entscheidungen laufen über die eigene Domain (Same Origin) und den eigenen sGTM. Kein Consent-Datum verlässt die Infrastruktur des Kunden/von InBiz.
- **Audit-Trail:** Jede Entscheidung wird mit Zeitstempel und Consent-ID geloggt (BigQuery). Nachweisbarkeit gegenüber Aufsichtsbehörden.
- **Re-Consent bei Änderung:** Config-Versionierung erzwingt neue Einwilligung bei geänderter Verarbeitung.
- **Widerruf vollständig:** `revoke` löscht beide Cookies, auch das HttpOnly-Backup — sonst würde der Restore-Tag den widerrufenen Consent wiederherstellen.

---

## 9. Stufenmodell (Implementierungsstufen A/B/C)

OIL2 wird in drei aufeinander aufbauenden Stufen ausgeliefert. Jede Stufe ist eigenständig funktionsfähig.

| Stufe | Umfang | Status |
|---|---|---|
| **A — Client + Bridges** | Banner, Engine, alle vier Bridges, JS-Cookie, dataLayer. Funktioniert ohne Server-Side. | Basis |
| **B — Server-Side** | sGTM Cookie Keeper, Cookie Restore, Probe-Client. HttpOnly-Backup, Safari-ITP-Bypass. | Aufbau |
| **C — Consent-Beacon** | sGTM Consent-Client, sofortige serverseitige Spiegelung der Entscheidung. | Aktuell |

Stufe A liefert einen kompletten Client-CMP. Stufe B macht den Consent ITP-resistent. Stufe C eliminiert das Race-Condition-Fenster, indem der Server die Entscheidung sofort autoritativ übernimmt.

---

## 10. Roadmap

### Phase 1 — Core + Bridges + Server (Priorität 0)
Types, Config-Parser, Dual-Cookie, State Machine, Cookie-Restore, alle vier Bridges, Beacon, Stub, Public API, fünf sGTM-Templates. **Deliverable:** vollständiges Consent-Signaling client- und serverseitig.

### Phase 2 — Banner UI + Accessibility (Priorität 0)
CSS-in-JS, WCAG-Utilities, Shadow-DOM-Banner, Preference Center (lazy). **Deliverable:** vollständige, barrierefreie Oberfläche.

### Phase 3 — Integration + Blocker (Priorität 1)
iFrame/Script-Blocker, Integration-Tests (Consent-Flow, Safari-ITP, Basic-Mode).

### Phase 4 — Analytics (Priorität 1–2)
BigQuery-Schema, Looker-Studio-Template, Consent-Health-Monitoring.

### Offene Folgethemen
- GitHub-Veröffentlichung (`github.com/SEOnomie/oil2cmp`) inkl. LICENSE, CHANGELOG, CI-Workflow
- Setup-Guide und API-Doku (`docs/`)
- Geo-Scope-Verfeinerung (Basic Mode für AT/CH, CONFIG-SCHEMA Abschnitt 6)

---

## 11. Beziehung zu FORGE

OIL2 und FORGE sind komplementär:

- **OIL2** ist das *Produkt* — die CMP, die im Browser und sGTM läuft und vom Website-Besucher bedient wird.
- **FORGE** ist das *Werkzeug* — das Backend-System, das aGTM-Installationen (inkl. OIL2) in Kunden-Container provisioniert, deployt und überwacht.

In FORGE wird OIL2 ein Service-Blueprint (`oil2-cmp`). FORGE deployt OIL2 dann genauso wie GA4, Google Ads oder Meta CAPI. Damit wird die OIL2-Auslieferung reproduzierbar statt manuell.

---

## 12. Geschäftsmodell & Positionierung

OIL2 ist primär ein internes InBiz-Werkzeug mit Produktpotenzial:

- **Auslieferung als Teil des Tracking-Setups** — kein separater Lizenz-Posten für den Kunden, eingebettet in das InBiz-Leistungspaket.
- **Kein wiederkehrender SaaS-Kostenblock** — anders als CCM19/Usercentrics fällt keine Pro-Domain-Gebühr an.
- **Lizenz MIT** — bei späterer Open-Source-Veröffentlichung verwendbar als Referenz und Lead-Magnet.
- **Differenzierung gegenüber Wettbewerbern** — der sGTM-native Ansatz ist ein Alleinstellungsmerkmal, das Standard-CMPs nicht bieten.

---

## 13. Risiken & offene Punkte

| Risiko | Bewertung | Gegenmaßnahme |
|---|---|---|
| Safari-ITP-Timing (Race Condition) | Mittel | `wait_for_update: 500`, Stufe C eliminiert das Fenster |
| sGTM-Sandbox-Limitierungen | Niedrig | Templates strikt nach Sandbox-Regeln, Test-Matrix vorhanden |
| Manuelle Service-Konfig fehleranfällig | Mittel | Config-Schema-Validierung, FORGE-Deployment perspektivisch |
| Wartung als Solo-/Kleinteam-Projekt | Mittel | ≤10 KB, null Deps, 285 Tests halten die Wartungslast niedrig |
| DACH-Fokus limitiert Skalierung | Akzeptiert | Bewusste Abgrenzung; Multi-Regulation nicht im Scope |

---

## 14. Referenz-Dokumente

| Dokument | Inhalt |
|---|---|
| `PROJEKT.md` | Master-Briefing: Projektziel, Architektur, Dateistruktur, Build-Setup, State Machine, Public API |
| `SPEZIFIKATION.md` | Modul-für-Modul-Spezifikation mit Interfaces, Funktionen, Ein-/Ausgaben |
| `SGTM-TEMPLATES.md` | Vollständige sGTM-Template-Spezifikationen mit Sandboxed JS |
| `CONFIG-SCHEMA.md` | JSON-Schema, Validierungsregeln, Defaults, Beispiel-Konfigurationen |
| `TESTS.md` | Testmatrix: Unit-Tests, Integration-Tests, Safari-ITP-Szenarien |

---

*OIL2 ist ein Projekt der InBiz Online Marketing GmbH & Co. KG.*
