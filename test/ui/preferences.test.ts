/**
 * OIL2 — Preference Center Tests
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createPreferences,
  type PreferenceCallbacks,
  type PreferenceInstance,
} from '../../src/ui/preferences';
import { parseConfig } from '../../src/storage/config';
import { injectConfig, cleanup } from '../helpers';
import type { OIL2Config, ConsentChoices } from '../../src/core/types';

function makeConfig(partial: Record<string, unknown> = {}): OIL2Config {
  injectConfig(partial as Partial<OIL2Config>);
  const c = parseConfig();
  document.getElementById('oil2-config')?.remove();
  return c;
}

function spies(): PreferenceCallbacks {
  return { onSave: vi.fn(), onClose: vi.fn() };
}

const ALL_FALSE: ConsentChoices = { functional: false, analytics: false, marketing: false };

function host(): HTMLElement {
  return document.getElementById('oil2-prefs-host') as HTMLElement;
}
function shadow(): ShadowRoot {
  return host().shadowRoot as ShadowRoot;
}

let instance: PreferenceInstance | null = null;

afterEach(() => {
  instance?.destroy();
  instance = null;
  cleanup();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('createPreferences — Struktur', () => {
  it('erstellt Host mit Shadow DOM und role=dialog', () => {
    instance = createPreferences(makeConfig(), ALL_FALSE, spies());
    expect(host().id).toBe('oil2-prefs-host');
    expect(host().shadowRoot).not.toBeNull();
    const dlg = shadow().querySelector('.oil2-prefs') as HTMLElement;
    expect(dlg.getAttribute('role')).toBe('dialog');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
  });

  it('rendert 4 Kategorien (Notwendig + 3 togglebar)', () => {
    instance = createPreferences(makeConfig(), ALL_FALSE, spies());
    expect(shadow().querySelectorAll('.oil2-prefs-category').length).toBe(4);
    expect(shadow().querySelectorAll('.oil2-toggle').length).toBe(4);
  });

  it('Notwendig ist disabled und checked (immer aktiv)', () => {
    instance = createPreferences(makeConfig(), ALL_FALSE, spies());
    const nec = shadow().querySelector('#oil2-necessary') as HTMLInputElement;
    expect(nec.disabled).toBe(true);
    expect(nec.checked).toBe(true);
    expect(shadow().querySelector('.oil2-prefs-always')?.textContent).toBe('Immer aktiv');
  });

  it('Kategorie-Labels/Beschreibungen kommen aus Config', () => {
    instance = createPreferences(
      makeConfig({
        categories: { marketing: { label: 'Werbe-Kram', description: 'Ads & Co' } },
      }),
      ALL_FALSE,
      spies(),
    );
    const mk = shadow().querySelector('#oil2-marketing')?.parentElement as HTMLElement;
    expect(mk.querySelector('.oil2-prefs-cat-label')?.textContent).toContain('Werbe-Kram');
    expect(mk.querySelector('.oil2-prefs-cat-desc')?.textContent).toBe('Ads & Co');
  });
});

describe('Toggle-States', () => {
  it('Toggles spiegeln currentChoices', () => {
    instance = createPreferences(
      makeConfig(),
      { functional: true, analytics: false, marketing: true },
      spies(),
    );
    expect((shadow().querySelector('#oil2-functional') as HTMLInputElement).checked).toBe(true);
    expect((shadow().querySelector('#oil2-analytics') as HTMLInputElement).checked).toBe(false);
    expect((shadow().querySelector('#oil2-marketing') as HTMLInputElement).checked).toBe(true);
  });
});

describe('Speichern', () => {
  it('Save liest Toggle-States und ruft onSave mit Choices', () => {
    const cb = spies();
    instance = createPreferences(makeConfig(), ALL_FALSE, cb);
    (shadow().querySelector('#oil2-analytics') as HTMLInputElement).checked = true;
    (shadow().querySelector('#oil2-marketing') as HTMLInputElement).checked = true;
    (shadow().querySelector('.oil2-prefs-save') as HTMLButtonElement).click();
    expect(cb.onSave).toHaveBeenCalledTimes(1);
    expect(cb.onSave).toHaveBeenCalledWith({
      functional: false,
      analytics: true,
      marketing: true,
    });
  });

  it('Save kuendigt sich fuer Screenreader an', () => {
    instance = createPreferences(makeConfig(), ALL_FALSE, spies());
    (shadow().querySelector('.oil2-prefs-save') as HTMLButtonElement).click();
    const status = document.querySelector('[role="status"]');
    expect(status?.textContent).toBe('Einstellungen gespeichert');
  });

  it('necessary beeinflusst Choices nicht (kein Feld)', () => {
    const cb = spies();
    instance = createPreferences(makeConfig(), ALL_FALSE, cb);
    (shadow().querySelector('.oil2-prefs-save') as HTMLButtonElement).click();
    expect(cb.onSave).toHaveBeenCalledWith({
      functional: false,
      analytics: false,
      marketing: false,
    });
  });
});

describe('Schliessen', () => {
  it('Close-Button (×) ruft onClose', () => {
    const cb = spies();
    instance = createPreferences(makeConfig(), ALL_FALSE, cb);
    (shadow().querySelector('.oil2-prefs-close') as HTMLButtonElement).click();
    expect(cb.onClose).toHaveBeenCalledTimes(1);
  });

  it('ESC ruft onClose (nicht onSave)', () => {
    const cb = spies();
    instance = createPreferences(makeConfig(), ALL_FALSE, cb);
    instance.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onSave).not.toHaveBeenCalled();
  });
});

describe('Display & Lifecycle', () => {
  it('show() -> sichtbar, hide() -> versteckt', () => {
    instance = createPreferences(makeConfig(), ALL_FALSE, spies());
    instance.show();
    expect(host().style.display).not.toBe('none');
    instance.hide();
    expect(host().style.display).toBe('none');
  });

  it('show() fokussiert den Close-Button', () => {
    instance = createPreferences(makeConfig(), ALL_FALSE, spies());
    instance.show();
    expect(shadow().activeElement).toBe(shadow().querySelector('.oil2-prefs-close'));
  });

  it('destroy() entfernt den Host', () => {
    instance = createPreferences(makeConfig(), ALL_FALSE, spies());
    instance.destroy();
    instance = null;
    expect(document.getElementById('oil2-prefs-host')).toBeNull();
  });

  it('Focus-Trap: Tab am Ende wrappt zum Anfang', () => {
    instance = createPreferences(makeConfig(), ALL_FALSE, spies());
    instance.show();
    const focusables = shadow().querySelectorAll<HTMLElement>(
      '.oil2-prefs button, .oil2-prefs a, .oil2-prefs input:not([disabled])',
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(shadow().activeElement).toBe(first);
  });
});

describe('Sicherheit', () => {
  it('XSS in Kategorie-Label wird neutralisiert', () => {
    instance = createPreferences(
      makeConfig({ categories: { analytics: { label: '<b>x</b>', description: 'd' } } }),
      ALL_FALSE,
      spies(),
    );
    const an = shadow().querySelector('#oil2-analytics')?.parentElement as HTMLElement;
    const labelEl = an.querySelector('.oil2-prefs-cat-label') as HTMLElement;
    expect(labelEl.querySelector('b')).toBeNull();
    expect(labelEl.textContent).toContain('<b>x</b>');
  });

  it('javascript:-URL mit Steuerzeichen im Footer-Link wird blockiert (Y3)', () => {
    instance = createPreferences(
      makeConfig({ ui: { privacyUrl: 'java\tscript:alert(1)' } }),
      ALL_FALSE,
      spies(),
    );
    const link = shadow().querySelector('.oil2-prefs-footer-link a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('#');
  });
});
