/**
 * OIL2 — Shadow DOM Banner
 *
 * Rendert das Consent-Banner in einem Shadow DOM (CSS-Isolation), mit
 * Focus-Trap, ESC=Ablehnen und Erstfokus auf "Ablehnen" (DSGVO). Labels werden
 * XSS-sicher per textContent gesetzt; URLs gegen gefaehrliche Schemata geprueft.
 *
 * @see SPEZIFIKATION.md §12
 * @see PROJEKT.md §13.3 (Shadow DOM CSS Isolation)
 */

import type { OIL2Config } from '../core/types';
import { getBannerStyles } from './styles';
import { trapFocus } from './a11y';

export interface BannerCallbacks {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onCustomize: () => void;
}

export interface BannerInstance {
  show(): void;
  hide(): void;
  destroy(): void;
}

const HOST_ID = 'oil2-banner-host';

/**
 * Erstellt das Banner (zunaechst versteckt) und haengt es an document.body.
 * Sichtbar erst nach `show()`.
 */
export function createBanner(config: OIL2Config, callbacks: BannerCallbacks): BannerInstance {
  // Defensive: evtl. vorhandenen Host entfernen -> nie Duplikate (T13).
  const existing = document.getElementById(HOST_ID);
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.display = 'none'; // bis show()

  // Shadow DOM mit Fallback (EC04: z. B. Opera Mini ohne attachShadow).
  let root: ShadowRoot | HTMLElement;
  try {
    root = host.attachShadow({ mode: 'open' });
  } catch {
    root = host; // ungekapselt, aber funktional
  }

  const style = document.createElement('style');
  style.textContent = getBannerStyles(config);
  root.appendChild(style);

  const banner = _renderBanner(config);
  root.appendChild(banner);

  document.body.appendChild(host);

  const rejectBtn = banner.querySelector('.oil2-btn-reject') as HTMLButtonElement;
  const customizeBtn = banner.querySelector('.oil2-btn-customize') as HTMLButtonElement;
  const acceptBtn = banner.querySelector('.oil2-btn-accept') as HTMLButtonElement;

  rejectBtn.addEventListener('click', callbacks.onRejectAll);
  customizeBtn.addEventListener('click', callbacks.onCustomize);
  acceptBtn.addEventListener('click', callbacks.onAcceptAll);

  let _releaseTrap: (() => void) | null = null;

  function _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      callbacks.onRejectAll();
    }
  }

  function show(): void {
    host.style.display = ''; // revert auf Stylesheet-Wert
    _releaseTrap = trapFocus(banner);
    document.addEventListener('keydown', _onKeydown);
    // Erstfokus auf "Ablehnen", NICHT "Akzeptieren" (DSGVO).
    rejectBtn.focus();
  }

  function hide(): void {
    host.style.display = 'none';
    if (_releaseTrap) {
      _releaseTrap();
      _releaseTrap = null;
    }
    document.removeEventListener('keydown', _onKeydown);
  }

  function destroy(): void {
    hide();
    rejectBtn.removeEventListener('click', callbacks.onRejectAll);
    customizeBtn.removeEventListener('click', callbacks.onCustomize);
    acceptBtn.removeEventListener('click', callbacks.onAcceptAll);
    host.remove();
  }

  return { show, hide, destroy };
}

// ============================================================================
// Rendering (XSS-sicher: textContent statt innerHTML)
// ============================================================================

function _renderBanner(config: OIL2Config): HTMLElement {
  const labels = config.ui.labels;

  const banner = document.createElement('div');
  banner.className = 'oil2-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-modal', 'true');
  banner.setAttribute('aria-label', labels.title);

  const content = document.createElement('div');
  content.className = 'oil2-banner-content';

  const title = document.createElement('h2');
  title.className = 'oil2-banner-title';
  title.textContent = labels.title;

  const desc = document.createElement('p');
  desc.className = 'oil2-banner-description';
  desc.textContent = labels.description;

  const links = document.createElement('div');
  links.className = 'oil2-banner-links';
  links.appendChild(_link(config.ui.privacyUrl, 'Datenschutzerklärung'));
  links.appendChild(_link(config.ui.imprintUrl, 'Impressum'));

  content.appendChild(title);
  content.appendChild(desc);
  content.appendChild(links);

  const actions = document.createElement('div');
  actions.className = 'oil2-banner-actions';
  actions.appendChild(_button('oil2-btn-reject', labels.rejectAll));
  actions.appendChild(_button('oil2-btn-customize', labels.customize));
  actions.appendChild(_button('oil2-btn-accept', labels.acceptAll));

  banner.appendChild(content);
  banner.appendChild(actions);
  return banner;
}

function _button(cls: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'oil2-btn ' + cls;
  b.textContent = label;
  return b;
}

function _link(url: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.textContent = text;
  a.setAttribute('href', _safeUrl(url));
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener noreferrer');
  return a;
}

/**
 * Blockiert gefaehrliche URL-Schemata (javascript:, data:, vbscript:).
 * Entfernt vor der Pruefung Steuerzeichen/Whitespace, die Browser beim
 * Schema-Parsing ignorieren (z. B. "java\tscript:") — sonst umgeht ein
 * praepariertes Label die Schema-Erkennung.
 */
function _safeUrl(url: string): string {
  const raw = url || '';
   
  const probe = raw.replace(/[\u0000-\u0020\u007f]/g, '').toLowerCase();
  if (/^(javascript|data|vbscript):/.test(probe)) return '#';
  const trimmed = raw.trim();
  return trimmed || '#';
}
