/* =========================================================================
   version.js – App-Version (Single Source of Truth)
   Schema MAJOR.MINOR.PATCH, von Hand gepflegt:
     MAJOR – große Umbauten
     MINOR – neue Funktionen
     PATCH – Fixes, Feinschliff
   Benennt den Service-Worker-Cache, steht im Menü und im Backup. Unabhängig
   von DB.DB_VERSION (Stores) und Store.SCHEMA_VERSION (Datenform).

   ⚠️ Bei jedem Release erhöhen – aber nur auf Ansage –, sonst behalten
   installierte PWAs die alte App-Shell im Cache (siehe service-worker.js).
   ========================================================================= */
(function (global) {
  "use strict";

  global.APP_VERSION = "0.4.0";

  // `self` statt `window`: Die Datei wird auch vom Service Worker per
  // importScripts geladen, damit Cache-Name und App dieselbe Version nutzen.
})(self);
