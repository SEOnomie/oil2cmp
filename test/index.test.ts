/**
 * OIL2 — Composition Root Tests (index.ts)
 *
 * Erste End-to-End-Verdrahtung: alle Phase-1-Module laufen hier UNGEMOCKT
 * zusammen (echte Bridges, echter Restore). Nutzt dynamisches import() mit
 * resetModules, da index.ts beim Import auto-initialisiert.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setCookie, makeCookiePayload, injectConfig, mockDataLayer, mockClarity, cleanup } from './helpers';
import type { ConsentChoices } from '../src/core/types';

interface PublicAPI {
  getConsent: () => ConsentChoices;
  show: () => void;
  showPreferences: () => void;
  setConsent: (c: ConsentChoices) => void;
  revoke: () => void;
  on: (e: string, cb: (d: ConsentChoices) => void) => void;
  off: (e: string, cb: (d: ConsentChoices) => void) => void;
  version: string;
}

function getAPI(): PublicAPI {
  return (window as unknown as { OIL2: PublicAPI }).OIL2;
}

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.getElementById('oil2-prefs-host')?.remove();
  document.querySelectorAll('iframe[data-oil2-category]').forEach((el) => el.remove());
  cleanup();
});

describe('index (Composition Root)', () => {
  it('exponiert window.OIL2 mit voller Public API', async () => {
    injectConfig({});
    await import('../src/index');
    const api = getAPI();
    expect(api).toBeDefined();
    for (const m of ['getConsent', 'show', 'showPreferences', 'setConsent', 'revoke', 'on', 'off']) {
      expect(typeof (api as unknown as Record<string, unknown>)[m]).toBe('function');
    }
    expect(typeof api.version).toBe('string');
  });

  it('Returning User mit gültigem Cookie → Consent restored + echte Bridges feuern', async () => {
    injectConfig({ _v: 1 });
    setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 0, v: 1 }));
    const dl = mockDataLayer();
    const clarity = mockClarity();

    await import('../src/index');

    // Cookie-Pfad ist synchron — Consent steht direkt nach dem Import.
    expect(getAPI().getConsent()).toEqual({ functional: true, analytics: true, marketing: false });

    // gcm: consent update im dataLayer
    const hasConsentUpdate = dl.some((e) => {
      const a = Array.from(e as ArrayLike<unknown>);
      return a[0] === 'consent' && a[1] === 'update';
    });
    expect(hasConsentUpdate).toBe(true);

    // datalayer bridge: oil2_consent_update Event
    const hasDlEvent = dl.some((e) => (e as { event?: string }).event === 'oil2_consent_update');
    expect(hasDlEvent).toBe(true);

    // clarity gefeuert, uetq angelegt
    expect(clarity).toHaveBeenCalled();
    expect(Array.isArray((window as unknown as { uetq?: unknown[] }).uetq)).toBe(true);
  });

  it('setConsent über Public API schreibt Cookie und feuert Bridges', async () => {
    injectConfig({});
    const dl = mockDataLayer();

    await import('../src/index'); // Auto-Init: kein Cookie → PENDING (Banner = No-Op)

    // Setter erst nach Auto-Init spionieren.
    const writes: string[] = [];
    vi.spyOn(document, 'cookie', 'set').mockImplementation((v) => {
      writes.push(v as unknown as string);
    });

    getAPI().setConsent({ functional: true, analytics: true, marketing: true });

    expect(writes.some((w) => w.startsWith('oil2='))).toBe(true);
    expect(dl.some((e) => (e as { event?: string }).event === 'oil2_consent_update')).toBe(true);
  });

  it('getConsent vor Init-Cookie → Default (alles false)', async () => {
    injectConfig({});
    await import('../src/index'); // kein Cookie
    expect(getAPI().getConsent()).toEqual({ functional: false, analytics: false, marketing: false });
  });

  it('show() über Public API zeigt den Banner', async () => {
    injectConfig({});
    mockDataLayer();
    await import('../src/index');
    getAPI().show();
    expect(document.getElementById('oil2-banner-host')).not.toBeNull();
  });

  it('revoke() über Public API löscht Cookie und zeigt Banner', async () => {
    injectConfig({ _v: 1 });
    setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 1, v: 1 }));
    mockDataLayer();
    await import('../src/index');

    const writes: string[] = [];
    vi.spyOn(document, 'cookie', 'set').mockImplementation((v) => {
      writes.push(v as unknown as string);
    });

    getAPI().revoke();

    expect(writes.some((w) => w.startsWith('oil2=') && /max-age=0/.test(w))).toBe(true);
    expect(getAPI().getConsent()).toEqual({ functional: false, analytics: false, marketing: false });
    expect(document.getElementById('oil2-banner-host')).not.toBeNull();
  });

  it('R2: revoke() re-blockt eingebettete iframes (End-to-End über echte Verdrahtung)', async () => {
    injectConfig({ _v: 1 });
    setCookie('oil2', makeCookiePayload({ f: 0, a: 0, m: 1, v: 1 })); // Marketing granted
    mockDataLayer();

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-oil2-category', 'marketing');
    iframe.setAttribute('src', 'https://www.youtube.com/embed/abc');
    document.body.appendChild(iframe);

    await import('../src/index');

    // Returning User mit Marketing-Consent → Embed ist freigeschaltet.
    expect(iframe.getAttribute('src')).toBe('https://www.youtube.com/embed/abc');

    getAPI().revoke();

    // R2: nach Widerruf erneut blockiert (src entfernt, in data-oil2-src gesichert).
    expect(iframe.getAttribute('src')).toBeNull();
    expect(iframe.getAttribute('data-oil2-src')).toBe('https://www.youtube.com/embed/abc');
  });

  it('on()/off() registriert und entfernt Listener', async () => {
    injectConfig({});
    mockDataLayer();
    await import('../src/index');
    const api = getAPI();
    const cb = vi.fn();

    api.on('consent:granted', cb);
    api.setConsent({ functional: true, analytics: false, marketing: false });
    expect(cb).toHaveBeenCalledTimes(1);

    api.off('consent:granted', cb);
    api.setConsent({ functional: true, analytics: true, marketing: false });
    expect(cb).toHaveBeenCalledTimes(1); // nach off() nicht erneut
  });

  it('showPreferences() über Public API lädt das Preference Center', async () => {
    injectConfig({});
    mockDataLayer();
    await import('../src/index');
    getAPI().showPreferences();
    await vi.waitFor(() => expect(document.getElementById('oil2-prefs-host')).not.toBeNull());
  });
});
