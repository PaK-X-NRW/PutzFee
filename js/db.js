/* =========================================================================
   db.js – Schlanker IndexedDB-Wrapper (Promise-basiert)
   Übernommen aus Noten-Fritze: Öffnen der Datenbank, additive
   Schema-Versionierung, generische CRUD-Operationen und atomar() für
   Schreibvorgänge über mehrere Stores in EINER Transaktion.
   ========================================================================= */
(function (global) {
  "use strict";

  const DB_NAME = "putzfee";
  // v1: raeume, aufgaben, erledigungen, einstellungen
  // v2: moebel (einzelne Exemplare mit Position)
  // v3: tiere (Katzen und Hunde mit Fellfarbe)
  const DB_VERSION = 3;

  const STORES = {
    // Räume: feste Plätze im Haus (id = Platz), Name umbenennbar, Deko-Liste
    raeume:       { keyPath: "id", indexes: [] },
    aufgaben:     { keyPath: "id", indexes: [{ name: "raumId", keyPath: "raumId" }] },
    // Verlauf: ein Eintrag je Abhaken { id, aufgabeId, raumId, tag, ts }
    erledigungen: { keyPath: "id", indexes: [
                      { name: "aufgabeId", keyPath: "aufgabeId" },
                      { name: "tag", keyPath: "tag" }
                    ] },
    // Exemplare: ein Möbelstück im Raum { id, raumId, typ, x } – x = Position (null = automatisch)
    moebel:       { keyPath: "id", indexes: [{ name: "raumId", keyPath: "raumId" }] },
    // Haustiere { id, art: "katze" | "hund", farbe }
    tiere:        { keyPath: "id", indexes: [] },
    einstellungen:{ keyPath: "key", indexes: [] }
  };

  let _dbPromise = null;

  function open() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        // Migrationen: bei höheren Versionen hier ergänzen (additiv!).
        Object.keys(STORES).forEach((name) => {
          let store;
          if (!db.objectStoreNames.contains(name)) {
            store = db.createObjectStore(name, { keyPath: STORES[name].keyPath });
          } else {
            store = e.target.transaction.objectStore(name);
          }
          STORES[name].indexes.forEach((ix) => {
            if (!store.indexNames.contains(ix.name)) {
              store.createIndex(ix.name, ix.keyPath, { unique: !!ix.unique });
            }
          });
        });
      };
      // Ein anderes offenes Fenster (Tab/PWA) mit älterer Version hält die
      // Datenbank: das Upgrade wartet, bis es geschlossen ist – Hinweis zeigen.
      req.onblocked = () => {
        if (global.UI) UI.toast("Bitte andere geöffnete PutzFee-Fenster schließen – die Datenbank wird aktualisiert.", { duration: 15000 });
      };
      req.onsuccess = () => {
        const db = req.result;
        // Will ein neueres Fenster upgraden, die eigene Verbindung freigeben
        // (sonst bliebe es blockiert); dieses Fenster muss dann neu laden.
        db.onversionchange = () => {
          db.close();
          if (global.UI) UI.toast("PutzFee wurde in einem anderen Fenster aktualisiert – bitte neu laden.", { duration: 60000 });
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  function tx(storeNames, mode) {
    return open().then((db) => {
      const t = db.transaction(storeNames, mode);
      return t;
    });
  }

  function reqToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ---- Generische Operationen ----------------------------------------------
  async function put(store, value) {
    const t = await tx(store, "readwrite");
    const r = reqToPromise(t.objectStore(store).put(value));
    return r.then(() => value);
  }

  async function bulkPut(store, values) {
    const t = await tx(store, "readwrite");
    const os = t.objectStore(store);
    values.forEach((v) => os.put(v));
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(values);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  async function get(store, key) {
    const t = await tx(store, "readonly");
    return reqToPromise(t.objectStore(store).get(key));
  }

  async function getAll(store) {
    const t = await tx(store, "readonly");
    return reqToPromise(t.objectStore(store).getAll());
  }

  async function getAllByIndex(store, indexName, value) {
    const t = await tx(store, "readonly");
    const ix = t.objectStore(store).index(indexName);
    return reqToPromise(ix.getAll(value));
  }

  async function del(store, key) {
    const t = await tx(store, "readwrite");
    return reqToPromise(t.objectStore(store).delete(key));
  }

  async function delByIndex(store, indexName, value) {
    const t = await tx(store, "readwrite");
    const os = t.objectStore(store);
    const ix = os.index(indexName);
    const keys = await reqToPromise(ix.getAllKeys(value));
    keys.forEach((k) => os.delete(k));
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(keys.length);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  // Schlüssel aller Datensätze mit einem bestimmten Index-Wert (nur lesen).
  async function keysByIndex(store, indexName, value) {
    const t = await tx(store, "readonly");
    return reqToPromise(t.objectStore(store).index(indexName).getAllKeys(value));
  }

  // Schreibt in mehrere Stores in EINER Transaktion: entweder wird alles
  // gespeichert oder – bei einem Fehler mittendrin – gar nichts. Für Löschen
  // mit Kaskade und für Importe, damit nie ein halber Datenstand zurückbleibt.
  //   schritte(os): os(name) liefert den Object-Store; darin synchron
  //   put/delete/clear aufrufen (kein await – sonst endet die Transaktion).
  async function atomar(storeNames, schritte) {
    const db = await open();
    const t = db.transaction(storeNames, "readwrite");
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("Speichern abgebrochen"));
      try {
        schritte((name) => t.objectStore(name));
      } catch (e) {
        try { t.abort(); } catch (e2) { /* schon beendet */ }
        reject(e);
      }
    });
  }

  async function clearAll() {
    const db = await open();
    const names = Array.from(db.objectStoreNames);
    const t = db.transaction(names, "readwrite");
    names.forEach((n) => t.objectStore(n).clear());
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  global.DB = {
    open, put, bulkPut, get, getAll, getAllByIndex, keysByIndex, del, delByIndex, clearAll, atomar,
    DB_NAME, DB_VERSION, STORES
  };
})(window);
