/**
 * OIL2 — Consent Engine Tests
 * @see TESTS.md §4 (T01–T42)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEngine, type EngineDeps } from '../../src/core/engine';
import { parseConfig } from '../../src/storage/config';
import { setCookie, makeCookiePayload, injectConfig, cleanup } from '../helpers';
import type { OIL2Config, ConsentChoices, RestoreResult } from '../../src/core/types';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

// -- Helpers ----------------------------------------------------------------

/** Baut eine vollständige Config (Defaults + Overrides) via parseConfig. */
function buildConfig(overrides: Record<string, unknown> = {}): OIL2Config {
  injectConfig(overrides);
  const c = parseConfig();
  document.getElementById('oil2-config')?.remove();
  return c;
}

const failedRestore: RestoreResult = { success: false, source: 'none', choices: null, duration: 0 };

/** Vollständig gemockte Deps. */
function makeDeps(): EngineDeps {
  return {
    bridges: {
      pushGoogleConsent: vi.fn(),
      pushUETConsent: vi.fn(),
      pushClarityConsent: vi.fn(),
      pushConsentUpdate: vi.fn(),
      pushConsentLog: vi.fn(),
      pushConsentBeacon: vi.fn(),
    },
    restore: {
      waitForCookieRestore: vi.fn().mockResolvedValue(failedRestore),
      probeRestore: vi.fn().mockResolvedValue(failedRestore),
    },
    ui: {
      showBanner: vi.fn(),
      hideBanner: vi.fn(),
      showPreferences: vi.fn(),
    },
  };
}

/** Deferred Promise für Timing-Tests. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const C_TRUE: ConsentChoices = { functional: true, analytics: true, marketing: true };
const C_FALSE: ConsentChoices = { functional: false, analytics: false, marketing: false };

// ===========================================================================

describe('createEngine', () => {
  it('T01: gibt OIL2Engine mit allen Methoden zurück', () => {
    const e = createEngine(buildConfig(), makeDeps());
    for (const m of ['init', 'getState', 'getConsent', 'setConsent', 'show', 'showPreferences', 'revoke', 'on', 'off']) {
      expect(typeof (e as unknown as Record<string, unknown>)[m]).toBe('function');
    }
  });

  it('T02: initialer State ist INIT', () => {
    const e = createEngine(buildConfig(), makeDeps());
    expect(e.getState()).toBe('INIT');
  });
});

describe('init — Cookie vorhanden', () => {
  it('T03: gleiche Config-Version → State = ACTIVE', async () => {
    setCookie('oil2', makeCookiePayload({ v: 1 }));
    const e = createEngine(buildConfig({ _v: 1 }), makeDeps());
    await e.init();
    expect(e.getState()).toBe('ACTIVE');
  });

  it('T04: getConsent() gibt gespeicherte Choices zurück', async () => {
    setCookie('oil2', makeCookiePayload({ f: 1, a: 0, m: 1, v: 1 }));
    const e = createEngine(buildConfig({ _v: 1 }), makeDeps());
    await e.init();
    expect(e.getConsent()).toEqual({ functional: true, analytics: false, marketing: true });
  });

  it('T05: Bridges werden gefeuert (Google, UET, Clarity, dataLayer)', async () => {
    setCookie('oil2', makeCookiePayload({ v: 1 }));
    const deps = makeDeps();
    const e = createEngine(buildConfig({ _v: 1 }), deps);
    await e.init();
    expect(deps.bridges.pushGoogleConsent).toHaveBeenCalled();
    expect(deps.bridges.pushUETConsent).toHaveBeenCalled();
    expect(deps.bridges.pushClarityConsent).toHaveBeenCalled();
    expect(deps.bridges.pushConsentUpdate).toHaveBeenCalled();
  });

  it('T06: consent:restored wird emittiert', async () => {
    setCookie('oil2', makeCookiePayload({ v: 1 }));
    const e = createEngine(buildConfig({ _v: 1 }), makeDeps());
    const cb = vi.fn();
    e.on('consent:restored', cb);
    await e.init();
    expect(cb).toHaveBeenCalled();
  });

  it('T07: andere Config-Version → Cookie gelöscht, State = PENDING', async () => {
    setCookie('oil2', makeCookiePayload({ v: 1 }));
    const writes: string[] = [];
    vi.spyOn(document, 'cookie', 'set').mockImplementation((v) => {
      writes.push(v as unknown as string);
    });
    const e = createEngine(buildConfig({ _v: 2 }), makeDeps());
    await e.init();
    expect(e.getState()).toBe('PENDING');
    expect(writes.some((w) => w.includes('max-age=0'))).toBe(true);
  });

  it('R1: andere Config-Version → Bridges feuern denied (alter Consent live widerrufen)', async () => {
    setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 1, v: 1 }));
    const deps = makeDeps();
    const e = createEngine(buildConfig({ _v: 2 }), deps);
    await e.init();
    expect(deps.bridges.pushGoogleConsent).toHaveBeenCalledWith(C_FALSE, expect.anything());
    expect(deps.bridges.pushUETConsent).toHaveBeenCalledWith(C_FALSE);
    expect(e.getState()).toBe('PENDING');
  });

  it('Stufe C: Beacon feuert NICHT bei restore (nur bei Entscheidung)', async () => {
    setCookie('oil2', makeCookiePayload({ v: 1 }));
    const deps = makeDeps();
    const e = createEngine(buildConfig({ _v: 1 }), deps);
    await e.init();
    expect(deps.bridges.pushConsentBeacon).not.toHaveBeenCalled();
  });
});

describe('init — Kein Cookie, kein Server', () => {
  it('T08: server.enabled = false → State = PENDING', async () => {
    const e = createEngine(buildConfig({ server: { enabled: false } }), makeDeps());
    await e.init();
    expect(e.getState()).toBe('PENDING');
  });

  it('T09: State PENDING → Banner wird gezeigt', async () => {
    const deps = makeDeps();
    const e = createEngine(buildConfig({ server: { enabled: false } }), deps);
    await e.init();
    expect(deps.ui.showBanner).toHaveBeenCalled();
  });

  it('T10: State PENDING → banner:shown Event', async () => {
    const e = createEngine(buildConfig({ server: { enabled: false } }), makeDeps());
    const cb = vi.fn();
    e.on('banner:shown', cb);
    await e.init();
    expect(cb).toHaveBeenCalled();
  });
});

describe('init — Kein Cookie, mit Server', () => {
  it('T11: server.enabled + restoreCookie → State = WAITING, Polling startet', async () => {
    const deps = makeDeps();
    const d = deferred<RestoreResult>();
    deps.restore.waitForCookieRestore = vi.fn().mockReturnValue(d.promise);
    const e = createEngine(buildConfig({ server: { enabled: true, endpoint: '/m', restoreCookie: true } }), deps);
    const p = e.init();
    expect(e.getState()).toBe('WAITING');
    expect(deps.restore.waitForCookieRestore).toHaveBeenCalled();
    d.resolve(failedRestore);
    await p;
  });

  it('T12: Polling findet Cookie → State = ACTIVE, Bridges feuern', async () => {
    const deps = makeDeps();
    deps.restore.waitForCookieRestore = vi.fn().mockImplementation(async () => {
      // Realistisch: der Server hat den Cookie via Set-Cookie gesetzt, bevor das
      // Polling-Result resolved — der Versions-Guard liest diesen echten Cookie.
      setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 0, v: 1 }));
      return {
        success: true,
        source: 'polling',
        choices: { functional: true, analytics: true, marketing: false },
        duration: 100,
      };
    });
    const e = createEngine(buildConfig({ server: { enabled: true, endpoint: '/m' } }), deps);
    await e.init();
    expect(e.getState()).toBe('ACTIVE');
    expect(deps.bridges.pushGoogleConsent).toHaveBeenCalled();
  });

  it('T13: Polling-Timeout → probeEndpoint aktiv → Probe-Request gesendet', async () => {
    const deps = makeDeps();
    deps.restore.waitForCookieRestore = vi.fn().mockResolvedValue(failedRestore);
    const e = createEngine(
      buildConfig({ server: { enabled: true, endpoint: '/m', probeEndpoint: true } }),
      deps,
    );
    await e.init();
    expect(deps.restore.probeRestore).toHaveBeenCalledWith('/m');
  });

  it('T14: Probe erfolgreich → State = ACTIVE', async () => {
    const deps = makeDeps();
    deps.restore.waitForCookieRestore = vi.fn().mockResolvedValue(failedRestore);
    deps.restore.probeRestore = vi.fn().mockImplementation(async () => {
      setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 1, v: 1 }));
      return { success: true, source: 'probe', choices: C_TRUE, duration: 50 };
    });
    const e = createEngine(buildConfig({ server: { enabled: true, endpoint: '/m', probeEndpoint: true } }), deps);
    await e.init();
    expect(e.getState()).toBe('ACTIVE');
  });

  it('T15: Probe fehlgeschlagen → State = PENDING, Banner gezeigt', async () => {
    const deps = makeDeps();
    const e = createEngine(buildConfig({ server: { enabled: true, endpoint: '/m', probeEndpoint: true } }), deps);
    await e.init();
    expect(e.getState()).toBe('PENDING');
    expect(deps.ui.showBanner).toHaveBeenCalled();
  });

  it('T16: probeEndpoint = false → nach Polling-Timeout direkt Banner', async () => {
    const deps = makeDeps();
    const e = createEngine(buildConfig({ server: { enabled: true, endpoint: '/m', probeEndpoint: false } }), deps);
    await e.init();
    expect(deps.restore.probeRestore).not.toHaveBeenCalled();
    expect(e.getState()).toBe('PENDING');
  });

  it('R1: Restore eines veralteten Cookies (alte _v) wird verworfen → Banner', async () => {
    setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 1, v: 1 }));
    const deps = makeDeps();
    // Server (sGTM Restore-Tag) stellt den ALTEN Cookie (v=1) wieder her,
    // obwohl die Config bereits auf _v=2 steht → muss verworfen werden.
    deps.restore.waitForCookieRestore = vi.fn().mockImplementation(async () => {
      setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 1, v: 1 }));
      return { success: true, source: 'polling', choices: C_TRUE, duration: 50 };
    });
    const e = createEngine(
      buildConfig({ _v: 2, server: { enabled: true, endpoint: '/m', restoreCookie: true } }),
      deps,
    );
    await e.init();
    expect(e.getState()).toBe('PENDING');
    expect(deps.ui.showBanner).toHaveBeenCalled();
    expect(e.getConsent()).toEqual(C_FALSE);
  });
});

describe('setConsent', () => {
  it('T17: aktualisiert interne Choices', () => {
    const e = createEngine(buildConfig(), makeDeps());
    e.setConsent(C_TRUE, 'accept_all');
    expect(e.getConsent()).toEqual(C_TRUE);
  });

  it('T18: schreibt Cookie', () => {
    const writes: string[] = [];
    vi.spyOn(document, 'cookie', 'set').mockImplementation((v) => {
      writes.push(v as unknown as string);
    });
    const e = createEngine(buildConfig(), makeDeps());
    e.setConsent(C_TRUE, 'accept_all');
    expect(writes.some((w) => w.startsWith('oil2='))).toBe(true);
  });

  it('T19: feuert Google CM v2 Update', () => {
    const deps = makeDeps();
    createEngine(buildConfig(), deps).setConsent(C_TRUE, 'accept_all');
    expect(deps.bridges.pushGoogleConsent).toHaveBeenCalled();
  });

  it('T20: feuert UET Update', () => {
    const deps = makeDeps();
    createEngine(buildConfig(), deps).setConsent(C_TRUE, 'accept_all');
    expect(deps.bridges.pushUETConsent).toHaveBeenCalled();
  });

  it('T21: feuert Clarity Update', () => {
    const deps = makeDeps();
    createEngine(buildConfig(), deps).setConsent(C_TRUE, 'accept_all');
    expect(deps.bridges.pushClarityConsent).toHaveBeenCalled();
  });

  it('T22: pusht dataLayer consent_update', () => {
    const deps = makeDeps();
    createEngine(buildConfig(), deps).setConsent(C_TRUE, 'accept_all');
    expect(deps.bridges.pushConsentUpdate).toHaveBeenCalled();
  });

  it('T23: consentLog.enabled → pusht consent_log', () => {
    const deps = makeDeps();
    createEngine(buildConfig({ consentLog: { enabled: true } }), deps).setConsent(C_TRUE, 'accept_all');
    expect(deps.bridges.pushConsentLog).toHaveBeenCalled();
  });

  it('T24: consentLog.enabled = false → kein consent_log', () => {
    const deps = makeDeps();
    createEngine(buildConfig({ consentLog: { enabled: false } }), deps).setConsent(C_TRUE, 'accept_all');
    expect(deps.bridges.pushConsentLog).not.toHaveBeenCalled();
  });

  it('T25: mindestens eine Kategorie true → consent:granted', () => {
    const e = createEngine(buildConfig(), makeDeps());
    const cb = vi.fn();
    e.on('consent:granted', cb);
    e.setConsent({ functional: false, analytics: true, marketing: false }, 'custom');
    expect(cb).toHaveBeenCalled();
  });

  it('T26: alle false → consent:denied', () => {
    const e = createEngine(buildConfig(), makeDeps());
    const cb = vi.fn();
    e.on('consent:denied', cb);
    e.setConsent(C_FALSE, 'reject_all');
    expect(cb).toHaveBeenCalled();
  });

  it('T27: State wird ACTIVE', () => {
    const e = createEngine(buildConfig(), makeDeps());
    e.setConsent(C_TRUE, 'accept_all');
    expect(e.getState()).toBe('ACTIVE');
  });

  it('T28: Banner geschlossen, banner:hidden emittiert', () => {
    const deps = makeDeps();
    const e = createEngine(buildConfig(), deps);
    const cb = vi.fn();
    e.on('banner:hidden', cb);
    e.setConsent(C_TRUE, 'accept_all');
    expect(deps.ui.hideBanner).toHaveBeenCalled();
    expect(cb).toHaveBeenCalled();
  });

  it('Y1: emittiert consent:updated bei jeder Änderung', () => {
    const e = createEngine(buildConfig(), makeDeps());
    const cb = vi.fn();
    e.on('consent:updated', cb);
    e.setConsent({ functional: false, analytics: true, marketing: false }, 'custom');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ functional: false, analytics: true, marketing: false });
  });

  it('Stufe C: feuert Consent-Beacon mit Action', () => {
    const deps = makeDeps();
    createEngine(buildConfig(), deps).setConsent(C_TRUE, 'accept_all');
    expect(deps.bridges.pushConsentBeacon).toHaveBeenCalledWith(C_TRUE, 'accept_all', expect.anything());
  });
});

describe('show / showPreferences', () => {
  it('T29: show() → Banner erscheint, State = UPDATING', () => {
    const deps = makeDeps();
    const e = createEngine(buildConfig(), deps);
    e.show();
    expect(deps.ui.showBanner).toHaveBeenCalled();
    expect(e.getState()).toBe('UPDATING');
  });

  it('T30: showPreferences() → Preference Center erscheint', () => {
    const deps = makeDeps();
    const e = createEngine(buildConfig(), deps);
    e.showPreferences();
    expect(deps.ui.showPreferences).toHaveBeenCalled();
  });

  it('T31: show() im ACTIVE State → State = UPDATING', () => {
    const e = createEngine(buildConfig(), makeDeps());
    e.setConsent(C_TRUE, 'accept_all');
    expect(e.getState()).toBe('ACTIVE');
    e.show();
    expect(e.getState()).toBe('UPDATING');
  });
});

describe('revoke', () => {
  it('T32: setzt alle Choices auf false', () => {
    const e = createEngine(buildConfig(), makeDeps());
    e.setConsent(C_TRUE, 'accept_all');
    e.revoke();
    expect(e.getConsent()).toEqual(C_FALSE);
  });

  it('T33: löscht Cookie', () => {
    const writes: string[] = [];
    const e = createEngine(buildConfig(), makeDeps());
    vi.spyOn(document, 'cookie', 'set').mockImplementation((v) => {
      writes.push(v as unknown as string);
    });
    e.revoke();
    expect(writes.some((w) => w.includes('max-age=0'))).toBe(true);
  });

  it('T34: feuert Bridges mit denied', () => {
    const deps = makeDeps();
    const e = createEngine(buildConfig(), deps);
    e.revoke();
    expect(deps.bridges.pushGoogleConsent).toHaveBeenCalledWith(C_FALSE, expect.anything());
  });

  it('T35: State = PENDING, Banner gezeigt', () => {
    const deps = makeDeps();
    const e = createEngine(buildConfig(), deps);
    e.revoke();
    expect(e.getState()).toBe('PENDING');
    expect(deps.ui.showBanner).toHaveBeenCalled();
  });

  it('R2: emittiert consent:denied (löst Blocker-Re-Sync aus)', () => {
    const e = createEngine(buildConfig(), makeDeps());
    const cb = vi.fn();
    e.on('consent:denied', cb);
    e.setConsent(C_TRUE, 'accept_all'); // erst granted (emittiert consent:granted)
    e.revoke();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(C_FALSE);
  });

  it('Y1: revoke emittiert consent:updated', () => {
    const e = createEngine(buildConfig(), makeDeps());
    const cb = vi.fn();
    e.on('consent:updated', cb);
    e.revoke();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(C_FALSE);
  });

  it('Y2: revoke schreibt Consent-Log mit action=revoke (wenn aktiviert)', () => {
    const deps = makeDeps();
    const e = createEngine(buildConfig({ consentLog: { enabled: true } }), deps);
    e.revoke();
    expect(deps.bridges.pushConsentLog).toHaveBeenCalledWith(C_FALSE, 'revoke', expect.anything());
  });

  it('Y2: consentLog.enabled = false → kein Revoke-Log', () => {
    const deps = makeDeps();
    const e = createEngine(buildConfig({ consentLog: { enabled: false } }), deps);
    e.revoke();
    expect(deps.bridges.pushConsentLog).not.toHaveBeenCalled();
  });

  it('Stufe C: Beacon feuert mit action=revoke', () => {
    const deps = makeDeps();
    createEngine(buildConfig(), deps).revoke();
    expect(deps.bridges.pushConsentBeacon).toHaveBeenCalledWith(C_FALSE, 'revoke', expect.anything());
  });
});

describe('Event Bus', () => {
  it('T36/T37: on() registriert, Callback wird bei Event aufgerufen', () => {
    const e = createEngine(buildConfig(), makeDeps());
    const cb = vi.fn();
    e.on('consent:granted', cb);
    e.setConsent(C_TRUE, 'accept_all');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('T38/T39: off() entfernt Callback → nicht mehr aufgerufen', () => {
    const e = createEngine(buildConfig(), makeDeps());
    const cb = vi.fn();
    e.on('consent:granted', cb);
    e.off('consent:granted', cb);
    e.setConsent(C_TRUE, 'accept_all');
    expect(cb).not.toHaveBeenCalled();
  });

  it('T40: mehrere Callbacks auf ein Event → alle aufgerufen', () => {
    const e = createEngine(buildConfig(), makeDeps());
    const a = vi.fn();
    const b = vi.fn();
    e.on('consent:granted', a);
    e.on('consent:granted', b);
    e.setConsent(C_TRUE, 'accept_all');
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('T41: Callback auf nicht-existierendes Event → kein Error', () => {
    const e = createEngine(buildConfig(), makeDeps());
    expect(() => e.on('consent:updated', vi.fn())).not.toThrow();
    // Emit eines Events ohne Listener crasht nicht:
    expect(() => e.revoke()).not.toThrow();
  });

  it('T42: doppelter init() → idempotent, zweiter ignoriert', async () => {
    setCookie('oil2', makeCookiePayload({ v: 1 }));
    const deps = makeDeps();
    const e = createEngine(buildConfig({ _v: 1 }), deps);
    await e.init();
    const callsAfterFirst = (deps.bridges.pushGoogleConsent as ReturnType<typeof vi.fn>).mock.calls.length;
    await e.init();
    expect((deps.bridges.pushGoogleConsent as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterFirst);
  });
});
