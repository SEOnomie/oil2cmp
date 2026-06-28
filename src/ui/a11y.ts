/**
 * OIL2 — WCAG Utilities
 *
 * Focus-Trap (Tab/Shift+Tab bleibt im Container) und Screenreader-Announcements.
 * Shadow-DOM-tauglich: nutzt getRootNode().activeElement statt document.active-
 * Element (das im Shadow DOM nur den Host liefert).
 *
 * @see SPEZIFIKATION.md §15
 */

/** Selektor fuer fokussierbare Elemente (disabled/aria-hidden ausgenommen). */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Haelt den Tastatur-Fokus innerhalb von `container` (Tab/Shift+Tab wrappen).
 * Re-queryt fokussierbare Elemente bei jedem Tab, damit dynamische Inhalte
 * (z. B. Toggle-States) korrekt beruecksichtigt werden.
 *
 * @returns Cleanup-Funktion, die den Listener entfernt.
 */
export function trapFocus(container: HTMLElement): () => void {
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    // Shadow-DOM-tauglich: aktives Element im jeweiligen Root.
    const root = container.getRootNode() as Document | ShadowRoot;
    const active = root.activeElement;

    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeydown);
  return () => container.removeEventListener('keydown', handleKeydown);
}

/**
 * Gibt eine Statusmeldung fuer Screenreader aus (aria-live="polite").
 * Erstellt ein visuell verstecktes Live-Region-Element und entfernt es nach 1 s.
 */
export function announceToScreenReader(message: string): void {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.style.cssText =
    'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 1000);
}
