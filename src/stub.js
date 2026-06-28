/* OIL2 Stub v1.1 — inline in <head>, VOR dem GTM-Script.
 *
 * Setzt die Google/Microsoft Consent-Defaults SYNCHRON, bevor GTM lädt. Ohne
 * diesen Stub würden die ersten Tags als "granted" feuern → DSGVO-Verstoss.
 *
 * Regeln (NICHT ändern):
 *  - KEIN defer, KEIN async — muss synchron im <head> laufen.
 *  - KEIN ES6 — nur var, function-Ausdrücke, keine Arrow Functions/Template Literals.
 *  - Wird NICHT gebundelt — copy-paste direkt ins HTML.
 *  - wait_for_update:500 nur ohne (gültigen) Cookie — bei vorhandenem Cookie
 *    steht der Default sofort fest, kein Warten nötig.
 */
(function () {
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }

  /* Verankert auf Cookie-Grenze, damit z. B. "notoil2=" nicht fälschlich matcht. */
  var c = document.cookie.match(/(?:^|;\s*)oil2=([^;]+)/);
  /* UET-Default: bei gültigem Cookie aus dem Marketing-Consent abgeleitet,
     sonst denied (das Main-Bundle aktualisiert nach Banner/Restore). */
  var uetAd = 'denied';

  if (c) {
    try {
      var s = JSON.parse(atob(c[1]));
      gtag('consent', 'default', {
        analytics_storage:       s.a ? 'granted' : 'denied',
        ad_storage:              s.m ? 'granted' : 'denied',
        ad_user_data:            s.m ? 'granted' : 'denied',
        ad_personalization:      s.m ? 'granted' : 'denied',
        functionality_storage:   s.f ? 'granted' : 'denied',
        personalization_storage: s.f ? 'granted' : 'denied',
        security_storage:        'granted'
      });
      uetAd = s.m ? 'granted' : 'denied';
    } catch (e) {
      /* Korrupter Cookie → alles denied + auf Update warten. */
      gtag('consent', 'default', {
        analytics_storage: 'denied', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied',
        functionality_storage: 'denied', personalization_storage: 'denied',
        security_storage: 'granted', wait_for_update: 500
      });
    }
  } else {
    /* Kein Cookie → alles denied + auf Update warten (Banner/Restore liefert es). */
    gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied',
      functionality_storage: 'denied', personalization_storage: 'denied',
      security_storage: 'granted', wait_for_update: 500
    });
  }

  /* Microsoft UET Default (aus Cookie abgeleitet, sonst denied). */
  window.uetq = window.uetq || [];
  uetq.push('consent', 'default', { ad_storage: uetAd });
})();
