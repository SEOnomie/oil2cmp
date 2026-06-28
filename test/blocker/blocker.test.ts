/**
 * OIL2 — Blocker Tests (SPEZIFIKATION.md §16)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initBlocker, applyConsent } from '../../src/blocker/blocker';
import type { ConsentChoices } from '../../src/core/types';

const YT = 'https://www.youtube.com/embed/abc';
const MAP = 'https://www.google.com/maps/embed?pb=xyz';

function addIframe(
  category: string | null,
  opts: { src?: string; preBlocked?: string; width?: string; height?: string; lazy?: boolean } = {},
): HTMLIFrameElement {
  const f = document.createElement('iframe');
  if (category !== null) f.setAttribute('data-oil2-category', category);
  if (opts.src) f.setAttribute('src', opts.src);
  if (opts.preBlocked) f.setAttribute('data-oil2-src', opts.preBlocked);
  if (opts.width) f.setAttribute('width', opts.width);
  if (opts.height) f.setAttribute('height', opts.height);
  if (opts.lazy) f.setAttribute('loading', 'lazy');
  document.body.appendChild(f);
  return f;
}

function mutableConsent(initial: Partial<ConsentChoices> = {}): {
  choices: ConsentChoices;
  get: () => ConsentChoices;
} {
  const choices: ConsentChoices = {
    functional: false,
    analytics: false,
    marketing: false,
    ...initial,
  };
  return { choices, get: () => choices };
}

function placeholders(): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>('[data-oil2-placeholder]');
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('initBlocker — Blockieren', () => {
  it('blockt iframe ohne Consent: src -> data-oil2-src, Platzhalter, versteckt', () => {
    const f = addIframe('marketing', { src: YT });
    const c = mutableConsent();
    initBlocker(c.get, () => {});

    expect(f.getAttribute('src')).toBeNull();
    expect(f.getAttribute('data-oil2-src')).toBe(YT);
    expect(f.style.display).toBe('none');
    expect(placeholders().length).toBe(1);
  });

  it('ignoriert iframe ohne data-oil2-category', () => {
    const f = addIframe(null, { src: YT });
    initBlocker(mutableConsent().get, () => {});
    expect(f.getAttribute('src')).toBe(YT);
    expect(placeholders().length).toBe(0);
  });

  it('unbekannte Kategorie -> warn + skip', () => {
    const f = addIframe('tracking', { src: YT });
    initBlocker(mutableConsent().get, () => {});
    expect(console.warn).toHaveBeenCalled();
    expect(f.getAttribute('src')).toBe(YT); // unangetastet
  });

  it('Consent bereits erteilt -> iframe bleibt geladen, kein Platzhalter', () => {
    const f = addIframe('marketing', { src: YT });
    const c = mutableConsent({ marketing: true });
    initBlocker(c.get, () => {});
    expect(f.getAttribute('src')).toBe(YT);
    expect(placeholders().length).toBe(0);
  });

  it('vorblockierter iframe (nur data-oil2-src) wird als blockiert behandelt', () => {
    addIframe('marketing', { preBlocked: YT });
    initBlocker(mutableConsent().get, () => {});
    expect(placeholders().length).toBe(1);
  });
});

describe('Platzhalter', () => {
  it('Button -> onConsentNeeded', () => {
    addIframe('marketing', { src: YT });
    const needed = vi.fn();
    initBlocker(mutableConsent().get, needed);
    (placeholders()[0].querySelector('button') as HTMLButtonElement).click();
    expect(needed).toHaveBeenCalledTimes(1);
  });

  it('uebernimmt width/height vom iframe', () => {
    addIframe('marketing', { src: YT, width: '560', height: '315' });
    initBlocker(mutableConsent().get, () => {});
    const ph = placeholders()[0];
    expect(ph.style.width).toBe('560px');
    expect(ph.style.height).toBe('315px');
  });

  it('Kategorie-Label im Platzhaltertext', () => {
    addIframe('functional', { src: MAP });
    initBlocker(mutableConsent().get, () => {});
    expect(placeholders()[0].textContent).toContain('Funktionale-Cookies');
  });
});

describe('applyConsent — Wiederherstellen & Re-Block', () => {
  it('nach Consent-Erteilung: iframe wird wiederhergestellt', () => {
    const f = addIframe('marketing', { src: YT });
    const c = mutableConsent();
    initBlocker(c.get, () => {});
    expect(f.getAttribute('src')).toBeNull();

    c.choices.marketing = true;
    applyConsent();

    expect(f.getAttribute('src')).toBe(YT);
    expect(f.style.display).toBe('');
    expect(placeholders().length).toBe(0);
  });

  it('nach Widerruf: iframe wird erneut blockiert', () => {
    const f = addIframe('marketing', { src: YT });
    const c = mutableConsent({ marketing: true });
    initBlocker(c.get, () => {});
    expect(f.getAttribute('src')).toBe(YT);

    c.choices.marketing = false;
    applyConsent();

    expect(f.getAttribute('src')).toBeNull();
    expect(placeholders().length).toBe(1);
  });

  it('verschiedene Kategorien werden unabhaengig gesteuert', () => {
    const ytF = addIframe('marketing', { src: YT });
    const mapF = addIframe('functional', { src: MAP });
    const c = mutableConsent({ marketing: true, functional: false });
    initBlocker(c.get, () => {});

    expect(ytF.getAttribute('src')).toBe(YT); // marketing erlaubt
    expect(mapF.getAttribute('src')).toBeNull(); // functional blockiert
    expect(placeholders().length).toBe(1);
  });

  it('loading="lazy" bleibt erhalten', () => {
    const f = addIframe('marketing', { src: YT, lazy: true });
    const c = mutableConsent();
    initBlocker(c.get, () => {});
    c.choices.marketing = true;
    applyConsent();
    expect(f.getAttribute('loading')).toBe('lazy');
    expect(f.getAttribute('src')).toBe(YT);
  });
});
