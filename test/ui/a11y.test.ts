/**
 * OIL2 — A11y Tests
 *
 * Focus-Trap im Light DOM (Shadow-DOM-Pfad wird ueber banner.test.ts abgedeckt)
 * und Screenreader-Announcement inkl. Auto-Removal.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { trapFocus, announceToScreenReader } from '../../src/ui/a11y';

function buildContainer(): { div: HTMLElement; a: HTMLElement; b: HTMLElement; c: HTMLElement } {
  const div = document.createElement('div');
  div.innerHTML =
    '<button id="a">A</button><button id="b">B</button><button id="c">C</button>';
  document.body.appendChild(div);
  return {
    div,
    a: div.querySelector('#a') as HTMLElement,
    b: div.querySelector('#b') as HTMLElement,
    c: div.querySelector('#c') as HTMLElement,
  };
}

function tab(on: HTMLElement, shift = false): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
  on.dispatchEvent(ev);
  return ev;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('trapFocus', () => {
  it('Tab am letzten Element wrappt zum ersten', () => {
    const { div, a, c } = buildContainer();
    const cleanup = trapFocus(div);
    c.focus();
    const ev = tab(c);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);
    cleanup();
  });

  it('Shift+Tab am ersten Element wrappt zum letzten', () => {
    const { div, a, c } = buildContainer();
    const cleanup = trapFocus(div);
    a.focus();
    const ev = tab(a, true);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(c);
    cleanup();
  });

  it('Tab in der Mitte laeuft normal weiter (kein preventDefault)', () => {
    const { div, b } = buildContainer();
    const cleanup = trapFocus(div);
    b.focus();
    const ev = tab(b);
    expect(ev.defaultPrevented).toBe(false);
    cleanup();
  });

  it('ignoriert Nicht-Tab-Tasten', () => {
    const { div, c } = buildContainer();
    const cleanup = trapFocus(div);
    c.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    c.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(c);
    cleanup();
  });

  it('disabled-Elemente werden uebersprungen', () => {
    const div = document.createElement('div');
    div.innerHTML =
      '<button id="a">A</button><button id="x" disabled>X</button><button id="c">C</button>';
    document.body.appendChild(div);
    const cleanup = trapFocus(div);
    const a = div.querySelector('#a') as HTMLElement;
    const c = div.querySelector('#c') as HTMLElement;
    c.focus();
    tab(c);
    expect(document.activeElement).toBe(a); // letztes fokussierbares = c, wrappt zu a
    cleanup();
  });

  it('Cleanup entfernt den Listener', () => {
    const { div, a, c } = buildContainer();
    const cleanup = trapFocus(div);
    cleanup();
    c.focus();
    const ev = tab(c);
    expect(ev.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(c); // kein Wrap mehr
  });

  it('leerer Container wirft nicht', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const cleanup = trapFocus(div);
    expect(() => tab(div)).not.toThrow();
    cleanup();
  });
});

describe('announceToScreenReader', () => {
  it('erstellt eine polite Live-Region mit der Nachricht', () => {
    announceToScreenReader('Einstellungen gespeichert');
    const status = document.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.textContent).toBe('Einstellungen gespeichert');
  });

  it('entfernt die Live-Region nach 1 Sekunde', () => {
    vi.useFakeTimers();
    announceToScreenReader('X');
    expect(document.querySelector('[role="status"]')).not.toBeNull();
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it('ist visuell versteckt (1px Clip)', () => {
    announceToScreenReader('versteckt');
    const status = document.querySelector('[role="status"]') as HTMLElement;
    expect(status.style.cssText).toContain('rect(0,0,0,0)');
    expect(status.style.cssText).toContain('width: 1px');
  });
});
