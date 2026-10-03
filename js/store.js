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

  const SCHEMA_VERSION = 8;
  // Schlüssel = Ziel-Version, Wert = async function ()
  const MIGRATION_STEPS = {};

  // v2: Dachboden wird zur Rumpelkammer (die Dachzimmer und das Büro kommen
  // dazu, ohne Daten), Keller heißt „Keller 1“. Aufgaben und Verlauf ziehen mit.
  // Wiederholbar: nach dem ersten Lauf gibt es keinen Dachboden mehr.
  MIGRATION_STEPS[2] = async () => {
    const alt = await DB.get("raeume", "dachboden");
    const keller = await DB.get("raeume", "keller");
    const aufgaben = (await DB.getAll("aufgaben")).filter((a) => a.raumId === "dachboden");
    const verlauf = (await DB.getAll("erledigungen")).filter((e) => e.raumId === "dachboden");
    await DB.atomar(["raeume", "aufgaben", "erledigungen"], (os) => {
      aufgaben.forEach((a) => { a.raumId = "rumpelkammer"; os("aufgaben").put(a); });
      verlauf.forEach((e) => { e.raumId = "rumpelkammer"; os("erledigungen").put(e); });
      if (alt) {
        os("raeume").put({ id: "rumpelkammer", name: alt.name !== "Dachboden" ? alt.name : "Rumpelkammer", deko: alt.deko || [] });
        os("raeume").delete("dachboden");
      }
      if (keller && keller.name === "Keller") os("raeume").put(Object.assign(keller, { name: "Keller 1" }));
    });
  };

  const ALLE_STORES = ["raeume", "aufgaben", "erledigungen", "einstellungen", "moebel", "tiere"];

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
    const moebel = exemplareZuordnen(aufgaben, []);
    const tiere = tiereAusAufgaben(demo.aufgaben);
    await DB.atomar(ALLE_STORES, (os) => {
      raeume.forEach((r) => os("raeume").put(r));
      aufgaben.forEach((a) => os("aufgaben").put(a));
      erledigungen.forEach((e) => os("erledigungen").put(e));
      moebel.forEach((m) => os("moebel").put(m));
      tiere.forEach((t) => os("tiere").put(t));
      os("einstellungen").put({ key: "schema", version: SCHEMA_VERSION });
    });
  }

  // v3: Aufgaben können ein Exemplar nennen (Treppe je Etage: „exemplar“).
  // Das Feld fehlt bei älteren Aufgaben – nichts muss umgeschrieben werden.
  MIGRATION_STEPS[3] = async () => {};

  // v4: Möbel als einzelne Exemplare. Je (Raum, Möbeltyp) entsteht ein Exemplar,
  // die bisherigen Aufgaben dieses Typs werden ihm zugeordnet (aufgabe.moebelId).
  // Wiederholbar: Aufgaben mit moebelId werden nicht mehr angefasst.
  MIGRATION_STEPS[4] = async () => {
    const aufgaben = await DB.getAll("aufgaben");
    const vorhanden = await DB.getAll("moebel");
    const offen = aufgaben.filter((a) => a.moebel && a.moebel !== "treppe" && !a.moebelId).map((a) => a.id);
    const neu = exemplareZuordnen(aufgaben, vorhanden);
    const geaendert = aufgaben.filter((a) => offen.indexOf(a.id) >= 0);
    if (!neu.length && !geaendert.length) return;
    await DB.atomar(["aufgaben", "moebel"], (os) => {
      neu.forEach((m) => os("moebel").put(m));
      geaendert.forEach((a) => os("aufgaben").put(a));
    });
  };

  // Ordnet Aufgaben mit Möbeltyp einem Exemplar im selben Raum zu. Fehlt eins,
  // wird es angelegt. Liefert die neu angelegten Exemplare (setzt aufgabe.moebelId).
  function exemplareZuordnen(aufgaben, vorhanden) {
    const neu = [];
    aufgaben.forEach((a) => {
      if (!a.moebel || a.moebel === "treppe" || a.moebelId) return;
      let m = vorhanden.concat(neu).find((x) => x.raumId === a.raumId && x.typ === a.moebel);
      if (!m) {
        m = { id: uid(), raumId: a.raumId, typ: a.moebel, x: null };
        neu.push(m);
      }
      a.moebelId = m.id;
    });
    return neu;
  }

  // ---- Lesen -----------------------------------------------------------
  async function laden() {
    const gespeichert = await DB.getAll("raeume");
    const nachId = {};
    gespeichert.forEach((r) => { nachId[r.id] = r; });
    // Reihenfolge und Typ kommen aus dem Hausplan; fehlende Räume ergänzen
    const raeume = global.Demo.RAEUME.map((vorlage) => {
      const r = nachId[vorlage.id] || { id: vorlage.id, name: vorlage.name, deko: [] };
      return { id: vorlage.id, typ: vorlage.typ, name: r.name || vorlage.name, deko: r.deko || [], dekoPos: r.dekoPos || {}, dekoEtage: r.dekoEtage || {} };
    });
    const aufgaben = await DB.getAll("aufgaben");
    const moebel = await DB.getAll("moebel");
    const tiere = await DB.getAll("tiere");
    return { raeume: raeume, aufgaben: aufgaben, moebel: moebel, tiere: tiere };
  }

  // Haustier anlegen und wieder entfernen (höchstens vier je Art prüft die Ansicht)
  async function tierAnlegen(art, farbe) {
    return DB.put("tiere", { id: uid(), art: art, farbe: farbe });
  }

  async function tierLoeschen(id) {
    return DB.del("tiere", id);
  }

  // Neues Exemplar in einem Raum (Position automatisch). Liefert die Id.
  async function moebelAnlegen(raumId, typ) {
    const m = { id: uid(), raumId: raumId, typ: typ, x: null };
    await DB.put("moebel", m);
    return m.id;
  }

  // v5: Exemplare im Flur können auf einer anderen Etage stehen (feld „etage“,
  // fehlt = Erdgeschoss). Nur ein neues Feld – nichts muss umgeschrieben werden.
  MIGRATION_STEPS[5] = async () => {};

  // v6: Haustiere werden im Speicher gehalten. Haben Haushalte schon Aufgaben für
  // Katzen- oder Hundezubehör, bekommen sie daraus ein Tier (einmalig, wenn keins da ist).
  MIGRATION_STEPS[6] = async () => {
    if ((await DB.getAll("tiere")).length) return;
    const neu = tiereAusAufgaben(await DB.getAll("aufgaben"));
    if (!neu.length) return;
    await DB.atomar(["tiere"], (os) => { neu.forEach((t) => os("tiere").put(t)); });
  };

  // Tiere aus vorhandenem Zubehör (Katzenklo, Futternapf, Kratzbaum, Hundebettchen)
  function tiereAusAufgaben(aufgaben) {
    const arten = {};
    aufgaben.forEach((a) => {
      const d = global.Moebel.KATALOG[a.moebel];
      if (d && (d.tier === "katze" || d.tier === "hund")) arten[d.tier] = true;
    });
    const farbe = { katze: "orange", hund: "braun" };
    return Object.keys(arten).map((art) => ({ id: uid(), art: art, farbe: farbe[art] }));
  }

  // v7: Deko kann verschoben werden; die Lage steht als „dekoPos“ am Raum (fehlt = automatisch).
  MIGRATION_STEPS[7] = async () => {};

  // v8: Deko im Flur kann auf einer anderen Etage stehen (raum.dekoEtage; fehlt = Erdgeschoss)
  MIGRATION_STEPS[8] = async () => {};

  async function dekoEtage(raumId, key, etage) {
    const r = await raumHolen(raumId);
    r.dekoEtage = Object.assign({}, r.dekoEtage || {});
    r.dekoEtage[key] = etage;
    return DB.put("raeume", r);
  }

  // Lage eines Deko-Teils im Raum (linke Kante in Hauskoordinaten)
  async function dekoPosition(raumId, key, x) {
    const r = await raumHolen(raumId);
    r.dekoPos = Object.assign({}, r.dekoPos || {});
    r.dekoPos[key] = x;
    return DB.put("raeume", r);
  }

  // Etage eines Flur-Exemplars (keller, eg, og, dach)
  async function moebelEtage(id, etage) {
    const m = await DB.get("moebel", id);
    if (!m) return;
    m.etage = etage;
    return DB.put("moebel", m);
  }

  // Position eines Exemplars (linke Kante in Hauskoordinaten)
  async function moebelPosition(id, x) {
    const m = await DB.get("moebel", id);
    if (!m) return;
    m.x = x;
    return DB.put("moebel", m);
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
      id: uid(), raumId: daten.raumId, titel: daten.titel, moebel: daten.moebel || null, moebelId: daten.moebelId || null,
      effekt: daten.effekt || null, exemplar: daten.exemplar || null, rhythmus: daten.rhythmus, zuletzt: null
    });
  }

  // Aufgabe ändern (Titel, Rhythmus, Effekt, Möbel). Verlauf und „zuletzt“ bleiben.
  async function aufgabeAendern(id, daten) {
    const a = await DB.get("aufgaben", id);
    if (!a) throw new Error("Aufgabe nicht gefunden");
    Object.assign(a, {
      titel: daten.titel, moebel: daten.moebel || null, moebelId: daten.moebelId || null,
      effekt: daten.effekt || null, exemplar: daten.exemplar || null, rhythmus: daten.rhythmus
    });
    return DB.put("aufgaben", a);
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
    return DB.atomar(["raeume", "aufgaben", "erledigungen", "moebel"], (os) => {
      os("aufgaben").clear();
      os("erledigungen").clear();
      os("moebel").clear();
      raeume.forEach((r) => os("raeume").put(r));
    });
  }

  // ---- Backup ----------------------------------------------------------------
  async function exportAll() {
    const daten = {};
    for (const name of ALLE_STORES) daten[name] = await DB.getAll(name);
    return {
      app: "putzfee",
      appVersion: global.APP_VERSION,
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
    // Sicherungen vor Version 4 kennen keine Möbel-Exemplare
    if (!obj.daten.moebel) obj.daten.moebel = [];
    if (!obj.daten.tiere) obj.daten.tiere = [];
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
    aufgabeAendern: aufgabeAendern,
    moebelAnlegen: moebelAnlegen,
    moebelPosition: moebelPosition,
    moebelEtage: moebelEtage,
    tierAnlegen: tierAnlegen,
    dekoPosition: dekoPosition,
    dekoEtage: dekoEtage,
    tierLoeschen: tierLoeschen,
    aufgabeLoeschen: aufgabeLoeschen,
    erledigen: erledigen,
    rueckgaengig: rueckgaengig,
    hausLeeren: hausLeeren,
    exportAll: exportAll,
    importAll: importAll
  };
})(window);
