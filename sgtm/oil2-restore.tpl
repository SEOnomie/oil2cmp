___INFO___

{
  "type": "TAG",
  "id": "cvt_oil2_cookie_restore",
  "version": 1,
  "securityGroups": [],
  "displayName": "OIL2 Cookie Restore",
  "categories": ["UTILITY"],
  "description": "Stellt den oil2 JS-Cookie aus oil2_srv wieder her, wenn Safari ITP ihn geloescht hat. Setzt oil2 OHNE httpOnly (JS muss lesen koennen). Trigger: All Pages / jeder Request.",
  "containerContexts": ["SERVER"]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "cookieMaxAge",
    "displayName": "Cookie Max-Age (Sekunden)",
    "simpleValueType": true,
    "defaultValue": "31536000",
    "help": "Lebensdauer des wiederhergestellten JS-Cookies. 31536000 = 365 Tage.",
    "valueValidators": [
      {
        "type": "POSITIVE_NUMBER"
      }
    ]
  },
  {
    "type": "TEXT",
    "name": "cookieDomain",
    "displayName": "Cookie-Domain (optional)",
    "simpleValueType": true,
    "defaultValue": "",
    "help": "Leer lassen fuer auto-detect. Sonst z.B. '.example.de'"
  },
  {
    "type": "CHECKBOX",
    "name": "enableLogging",
    "checkboxText": "Debug-Logging aktivieren",
    "simpleValueType": true,
    "defaultValue": false
  }
]


___SANDBOXED_JS_FOR_SERVER___

// sGTM Tag: OIL2 Cookie Restore
var getCookieValues = require('getCookieValues');
var setCookie = require('setCookie');
var logToConsole = require('logToConsole');

var maxAge = data.cookieMaxAge || '31536000';
var cookieDomain = data.cookieDomain || '';
var enableLogging = data.enableLogging || false;

var jsCookie = getCookieValues('oil2')[0];
var srvCookie = getCookieValues('oil2_srv')[0];

// Restore nur wenn:
// 1. HttpOnly-Cookie vorhanden UND
// 2. JS-Cookie fehlt (ITP hat es geloescht)
if (!jsCookie && srvCookie) {
  var options = {
    'max-age': maxAge,
    secure: true,
    sameSite: 'lax',
    path: '/'
    // KEIN httpOnly! JS muss den Cookie lesen koennen
  };

  if (cookieDomain) {
    options.domain = cookieDomain;
  }

  setCookie('oil2', srvCookie, options);

  if (enableLogging) {
    logToConsole('[OIL2 Restore] Restored oil2 from oil2_srv');
  }
} else if (enableLogging) {
  if (jsCookie) {
    logToConsole('[OIL2 Restore] oil2 already present, no restore needed');
  } else {
    logToConsole('[OIL2 Restore] No oil2_srv found, cannot restore');
  }
}

data.gtmOnSuccess();


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
        "publicId": "set_cookies",
        "versionId": "1"
      },
      "param": [
        {
          "key": "allowedCookies",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "name"
                  },
                  {
                    "type": 1,
                    "string": "domain"
                  },
                  {
                    "type": 1,
                    "string": "path"
                  },
                  {
                    "type": 1,
                    "string": "secure"
                  },
                  {
                    "type": 1,
                    "string": "session"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "oil2"
                  },
                  {
                    "type": 1,
                    "string": "*"
                  },
                  {
                    "type": 1,
                    "string": "*"
                  },
                  {
                    "type": 1,
                    "string": "any"
                  },
                  {
                    "type": 1,
                    "string": "any"
                  }
                ]
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

OIL2 Cookie Restore (Server-Side GTM)
=====================================

ZWECK
Gegenstueck zum Keeper. Stellt den oil2 JS-Cookie aus dem oil2_srv HttpOnly-
Backup wieder her, sobald Safari ITP den JS-Cookie geloescht hat.

LOGIK
Schreibt oil2 NUR, wenn oil2 fehlt UND oil2_srv vorhanden ist.
Sind beide da -> kein Restore. Fehlt oil2_srv -> kann nicht restoren.

KRITISCH: KEIN httpOnly
oil2 wird bewusst OHNE httpOnly gesetzt. Das Client-seitige Cookie-Restore-
Polling (restore.ts) muss den Cookie lesen koennen, um den Consent-State
wiederherzustellen. Mit httpOnly wuerde das Polling fehlschlagen.

TRIGGER
All Pages (jeder eingehende Request) - identisch zum Keeper.

FELDER
- Cookie Max-Age: Default 31536000 s = 365 Tage.
- Cookie-Domain: leer = auto-detect; sonst z.B. ".example.de".
- Debug-Logging: nur in Preview/Debug.

PERMISSIONS (Intent)
- get_cookies: liest oil2, oil2_srv (specific).
- set_cookies: schreibt ausschliesslich oil2 (NICHT oil2_srv).
- logging: debug only.
Hinweis: Permission-Reconciliation beim ersten Speichern ist normal.
