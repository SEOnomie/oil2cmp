___INFO___

{
  "type": "CLIENT",
  "id": "cvt_oil2_consent_client",
  "version": 1,
  "securityGroups": [],
  "displayName": "OIL2 Consent Client",
  "categories": ["UTILITY"],
  "description": "Empfaengt den OIL2 Consent-Beacon auf /oil2/consent (POST) und setzt oil2 + oil2_srv autoritativ serverseitig. Bei action=revoke werden beide Cookies geloescht. Stufe C.",
  "containerContexts": ["SERVER"]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "requestPath",
    "displayName": "Request-Pfad",
    "simpleValueType": true,
    "defaultValue": "/oil2/consent",
    "help": "Pfad auf dem der Client lauscht. Standard: /oil2/consent"
  },
  {
    "type": "TEXT",
    "name": "jsCookieMaxAge",
    "displayName": "oil2 Max-Age (Sekunden)",
    "simpleValueType": true,
    "defaultValue": "31536000",
    "help": "Lebensdauer des JS-lesbaren oil2-Cookies. 31536000 = 365 Tage."
  },
  {
    "type": "TEXT",
    "name": "srvCookieMaxAge",
    "displayName": "oil2_srv Max-Age (Sekunden)",
    "simpleValueType": true,
    "defaultValue": "34560000",
    "help": "Lebensdauer des HttpOnly oil2_srv-Backups. 34560000 = 400 Tage."
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

// sGTM Client: OIL2 Consent Beacon Handler
var claimRequest = require('claimRequest');
var getRequestPath = require('getRequestPath');
var getRequestMethod = require('getRequestMethod');
var getRequestBody = require('getRequestBody');
var getRequestHeader = require('getRequestHeader');
var setCookie = require('setCookie');
var setResponseStatus = require('setResponseStatus');
var setResponseHeader = require('setResponseHeader');
var setResponseBody = require('setResponseBody');
var returnResponse = require('returnResponse');
var fromBase64 = require('fromBase64');
var JSON = require('JSON');
var logToConsole = require('logToConsole');

var requestPath = data.requestPath || '/oil2/consent';
var jsMaxAge = data.jsCookieMaxAge || '31536000';
var srvMaxAge = data.srvCookieMaxAge || '34560000';
var cookieDomain = data.cookieDomain || '';
var enableLogging = data.enableLogging || false;

// Nur auf konfigurierten Pfad reagieren
if (getRequestPath() !== requestPath) {
  return; // Nicht unser Request -> naechster Client darf claimen
}

claimRequest();

// CORS + Cache (Origin echoen, weil der Beacon credentials mitschickt)
setResponseHeader('Access-Control-Allow-Origin', getRequestHeader('Origin') || '*');
setResponseHeader('Access-Control-Allow-Credentials', 'true');
setResponseHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
setResponseHeader('Content-Type', 'application/json');

var method = getRequestMethod();

// Preflight (bei text/plain eigentlich nicht noetig, aber defensiv)
if (method === 'OPTIONS') {
  setResponseHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  setResponseHeader('Access-Control-Allow-Headers', 'content-type');
  setResponseStatus(204);
  setResponseBody('');
  returnResponse();
  return;
}

if (method !== 'POST') {
  setResponseStatus(405);
  setResponseBody('{"ok":false}');
  returnResponse();
  return;
}

var body = getRequestBody();
var parsed = body ? JSON.parse(body) : null;

if (!parsed) {
  if (enableLogging) logToConsole('[OIL2 Consent] invalid or empty body');
  setResponseStatus(400);
  setResponseBody('{"ok":false}');
  returnResponse();
  return;
}

// Cookie-Optionen
var jsOpts = { 'max-age': jsMaxAge, secure: true, sameSite: 'lax', path: '/' };
var srvOpts = { 'max-age': srvMaxAge, httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
if (cookieDomain) {
  jsOpts.domain = cookieDomain;
  srvOpts.domain = cookieDomain;
}

// Widerruf: BEIDE Cookies loeschen (auch oil2_srv), sonst wuerde der Restore-Tag
// den widerrufenen Consent beim naechsten Load wiederherstellen.
if (parsed.action === 'revoke') {
  var delJs = { 'max-age': '0', secure: true, sameSite: 'lax', path: '/' };
  var delSrv = { 'max-age': '0', httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
  if (cookieDomain) {
    delJs.domain = cookieDomain;
    delSrv.domain = cookieDomain;
  }
  setCookie('oil2', '', delJs);
  setCookie('oil2_srv', '', delSrv);
  if (enableLogging) logToConsole('[OIL2 Consent] revoke -> cleared oil2 + oil2_srv');
  setResponseStatus(200);
  setResponseBody('{"ok":true,"cleared":true}');
  returnResponse();
  return;
}

// Sonst: Consent-Wert validieren + autoritativ setzen
var encoded = parsed.c;
var decoded = encoded ? JSON.parse(fromBase64(encoded)) : null;
var valid = decoded &&
  (decoded.f === 0 || decoded.f === 1) &&
  (decoded.a === 0 || decoded.a === 1) &&
  (decoded.m === 0 || decoded.m === 1);

if (valid) {
  setCookie('oil2', encoded, jsOpts);
  setCookie('oil2_srv', encoded, srvOpts);
  if (enableLogging) logToConsole('[OIL2 Consent] set oil2 + oil2_srv from beacon');
  setResponseStatus(200);
  setResponseBody('{"ok":true}');
} else {
  if (enableLogging) logToConsole('[OIL2 Consent] invalid consent payload');
  setResponseStatus(400);
  setResponseBody('{"ok":false}');
}

returnResponse();


___SERVER_PERMISSIONS___

[
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
                  { "type": 1, "string": "name" },
                  { "type": 1, "string": "domain" },
                  { "type": 1, "string": "path" },
                  { "type": 1, "string": "secure" },
                  { "type": 1, "string": "session" }
                ],
                "mapValue": [
                  { "type": 1, "string": "oil2" },
                  { "type": 1, "string": "*" },
                  { "type": 1, "string": "*" },
                  { "type": 1, "string": "any" },
                  { "type": 1, "string": "any" }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  { "type": 1, "string": "name" },
                  { "type": 1, "string": "domain" },
                  { "type": 1, "string": "path" },
                  { "type": 1, "string": "secure" },
                  { "type": 1, "string": "session" }
                ],
                "mapValue": [
                  { "type": 1, "string": "oil2_srv" },
                  { "type": 1, "string": "*" },
                  { "type": 1, "string": "*" },
                  { "type": 1, "string": "any" },
                  { "type": 1, "string": "any" }
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
          "value": { "type": 1, "string": "specific" }
        },
        {
          "key": "headerWhitelist",
          "value": {
            "type": 2,
            "listItem": [
              { "type": 1, "string": "origin" },
              { "type": 1, "string": "content-type" }
            ]
          }
        },
        {
          "key": "pathAllowed",
          "value": { "type": 8, "boolean": true }
        },
        {
          "key": "bodyAllowed",
          "value": { "type": 8, "boolean": true }
        },
        {
          "key": "methodAllowed",
          "value": { "type": 8, "boolean": true }
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
              { "type": 1, "string": "access-control-allow-origin" },
              { "type": 1, "string": "access-control-allow-credentials" },
              { "type": 1, "string": "access-control-allow-methods" },
              { "type": 1, "string": "access-control-allow-headers" },
              { "type": 1, "string": "cache-control" },
              { "type": 1, "string": "content-type" }
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
          "value": { "type": 1, "string": "debug" }
        }
      ]
    },
    "isRequired": true
  }
]


___TESTS___

scenarios: []


___NOTES___

OIL2 Consent Client (Server-Side GTM) — Stufe C
================================================

ZWECK
Empfaengt den Consent-Beacon, den src/bridges/beacon.ts bei jeder ENTSCHEIDUNG
feuert (navigator.sendBeacon('<endpoint>/oil2/consent', ...)). Setzt oil2 +
oil2_srv autoritativ serverseitig. Damit:
- entsteht der HttpOnly-Backup oil2_srv SOFORT (nicht erst beim naechsten
  Request ueber den Cookie Keeper),
- steht der Consent Server-Tags ab dem naechsten Hit bereit,
- wird der Consent-Log NICHT hier geschrieben (das macht weiterhin der
  dataLayer -> sGTM -> BigQuery Pfad; kein Doppel-Logging).

PAYLOAD (text/plain, JSON)
  { "c": "<base64 oil2-Cookie-Wert>", "action": "accept_all|reject_all|custom|revoke" }

ABLAUF
1. getRequestPath() === requestPath ? sonst return (anderer Client darf claimen)
2. claimRequest() + CORS-Header
3. OPTIONS -> 204 (Preflight; bei text/plain normalerweise nicht noetig)
4. method !== POST -> 405
5. action === 'revoke' -> oil2 UND oil2_srv loeschen (max-age=0) -> 200 cleared
   sonst -> c validieren (f/a/m in {0,1}) -> oil2 (365d) + oil2_srv (HttpOnly,
   400d) setzen -> 200 ok ; ungueltig -> 400
6. returnResponse()

WARUM REVOKE BEIDE COOKIES LOESCHT
revoke() loescht clientseitig nur oil2. Ohne dieses Loeschen von oil2_srv wuerde
der OIL2 Restore Tag beim naechsten Load oil2 aus dem (alten, granted) oil2_srv
wiederherstellen -> der Widerruf waere unwirksam. Der Beacon schliesst diese
Luecke serverseitig.

TRANSPORT / CORS
Der Beacon sendet als text/plain -> CORS-"simple request", kein Preflight.
navigator.sendBeacon schickt Credentials automatisch mit; die Set-Cookie der
Antwort greift im Same-Origin-/Own-CDN-Setup (dasselbe IP-Matching wie der
Rest). Im echten Cross-Origin-Subdomain-Setup koennen Drittanbieter-Cookie-
Restriktionen das Set-Cookie blockieren — daher same_origin/own_cdn empfohlen.

AKTIVIERUNG
Client lauscht automatisch auf /oil2/consent. Clientseitig:
  server.enabled = true UND server.consentBeacon = true (+ server.endpoint).
Test (POST mit JSON-Body):
  curl -X POST 'https://<domain>/<sgtm-pfad>/oil2/consent' \
    --data '{"c":"<base64>","action":"accept_all"}'
  -> {"ok":true} + Set-Cookie: oil2, oil2_srv

PERMISSIONS (Intent)
- set_cookies: oil2 + oil2_srv.
- read_request: Pfad, Methode, Body, Origin/Content-Type-Header.
- return_response: die CORS-/Content-Type-Header oben.
- logging: debug only.
WICHTIG: request/response-Permissions sind Best-Effort. Der GTM-Editor leitet
sie beim Speichern aus den require()-Aufrufen ab und fordert ggf. zur
Bestaetigung auf — das ist die verlaessliche Quelle, bitte dort gegenpruefen.
