/**
 * OIL2 — Preference Center (lazy loaded)
 *
 * Detaillierte Consent-Einstellungen pro Kategorie im Shadow DOM. Native
 * Checkbox-Toggles (Accessibility), "Notwendig" immer aktiv/disabled. Save liest
 * die Toggle-States; ESC und das Schliessen-X loesen onClose aus.
 *
 * Wird via `import('./preferences')` als separater Chunk geladen und zaehlt
 * nicht zum Core-Bundle-Budget.
 *
 * @see SPEZIFIKATION.md §13
 */

import type { OIL2Config, ConsentChoices } from '../core/types';
import { getPreferencesStyles } from './styles';
import { trapFocus, announceToScreenReader } from './a11y';

export interface PreferenceCallbacks {
  onSave: (choices: ConsentChoices) => void;
  onClose: () => void;
}

export interface PreferenceInstance {
  show(): void;
  hide(): void;
  destroy(): void;
}

const HOST_ID = 'oil2-prefs-host';

export function createPreferences(
  config: OIL2Config,
  currentChoices: ConsentChoices,
  callbacks: PreferenceCallbacks,
): PreferenceInstance {
  const existing = document.getElementById(HOST_ID);
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.display = 'none';

  let root: ShadowRoot | HTMLElement;
  try {
    root = host.attachShadow({ mode: 'open' });
  } catch {
    root = host;
  }

  const style = document.createElement('style');
  style.textContent = getPreferencesStyles(config);
  root.appendChild(style);

  const prefs = _renderPrefs(config, currentChoices);
  root.appendChild(prefs);

  document.body.appendChild(host);

  const closeBtn = prefs.querySelector('.oil2-prefs-close') as HTMLButtonElement;
  const saveBtn = prefs.querySelector('.oil2-prefs-save') as HTMLButtonElement;
  const fnToggle = prefs.querySelector('#oil2-functional') as HTMLInputElement;
  const anToggle = prefs.querySelector('#oil2-analytics') as HTMLInputElement;
  const mkToggle = prefs.querySelector('#oil2-marketing') as HTMLInputElement;

  function _readChoices(): ConsentChoices {
    return {
      functional: fnToggle.checked,
      analytics: anToggle.checked,
      marketing: mkToggle.checked,
    };
  }

  function _onSave(): void {
    callbacks.onSave(_readChoices());
    announceToScreenReader('Einstellungen gespeichert');
  }

  closeBtn.addEventListener('click', callbacks.onClose);
  saveBtn.addEventListener('click', _onSave);

  let _releaseTrap: (() => void) | null = null;

  function _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      callbacks.onClose();
    }
  }

  function show(): void {
    host.style.display = '';
    _releaseTrap = trapFocus(prefs);
    document.addEventListener('keydown', _onKeydown);
    closeBtn.focus();
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
    closeBtn.removeEventListener('click', callbacks.onClose);
    saveBtn.removeEventListener('click', _onSave);
    host.remove();
  }

  return { show, hide, destroy };
}

// ============================================================================
// Rendering (XSS-sicher: textContent statt innerHTML)
// ============================================================================

function _renderPrefs(config: OIL2Config, choices: ConsentChoices): HTMLElement {
  const labels = config.ui.labels;
  const cats = config.categories;

  const prefs = document.createElement('div');
  prefs.className = 'oil2-prefs';
  prefs.setAttribute('role', 'dialog');
  prefs.setAttribute('aria-modal', 'true');
  prefs.setAttribute('aria-label', labels.title);

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'oil2-prefs-header';

  const title = document.createElement('h2');
  title.className = 'oil2-prefs-title';
  title.textContent = labels.title;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'oil2-prefs-close';
  close.setAttribute('aria-label', 'Schließen');
  close.textContent = '\u00d7'; // ×

  header.appendChild(title);
  header.appendChild(close);

  // --- Body ---
  const body = document.createElement('div');
  body.className = 'oil2-prefs-body';

  body.appendChild(
    _category({
      id: 'oil2-necessary',
      label: 'Notwendige Cookies',
      desc: 'Für den Betrieb der Website erforderlich, nicht deaktivierbar.',
      checked: true,
      always: true,
    }),
  );
  body.appendChild(
    _category({
      id: 'oil2-functional',
      label: cats.functional.label,
      desc: cats.functional.description,
      checked: choices.functional,
    }),
  );
  body.appendChild(
    _category({
      id: 'oil2-analytics',
      label: cats.analytics.label,
      desc: cats.analytics.description,
      checked: choices.analytics,
    }),
  );
  body.appendChild(
    _category({
      id: 'oil2-marketing',
      label: cats.marketing.label,
      desc: cats.marketing.description,
      checked: choices.marketing,
    }),
  );

  // --- Footer ---
  const footer = document.createElement('div');
  footer.className = 'oil2-prefs-footer';

  const linkWrap = document.createElement('div');
  linkWrap.className = 'oil2-prefs-footer-link';
  linkWrap.appendChild(_link(config.ui.privacyUrl, 'Datenschutzerklärung'));

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'oil2-prefs-save';
  save.textContent = labels.save;

  footer.appendChild(linkWrap);
  footer.appendChild(save);

  prefs.appendChild(header);
  prefs.appendChild(body);
  prefs.appendChild(footer);
  return prefs;
}

interface CategoryOptions {
  id: string;
  label: string;
  desc: string;
  checked: boolean;
  always?: boolean;
}

function _category(opts: CategoryOptions): HTMLElement {
  const cat = document.createElement('div');
  cat.className = 'oil2-prefs-category';

  const info = document.createElement('div');
  info.className = 'oil2-prefs-cat-info';

  const labelEl = document.createElement('div');
  labelEl.className = 'oil2-prefs-cat-label';
  labelEl.textContent = opts.label;
  if (opts.always) {
    const badge = document.createElement('span');
    badge.className = 'oil2-prefs-always';
    badge.textContent = 'Immer aktiv';
    labelEl.appendChild(badge);
  }

  const descEl = document.createElement('div');
  descEl.className = 'oil2-prefs-cat-desc';
  descEl.textContent = opts.desc;

  info.appendChild(labelEl);
  info.appendChild(descEl);

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.className = 'oil2-toggle';
  toggle.id = opts.id;
  toggle.checked = opts.checked;
  toggle.setAttribute('aria-label', opts.label);
  if (opts.always) toggle.disabled = true;

  cat.appendChild(info);
  cat.appendChild(toggle);
  return cat;
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
