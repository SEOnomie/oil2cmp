/**
 * OIL2 — Banner Tests (TESTS.md §7, T01–T24)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBanner, type BannerCallbacks, type BannerInstance } from '../../src/ui/banner';
import { parseConfig } from '../../src/storage/config';
import { injectConfig, cleanup } from '../helpers';
import type { OIL2Config } from '../../src/core/types';

function makeConfig(partial: Record<string, unknown> = {}): OIL2Config {
  injectConfig(partial as Partial<OIL2Config>);
  const c = parseConfig();
  document.getElementById('oil2-config')?.remove();
  return c;
}

function spies(): BannerCallbacks {
  return { onAcceptAll: vi.fn(), onRejectAll: vi.fn(), onCustomize: vi.fn() };
}

function host(): HTMLElement {
  return document.getElementById('oil2-banner-host') as HTMLElement;
}
function shadow(): ShadowRoot {
  return host().shadowRoot as ShadowRoot;
}

let instance: BannerInstance | null = null;

afterEach(() => {
  instance?.destroy();
  instance = null;
  cleanup();
  document.body.innerHTML = '';
});

describe('createBanner — Struktur', () => {
  beforeEach(() => {
    instance = createBanner(makeConfig(), spies());
  });

  it('T01: erstellt Container mit Shadow DOM', () => {
    expect(host()).not.toBeNull();
    expect(host().shadowRoot).not.toBeNull();
  });
  it('T02: Container hat id="oil2-banner-host"', () => {
    expect(host().id).toBe('oil2-banner-host');
  });
  it('T03: Shadow DOM enthaelt Banner-HTML', () => {
    expect(shadow().querySelector('.oil2-banner')).not.toBeNull();
  });
  it('T04: role="dialog" und aria-modal="true"', () => {
    const b = shadow().querySelector('.oil2-banner') as HTMLElement;
    expect(b.getAttribute('role')).toBe('dialog');
    expect(b.getAttribute('aria-modal')).toBe('true');
  });
  it('T05: enthaelt Title, Description, Links, Buttons', () => {
    expect(shadow().querySelector('.oil2-banner-title')).not.toBeNull();
    expect(shadow().querySelector('.oil2-banner-description')).not.toBeNull();
    expect(shadow().querySelectorAll('.oil2-banner-links a').length).toBe(2);
    expect(shadow().querySelectorAll('.oil2-btn').length).toBe(3);
  });
});

describe('Banner Buttons', () => {
  it('T06: Akzeptieren -> onAcceptAll', () => {
    const cb = spies();
    instance = createBanner(makeConfig(), cb);
    (shadow().querySelector('.oil2-btn-accept') as HTMLButtonElement).click();
    expect(cb.onAcceptAll).toHaveBeenCalledTimes(1);
  });
  it('T07: Ablehnen -> onRejectAll', () => {
    const cb = spies();
    instance = createBanner(makeConfig(), cb);
    (shadow().querySelector('.oil2-btn-reject') as HTMLButtonElement).click();
    expect(cb.onRejectAll).toHaveBeenCalledTimes(1);
  });
  it('T08: Einstellungen -> onCustomize', () => {
    const cb = spies();
    instance = createBanner(makeConfig(), cb);
    (shadow().querySelector('.oil2-btn-customize') as HTMLButtonElement).click();
    expect(cb.onCustomize).toHaveBeenCalledTimes(1);
  });
  it('T09: Buttons nutzen Labels aus Config', () => {
    instance = createBanner(
      makeConfig({ ui: { labels: { acceptAll: 'Ja klar', rejectAll: 'Nein danke' } } }),
      spies(),
    );
    expect((shadow().querySelector('.oil2-btn-accept') as HTMLElement).textContent).toBe('Ja klar');
    expect((shadow().querySelector('.oil2-btn-reject') as HTMLElement).textContent).toBe('Nein danke');
  });
});

describe('Banner Display', () => {
  beforeEach(() => {
    instance = createBanner(makeConfig(), spies());
  });
  it('T10: show() -> sichtbar (display != none)', () => {
    instance!.show();
    expect(host().style.display).not.toBe('none');
  });
  it('T11: hide() -> unsichtbar', () => {
    instance!.show();
    instance!.hide();
    expect(host().style.display).toBe('none');
  });
  it('T12: destroy() -> Container aus DOM entfernt', () => {
    instance!.destroy();
    instance = null;
    expect(document.getElementById('oil2-banner-host')).toBeNull();
  });
  it('T13: Doppelter show() -> nur ein Banner im DOM', () => {
    instance!.show();
    instance!.show();
    expect(document.querySelectorAll('#oil2-banner-host').length).toBe(1);
  });
});

describe('Banner Accessibility', () => {
  it('T14: Focus-Trap: Tab am Ende wrappt zum Anfang', () => {
    instance = createBanner(makeConfig(), spies());
    instance.show();
    const focusables = shadow().querySelectorAll<HTMLElement>(
      '.oil2-banner a, .oil2-banner button',
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(shadow().activeElement).toBe(first);
  });
  it('T15: Focus-Trap: Shift+Tab am Anfang wrappt zum Ende', () => {
    instance = createBanner(makeConfig(), spies());
    instance.show();
    const focusables = shadow().querySelectorAll<HTMLElement>(
      '.oil2-banner a, .oil2-banner button',
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first.focus();
    const ev = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    first.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(shadow().activeElement).toBe(last);
  });
  it('T16: ESC -> onRejectAll', () => {
    const cb = spies();
    instance = createBanner(makeConfig(), cb);
    instance.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cb.onRejectAll).toHaveBeenCalledTimes(1);
  });
  it('T17: Erstfokus auf "Ablehnen"', () => {
    instance = createBanner(makeConfig(), spies());
    instance.show();
    expect(shadow().activeElement).toBe(shadow().querySelector('.oil2-btn-reject'));
  });
  it('T18: aria-label entspricht config.ui.labels.title', () => {
    instance = createBanner(makeConfig({ ui: { labels: { title: 'Meine Cookies' } } }), spies());
    const b = shadow().querySelector('.oil2-banner') as HTMLElement;
    expect(b.getAttribute('aria-label')).toBe('Meine Cookies');
  });
});

describe('Banner Responsive / Theme (injected CSS)', () => {
  function css(cfgPartial: Record<string, unknown>): string {
    instance = createBanner(makeConfig(cfgPartial), spies());
    return (shadow().querySelector('style') as HTMLStyleElement).textContent || '';
  }
  it('T19: position bottom', () => {
    expect(css({ ui: { position: 'bottom' } })).toContain('bottom: 0;');
  });
  it('T20: position top', () => {
    expect(css({ ui: { position: 'top' } })).toContain('top: 0;');
  });
  it('T21: position center -> Modal-Overlay', () => {
    expect(css({ ui: { position: 'center' } })).toContain('inset: 0');
  });
  it('T22: equalButtons -> Accept gleichwertig (sekundaer)', () => {
    expect(css({ ui: { equalButtons: true } })).toContain(
      '.oil2-btn-accept { background: var(--oil2-btn-sec-bg)',
    );
  });
  it('T23: theme light -> kein Dark-Media-Query', () => {
    expect(css({ ui: { theme: 'light' } })).not.toContain('prefers-color-scheme: dark');
  });
  it('T24: theme dark -> Dark-Tokens', () => {
    expect(css({ ui: { theme: 'dark' } })).toContain('--oil2-bg: #1a1a18');
  });
});

describe('Banner Sicherheit', () => {
  it('XSS in Labels wird per textContent neutralisiert (EC14)', () => {
    instance = createBanner(
      makeConfig({ ui: { labels: { title: '<img src=x onerror=alert(1)>' } } }),
      spies(),
    );
    const title = shadow().querySelector('.oil2-banner-title') as HTMLElement;
    expect(title.querySelector('img')).toBeNull();
    expect(title.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('javascript:-URL wird blockiert', () => {
    instance = createBanner(
      makeConfig({ ui: { privacyUrl: 'javascript:alert(1)' } }),
      spies(),
    );
    const link = shadow().querySelector('.oil2-banner-links a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('#');
  });

  it('javascript:-URL mit Steuerzeichen (Tab) wird ebenfalls blockiert (Y3)', () => {
    instance = createBanner(
      makeConfig({ ui: { privacyUrl: 'java\tscript:alert(1)' } }),
      spies(),
    );
    const link = shadow().querySelector('.oil2-banner-links a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('#');
  });
});
