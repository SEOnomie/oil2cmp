___INFO___

{
  "type": "CLIENT",
  "id": "cvt_oil2_probe_client",
  "version": 1,
  "securityGroups": [],
  "displayName": "OIL2 Probe Client",
  "categories": ["UTILITY"],
  "description": "Leichtgewichtiger Client, der auf /oil2/restore lauscht und oil2 aus oil2_srv wiederherstellt. Fallback fuer das Client-Polling (z.B. Basic Mode ohne GA4-Ping).",
  "containerContexts": ["SERVER"]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "requestPath",
    "displayName": "Request-Pfad",
    "simpleValueType": true,
    "defaultValue": "/oil2/restore",
    "help": "Pfad auf dem der Client lauscht. Standard: /oil2/restore"
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

// sGTM Client: OIL2 Probe-Request Handler
var claimRequest = require('claimRequest');
var getCookieValues = require('getCookieValues');
var getRequestPath = require('getRequestPath');
var getRequestHeader = require('getRequestHeader');
var returnResponse = require('returnResponse');
var setCookie = require('setCookie');
var setResponseBody = require('setResponseBody');
var setResponseHeader = require('setResponseHeader');
var setResponseStatus = require('setResponseStatus');
var logToConsole = require('logToConsole');

var requestPath = data.requestPath || '/oil2/restore';
var enableLogging = data.enableLogging || false;

// Nur auf konfigurierten Pfad reagieren
var path = getRequestPath();
if (path !== requestPath) {
  return; // Nicht unser Request -> naechster Client darf claimen
}

// Request claimen
claimRequest();

// CORS-Header setzen (wichtig fuer fetch mit credentials: 'include')
setResponseHeader('Access-Control-Allow-Origin', getRequestHeader('Origin') || '*');
setResponseHeader('Access-Control-Allow-Credentials', 'true');
setResponseHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

// oil2_srv Cookie lesen
var srvCookie = getCookieValues('oil2_srv')[0];

if (srvCookie) {
  // JS-Cookie wiederherstellen (KEIN httpOnly!)
  var options = {
    'max-age': '31536000',
    secure: true,
    sameSite: 'lax',
    path: '/'
  };

  setCookie('oil2', srvCookie, options);

  if (enableLogging) {
    logToConsole('[OIL2 Probe] Restored oil2 from oil2_srv via probe request');
  }

  setResponseStatus(200);
  setResponseBody('{"restored":true}');
} else {
  if (enableLogging) {
    logToConsole('[OIL2 Probe] No oil2_srv cookie found');
  }

  setResponseStatus(204);
  setResponseBody('');
}

setResponseHeader('Content-Type', 'application/json');
returnResponse();


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
        "publicId": "read_request",
        "versionId": "1"
      },
      "param": [
        {
          "key": "requestAccess",
          "value": {
            "type": 1,
            "string": "specific"
          }
        },
        {
          "key": "headerWhitelist",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 1,
                "string": "origin"
              }
            ]
          }
        },
        {
          "key": "pathAllowed",
          "value": {
            "type": 8,
            "boolean": true
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
        "publicId": "return_response",
        "versionId": "1"
      },
      "param": [
        {
          "key": "headerWhitelist",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 1,
                "string": "access-control-allow-origin"
              },
              {
                "type": 1,
                "string": "access-control-allow-credentials"
              },
              {
                "type": 1,
                "string": "cache-control"
              },
              {
                "type": 1,
                "string": "content-type"
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

OIL2 Probe Client (Server-Side GTM)
===================================

ZWECK
Dedizierter Fallback fuer den Cookie-Restore. Wenn das Client-seitige Polling
fehlschlaegt (z.B. Basic Mode ohne GA4-Ping), feuert restore.ts ein
fetch('/oil2/restore', { credentials:'include' }). Dieser Client faengt den
Request ab, liest oil2_srv und setzt oil2 via Set-Cookie zurueck.

ABLAUF
1. getRequestPath() === requestPath ? sonst return (anderer Client darf claimen)
2. claimRequest()
3. CORS-Header (Access-Control-Allow-Origin = Origin, -Credentials = true)
4. oil2_srv vorhanden -> setCookie('oil2', ...) ohne httpOnly, 200 + {"restored":true}
   sonst -> 204, leer
5. returnResponse()

CORS / CREDENTIALS
Access-Control-Allow-Credentials:true + Origin-Echo sind Pflicht, weil der
Browser mit credentials:'include' anfragt (sonst wird oil2_srv nicht
mitgeschickt). KEIN httpOnly beim Restore - der Client muss oil2 lesen koennen.

INSTALLATION
Client lauscht automatisch auf /oil2/restore. Test:
  https://<domain>/<sgtm-pfad>/oil2/restore  ->  {"restored":true} oder 204.

PERMISSIONS (Intent)
- get_cookies: liest oil2_srv.
- set_cookies: schreibt oil2.
- read_request: Pfad + Origin-Header.
- return_response: die 4 Response-Header oben.
- logging: debug only.
WICHTIG: Die request/response-Permissions sind Best-Effort. Der GTM-Editor
leitet sie beim Speichern aus den require()-Aufrufen ab und fordert ggf. zur
Bestaetigung auf - das ist die verlaessliche Quelle, bitte dort gegenpruefen.
