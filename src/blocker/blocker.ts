/**
 * OIL2 — iFrame/Embed Blocker (Phase 3, Prioritaet 1)
 *
 * Blockt `<iframe data-oil2-category="...">` (YouTube, Maps, Social Embeds) bis
 * Consent fuer die jeweilige Kategorie vorliegt: verschiebt `src` nach
 * `data-oil2-src` und zeigt einen Platzhalter. Bei Consent-Erteilung wird der
 * iframe wiederhergestellt, bei Widerruf erneut blockiert.
 *
 * Public Entry: `initBlocker(getConsent, onConsentNeeded)`. Fuer die Reaktion
 * auf Consent-Aenderungen ruft der Composition Root `applyConsent()` an den
 * Consent-Events der Engine (die Spec-Signatur allein bietet keinen Hook).
 *
 * @see SPEZIFIKATION.md §16
 */

import type { ConsentChoices, ConsentCategory } from '../core/types';

interface Managed {
  iframe: HTMLIFrameElement;
  category: ConsentCategory;
  placeholder: HTMLElement | null;
  blocked: boolean;
}

const CATEGORY_LABELS: Record<ConsentCategory, string> = {
  functional: 'Funktionale',
  analytics: 'Statistik',
  marketing: 'Marketing',
};

let _getConsent: (() => ConsentChoices) | null = null;
let _onConsentNeeded: (() => void) | null = null;
let _managed: Managed[] = [];

/**
 * Scannt alle `iframe[data-oil2-category]`, blockt sie und stellt bereits
 * erlaubte Einbettungen direkt wieder her.
 */
export function initBlocker(getConsent: () => ConsentChoices, onConsentNeeded: () => void): void {
  _getConsent = getConsent;
  _onConsentNeeded = onConsentNeeded;
  _managed = [];

  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe[data-oil2-category]');
  iframes.forEach((iframe) => {
    const category = iframe.getAttribute('data-oil2-category');
    if (category !== 'functional' && category !== 'analytics' && category !== 'marketing') {
      console.warn('[OIL2] Unknown blocker category: ' + category);
      return;
    }
    const entry: Managed = { iframe, category, placeholder: null, blocked: false };
    _managed.push(entry);
    _block(entry);
  });

  applyConsent();
}

/**
 * Gleicht alle verwalteten iframes mit dem aktuellen Consent ab:
 * erlaubt -> wiederherstellen, nicht erlaubt -> (erneut) blockieren.
 */
export function applyConsent(): void {
  if (!_getConsent) return;
  const consent = _getConsent();
  for (const entry of _managed) {
    const granted = consent[entry.category];
    if (granted && entry.blocked) {
      _unblock(entry);
    } else if (!granted && !entry.blocked) {
      _block(entry);
    }
  }
}

// ============================================================================
// Block / Unblock
// ============================================================================

function _block(entry: Managed): void {
  const iframe = entry.iframe;
  const src = iframe.getAttribute('src');
  if (src) {
    iframe.setAttribute('data-oil2-src', src);
    iframe.removeAttribute('src'); // verhindert das Laden
  }
  iframe.style.display = 'none';

  if (!entry.placeholder) {
    entry.placeholder = _createPlaceholder(entry);
    if (iframe.parentNode) {
      iframe.parentNode.insertBefore(entry.placeholder, iframe);
    }
  } else {
    entry.placeholder.style.display = '';
  }
  entry.blocked = true;
}

function _unblock(entry: Managed): void {
  const iframe = entry.iframe;
  const stored = iframe.getAttribute('data-oil2-src');
  if (stored) {
    iframe.setAttribute('src', stored); // Laden erlauben
  }
  iframe.style.display = '';

  if (entry.placeholder) {
    entry.placeholder.remove();
    entry.placeholder = null;
  }
  entry.blocked = false;
}

// ============================================================================
// Placeholder (Inline-Styles, kein Shadow DOM — ersetzt Inline-Inhalt)
// ============================================================================

function _createPlaceholder(entry: Managed): HTMLElement {
  const iframe = entry.iframe;
  const width = iframe.getAttribute('width');
  const height = iframe.getAttribute('height');

  const ph = document.createElement('div');
  ph.setAttribute('data-oil2-placeholder', entry.category);
  ph.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:12px',
    'box-sizing:border-box',
    'padding:24px',
    'text-align:center',
    'background:#f0f0ec',
    'border:1px solid #e2e2dc',
    'border-radius:8px',
    'font-family:system-ui,-apple-system,sans-serif',
    'color:#1a1a1a',
    width ? 'width:' + _cssSize(width) : 'width:100%',
    height ? 'height:' + _cssSize(height) : 'min-height:160px',
  ].join(';');

  const text = document.createElement('p');
  text.style.cssText = 'margin:0;font-size:13px;line-height:1.5;color:#6b6b67';
  // XSS-sicher: textContent; Label stammt aus interner Map.
  text.textContent =
    'Für diesen Inhalt sind ' + CATEGORY_LABELS[entry.category] + '-Cookies erforderlich.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Cookies erlauben';
  btn.style.cssText =
    'min-height:44px;padding:0 16px;background:#1a1a1a;color:#fff;border:none;' +
    'border-radius:6px;font:inherit;font-size:13px;font-weight:600;cursor:pointer';
  btn.addEventListener('click', () => {
    if (_onConsentNeeded) _onConsentNeeded();
  });

  ph.appendChild(text);
  ph.appendChild(btn);
  return ph;
}

/** Numerische Groessen -> px, sonst unveraendert (z. B. "100%"). */
function _cssSize(value: string): string {
  return /^\d+$/.test(value) ? value + 'px' : value;
}
