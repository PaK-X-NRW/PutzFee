/* =====================================================================
   app.js – Prototyp: Zustand, Raum-Panel, Zeitsteuerung, Delegation
   ---------------------------------------------------------------------
   Daten liegen im Prototyp nur im Arbeitsspeicher (Neuladen = Demo neu).
   Interaktion über data-action + zentrale Delegation (wie Noten-Fritze).
   ===================================================================== */
(function (global) {
  "use strict";

  const Calc = global.Calc;
  const Haus = global.Haus;
  const M = global.Moebel;
  const esc = Haus.esc;

  const EFFEKTE = [
    { key: "", name: "– kein Effekt –" },
    { key: "aufraeumen", name: "Aufräumen (Unordnung)" },
    { key: "staubwischen", name: "Staub wischen (Spinnweben)" },
    { key: "staubsaugen", name: "Staubsaugen (Wollmäuse)" },
    { key: "wischen", name: "Boden wischen (Flecken)" }
  ];

  const heuteEcht = Calc.tagNr(new Date());
  const state = {
    daten: global.Demo.daten(heuteEcht),
    versatz: 0,
    auswahl: null,
    fokusMoebel: null
  };

  function heute() { return heuteEcht + state.versatz; }
  function $(sel) { return document.querySelector(sel); }

  // ---- Render -----------------------------------------------------------
  function render() {
    $("#haus").innerHTML = Haus.render(state.daten, heute(), state.auswahl);
    renderKopf();
    renderPanel();
  }

  function renderKopf() {
    const d = Calc.datumVon(heute());
    $("#datum").textContent = d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) +
      (state.versatz ? " (" + (state.versatz > 0 ? "+" : "") + state.versatz + " Tage)" : "");
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
        '<button class="haken" data-action="erledigt" data-id="' + x.a.id + '" title="Erledigt">✓</button>' +
        '<button class="weg" data-action="loeschen" data-id="' + x.a.id + '" title="Aufgabe löschen">✕</button></li>';
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
    const deko = state.daten.deko[raum.id] || [];
    s += '<h3>Deko</h3><div class="chips">' + Object.keys(M.DEKO).map((k) =>
      '<button class="chip' + (deko.indexOf(k) >= 0 ? " an" : "") + '" data-action="deko" data-key="' + k + '">' + M.DEKO[k].name + "</button>").join("") + "</div>";

    panel.className = "panel offen " + seite;
    panel.innerHTML = s;
  }

  // ---- Aktionen -----------------------------------------------------------
  const AKTIONEN = {
    raum: (el) => { state.auswahl = el.dataset.id; state.fokusMoebel = null; render(); },
    moebel: (el) => { state.auswahl = el.dataset.raum; state.fokusMoebel = el.dataset.key; render(); },
    schliessen: () => { state.auswahl = null; state.fokusMoebel = null; render(); },
    tag: (el) => { state.versatz += Number(el.dataset.d); render(); },
    heute: () => { state.versatz = 0; render(); },
    erledigt: (el) => {
      const a = state.daten.aufgaben.find((x) => x.id === el.dataset.id);
      if (a) a.zuletzt = heute();
      render();
    },
    loeschen: (el) => {
      state.daten.aufgaben = state.daten.aufgaben.filter((x) => x.id !== el.dataset.id);
      render();
    },
    deko: (el) => {
      const liste = state.daten.deko[state.auswahl] = state.daten.deko[state.auswahl] || [];
      const i = liste.indexOf(el.dataset.key);
      if (i >= 0) liste.splice(i, 1); else liste.push(el.dataset.key);
      render();
    },
    "aufgabe-neu": () => {
      const titel = $("#f-titel").value.trim();
      if (!titel) { $("#f-titel").focus(); return; }
      const art = document.querySelector('input[name="f-art"]:checked').value;
      const wt = Array.prototype.map.call(document.querySelectorAll(".f-wt:checked"), (c) => Number(c.value));
      const rhythmus = art === "wochentage" && wt.length
        ? { art: "wochentage", wochentage: wt }
        : { art: "intervall", tage: Math.max(1, Math.min(365, Number($("#f-tage").value) || 7)) };
      state.daten.aufgaben.push({
        id: "a" + (state.daten.naechsteId++), raumId: state.auswahl, titel: titel,
        moebel: $("#f-moebel").value || null, effekt: $("#f-effekt").value || null,
        rhythmus: rhythmus, zuletzt: null
      });
      render();
    }
  };

  const AENDERUNGEN = {
    umbenennen: (el) => {
      const raum = state.daten.raeume.find((r) => r.id === state.auswahl);
      if (raum && el.value.trim()) raum.name = el.value.trim();
      render();
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
    }
  };

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-action]");
    if (!el) {
      if (ev.target.closest("#haus")) AKTIONEN.schliessen();
      return;
    }
    const f = AKTIONEN[el.dataset.action];
    if (f) f(el);
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-change]");
    if (el && AENDERUNGEN[el.dataset.change]) AENDERUNGEN[el.dataset.change](el);
  });

  render();
})(window);
