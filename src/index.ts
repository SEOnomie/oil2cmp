/**
 * OIL2 — Public API & Composition Root
 *
 * Setzt die globale `window.OIL2`-API, parst die Config, baut die echten
 * Engine-Dependencies (Bridges + Restore) zusammen und startet den Auto-Init.
 *
 * Dies ist der Composition Root: die einzige Stelle, an der die konkreten
 * Module zu den `EngineDeps` des Engine verdrahtet werden. Die Banner-Steuerung
 * ist als Phase-2-Seam (`_banner`) vorbereitet — bis dahin No-Ops; der Core
 * (Cookie-Restore, Bridges) funktioniert bereits ohne sichtbares Banner.
 *
 * @see SPEZIFIKATION.md §11
 */

import { createEngine, type OIL2Engine, type EngineDeps, type EngineUI } from './core/engine';
import { createUIController, type UIController } from './ui/controller';
import { initBlocker, applyConsent } from './blocker/blocker';
import { parseConfig } from './storage/config';
import { pushGoogleConsent } from './bridges/gcm';
import { pushUETConsent } from './bridges/uet';
import { pushClarityConsent } from './bridges/clarity';
import { pushConsentUpdate, pushConsentLog } from './bridges/datalayer';
import { pushConsentBeacon } from './bridges/beacon';
import { waitForCookieRestore, probeRestore } from './core/restore';
import { OIL2_VERSION } from './version';
import type { ConsentChoices, OIL2Event, EventCallback } from './core/types';

let _engine: OIL2Engine | null = null;

/** UI-Controller (Banner + lazy Preference Center). Belegt in init(). */
let _ui: UIController | null = null;

// ============================================================================
// Composition Root
// ============================================================================

/** Verdrahtet die konkreten Module zu den Engine-Dependencies. */
function _buildDeps(ui: EngineUI): EngineDeps {
  return {
    bridges: {
      pushGoogleConsent,
      pushUETConsent,
      pushClarityConsent,
      pushConsentUpdate,
      pushConsentLog,
      pushConsentBeacon,
    },
    restore: {
      waitForCookieRestore,
      probeRestore,
    },
    ui,
  };
}

const _emptyChoices = (): ConsentChoices => ({
  functional: false,
  analytics: false,
  marketing: false,
});

/** Initialisiert OIL2 (idempotent). */
function init(): void {
  if (_engine) return;
  const config = parseConfig();

  // UI-Controller mit late-bound Engine-Aktionen (Engine wird direkt danach gesetzt).
  _ui = createUIController(config, {
    setConsent: (choices, action) => _engine?.setConsent(choices, action),
    getConsent: () => _engine?.getConsent() ?? _emptyChoices(),
    openPreferences: () => _engine?.showPreferences(),
  });

  _engine = createEngine(config, _buildDeps(_ui));

  // iFrame/Embed-Blocker: blockt eingebettete Inhalte bis zum Consent und
  // gleicht bei jeder Consent-Aenderung ab. Listener VOR init() registrieren,
  // damit ein synchroner Cookie-Restore (consent:restored) bereits greift.
  initBlocker(
    () => _engine?.getConsent() ?? _emptyChoices(),
    () => _engine?.show(),
  );
  // Blocker bei jeder Consent-Änderung resynchronisieren. consent:updated deckt
  // setConsent UND revoke ab, consent:restored den Init-/ITP-Restore-Pfad. Beide
  // zusammen genügen — granted/denied wären redundant (consent:updated feuert
  // ohnehin) und würden den Blocker nur doppelt syncen.
  const _syncBlocker = (): void => applyConsent();
  _engine.on('consent:updated', _syncBlocker);
  _engine.on('consent:restored', _syncBlocker);

  void _engine.init();
}

// ============================================================================
// Public API
// ============================================================================

const publicAPI = {
  /** Aktuellen Consent abfragen. */
  getConsent: (): ConsentChoices =>
    _engine?.getConsent() ?? { functional: false, analytics: false, marketing: false },

  /** Banner erneut anzeigen (z. B. Footer-Link "Cookie-Einstellungen"). */
  show: (): void => _engine?.show(),

  /** Preference Center öffnen. */
  showPreferences: (): void => _engine?.showPreferences(),

  /** Consent programmatisch setzen (Action: 'custom'). */
  setConsent: (choices: ConsentChoices): void => _engine?.setConsent(choices, 'custom'),

  /** Consent widerrufen (alles denied, Banner zeigen). */
  revoke: (): void => _engine?.revoke(),

  /** Event-Listener registrieren. */
  on: (event: OIL2Event, cb: EventCallback): void => _engine?.on(event, cb),

  /** Event-Listener entfernen. */
  off: (event: OIL2Event, cb: EventCallback): void => _engine?.off(event, cb),

  /** Build-Version. */
  version: OIL2_VERSION,
};

/** Window-Erweiterung für die globale OIL2-API. */
interface OIL2Window extends Window {
  OIL2?: typeof publicAPI;
}

(window as OIL2Window).OIL2 = publicAPI;

// ============================================================================
// Auto-Init
// ============================================================================

// Script wird mit `defer` geladen → DOM i. d. R. bereits ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ============================================================================
// Named Exports (für ES-Module-Nutzer)
// ============================================================================

export { publicAPI as OIL2, OIL2_VERSION };
export type { ConsentChoices, OIL2Config, OIL2Event } from './core/types';
