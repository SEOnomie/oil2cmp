/**
 * OIL2 — Integration: Basic Mode (TESTS.md §8, IT16–IT20)
 *
 * Basic Mode unterscheidet sich fuer OIL2 v. a. im Stub (wait_for_update) und
 * darin, dass mangels GA4-Ping der Probe-Request der Restore-Pfad ist. Das
 * eigentliche Laden/Nicht-Laden von Tags ist GTM-Verhalten (Consent Mode im
 * Container) — OIL2 liefert dafuer das korrekte Signal.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import { wireEngine, makeConfig, findGcmUpdate, bannerHost, bannerButton } from './wire';
import { mockDataLayer, mockClarity, cleanup } from '../helpers';

beforeEach(() => {
  mockDataLayer();
  (window as unknown as { uetq?: unknown[] }).uetq = [];
  mockClarity();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('Stub', () => {
  it('IT16: kein Cookie -> Consent default denied + wait_for_update:500', () => {
    const win = new Window({ url: 'https://example.de/' });
    const code = readFileSync('src/stub.js', 'utf8');
    new win.Function(code).call(win);

    const dl = (win as unknown as { dataLayer: Array<{ [k: number]: unknown }> }).dataLayer;
    const def = dl.find((e) => e[0] === 'consent' && e[1] === 'default');
    expect(def).toBeTruthy();
    const state = def![2] as Record<string, unknown>;
    expect(state.ad_storage).toBe('denied');
    expect(state.analytics_storage).toBe('denied');
    expect(state.security_storage).toBe('granted');
    expect(state.wait_for_update).toBe(500);
  });

  it('Y5: gültiger Cookie mit Marketing → UET- und GCM-Default granted', () => {
    const win = new Window({ url: 'https://example.de/' });
    const payload = btoa(JSON.stringify({ f: 0, a: 0, m: 1, t: 1, v: 1, ab: 'A' }));
    win.document.cookie = 'oil2=' + payload;
    const code = readFileSync('src/stub.js', 'utf8');
    new win.Function(code).call(win);

    // UET-Default aus Cookie abgeleitet (statt pauschal denied).
    const uetq = (win as unknown as { uetq: unknown[] }).uetq;
    expect(uetq[0]).toBe('consent');
    expect(uetq[1]).toBe('default');
    expect(uetq[2]).toMatchObject({ ad_storage: 'granted' });

    // GCM-Default ebenfalls aus Cookie, ohne wait_for_update (Consent steht fest).
    const dl = (win as unknown as { dataLayer: Array<{ [k: number]: unknown }> }).dataLayer;
    const def = dl.find((e) => e[0] === 'consent' && e[1] === 'default');
    const state = def![2] as Record<string, unknown>;
    expect(state.ad_storage).toBe('granted');
    expect(state.wait_for_update).toBeUndefined();
  });
});

describe('Restore im Basic Mode', () => {
  it('IT17: Polling-Timeout -> Probe-Request als Fallback', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

    const engine = wireEngine(
      makeConfig({
        consentMode: 'basic',
        server: { enabled: true, endpoint: '/tracking', restoreTimeout: 100 },
      }),
    );
    await engine.init();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/tracking/oil2/restore');
  });
});

describe('Consent-Signal im Basic Mode', () => {
  it('IT18: Consent erteilt -> granted-Signal (GTM darf laden)', async () => {
    const engine = wireEngine(makeConfig({ consentMode: 'basic' }));
    await engine.init();
    bannerButton('.oil2-btn-accept').click();

    expect(findGcmUpdate()).toMatchObject({
      analytics_storage: 'granted',
      ad_storage: 'granted',
    });
  });

  it('IT19: Consent denied -> denied-Signal (GTM laedt gated Tags nicht)', async () => {
    const engine = wireEngine(makeConfig({ consentMode: 'basic' }));
    await engine.init();
    bannerButton('.oil2-btn-reject').click();

    expect(findGcmUpdate()).toMatchObject({
      analytics_storage: 'denied',
      ad_storage: 'denied',
    });
    expect(bannerHost()!.style.display).toBe('none');
  });

  // IT20: "kein cookieless Ping" ist reines GTM-Consent-Mode-Verhalten
  // (advanced vs. basic im Container) und nicht von der OIL2-Runtime steuerbar.
  // Validiert ueber die sGTM-Manualtests (TESTS.md §11) und die GTM-Konfiguration.
  it.skip('IT20: kein cookieless Ping (GTM-seitig, siehe §11)', () => {});
});
