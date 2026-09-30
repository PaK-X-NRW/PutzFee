/* =====================================================================
   store.js – Datenhaltung der PutzFee (über DB, nie direkt aus Views)
   ---------------------------------------------------------------------
   - start(heute): Datenbank öffnen, dauerhaften Speicher erbitten,
     beim allerersten Start den Beispielhaushalt anlegen, sonst migrieren
   - laden(): { raeume, aufgaben } für Hausansicht und Panel
   - Räume: umbenennen, Deko umschalten
   - Aufgaben: anlegen, löschen (mit Verlauf), erledigen (+ Verlauf),
     rueckgaengig (letztes Abhaken zurücknehmen)
   - hausLeeren(): alle Aufgaben, Verlauf und Deko weg, Räume bleiben
   - Backup: exportAll() / importAll(obj) – prüft vor dem Schreiben,
     ersetzt alles in EINER Transaktion
   - Datenversion: SCHEMA_VERSION + MIGRATION_STEPS (wie Noten-Fritze;
     jeder Schritt muss wiederholbar sein, weil ein älteres Backup die
     Schritte ab seiner Version erneut laufen lässt)
   ===================================================================== */
(function (global) {
  "use strict";

  const DB = global.DB;

  const SCHEMA_VERSION = 1;
  // Schlüssel = Ziel-Version, Wert = async function ()
  const MIGRATION_STEPS = {};

  const ALLE_STORES = ["raeume", "aufgaben", "erledigungen", "einstellungen"];

  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  // ---- Start & Migration ---------------------------------------------
  async function start(heute) {
    await DB.open();
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
    const schema = await DB.get("einstellungen", "schema");
    if (!schema) {
      await beispielAnlegen(heute);
      return;
    }
    await migrateSchema(schema.version);
  }

  async function migrateSchema(ab) {
    for (let v = ab + 1; v <= SCHEMA_VERSION; v++) {
      if (MIGRATION_STEPS[v]) await MIGRATION_STEPS[v]();
    }
    if (ab !== SCHEMA_VERSION) await DB.put("einstellungen", { key: "schema", version: SCHEMA_VERSION });
  }

  function leereRaeume() {
    return global.Demo.RAEUME.map((r) => ({ id: r.id, typ: r.typ, name: r.name, deko: [] }));
  }

  async function beispielAnlegen(heute) {
    const demo = global.Demo.daten(heute);
    const raeume = leereRaeume().map((r) => {
      r.deko = (demo.deko[r.id] || []).slice();
      return r;
    });
    const aufgaben = demo.aufgaben.map((a) => Object.assign({}, a, { id: uid() }));
    const erledigungen = aufgaben.filter((a) => a.zuletzt != null).map((a) => ({
      id: uid(), aufgabeId: a.id, raumId: a.raumId, tag: a.zuletzt, ts: Date.now()
    }));
    await DB.atomar(ALLE_STORES, (os) => {
      raeume.forEach((r) => os("raeume").put(r));
      aufgaben.forEach((a) => os("aufgaben").put(a));
      erledigungen.forEach((e) => os("erledigungen").put(e));
      os("einstellungen").put({ key: "schema", version: SCHEMA_VERSION });
    });
  }

  // ---- Lesen -----------------------------------------------------------
  async function laden() {
    const gespeichert = await DB.getAll("raeume");
    const nachId = {};
    gespeichert.forEach((r) => { nachId[r.id] = r; });
    // Reihenfolge und Typ kommen aus dem Hausplan; fehlende Räume ergänzen
    const raeume = global.Demo.RAEUME.map((vorlage) => {
      const r = nachId[vorlage.id] || { id: vorlage.id, name: vorlage.name, deko: [] };
      return { id: vorlage.id, typ: vorlage.typ, name: r.name || vorlage.name, deko: r.deko || [] };
    });
    const aufgaben = await DB.getAll("aufgaben");
    return { raeume: raeume, aufgaben: aufgaben };
  }

  async function raumHolen(id) {
    const r = await DB.get("raeume", id);
    if (r) return r;
    const vorlage = global.Demo.RAEUME.find((x) => x.id === id);
    return { id: id, typ: vorlage.typ, name: vorlage.name, deko: [] };
  }

  // ---- Räume -------------------------------------------------------------
  async function raumUmbenennen(id, name) {
    const r = await raumHolen(id);
    r.name = name;
    return DB.put("raeume", r);
  }

  async function dekoUmschalten(id, key) {
    const r = await raumHolen(id);
    const liste = r.deko || [];
    const i = liste.indexOf(key);
    if (i >= 0) liste.splice(i, 1); else liste.push(key);
    r.deko = liste;
    return DB.put("raeume", r);
  }

  // ---- Aufgaben ------------------------------------------------------------
  function aufgabeAnlegen(daten) {
    return DB.put("aufgaben", {
      id: uid(), raumId: daten.raumId, titel: daten.titel, moebel: daten.moebel || null,
      effekt: daten.effekt || null, rhythmus: daten.rhythmus, zuletzt: null
    });
  }

  async function aufgabeLoeschen(id) {
    const verlauf = await DB.keysByIndex("erledigungen", "aufgabeId", id);
    return DB.atomar(["aufgaben", "erledigungen"], (os) => {
      verlauf.forEach((k) => os("erledigungen").delete(k));
      os("aufgaben").delete(id);
    });
  }

  // Abhaken: Verlaufseintrag + „zuletzt" an der Aufgabe. Liefert, was
  // rueckgaengig() zum Zurücknehmen braucht.
  async function erledigen(id, tag) {
    const a = await DB.get("aufgaben", id);
    if (!a) throw new Error("Aufgabe nicht gefunden");
    const eintrag = { id: uid(), aufgabeId: a.id, raumId: a.raumId, tag: tag, ts: Date.now() };
    const vorher = a.zuletzt;
    a.zuletzt = tag;
    await DB.atomar(["aufgaben", "erledigungen"], (os) => {
      os("erledigungen").put(eintrag);
      os("aufgaben").put(a);
    });
    return { aufgabeId: a.id, erledigungId: eintrag.id, vorher: vorher, titel: a.titel };
  }

  async function rueckgaengig(merker) {
    const a = await DB.get("aufgaben", merker.aufgabeId);
    await DB.atomar(["aufgaben", "erledigungen"], (os) => {
      os("erledigungen").delete(merker.erledigungId);
      if (a) {
        a.zuletzt = merker.vorher;
        os("aufgaben").put(a);
      }
    });
  }

  async function hausLeeren() {
    const raeume = (await DB.getAll("raeume")).map((r) => Object.assign(r, { deko: [] }));
    return DB.atomar(["raeume", "aufgaben", "erledigungen"], (os) => {
      os("aufgaben").clear();
      os("erledigungen").clear();
      raeume.forEach((r) => os("raeume").put(r));
    });
  }

  // ---- Backup ----------------------------------------------------------------
  async function exportAll() {
    const daten = {};
    for (const name of ALLE_STORES) daten[name] = await DB.getAll(name);
    return {
      app: "putzfee",
      schemaVersion: SCHEMA_VERSION,
      exportiertAm: new Date().toISOString(),
      daten: daten
    };
  }

  function pruefeBackup(obj) {
    if (!obj || obj.app !== "putzfee" || !obj.daten) {
      throw new Error("Das ist keine PutzFee-Sicherung.");
    }
    const version = Number(obj.schemaVersion) || 0;
    if (version > SCHEMA_VERSION) {
      throw new Error("Die Sicherung stammt aus einer neueren PutzFee-Version. Bitte zuerst die App aktualisieren.");
    }
    ALLE_STORES.forEach((name) => {
      const liste = obj.daten[name];
      if (!Array.isArray(liste)) throw new Error("Die Sicherung ist unvollständig (" + name + " fehlt).");
      const schluessel = DB.STORES[name].keyPath;
      liste.forEach((x) => {
        if (!x || typeof x !== "object" || x[schluessel] == null) throw new Error("Die Sicherung enthält fehlerhafte Einträge (" + name + ").");
      });
    });
    return version;
  }

  async function importAll(obj) {
    const version = pruefeBackup(obj);
    await DB.atomar(ALLE_STORES, (os) => {
      ALLE_STORES.forEach((name) => {
        os(name).clear();
        obj.daten[name].forEach((x) => { if (!(name === "einstellungen" && x.key === "schema")) os(name).put(x); });
      });
      os("einstellungen").put({ key: "schema", version: version });
    });
    await migrateSchema(version);
  }

  global.Store = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    start: start,
    laden: laden,
    raumUmbenennen: raumUmbenennen,
    dekoUmschalten: dekoUmschalten,
    aufgabeAnlegen: aufgabeAnlegen,
    aufgabeLoeschen: aufgabeLoeschen,
    erledigen: erledigen,
    rueckgaengig: rueckgaengig,
    hausLeeren: hausLeeren,
    exportAll: exportAll,
    importAll: importAll
  };
})(window);
