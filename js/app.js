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
    { key: "wischen", name: "Boden wischen (Flecken)" }
  ];

  const state = {
    daten: { raeume: [], aufgaben: [] },
    versatz: 0,
    auswahl: null,
    fokusMoebel: null,
    menue: false,
    gerenderterTag: null
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
    $("#haus").innerHTML = Haus.render(state.daten, heute(), state.auswahl);
    renderKopf();
    renderPanel();
    $("#menue").className = "menue" + (state.menue ? " offen" : "");
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

  function moebelOptionen() {
    const gruppen = {};
    Object.keys(M.KATALOG).forEach((k) => {
      const d = M.KATALOG[k];
      (gruppen[d.gruppe] = gruppen[d.gruppe] || []).push('<option value="' + k + '">' + d.name + "</option>");
    });
    return '<option value="">– kein Möbelstück –</option>' +
      Object.keys(gruppen).map((gr) => '<optgroup label="' + gr + '">' + gruppen[gr].join("") + "</optgroup>").join("");
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
    const info = Calc.raumStand(state.daten.aufgaben.filter((a) => a.raumId === raum.id), h);
    const aufgaben = state.daten.aufgaben
      .filter((a) => a.raumId === raum.id)
      .map((a) => ({ a: a, st: Calc.aufgabenStand(a, h) }))
      .sort((x, y) => y.st.anteil - x.st.anteil);

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

    s += '<ul class="aufgaben">';
    aufgaben.forEach((x) => {
      const f = Calc.heatFarbe(x.st.anteil);
      const fokus = state.fokusMoebel && x.a.moebel === state.fokusMoebel;
      s += '<li class="' + (x.st.erledigt ? "erledigt" : "offen") + (fokus ? " fokus" : "") + '">' +
        '<span class="punkt" style="background:' + f.fill + ";border-color:" + f.dunkel + '"></span>' +
        '<div class="a-text"><b>' + esc(x.a.titel) + "</b><small>" + Calc.rhythmusText(x.a.rhythmus) + " · " + Calc.standText(x.a, h) + "</small></div>" +
        '<button class="haken" data-action="erledigt" data-id="' + esc(x.a.id) + '"' + (vorschau ? " disabled" : "") +
        ' title="' + (vorschau ? "In der Vorschau nicht möglich" : "Erledigt") + '">✓</button>' +
        '<button class="weg" data-action="loeschen" data-id="' + esc(x.a.id) + '" title="Aufgabe löschen">✕</button></li>';
    });
    s += "</ul>";

    // Neue Aufgabe
    s += '<details class="neu"' + (aufgaben.length ? "" : " open") + "><summary>＋ Neue Aufgabe</summary>" +
      '<label>Vorlage<select data-change="vorlage"><option value="">– eigene Aufgabe –</option>' +
      global.Demo.VORLAGEN.map((v, i) => '<option value="' + i + '">' + esc(v.titel) + " (" + Calc.rhythmusText(v.rhythmus) + ")</option>").join("") +
      "</select></label>" +
      '<label>Titel<input id="f-titel" placeholder="z. B. Fenster putzen"></label>' +
      '<label>Möbelstück (erscheint im Raum)<select id="f-moebel">' + moebelOptionen() + "</select></label>" +
      '<label>Effekt im Raum<select id="f-effekt">' + EFFEKTE.map((e) => '<option value="' + e.key + '">' + e.name + "</option>").join("") + "</select></label>" +
      '<div class="rhythmus"><label class="inline"><input type="radio" name="f-art" value="intervall" checked> alle</label>' +
      '<input id="f-tage" type="number" min="1" max="365" value="7"> Tage</div>' +
      '<div class="rhythmus"><label class="inline"><input type="radio" name="f-art" value="wochentage"> an</label>' +
      [1, 2, 3, 4, 5, 6, 0].map((t) => '<label class="tag"><input type="checkbox" class="f-wt" value="' + t + '">' + Calc.WOCHENTAGE[t] + "</label>").join("") + "</div>" +
      '<button class="primaer" data-action="aufgabe-neu">Aufgabe anlegen</button></details>';

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
    "aufgabe-neu": async () => {
      const titel = $("#f-titel").value.trim();
      if (!titel) { $("#f-titel").focus(); return; }
      const art = document.querySelector('input[name="f-art"]:checked').value;
      const wt = Array.prototype.map.call(document.querySelectorAll(".f-wt:checked"), (c) => Number(c.value));
      if (art === "wochentage" && !wt.length) { UI.toast("Bitte mindestens einen Wochentag wählen."); return; }
      const rhythmus = art === "wochentage"
        ? { art: "wochentage", wochentage: wt }
        : { art: "intervall", tage: Math.max(1, Math.min(365, Math.round(Number($("#f-tage").value)) || 7)) };
      await Store.aufgabeAnlegen({
        raumId: state.auswahl, titel: titel, rhythmus: rhythmus,
        moebel: $("#f-moebel").value || null, effekt: $("#f-effekt").value || null
      });
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
    vorlage: (el) => {
      const v = global.Demo.VORLAGEN[Number(el.value)];
      if (!v) return;
      $("#f-titel").value = v.titel;
      $("#f-moebel").value = v.moebel || "";
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

  // Neuer Tag, während die App offen ist (Tablet an der Wand): neu rechnen
  function tagPruefen() {
    if (state.gerenderterTag !== null && state.gerenderterTag !== heuteEcht()) render();
  }
  setInterval(tagPruefen, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tagPruefen(); });
  global.addEventListener("unhandledrejection", (ev) => UI.fehlerMelden(ev.reason));

  // ---- Start --------------------------------------------------------------
  Store.start(heuteEcht())
    .then(neuLaden)
    .catch((e) => {
      console.error(e);
      $("#haus").innerHTML = '<div class="startfehler"><b>PutzFee kann hier nichts speichern.</b>' +
        "<p>Der Browser erlaubt keinen Speicher (z. B. im privaten Modus). Bitte in einem normalen Fenster öffnen.</p><small>" +
        esc((e && e.message) || e) + "</small></div>";
    });
})(window);
