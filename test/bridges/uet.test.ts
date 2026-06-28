/**
 * OIL2 — Microsoft UET Bridge Tests
 * @see TESTS.md §6 (uet: T01–T05)
 */

import { describe, it, expect, afterEach } from 'vitest';
import { pushUETConsent } from '../../src/bridges/uet';
import { cleanup } from '../helpers';
import type { ConsentChoices } from '../../src/core/types';

afterEach(() => {
  cleanup();
});

const C_TRUE: ConsentChoices = { functional: true, analytics: true, marketing: true };
const C_FALSE: ConsentChoices = { functional: false, analytics: false, marketing: false };

function getUetq(): unknown[] {
  return (window as unknown as { uetq: unknown[] }).uetq;
}

describe('pushUETConsent', () => {
  it('T01: pusht consent update in uetq Array', () => {
    pushUETConsent(C_TRUE);
    const q = getUetq();
    expect(q[0]).toBe('consent');
    expect(q[1]).toBe('update');
    expect(typeof q[2]).toBe('object');
  });

  it('T02: marketing:true → ad_storage:granted', () => {
    pushUETConsent({ ...C_FALSE, marketing: true });
    const obj = getUetq()[2] as Record<string, string>;
    expect(obj.ad_storage).toBe('granted');
  });

  it('T03: marketing:false → ad_storage:denied', () => {
    pushUETConsent({ ...C_TRUE, marketing: false });
    const obj = getUetq()[2] as Record<string, string>;
    expect(obj.ad_storage).toBe('denied');
  });

  it('T04: uetq existiert nicht → wird als leeres Array initialisiert', () => {
    expect((window as unknown as { uetq?: unknown[] }).uetq).toBeUndefined();
    pushUETConsent(C_TRUE);
    expect(Array.isArray(getUetq())).toBe(true);
  });

  it('T05: nur ad_storage wird gesendet (kein analytics_storage)', () => {
    pushUETConsent(C_TRUE);
    const obj = getUetq()[2] as Record<string, string>;
    expect(Object.keys(obj)).toEqual(['ad_storage']);
  });
});
