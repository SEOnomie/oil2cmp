# DECISIONS.md — oil2

<!-- MANUELL -->
## Manuelle ADRs

<!-- /MANUELL -->

<!-- AUTO-GENERIERT — NICHT MANUELL BEARBEITEN -->
*Letzte Analyse: 2026-04-05 23:02*

## AUTO-GENERIERT: Implizite Architekturentscheidungen

### ADR-001: Verwendung von Vite als Build-Tool und Dev-Server

**Status:** Akzeptiert

**Kontext:**
Das Projekt benötigt ein modernes Build-Tool für die Entwicklung und Produktionsbereitstellung.

**Entscheidung:**
Wir verwenden Vite als primäres Build-Tool und Development-Server.

**Begründung:**
- Schnelle Hot-Module-Replacement (HMR) während der Entwicklung
- Native ES-Module-Unterstützung
- Optimierte Bundle-Generierung für Production
- Gute TypeScript-Integration out-of-the-box

**Konsequenzen:**
- Abhängigkeit von der Vite-Toolchain
- Kompatibilität mit modernen Browsern erforderlich
- Schnellere Entwicklungszyklen durch effizientes HMR

### ADR-002: Fester Port 5201 mit strenger Port-Durchsetzung

**Status:** Akzeptiert

**Kontext:**
Der Development-Server benötigt eine konsistente Netzwerk-Konfiguration für lokale Entwicklung.

**Entscheidung:**
Wir konfigurieren den Dev-Server auf Port 5201 mit aktivierter `strictPort`-Option.

**Begründung:**
- Konsistente Entwicklungsumgebung für alle Entwickler
- Vermeidung von Port-Konflikten durch deterministische Port-Zuweisung
- Vereinfachte Konfiguration von Proxy-Services oder API-Endpoints

**Konsequenzen:**
- Server startet nicht, wenn Port 5201 bereits belegt ist
- Erfordert manuelle Konfliktlösung bei Port-Kollisionen
- Vorhersagbare URL für lokale Entwicklung (localhost:5201)
<!-- /AUTO-GENERIERT -->
