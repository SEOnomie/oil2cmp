___INFO___

{
  "type": "MACRO",
  "id": "cvt_oil2_consent_variable",
  "version": 1,
  "securityGroups": [],
  "displayName": "OIL2 Consent",
  "categories": ["UTILITY"],
  "description": "Liest den OIL2 Consent-Status aus den Cookies (oil2 / oil2_srv) und gibt ein strukturiertes Consent-Objekt oder eine einzelne Kategorie (true/false) zurück. Fuer Consent-Gating in sGTM-Tags (Meta CAPI, TikTok Events API, LinkedIn CAPI, etc.).",
  "containerContexts": ["SERVER"]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "SELECT",
    "name": "cookiePriority",
    "displayName": "Cookie-Prioritaet",
    "macrosInSelect": false,
    "selectItems": [
      {
        "value": "js_first",
        "displayValue": "JS-Cookie zuerst (oil2), dann HttpOnly (oil2_srv)"
      },
      {
        "value": "srv_first",
        "displayValue": "HttpOnly-Cookie zuerst (oil2_srv), dann JS (oil2)"
      }
    ],
    "simpleValueType": true,
    "defaultValue": "js_first",
    "help": "Bestimmt welcher Cookie zuerst gelesen wird. Standard: JS-Cookie (oil2) zuerst."
  },
  {
    "type": "SELECT",
    "name": "returnFormat",
    "displayName": "Rueckgabe-Format",
    "macrosInSelect": false,
    "selectItems": [
      {
        "value": "object",
        "displayValue": "Consent-Objekt {functional, analytics, marketing}"
      },
      {
        "value": "category",
        "displayValue": "Einzelne Kategorie (true/false)"
      }
    ],
    "simpleValueType": true,
    "defaultValue": "object"
  },
  {
    "type": "SELECT",
    "name": "category",
    "displayName": "Kategorie",
    "macrosInSelect": false,
    "selectItems": [
      {
        "value": "functional",
        "displayValue": "Funktional"
      },
      {
        "value": "analytics",
        "displayValue": "Statistik"
      },
      {
        "value": "marketing",
        "displayValue": "Marketing"
      }
    ],
    "simpleValueType": true,
    "defaultValue": "marketing",
    "enablingConditions": [
      {
        "paramName": "returnFormat",
        "paramValue": "category",
        "type": "EQUALS"
      }
    ]
  }
]


___SANDBOXED_JS_FOR_SERVER___

// sGTM Variable: OIL2 Consent Status
var getCookieValues = require('getCookieValues');
var JSON = require('JSON');
var fromBase64 = require('fromBase64');
var logToConsole = require('logToConsole');

var cookiePriority = data.cookiePriority || 'js_first';
var returnFormat = data.returnFormat || 'object';
var category = data.category || 'marketing';

// Cookie lesen (Prioritaet konfigurierbar)
var raw = null;
if (cookiePriority === 'js_first') {
  raw = getCookieValues('oil2')[0];
  if (!raw) raw = getCookieValues('oil2_srv')[0];
} else {
  raw = getCookieValues('oil2_srv')[0];
  if (!raw) raw = getCookieValues('oil2')[0];
}

// Kein Cookie gefunden
if (!raw) {
  logToConsole('[OIL2 Variable] No consent cookie found');
  if (returnFormat === 'category') return false;
  return { functional: false, analytics: false, marketing: false, timestamp: 0, version: 0, variant: '' };
}

// Base64 dekodieren + JSON parsen
var decoded = null;
try {
  decoded = JSON.parse(fromBase64(raw));
} catch (e) {
  logToConsole('[OIL2 Variable] Failed to decode cookie: ' + e);
  if (returnFormat === 'category') return false;
  return { functional: false, analytics: false, marketing: false, timestamp: 0, version: 0, variant: '' };
}

// Consent-Objekt bauen
var consent = {
  functional: decoded.f === 1,
  analytics: decoded.a === 1,
  marketing: decoded.m === 1,
  timestamp: decoded.t || 0,
  version: decoded.v || 0,
  variant: decoded.ab || ''
};

// Rueckgabe
if (returnFormat === 'category') {
  if (category === 'functional') return consent.functional;
  if (category === 'analytics') return consent.analytics;
  if (category === 'marketing') return consent.marketing;
  return false;
}

return consent;


___SERVER_PERMISSIONS___

[
  {
    "instance": {
      "key": {
        "publicId": "get_cookies",
        "versionId": "1"
      },
      "param": [
        {
          "key": "cookieAccess",
          "value": {
            "type": 1,
            "string": "specific"
          }
        },
        {
          "key": "cookieNames",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 1,
                "string": "oil2"
              },
              {
                "type": 1,
                "string": "oil2_srv"
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "logging",
        "versionId": "1"
      },
      "param": [
        {
          "key": "environments",
          "value": {
            "type": 1,
            "string": "debug"
          }
        }
      ]
    },
    "isRequired": true
  }
]


___TESTS___

scenarios: []


___NOTES___

OIL2 Consent Variable (Server-Side GTM)
=======================================

ZWECK
Liest oil2 / oil2_srv, dekodiert die Base64-JSON-Payload und liefert den
Consent fuer Consent-Gating in sGTM-Tags.

FELDER
- Cookie-Prioritaet: js_first (Default) liest oil2 zuerst, dann oil2_srv.
  srv_first dreht die Reihenfolge.
- Rueckgabe-Format:
  - object  -> { functional, analytics, marketing, timestamp, version, variant }
  - category -> einzelnes true/false (Feld "Kategorie" waehlen)

NUTZUNG IN TAGS
  {{OIL2 Consent}}.marketing === true
  // oder als Single-Category-Variable:
  {{OIL2 Marketing Consent}} === true

PERMISSIONS (Intent)
- get_cookies: liest NUR oil2 und oil2_srv (cookieAccess = specific).
- logging: nur in der Debug/Preview-Umgebung.
Hinweis: Fragt GTM beim ersten Speichern nach Permission-Reconciliation,
ist das normal (der Editor leitet sie aus den require()-Aufrufen ab).

RUECKGABE BEI FEHLER / KEIN COOKIE
{ functional:false, analytics:false, marketing:false, timestamp:0, version:0, variant:'' }
bzw. false im category-Format. Wirft nie.
