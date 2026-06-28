___INFO___

{
  "type": "TAG",
  "id": "cvt_oil2_cookie_keeper",
  "version": 1,
  "securityGroups": [],
  "displayName": "OIL2 Cookie Keeper",
  "categories": ["UTILITY"],
  "description": "Sichert den oil2 JS-Cookie als oil2_srv HttpOnly-Cookie (ITP-Backup). Aktualisiert nur, wenn oil2 neuer/anders als oil2_srv ist. Trigger: All Pages / jeder Request.",
  "containerContexts": ["SERVER"]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "cookieMaxAge",
    "displayName": "Cookie Max-Age (Sekunden)",
    "simpleValueType": true,
    "defaultValue": "34560000",
    "help": "Lebensdauer des HttpOnly-Cookies in Sekunden. 34560000 = 400 Tage (Maximum fuer Cookies).",
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

// sGTM Tag: OIL2 Cookie Keeper
var getCookieValues = require('getCookieValues');
var setCookie = require('setCookie');
var logToConsole = require('logToConsole');

var maxAge = data.cookieMaxAge || '34560000';
var cookieDomain = data.cookieDomain || '';
var enableLogging = data.enableLogging || false;

// JS-Cookie lesen
var jsCookie = getCookieValues('oil2')[0];
// HttpOnly-Cookie lesen
var srvCookie = getCookieValues('oil2_srv')[0];

// Nur aktualisieren wenn:
// 1. JS-Cookie vorhanden UND
// 2. HttpOnly-Cookie fehlt oder unterschiedlich
if (jsCookie && jsCookie !== srvCookie) {
  var options = {
    'max-age': maxAge,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  };

  if (cookieDomain) {
    options.domain = cookieDomain;
  }

  setCookie('oil2_srv', jsCookie, options);

  if (enableLogging) {
    logToConsole('[OIL2 Keeper] Synced oil2 -> oil2_srv');
  }
} else if (enableLogging) {
  if (!jsCookie) {
    logToConsole('[OIL2 Keeper] No oil2 cookie found, skipping');
  } else {
    logToConsole('[OIL2 Keeper] Cookies already in sync');
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
                    "string": "oil2_srv"
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

OIL2 Cookie Keeper (Server-Side GTM)
====================================

ZWECK
Spiegelt den oil2 JS-Cookie in den oil2_srv HttpOnly-Cookie. Dadurch ueberlebt
der Consent Safari ITP (das den JS-Cookie nach 7 Tagen kappt), waehrend oil2_srv
(HttpOnly, 400 Tage) bei IP-Matching ITP-immun bleibt.

LOGIK
Schreibt oil2_srv NUR, wenn oil2 vorhanden UND ungleich oil2_srv ist
(spart unnoetige Set-Cookie-Header bei jedem Request).

TRIGGER
All Pages (jeder eingehende Request). Keine Event-Filter noetig.

FELDER
- Cookie Max-Age: Default 34560000 s = 400 Tage (Cookie-Maximum).
- Cookie-Domain: leer = auto-detect; sonst z.B. ".example.de".
- Debug-Logging: nur in Preview/Debug sichtbar.

PERMISSIONS (Intent)
- get_cookies: liest oil2, oil2_srv (specific).
- set_cookies: schreibt ausschliesslich oil2_srv.
- logging: debug only.
Hinweis: Eine Permission-Reconciliation beim ersten Speichern ist normal.

WICHTIG
oil2_srv wird mit httpOnly:true gesetzt - bewusst, damit JavaScript es nicht
lesen kann (echtes Server-Backup). Der Restore-Tag setzt spaeter oil2 OHNE
httpOnly zurueck, damit der Client es lesen kann.
