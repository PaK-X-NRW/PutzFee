/* =====================================================================
   app.js – Zustand, Raum-Panel, Vorschau, Menü, Delegation, Start
   ---------------------------------------------------------------------
   - Daten kommen aus dem Store (IndexedDB); nach jeder Änderung wird
     neu geladen und gerendert (neuLaden)
   - Vorschau: ◀ ▶ / +1 Woche verschieben nur die Anzeige; solange
     vorgespult ist, ist Abhaken gesperrt (sonst Datum in der Zukunft)
   - Menü ☰: Sichern (Datei), Wiederherstellen, Haus leeren
   - Abhaken zeigt einen Toast mit „Rückgängig"
   - Um Mitternacht (App bleibt offen) rechnet die Anzeige neu
   - Service Worker (nur über http/https) + Toast „Neue Version verfügbar"
   Interaktion über data-action / data-change + zentrale Delegation.
   ===================================================================== */
(function (global) {
  "use strict";

  const Calc = global.Calc;
  const Haus = global.Haus;
  const Store = global.Store;
  const UI = global.UI;
  const M = global.Moebel;
  const esc = UI.esc;

  const EFFEKTE = [
    { key: "", name: "– kein Effekt –" },
    { key: "aufraeumen", name: "Aufräumen (Unordnung)" },
    { key: "staubwischen", name: "Staub wischen (Spinnweben)" },
    { key: "staubsaugen", name: "Staubsaugen (Wollmäuse)" },
    { key: "wischen", name: "Boden wischen (Flecken)" },
    { key: "waesche", name: "Wäsche waschen (Wäscheberg)" },
    { key: "glas", name: "Tisch abwischen (umgekipptes Glas)" },
    { key: "flecken", name: "Möbel reinigen (Flecken)" },
    { key: "fliegen", name: "Fliegen vertreiben" },
    { key: "fenster", name: "Fenster putzen (Schmutz)" },
    { key: "handtuch", name: "Dusche putzen (Handtuch)" }
  ];

  const state = {
    daten: { raeume: [], aufgaben: [], moebel: [], tiere: [] },
    versatz: 0,
    auswahl: null,
    fokusMoebel: null,
    menue: false,
    gerenderterTag: null,
    umgestalten: false,
    tierArt: "katze",
    bearbeitId: null,
    zugGerade: false
  };

  function heuteEcht() { return Calc.tagNr(new Date()); }
  function heute() { return heuteEcht() + state.versatz; }
  function $(sel) { return document.querySelector(sel); }
  function datumText(tag) {
    return Calc.datumVon(tag).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  }

  async function neuLaden() {
    state.daten = await Store.laden();
    render();
  }

  // ---- Render -----------------------------------------------------------
  function render() {
    state.gerenderterTag = heuteEcht();
    $("#haus").innerHTML = Haus.render(state.daten, heute(), state.auswahl, state.umgestalten);
    $("#haus").style.touchAction = state.umgestalten ? "none" : "";
    renderTiere();
    renderKopf();
    renderPanel();
    $("#menue").className = "menue" + (state.menue ? " offen" : "");
  }

  // ---- Haustiere im Menü ---------------------------------------------------
  function farbName(art, farbe) {
    const f = M.TIER_FARBEN[art].find((x) => x[0] === farbe);
    return f ? f[1] : farbe;
  }

  function renderTiere() {
    const el = $("#tiere");
    if (!el) return;
    const liste = state.daten.tiere || [];
    const art = state.tierArt;
    const anzahl = liste.filter((t) => t.art === art).length;
    let s = "<b>🐾 Haustiere</b>";
    liste.forEach((t) => {
      s += '<div class="tier-zeile">' + esc(M.TIERE[t.art].name + " · " + farbName(t.art, t.farbe)) +
        ' <button data-action="tier-weg" data-id="' + esc(t.id) + '" title="Entfernen">✕</button></div>';
    });
    s += '<div class="tier-neu"><select data-change="tier-art">' +
      Object.keys(M.TIERE).map((k) => '<option value="' + k + '"' + (k === art ? " selected" : "") + ">" + M.TIERE[k].name + "</option>").join("") +
      '</select> <select id="t-farbe">' + M.TIER_FARBEN[art].map((f) => '<option value="' + f[0] + '">' + f[1] + "</option>").join("") +
      '</select> <button data-action="tier-neu"' + (anzahl >= 4 ? " disabled" : "") + ">Hinzufügen</button>" +
      (anzahl >= 4 ? "<small>Höchstens 4 Tiere pro Art.</small>" : "") + "</div>";
    el.innerHTML = s;
  }

  function renderKopf() {
    const vorschau = state.versatz !== 0;
    $("#datum").textContent = datumText(heute());
    $(".zeit").classList.toggle("vorschau", vorschau);
    const banner = $("#vorschau");
    banner.className = "vorschau-banner" + (vorschau ? " an" : "");
    banner.innerHTML = vorschau
      ? "<span>👀 Vorschau: So sieht es am <b>" + datumText(heute()) + "</b> aus. Abhaken geht nur heute.</span>" +
        '<button data-action="heute">Zurück zu heute</button>'
      : "";
    const infos = Haus.staende(state.daten, heute());
    let erl = 0;
    let alle = 0;
    Object.keys(infos).forEach((k) => { erl += infos[k].erledigt; alle += infos[k].anzahl; });
    $("#gesamt").textContent = "Haus: " + (alle ? Math.round(erl / alle * 100) : 0) + " % erledigt";
  }

  function moebelOptionen(aktuell) {
    const gruppen = {};
    Object.keys(M.KATALOG).forEach((k) => {
      const d = M.KATALOG[k];
      (gruppen[d.gruppe] = gruppen[d.gruppe] || []).push('<option value="' + k + '"' + (k === aktuell ? " selected" : "") + ">" + d.name + "</option>");
    });
    return '<option value="">– kein Möbelstück –</option>' +
      Object.keys(gruppen).map((gr) => '<optgroup label="' + gr + '">' + gruppen[gr].join("") + "</optgroup>").join("") +
      '<optgroup label="Treppenhaus"><option value="treppe"' + (aktuell === "treppe" ? " selected" : "") + ">Treppe (je Etage)</option></optgroup>";
  }

  function etageName(key) {
    const e = Haus.ETAGEN.find((x) => x.key === key);
    return e ? e.name : "";
  }

  // Exemplare: Auswahl im Formular und Nummerierung, wenn ein Typ mehrfach im Raum steht
  function exemplareDesRaums(typ) {
    return state.daten.moebel.filter((m) => m.raumId === state.auswahl && m.typ === typ);
  }

  function exemplarOptionen(typ, aktuell) {
    let s = '<option value="neu">neues Exemplar</option>';
    exemplareDesRaums(typ).forEach((m, i) => {
      s += '<option value="' + esc(m.id) + '"' + (m.id === aktuell ? " selected" : "") + ">" + M.KATALOG[typ].name + " " + (i + 1) + "</option>";
    });
    return s;
  }

  function exemplarTitel(m) {
    const name = M.KATALOG[m.typ].name;
    const gleiche = state.daten.moebel.filter((x) => x.raumId === m.raumId && x.typ === m.typ);
    return gleiche.length < 2 ? name : name + " " + (gleiche.indexOf(m) + 1);
  }

  function exemplarZusatz(a) {
    if (!a.moebelId) return "";
    const m = state.daten.moebel.find((x) => x.id === a.moebelId);
    if (!m) return "";
    const gleiche = exemplareDesRaums(m.typ);
    if (gleiche.length < 2) return "";
    return M.KATALOG[m.typ].name + " " + (gleiche.indexOf(m) + 1) + " · ";
  }

  function renderPanel() {
    const panel = $("#panel");
    const raum = state.daten.raeume.find((r) => r.id === state.auswahl);
    if (!raum) {
      panel.className = "panel";
      panel.innerHTML = "";
      return;
    }
    const geo = Haus.LAGE[raum.id];
    const seite = geo.x + geo.w / 2 > 800 ? "links" : "rechts";
    const h = heute();
    const vorschau = state.versatz !== 0;
    const umg = state.umgestalten;
    const info = Calc.raumStand(state.daten.aufgaben.filter((a) => a.raumId === raum.id), h);
    const aufgaben = state.daten.aufgaben
      .filter((a) => a.raumId === raum.id)
      .map((a) => ({ a: a, st: Calc.aufgabenStand(a, h) }))
      .sort((x, y) => y.st.anteil - x.st.anteil);
    const fokusKey = (a) => (a.moebel === "treppe" ? "treppe-" + a.exemplar : a.moebelId);
    const bearb = state.bearbeitId ? state.daten.aufgaben.find((a) => a.id === state.bearbeitId) : null;
    const v = bearb || {};

    let s = '<div class="panel-kopf"><input class="raumname" data-change="umbenennen" value="' + esc(raum.name) + '" aria-label="Raumname">' +
      '<button class="rund" data-action="schliessen" aria-label="Schließen">✕</button></div>';
    s += '<div class="status status-' + info.status + '">';
    if (info.status === "leer") {
      s += "<b>Noch keine Aufgaben</b><span>Der Raum bleibt grau, bis du eine Aufgabe anlegst.</span>";
    } else {
      const symbol = { biohazard: "☠️", schmutzig: "🧹", sauber: "🙂", blitzsauber: "🧚" }[info.status];
      s += "<b>" + symbol + " " + Math.round(info.quote * 100) + " % erledigt</b><span>" +
        (info.status === "biohazard" ? "BIOHAZARD – " : "") + esc(info.spruch) + "</span>";
    }
    s += "</div>";

    s += '<div class="umgestalten-zeile"><button class="' + (umg ? "primaer" : "") + '" data-action="umgestalten">' +
      (umg ? "✓ Fertig" : "✥ Möbel verschieben") + "</button>" +
      (umg ? "<small>Möbel mit dem Finger an die gewünschte Stelle ziehen.</small>" : "") + "</div>";

    if (umg && raum.typ === "flur") {
      const exemplare = state.daten.moebel.filter((m) => m.raumId === raum.id && state.daten.aufgaben.some((a) => a.moebelId === m.id));
      const etagenWahl = (aktuell, datenAttr) => '<select ' + datenAttr + ">" +
        Haus.ETAGEN.filter((e) => e.key !== "dach").map((e) => '<option value="' + e.key + '"' + ((aktuell || "eg") === e.key ? " selected" : "") + ">" + e.name + "</option>").join("") +
        "</select>";
      const deko = (raum.deko || []).filter((k) => M.DEKO[k]);
      if (exemplare.length || deko.length) {
        s += '<div class="etagen"><small>Auf welcher Etage steht es?</small>' +
          exemplare.map((m) => "<label>" + esc(exemplarTitel(m)) + " " +
            etagenWahl(m.etage, 'data-change="etage" data-id="' + esc(m.id) + '"') + "</label>").join("") +
          deko.map((k) => "<label>" + esc(M.DEKO[k].name) + " " +
            etagenWahl((raum.dekoEtage || {})[k], 'data-change="dekoetage" data-key="' + k + '"') + "</label>").join("") +
          "</div>";
      }
    }

    s += '<ul class="aufgaben">';
    aufgaben.forEach((x) => {
      const f = Calc.heatFarbe(x.st.anteil);
      const fokus = state.fokusMoebel && fokusKey(x.a) === state.fokusMoebel;
      const zusatz = x.a.moebel === "treppe" ? etageName(x.a.exemplar) + " · " : exemplarZusatz(x.a);
      s += '<li class="' + (x.st.erledigt ? "erledigt" : "offen") + (fokus ? " fokus" : "") + (bearb === x.a ? " bearbeitet" : "") + '">' +
        '<span class="punkt" style="background:' + f.fill + ";border-color:" + f.dunkel + '"></span>' +
        '<div class="a-text"><b>' + esc(x.a.titel) + "</b><small>" + zusatz + Calc.rhythmusText(x.a.rhythmus) + " · " + Calc.standText(x.a, h) + "</small></div>" +
        '<button class="haken" data-action="erledigt" data-id="' + esc(x.a.id) + '"' + (vorschau ? " disabled" : "") +
        ' title="' + (vorschau ? "In der Vorschau nicht möglich" : "Erledigt") + '">✓</button>' +
        '<button data-action="bearbeiten" data-id="' + esc(x.a.id) + '" title="Aufgabe bearbeiten">✎</button>' +
        '<button class="weg" data-action="loeschen" data-id="' + esc(x.a.id) + '" title="Aufgabe löschen">✕</button></li>';
    });
    s += "</ul>";

    // Formular: neue Aufgabe, oder – im Bearbeiten-Modus – die gewählte Aufgabe
    const wochentage = !!v.rhythmus && v.rhythmus.art === "wochentage";
    const wt = wochentage ? v.rhythmus.wochentage : [];
    const moebelHier = !!v.moebel && v.moebel !== "treppe";
    s += '<details class="neu"' + (aufgaben.length && !bearb ? "" : " open") + "><summary>" + (bearb ? "✎ Aufgabe bearbeiten" : "＋ Neue Aufgabe") + "</summary>" +
      '<label>Vorlage<select data-change="vorlage"><option value="">– eigene Aufgabe –</option>' +
      global.Demo.VORLAGEN.map((vl, i) => '<option value="' + i + '">' + esc(vl.titel) + " (" + Calc.rhythmusText(vl.rhythmus) + ")</option>").join("") +
      "</select></label>" +
      '<label>Titel<input id="f-titel" value="' + esc(v.titel || "") + '" placeholder="z. B. Fenster putzen"></label>' +
      '<label>Möbelstück (erscheint im Raum)<select id="f-moebel" data-change="moebel-wahl">' + moebelOptionen(v.moebel || "") + "</select></label>" +
      '<label id="f-exemplar-zeile"' + (moebelHier ? "" : " hidden") + '>Exemplar<select id="f-exemplar">' +
        (moebelHier ? exemplarOptionen(v.moebel, v.moebelId) : "") + "</select></label>" +
      '<label id="f-etage-zeile"' + (v.moebel === "treppe" ? "" : " hidden") + '>Etage<select id="f-etage">' +
        Haus.ETAGEN.map((e) => '<option value="' + e.key + '"' + (e.key === v.exemplar ? " selected" : "") + ">" + e.name + "</option>").join("") + "</select></label>" +
      '<label>Effekt im Raum<select id="f-effekt">' + EFFEKTE.map((e) => '<option value="' + e.key + '"' + (e.key === (v.effekt || "") ? " selected" : "") + ">" + e.name + "</option>").join("") + "</select></label>" +
      '<div class="rhythmus"><label class="inline"><input type="radio" name="f-art" value="intervall"' + (wochentage ? "" : " checked") + "> alle</label>" +
      '<input id="f-tage" type="number" min="1" max="365" value="' + (v.rhythmus && !wochentage ? v.rhythmus.tage : 7) + '"> Tage</div>' +
      '<div class="rhythmus"><label class="inline"><input type="radio" name="f-art" value="wochentage"' + (wochentage ? " checked" : "") + "> an</label>" +
      [1, 2, 3, 4, 5, 6, 0].map((t) => '<label class="tag"><input type="checkbox" class="f-wt" value="' + t + '"' + (wt.indexOf(t) >= 0 ? " checked" : "") + ">" + Calc.WOCHENTAGE[t] + "</label>").join("") + "</div>" +
      (bearb
        ? '<button class="primaer" data-action="aufgabe-neu">Änderungen speichern</button> <button data-action="bearbeiten-ende">Abbrechen</button>'
        : '<button class="primaer" data-action="aufgabe-neu">Aufgabe anlegen</button>') +
      "</details>";

    // Deko
    const deko = raum.deko || [];
    s += '<h3>Deko</h3><div class="chips">' + Object.keys(M.DEKO).map((k) =>
      '<button class="chip' + (deko.indexOf(k) >= 0 ? " an" : "") + '" data-action="deko" data-key="' + k + '">' + M.DEKO[k].name + "</button>").join("") + "</div>";

    panel.className = "panel offen " + seite;
    panel.innerHTML = s;
  }

  // ---- Backup -------------------------------------------------------------
  function dateiSpeichern(name, inhalt) {
    const blob = new Blob([inhalt], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function dateiLesen(datei) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsText(datei);
    });
  }

  // ---- Aktionen -----------------------------------------------------------
  const AKTIONEN = {
    raum: (el) => { state.auswahl = el.dataset.id; state.fokusMoebel = null; render(); },
    moebel: (el) => { state.auswahl = el.dataset.raum; state.fokusMoebel = el.dataset.key; render(); },
    schliessen: () => { state.auswahl = null; state.fokusMoebel = null; render(); },
    tag: (el) => { state.versatz += Number(el.dataset.d); render(); },
    heute: () => { state.versatz = 0; render(); },
    menue: () => { state.menue = !state.menue; render(); },

    erledigt: async (el) => {
      if (state.versatz !== 0) { UI.toast("In der Vorschau kann nicht abgehakt werden."); return; }
      const merker = await Store.erledigen(el.dataset.id, heuteEcht());
      await neuLaden();
      UI.toast("„" + merker.titel + "“ erledigt ✨", {
        duration: 6000,
        aktion: { text: "Rückgängig", fn: async () => { await Store.rueckgaengig(merker); await neuLaden(); } }
      });
    },
    loeschen: async (el) => {
      const a = state.daten.aufgaben.find((x) => x.id === el.dataset.id);
      if (!a || !global.confirm("Aufgabe „" + a.titel + "“ löschen? Ihr Verlauf wird mitgelöscht.")) return;
      await Store.aufgabeLoeschen(a.id);
      await neuLaden();
    },
    deko: async (el) => {
      await Store.dekoUmschalten(state.auswahl, el.dataset.key);
      await neuLaden();
    },
    umgestalten: () => { state.umgestalten = !state.umgestalten; render(); },
    "tier-neu": async () => {
      const art = state.tierArt;
      if (state.daten.tiere.filter((t) => t.art === art).length >= 4) return;
      await Store.tierAnlegen(art, $("#t-farbe").value);
      await neuLaden();
    },
    "tier-weg": async (el) => {
      await Store.tierLoeschen(el.dataset.id);
      await neuLaden();
    },
    bearbeiten: (el) => { state.bearbeitId = el.dataset.id; render(); },
    "bearbeiten-ende": () => { state.bearbeitId = null; render(); },
    "aufgabe-neu": async () => {
      const titel = $("#f-titel").value.trim();
      if (!titel) { $("#f-titel").focus(); return; }
      const art = document.querySelector('input[name="f-art"]:checked').value;
      const wt = Array.prototype.map.call(document.querySelectorAll(".f-wt:checked"), (c) => Number(c.value));
      if (art === "wochentage" && !wt.length) { UI.toast("Bitte mindestens einen Wochentag wählen."); return; }
      const rhythmus = art === "wochentage"
        ? { art: "wochentage", wochentage: wt }
        : { art: "intervall", tage: Math.max(1, Math.min(365, Math.round(Number($("#f-tage").value)) || 7)) };
      const moebel = $("#f-moebel").value || null;
      const daten = {
        titel: titel, rhythmus: rhythmus, moebel: moebel, effekt: $("#f-effekt").value || null,
        exemplar: moebel === "treppe" ? $("#f-etage").value : null, moebelId: null
      };
      if (moebel && moebel !== "treppe") {
        const wahl = $("#f-exemplar").value;
        daten.moebelId = wahl === "neu" ? await Store.moebelAnlegen(state.auswahl, moebel) : wahl;
      }
      if (state.bearbeitId) {
        await Store.aufgabeAendern(state.bearbeitId, daten);
        state.bearbeitId = null;
      } else {
        await Store.aufgabeAnlegen(Object.assign({ raumId: state.auswahl }, daten));
      }
      await neuLaden();
    },

    sichern: async () => {
      state.menue = false;
      render();
      const backup = await Store.exportAll();
      const d = new Date();
      const tag = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      dateiSpeichern("putzfee-sicherung-" + tag + ".json", JSON.stringify(backup, null, 1));
      UI.toast("Sicherung gespeichert.");
    },
    wiederherstellen: () => {
      state.menue = false;
      render();
      $("#datei-import").click();
    },
    leeren: async () => {
      state.menue = false;
      render();
      if (!global.confirm("Haus leeren?\n\nAlle Aufgaben, der Verlauf und die Deko werden gelöscht. Die Räume und ihre Namen bleiben.\n\nTipp: vorher über ☰ „Sichern“.")) return;
      await Store.hausLeeren();
      state.auswahl = null;
      await neuLaden();
      UI.toast("Das Haus ist leer – tippe einen Raum an und lege Aufgaben an.");
    }
  };

  const AENDERUNGEN = {
    umbenennen: async (el) => {
      const name = el.value.trim();
      if (name) await Store.raumUmbenennen(state.auswahl, name);
      await neuLaden();
    },
    dekoetage: async (el) => {
      await Store.dekoEtage(state.auswahl, el.dataset.key, el.value);
      await neuLaden();
    },
    "tier-art": (el) => {
      state.tierArt = el.value;
      renderTiere();
    },
    etage: async (el) => {
      await Store.moebelEtage(el.dataset.id, el.value);
      await neuLaden();
    },
    "moebel-wahl": (el) => {
      const typ = el.value;
      $("#f-etage-zeile").hidden = typ !== "treppe";
      $("#f-exemplar-zeile").hidden = !typ || typ === "treppe";
      $("#f-exemplar").innerHTML = typ && typ !== "treppe" ? exemplarOptionen(typ, null) : "";
    },
    vorlage: (el) => {
      const v = global.Demo.VORLAGEN[Number(el.value)];
      if (!v) return;
      $("#f-titel").value = v.titel;
      $("#f-moebel").value = v.moebel || "";
      $("#f-moebel").dispatchEvent(new Event("change", { bubbles: true }));
      $("#f-effekt").value = v.effekt || "";
      const wt = v.rhythmus.art === "wochentage";
      document.querySelector('input[name="f-art"][value="' + (wt ? "wochentage" : "intervall") + '"]').checked = true;
      if (!wt) $("#f-tage").value = v.rhythmus.tage;
      document.querySelectorAll(".f-wt").forEach((c) => { c.checked = wt && v.rhythmus.wochentage.indexOf(Number(c.value)) >= 0; });
    },
    import: async (el) => {
      const datei = el.files && el.files[0];
      el.value = "";
      if (!datei) return;
      let obj;
      try {
        obj = JSON.parse(await dateiLesen(datei));
      } catch (e) {
        UI.toast("Die Datei konnte nicht gelesen werden – ist das eine PutzFee-Sicherung?", { duration: 7000 });
        return;
      }
      const vom = obj && obj.exportiertAm ? " vom " + new Date(obj.exportiertAm).toLocaleDateString("de-DE") : "";
      if (!global.confirm("Sicherung" + vom + " wiederherstellen?\n\nAlle aktuellen Aufgaben, der Verlauf und die Räume werden dadurch ersetzt.")) return;
      await Store.importAll(obj);
      state.auswahl = null;
      state.versatz = 0;
      await neuLaden();
      UI.toast("Sicherung wiederhergestellt.");
    }
  };

  function ausfuehren(f, el) {
    Promise.resolve().then(() => f(el)).catch(UI.fehlerMelden);
  }

  document.addEventListener("click", (ev) => {
    if (state.zugGerade) { state.zugGerade = false; return; }
    const el = ev.target.closest("[data-action]");
    if (state.menue && !ev.target.closest("#menue") && !(el && el.dataset.action === "menue")) {
      state.menue = false;
      render();
      return;
    }
    if (!el) {
      if (ev.target.closest("#haus")) AKTIONEN.schliessen();
      return;
    }
    const f = AKTIONEN[el.dataset.action];
    if (f) ausfuehren(f, el);
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-change]");
    if (el && AENDERUNGEN[el.dataset.change]) ausfuehren(AENDERUNGEN[el.dataset.change], el);
  });

  // ---- Möbel verschieben (nur im Umgestalten-Modus) -------------------------
  // Während des Ziehens wird nur das Attribut transform geändert; gespeichert
  // und neu gezeichnet wird beim Loslassen.
  let zug = null;
  function bildZuSvg(svg, px) {
    return px * svg.viewBox.baseVal.width / svg.getBoundingClientRect().width;
  }
  document.addEventListener("pointerdown", (ev) => {
    const el = ev.target.closest && ev.target.closest("[data-drag]");
    if (!el || !state.umgestalten) return;
    zug = { el: el, id: el.dataset.drag, x0: Number(el.dataset.x), startX: ev.clientX, bewegt: false, neuX: Number(el.dataset.x) };
  });
  document.addEventListener("pointermove", (ev) => {
    if (!zug) return;
    const dx = bildZuSvg(zug.el.ownerSVGElement, ev.clientX - zug.startX);
    if (!zug.bewegt && Math.abs(dx) < 4) return;
    zug.bewegt = true;
    const raum = Haus.LAGE[zug.el.dataset.raum];
    const w = Number(zug.el.dataset.w);
    zug.neuX = Math.max(raum.x + 5, Math.min(zug.x0 + dx, raum.x + raum.w - 5 - w));
    const skal = Number(zug.el.dataset.s);
    zug.el.setAttribute("transform", "translate(" + (Math.round(zug.neuX * 10) / 10) + " " + zug.el.dataset.y + ")" +
      (skal !== 1 ? " scale(" + skal + ")" : ""));
  });
  document.addEventListener("pointerup", () => {
    const z = zug;
    zug = null;
    if (!z || !z.bewegt) return;
    state.zugGerade = true;
    setTimeout(() => { state.zugGerade = false; }, 0);
    const speichern = z.id.indexOf("deko:") === 0
      ? Store.dekoPosition(z.el.dataset.raum, z.id.slice(5), z.neuX)
      : Store.moebelPosition(z.id, z.neuX);
    speichern.then(neuLaden).catch(UI.fehlerMelden);
  });

  // Neuer Tag, während die App offen ist (Tablet an der Wand): neu rechnen
  function tagPruefen() {
    if (state.gerenderterTag !== null && state.gerenderterTag !== heuteEcht()) render();
  }
  setInterval(tagPruefen, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tagPruefen(); });
  global.addEventListener("unhandledrejection", (ev) => UI.fehlerMelden(ev.reason));

  // ---- Menü-Infos: Version, Hinweis zum Installieren ------------------------
  function installiert() {
    return navigator.standalone === true ||
      (global.matchMedia && global.matchMedia("(display-mode: standalone)").matches);
  }

  function menueInfos() {
    $("#version").textContent = "PutzFee " + global.APP_VERSION;
    $("#installieren").innerHTML = installiert() ? "" :
      "<b>📲 Als App nutzen</b>iPad: in Safari auf Teilen ⬆︎ → „Zum Home-Bildschirm“. " +
      "Dann läuft PutzFee auch offline, und Safari räumt die Daten nicht weg.";
  }

  // ---- Service Worker (wie Noten-Fritze) ----------------------------------------
  function serviceWorkerStarten() {
    if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return;
    // Nur wenn schon ein Service Worker steuert, ist ein Wechsel ein Update
    // (und nicht die allererste Installation)
    const schonAktiv = !!navigator.serviceWorker.controller;
    // updateViaCache "none": sonst kommt die per importScripts geladene
    // version.js aus dem HTTP-Cache und der Versionssprung bleibt unbemerkt
    navigator.serviceWorker.register("service-worker.js", { updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch((e) => console.warn("Service Worker:", e));
    if (schonAktiv) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        UI.toast("Neue Version verfügbar", { duration: 15000, aktion: { text: "Neu laden", fn: () => location.reload() } });
      });
    }
  }

  // ---- Start --------------------------------------------------------------
  menueInfos();
  Store.start(heuteEcht())
    .then(neuLaden)
    .then(serviceWorkerStarten)
    .catch((e) => {
      console.error(e);
      $("#haus").innerHTML = '<div class="startfehler"><b>PutzFee kann hier nichts speichern.</b>' +
        "<p>Der Browser erlaubt keinen Speicher (z. B. im privaten Modus). Bitte in einem normalen Fenster öffnen.</p><small>" +
        esc((e && e.message) || e) + "</small></div>";
    });
})(window);
