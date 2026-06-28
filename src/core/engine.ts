/**
 * OIL2 — Consent Engine
 *
 * State Machine, Event Bus und zentrale Steuerung. Orchestriert Cookie-Storage,
 * Config-Versionsabgleich, Bridges, Cookie-Restore und Banner.
 *
 * Architektur-Hinweis: Bridges, Restore und Banner-Steuerung werden per
 * Dependency Injection (`deps`) hereingereicht. Grund: Diese Module entstehen
 * erst nach dem Engine (der Banner sogar in Phase 2) und können daher nicht
 * direkt importiert werden. `createEngine(config)` funktioniert dank No-Op-
 * Defaults trotzdem; die echte Verdrahtung übernimmt `index.ts` (Modul 11).
 * Cookie-Storage und Config sind bereits fertig und werden direkt importiert.
 *
 * Wirft nie: Listener-Fehler werden geloggt, nicht propagiert.
 *
 * @see SPEZIFIKATION.md §4
 */

import type {
  OIL2Config,
  ConsentChoices,
  ConsentState,
  ConsentAction,
  OIL2Event,
  EventCallback,
  RestoreResult,
} from './types';
import { readConsent, writeConsent, deleteConsent, payloadToChoices } from '../storage/cookies';
import { hasConfigChanged } from '../storage/config';

// ============================================================================
// Public Interface
// ============================================================================

export interface OIL2Engine {
  init(): Promise<void>;
  getState(): ConsentState;
  getConsent(): ConsentChoices;
  setConsent(choices: ConsentChoices, action: ConsentAction): void;
  show(): void;
  showPreferences(): void;
  revoke(): void;
  on(event: OIL2Event, callback: EventCallback): void;
  off(event: OIL2Event, callback: EventCallback): void;
}

// ============================================================================
// Injected Dependencies
// ============================================================================

/** Bridge-Funktionen (Module 6–9). */
export interface EngineBridges {
  pushGoogleConsent: (choices: ConsentChoices, config: OIL2Config) => void;
  pushUETConsent: (choices: ConsentChoices) => void;
  pushClarityConsent: (choices: ConsentChoices, config: OIL2Config) => void;
  pushConsentUpdate: (choices: ConsentChoices) => void;
  pushConsentLog: (choices: ConsentChoices, action: ConsentAction, config: OIL2Config) => void;
  pushConsentBeacon: (choices: ConsentChoices, action: ConsentAction, config: OIL2Config) => void;
}

/** Cookie-Restore-Funktionen (Modul 5). */
export interface EngineRestore {
  waitForCookieRestore: (timeout: number) => Promise<RestoreResult>;
  probeRestore: (endpoint: string) => Promise<RestoreResult>;
}

/** Banner-/Preference-Steuerung (Phase 2). */
export interface EngineUI {
  showBanner: () => void;
  hideBanner: () => void;
  showPreferences: () => void;
}

export interface EngineDeps {
  bridges: EngineBridges;
  restore: EngineRestore;
  ui: EngineUI;
}

/** No-Op-Defaults, damit `createEngine(config)` ohne Verdrahtung lauffähig ist. */
function _defaultDeps(): EngineDeps {
  const noop = (): void => {};
  const failedRestore = (): Promise<RestoreResult> =>
    Promise.resolve({ success: false, source: 'none', choices: null, duration: 0 });
  return {
    bridges: {
      pushGoogleConsent: noop,
      pushUETConsent: noop,
      pushClarityConsent: noop,
      pushConsentUpdate: noop,
      pushConsentLog: noop,
      pushConsentBeacon: noop,
    },
    restore: {
      waitForCookieRestore: failedRestore,
      probeRestore: failedRestore,
    },
    ui: {
      showBanner: noop,
      hideBanner: noop,
      showPreferences: noop,
    },
  };
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Erstellt eine Engine-Instanz mit interner State-Verwaltung.
 *
 * @param config Vollständige, validierte Config.
 * @param deps   Injizierte Kollaborateure. Default: No-Ops.
 */
export function createEngine(config: OIL2Config, deps: EngineDeps = _defaultDeps()): OIL2Engine {
  let _state: ConsentState = 'INIT';
  let _choices: ConsentChoices = { functional: false, analytics: false, marketing: false };
  const _listeners = new Map<OIL2Event, Set<EventCallback>>();
  let _initialized = false;

  // -- State & Events --------------------------------------------------------

  function _setState(state: ConsentState): void {
    _state = state;
  }

  function _emit(event: OIL2Event): void {
    const set = _listeners.get(event);
    if (!set) return;
    // Snapshot, falls ein Listener während des Durchlaufs off() aufruft.
    for (const cb of [...set]) {
      try {
        cb({ ..._choices });
      } catch (e) {
        _warn('Event listener threw for "' + event + '": ' + e);
      }
    }
  }

  // -- Bridges ---------------------------------------------------------------

  /** Feuert die vier Consent-Bridges (ohne Consent-Log). */
  function _fireBridges(choices: ConsentChoices): void {
    deps.bridges.pushGoogleConsent(choices, config);
    deps.bridges.pushUETConsent(choices);
    deps.bridges.pushClarityConsent(choices, config);
    deps.bridges.pushConsentUpdate(choices);
  }

  // -- Consent anwenden ------------------------------------------------------

  /** Wendet wiederhergestellten Consent an: RESTORED → Bridges → restored → ACTIVE. */
  function _restoreConsent(choices: ConsentChoices): void {
    _choices = choices;
    _setState('RESTORED');
    _fireBridges(choices);
    _emit('consent:restored');
    _setState('ACTIVE');
  }

  /** Zeigt den Banner im Erst-/Revoke-Flow: PENDING → showBanner → banner:shown. */
  function _showInitialBanner(): void {
    _setState('PENDING');
    deps.ui.showBanner();
    _emit('banner:shown');
  }

  // -- Restore-Flow ----------------------------------------------------------

  /**
   * Wendet ein Restore-Ergebnis NUR an, wenn der wiederhergestellte `oil2`
   * Cookie die AKTUELLE Config-Version trägt (R1).
   *
   * Hintergrund: Bei einem Config-Versions-Bump wird der JS-Cookie in `init()`
   * gelöscht — der serverseitige `oil2_srv` (HttpOnly) hält aber noch die ALTE
   * Version. Das sGTM-Restore-Tag kopiert ihn auf den nächsten Request nach
   * `oil2` zurück; ohne Versionsprüfung würde das Polling diesen veralteten
   * Consent anwenden und das Re-Consent-Banner überspringen. Greift die alte
   * Version, wird der Cookie wieder gelöscht und `false` zurückgegeben, damit
   * der Banner-Flow läuft.
   */
  function _tryApplyRestore(result: RestoreResult): boolean {
    if (!result.success || !result.choices) return false;
    const payload = readConsent();
    if (!payload || hasConfigChanged(payload.v, config)) {
      if (payload) deleteConsent(config);
      return false;
    }
    _restoreConsent(payloadToChoices(payload));
    return true;
  }

  /** Kein (gültiger) Cookie: ggf. Restore versuchen, sonst Banner zeigen. */
  async function _restoreOrBanner(): Promise<void> {
    const restoreActive = config.server.enabled && config.server.restoreCookie;
    if (!restoreActive) {
      _showInitialBanner();
      return;
    }

    _setState('WAITING');
    if (_tryApplyRestore(await deps.restore.waitForCookieRestore(config.server.restoreTimeout))) {
      return;
    }

    // Polling-Timeout → Probe-Request als Fallback (z. B. Basic Mode).
    if (config.server.probeEndpoint) {
      if (_tryApplyRestore(await deps.restore.probeRestore(config.server.endpoint))) {
        return;
      }
    }

    _showInitialBanner();
  }

  // -- Public Methods --------------------------------------------------------

  async function init(): Promise<void> {
    if (_initialized) return; // idempotent
    _initialized = true;

    const payload = readConsent();

    if (payload && !hasConfigChanged(payload.v, config)) {
      // Gültiger Cookie, gleiche Config-Version.
      _restoreConsent(payloadToChoices(payload));
      return;
    }

    if (payload) {
      // Cookie vorhanden, aber Config-Version geändert → Re-Consent (R1):
      // alten Cookie löschen UND den vom Stub aus dem alten Cookie gesetzten
      // (granted) Consent-Default live auf denied zurücknehmen, bis der User
      // neu entscheidet. Ohne dieses Update bliebe der alte Consent bis zur
      // Neuwahl aktiv (DSGVO-Verstoss).
      deleteConsent(config);
      _fireBridges({ functional: false, analytics: false, marketing: false });
    }

    await _restoreOrBanner();
  }

  function setConsent(choices: ConsentChoices, action: ConsentAction): void {
    // Defensiv coercen (schützt vor Partial/Non-Boolean zur Laufzeit).
    _choices = {
      functional: !!choices.functional,
      analytics: !!choices.analytics,
      marketing: !!choices.marketing,
    };

    writeConsent(_choices, config);
    _fireBridges(_choices);

    if (config.consentLog.enabled) {
      deps.bridges.pushConsentLog(_choices, action, config);
    }

    // Stufe C: Entscheidung sofort serverseitig spiegeln (Cookie-Sync + ITP-Backup).
    deps.bridges.pushConsentBeacon(_choices, action, config);

    deps.ui.hideBanner();
    _setState('ACTIVE');

    const anyGranted = _choices.functional || _choices.analytics || _choices.marketing;
    _emit(anyGranted ? 'consent:granted' : 'consent:denied');
    // Generisches "Consent hat sich geändert"-Signal (Y1): ein einzelnes Event,
    // an das nachgelagerte Consumer (z. B. der iFrame-Blocker) andocken können,
    // ohne granted/denied einzeln behandeln zu müssen.
    _emit('consent:updated');
    _emit('banner:hidden');
  }

  function show(): void {
    _setState('UPDATING');
    deps.ui.showBanner();
    _emit('banner:shown');
  }

  function showPreferences(): void {
    _setState('UPDATING');
    deps.ui.showPreferences();
  }

  function revoke(): void {
    _choices = { functional: false, analytics: false, marketing: false };
    deleteConsent(config);
    _fireBridges(_choices);

    // Y2: Widerruf in den Audit-Trail schreiben (sofern aktiviert) — sonst
    // fehlten Revoke-Vorgänge im BigQuery-Consent-Log.
    if (config.consentLog.enabled) {
      deps.bridges.pushConsentLog(_choices, 'revoke', config);
    }

    // Stufe C: Widerruf serverseitig spiegeln. Der Consent-Client loescht bei
    // action=revoke BEIDE Cookies (auch oil2_srv) — sonst wuerde der Restore-Tag
    // den widerrufenen Consent beim naechsten Load wiederherstellen.
    deps.bridges.pushConsentBeacon(_choices, 'revoke', config);

    _setState('PENDING');
    // consent:denied (Richtung) + consent:updated (generisches Change-Signal),
    // BEVOR der Banner kommt. Nachgelagerte Listener (v. a. der iFrame-Blocker,
    // der via index.ts auf consent:updated hört) nehmen den Widerruf so an und
    // blockieren bereits geladene Embeds erneut. Ohne dieses Signal liefen
    // freigeschaltete iframes nach dem Widerruf bis zum Reload weiter.
    _emit('consent:denied');
    _emit('consent:updated');
    deps.ui.showBanner();
    _emit('banner:shown');
  }

  function on(event: OIL2Event, callback: EventCallback): void {
    let set = _listeners.get(event);
    if (!set) {
      set = new Set();
      _listeners.set(event, set);
    }
    set.add(callback);
  }

  function off(event: OIL2Event, callback: EventCallback): void {
    _listeners.get(event)?.delete(callback);
  }

  return {
    init,
    getState: () => _state,
    getConsent: () => ({ ..._choices }),
    setConsent,
    show,
    showPreferences,
    revoke,
    on,
    off,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function _warn(msg: string): void {
  console.warn('[OIL2] ' + msg);
}
