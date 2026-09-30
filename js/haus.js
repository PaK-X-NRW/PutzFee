/* =====================================================================
   haus.js – Hausansicht (Puppenhaus-Querschnitt als SVG)
   ---------------------------------------------------------------------
   - LAGE: feste Plätze der Räume im Haus (Dachboden, OG, EG, Keller,
     Garage, Balkon, Garten). Räume tragen nur Typ und Namen, die
     Position kommt von hier – Umbenennen ändert nichts am Plan.
   - render(daten, heute, auswahl): baut das komplette SVG
     Je Raum: Wand in Heatmap-Farbe (leer = grau), Boden, Schild mit
     Prozentanzeige und Spruch, Möbel aus den Aufgaben (+ Deko),
     Effekte (Spinnweben, Wollmäuse, Flecken, tägliche Unordnung),
     Belohnung + Haustier ab „sauber", Totenschädel bei 0 %, Fee bei 100 %.
   ===================================================================== */
(function (global) {
  "use strict";

  const Calc = global.Calc;
  const M = global.Moebel;
  const r1 = M.r1;

  function zelle(x, y, w, h) { return { x: x + 5, y: y + 5, w: w - 10, h: h - 10 }; }

  const LAGE = {
    dachboden: zelle(390, 125, 820, 135),
    schlafzimmer: zelle(300, 260, 260, 190),
    kinder1: zelle(560, 260, 200, 190),
    kinder2: zelle(760, 260, 200, 190),
    bad: zelle(960, 260, 190, 190),
    frei1: zelle(1150, 260, 150, 190),
    flur: zelle(300, 450, 120, 190),
    wohnzimmer: zelle(420, 450, 300, 190),
    esszimmer: zelle(720, 450, 210, 190),
    kueche: zelle(930, 450, 240, 190),
    gaestewc: zelle(1170, 450, 130, 190),
    keller: zelle(300, 645, 700, 160),
    frei2: zelle(1000, 645, 300, 160),
    garage: zelle(85, 460, 205, 180),
    balkon: { x: 1312, y: 265, w: 140, h: 190 },
    garten: { x: 1330, y: 460, w: 262, h: 185 }
  };

  const DRAUSSEN = { garten: true, balkon: true };

  const MUSTER = {
    wohnzimmer: "streifen", esszimmer: "streifen", schlafzimmer: "streifen", flur: "streifen",
    kinderzimmer: "punkte", frei: "punkte", bad: "fliesen", gaestewc: "fliesen", kueche: "fliesen",
    keller: "ziegel", garage: "ziegel", dachboden: "bretter"
  };

  const BODEN = {
    bad: "fliese", gaestewc: "fliese", kueche: "fliese", keller: "beton", garage: "beton",
    garten: "gras", balkon: "platte"
  };

  const BELOHNUNG_JE_RAUM = {
    kueche: { item: "kessel", auf: ["herd", "spuele", "waschmaschine"] },
    esszimmer: { item: "kaffee", auf: ["esstisch"] },
    wohnzimmer: { item: "vase", auf: ["kommode", "schreibtisch"] },
    schlafzimmer: { item: "teddy", auf: ["bett"] },
    kinderzimmer: { item: "teddy", auf: ["kinderbett", "bett"] },
    bad: { item: "ente", auf: ["badewanne", "waschbecken"] },
    gaestewc: { item: "vase", auf: ["waschbecken"] },
    flur: { item: "vase", auf: ["schuhregal", "kommode"] },
    garten: { item: "sonnenblume", auf: [] },
    balkon: { item: "schmetterling", auf: [], schwebt: true }
  };

  const BAUM = '<rect x="1556" y="520" width="14" height="112" fill="#8a5a3b"/><circle cx="1563" cy="505" r="34" fill="#6a994e"/>' +
    '<circle cx="1540" cy="525" r="22" fill="#81b29a"/><circle cx="1583" cy="527" r="20" fill="#81b29a"/>';

  // Wo sich Haustiere am liebsten aufhalten (bei gleicher Sauberkeit)
  const LIEBLINGSORTE = ["wohnzimmer", "schlafzimmer", "kinderzimmer", "esszimmer", "kueche", "flur", "garten", "balkon"];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function g(x, y, s, inhalt, extra) {
    return "<g" + (extra || "") + ' transform="translate(' + r1(x) + " " + r1(y) + ")" + (s !== 1 ? " scale(" + (Math.round(s * 1000) / 1000) + ")" : "") + '">' + inhalt + "</g>";
  }

  // ---- Kulisse --------------------------------------------------------
  function defs() {
    return "<defs>" +
      '<linearGradient id="himmel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f5"/><stop offset="1" stop-color="#eef8fb"/></linearGradient>' +
      '<pattern id="m-streifen" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="8" height="16" fill="#ffffff" opacity=".28"/></pattern>' +
      '<pattern id="m-punkte" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="2.4" fill="#ffffff" opacity=".65"/></pattern>' +
      '<pattern id="m-fliesen" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.5"/></pattern>' +
      '<pattern id="m-ziegel" width="30" height="16" patternUnits="userSpaceOnUse"><path d="M0 0H30M0 8H30M10 0V8M25 8V16" stroke="#000" stroke-opacity=".09" fill="none"/></pattern>' +
      '<pattern id="m-bretter" width="22" height="10" patternUnits="userSpaceOnUse"><path d="M0 0V10" stroke="#000" stroke-opacity=".09"/></pattern>' +
      '<pattern id="m-dach" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#c75b4a"/><path d="M0 12 Q6 2 12 12 Q18 2 24 12" fill="#b24c3d" stroke="#9c3f33" stroke-width="1"/></pattern>' +
      '<pattern id="m-erde" width="40" height="30" patternUnits="userSpaceOnUse"><rect width="40" height="30" fill="#9c6b45"/><circle cx="8" cy="8" r="2" fill="#8a5c3a"/><circle cx="28" cy="20" r="3" fill="#8a5c3a"/><circle cx="34" cy="5" r="1.5" fill="#b07d55"/></pattern>' +
      "</defs>";
  }

  function wolke(x, y, s) {
    return g(x, y, s, '<g fill="#ffffff" opacity=".9"><ellipse cx="0" cy="0" rx="34" ry="14"/><ellipse cx="-18" cy="-8" rx="18" ry="14"/><ellipse cx="12" cy="-14" rx="22" ry="17"/></g>');
  }

  function kulisse() {
    let s = '<rect x="0" y="0" width="1600" height="640" fill="url(#himmel)"/>';
    s += g(1500, 80, 1, '<circle r="34" fill="#ffd166"/><g stroke="#ffd166" stroke-width="4" stroke-linecap="round"><path d="M0 -48V-58M0 48V58M-48 0H-58M48 0H58M-34 -34L-41 -41M34 34L41 41M-34 34L-41 41M34 -34L41 -41"/></g>');
    s += wolke(160, 110, 1) + wolke(420, 60, 0.7) + wolke(1340, 170, 0.8);
    // Erde + Wiese
    s += '<rect x="0" y="640" width="1600" height="190" fill="url(#m-erde)"/>';
    s += '<path d="M0 634 Q20 626 40 634 T80 634 T120 634 T160 634 T200 634 T240 634 T280 634 V648 H0Z M1310 634 Q1330 626 1350 634 T1390 634 T1430 634 T1470 634 T1510 634 T1550 634 T1600 634 V648 H1310Z" fill="#7cb35a"/>';
    // Gartenzaun
    let zaun = "";
    for (let x = 1342; x < 1590; x += 16) zaun += '<path d="M' + x + " 632 V590 L" + (x + 5) + " 583 L" + (x + 10) + " 590 V632Z" + '"/>';
    s += '<g fill="#ffffff" stroke="#c9b8a3" stroke-width="1.2">' + zaun + '<rect x="1336" y="598" width="254" height="5"/><rect x="1336" y="618" width="254" height="5"/></g>';
    // Garage + Haus-Rahmen
    s += '<rect x="80" y="455" width="215" height="185" rx="4" fill="#8a5a3b"/><rect x="72" y="447" width="231" height="12" rx="4" fill="#6f4a31"/>';
    s += '<rect x="290" y="250" width="1020" height="560" rx="4" fill="#8a5a3b"/>';
    // Balkonplatte
    s += '<rect x="1305" y="445" width="152" height="12" rx="3" fill="#8a5a3b"/>';
    // Dach (Mansarde) mit Schornstein und Rundfenster
    s += '<path d="M268 262 L370 118 L1230 118 L1332 262Z" fill="url(#m-dach)" stroke="#8a3a2e" stroke-width="3" stroke-linejoin="round"/>';
    s += '<rect x="1020" y="52" width="40" height="60" fill="#b5654f" stroke="#8a3a2e" stroke-width="3"/><rect x="1014" y="46" width="52" height="10" fill="#8a3a2e"/>';
    s += '<path d="M352 124 L800 36 L1248 124Z" fill="url(#m-dach)" stroke="#8a3a2e" stroke-width="3" stroke-linejoin="round"/>';
    s += '<circle cx="800" cy="92" r="15" fill="#cfe9f7" stroke="#8a5a3b" stroke-width="4"/><path d="M785 92H815M800 77V107" stroke="#8a5a3b" stroke-width="2"/>';
    return s;
  }

  // ---- Raum-Bausteine -------------------------------------------------
  function wand(raum, geo, farbe) {
    if (DRAUSSEN[raum.typ]) {
      return '<rect x="' + geo.x + '" y="' + geo.y + '" width="' + geo.w + '" height="' + geo.h + '" rx="6" fill="' + farbe.fill + '" opacity=".22"/>';
    }
    const muster = MUSTER[raum.typ] || "punkte";
    return '<rect x="' + geo.x + '" y="' + geo.y + '" width="' + geo.w + '" height="' + geo.h + '" fill="' + farbe.wand + '"/>' +
      '<rect x="' + geo.x + '" y="' + geo.y + '" width="' + geo.w + '" height="' + geo.h + '" fill="url(#m-' + muster + ')"/>' +
      '<rect x="' + geo.x + '" y="' + geo.y + '" width="' + geo.w + '" height="10" fill="#000" opacity=".05"/>';
  }

  function boden(raum, geo, bodenY) {
    const art = BODEN[raum.typ] || "holz";
    const farben = { holz: ["#c89b6d", "#a97c50", 34], fliese: ["#ebe6dc", "#cfc6b8", 14], beton: ["#b8b1a7", "#a39c92", 60], gras: ["#7cb35a", "#6a9c4b", 12], platte: ["#9b6b4a", "#8a5a3b", 40] };
    const f = farben[art];
    let s = '<rect x="' + geo.x + '" y="' + bodenY + '" width="' + geo.w + '" height="10" fill="' + f[0] + '"/>';
    let d = "";
    for (let x = geo.x + f[2]; x < geo.x + geo.w; x += f[2]) d += "M" + x + " " + bodenY + "v10";
    s += '<path d="' + d + 'M' + geo.x + " " + bodenY + "h" + geo.w + '" stroke="' + f[1] + '" stroke-width="1.2"/>';
    return s;
  }

  function schild(raum, geo, info) {
    const sw = Math.min(geo.w - 16, 196);
    const sx = geo.x + (geo.w - sw) / 2;
    const sy = geo.y + 8;
    const leer = info.status === "leer";
    const bio = info.status === "biohazard";
    const mitZeile = !leer && (geo.w >= 190 || bio);
    const sh = mitZeile ? 46 : 34;
    const maxZeichen = Math.floor((sw - 10) / 7);
    const name = raum.name.length > maxZeichen ? raum.name.slice(0, maxZeichen - 1) + "…" : raum.name;

    let s = '<g class="schild">';
    s += '<path d="M' + r1(sx + 14) + " " + geo.y + "V" + sy + "M" + r1(sx + sw - 14) + " " + geo.y + "V" + sy + '" stroke="#8a5a3b" stroke-width="1.5"/>';
    s += '<rect x="' + r1(sx) + '" y="' + sy + '" width="' + sw + '" height="' + sh + '" rx="7" fill="' + (bio ? "#fff0ee" : "#fffaf0") +
      '" stroke="' + (bio ? "#d62828" : "#8a5a3b") + '" stroke-width="2"/>';
    s += '<text x="' + r1(sx + sw / 2) + '" y="' + (sy + 14) + '" class="schild-name">' + esc(name) + "</text>";
    if (leer) {
      s += '<text x="' + r1(sx + sw / 2) + '" y="' + (sy + 28) + '" class="schild-leer">keine Aufgaben</text>';
    } else {
      const bx = sx + 8;
      const bw = sw - 16 - 34;
      const by = sy + 20;
      const balken = Calc.heatFarbe(1 - info.quote);
      s += '<rect x="' + r1(bx) + '" y="' + by + '" width="' + r1(bw) + '" height="8" rx="4" fill="#eee4d4"/>';
      if (info.quote > 0) s += '<rect x="' + r1(bx) + '" y="' + by + '" width="' + r1(Math.max(8, bw * info.quote)) + '" height="8" rx="4" fill="' + balken.fill + '" stroke="' + balken.dunkel + '" stroke-width="1"/>';
      s += '<text x="' + r1(sx + sw - 7) + '" y="' + (by + 8) + '" class="schild-prozent">' + Math.round(info.quote * 100) + " %</text>";
      if (mitZeile) {
        s += bio
          ? '<text x="' + r1(sx + sw / 2) + '" y="' + (sy + 41) + '" class="schild-bio">☣ BIOHAZARD ☣</text>'
          : '<text x="' + r1(sx + sw / 2) + '" y="' + (sy + 41) + '" class="schild-spruch">' + esc(info.spruch) + "</text>";
      }
    }
    return { svg: s + "</g>", unten: sy + sh };
  }

  // Möbel nebeneinander auf den Boden stellen; hohe Möbel an die Ränder
  function anordnen(geo, eintraege, s0) {
    const hoch = eintraege.filter((e) => e.def.h >= 90);
    const reihe = eintraege.filter((e) => e.def.h < 90);
    hoch.forEach((e, i) => { if (i % 2 === 0) reihe.unshift(e); else reihe.push(e); });
    const n = reihe.length;
    if (!n) return [];
    const rand = 8;
    const platz = geo.w - 2 * rand;
    const summe = reihe.reduce((a, e) => a + e.def.w, 0);
    let s = s0;
    if (summe * s + 6 * (n + 1) > platz) s = (platz - 6 * (n + 1)) / summe;
    const luecke = (platz - summe * s) / (n + 1);
    let x = geo.x + rand + luecke;
    return reihe.map((e) => {
      const p = { key: e.key, def: e.def, deko: e.deko, farbe: e.farbe, x: x, w: e.def.w * s, h: e.def.h * s, s: s };
      x += p.w + luecke;
      return p;
    });
  }

  function verteilen(rnd, geo, breite) {
    return geo.x + 10 + rnd() * Math.max(0, geo.w - 20 - breite);
  }

  // ---- Ein Raum ---------------------------------------------------------
  function raumSVG(raum, geo, info, aufgaben, deko, heute, tiere, gewaehlt) {
    const draussen = !!DRAUSSEN[raum.typ];
    const bodenY = geo.y + geo.h - 10;
    const s0 = Math.min(1, (geo.h - 10 - 58) / 112);
    const raumFarbe = Calc.heatFarbe(info.heat);

    // Möbel aus den Aufgaben (gleiches Möbel = eins, Farbe = dringendste Aufgabe)
    const moebel = {};
    const effekte = { staubwischen: [], staubsaugen: [], wischen: [], aufraeumen: [] };
    aufgaben.forEach((a) => {
      const st = Calc.aufgabenStand(a, heute);
      if (a.moebel && M.KATALOG[a.moebel]) {
        if (!moebel[a.moebel] || moebel[a.moebel].anteil < st.anteil) moebel[a.moebel] = { anteil: st.anteil };
      }
      if (a.effekt && effekte[a.effekt]) effekte[a.effekt].push({ aufgabe: a, stand: st });
    });

    const boden0 = [];
    const wand0 = [];
    const flaechen = [];
    Object.keys(moebel).forEach((key) => {
      const def = M.KATALOG[key];
      const e = { key: key, def: def, farbe: Calc.heatFarbe(moebel[key].anteil) };
      if (def.art === "wand") wand0.push(e);
      else if (def.art === "flaeche") flaechen.push(e);
      else boden0.push(e);
    });
    deko.forEach((key) => {
      const def = M.DEKO[key];
      if (!def) return;
      const e = { key: key, def: def, deko: true };
      if (def.art === "wand") wand0.push(e);
      else boden0.push(e);
    });

    let s = '<g class="raum' + (gewaehlt ? " gewaehlt" : "") + '" data-action="raum" data-id="' + raum.id + '"><title>' + esc(raum.name) + "</title>";
    s += wand(raum, geo, raumFarbe);
    if (raum.typ === "garten") s += BAUM;
    s += boden(raum, geo, bodenY);

    // Spinnweben (staubwischen): wachsen mit der Dringlichkeit
    let webAnteil = 0;
    effekte.staubwischen.forEach((e) => { webAnteil = Math.max(webAnteil, e.stand.anteil); });
    let webs = "";
    if (webAnteil > 0.35) {
      const gr = Math.round((16 + Math.min(1.3, webAnteil) * 24) * Math.max(0.7, s0));
      const op = Math.min(1, (webAnteil - 0.2) * 1.4);
      const spinne = webAnteil >= 1;
      webs = '<g opacity="' + r1(op) + '">' + g(geo.x, geo.y, 1, M.spinnweben(gr, spinne)) +
        '<g transform="translate(' + (geo.x + geo.w) + " " + geo.y + ') scale(-1 1)">' + M.spinnweben(gr * 0.85, false) + "</g></g>";
    }

    const sch = schild(raum, geo, info);

    // Wand-Gegenstände unterhalb des Schilds verteilen
    const wandOben = sch.unten + 8;
    wand0.forEach((e, i) => {
      const w = e.def.w * s0;
      const x = geo.x + (i + 1) * geo.w / (wand0.length + 1) - w / 2;
      const inhalt = e.deko ? e.def.zeichnen() : e.def.zeichnen(e.farbe);
      s += e.deko ? g(x, wandOben + e.def.h * s0, s0, inhalt)
        : g(x, wandOben + e.def.h * s0, s0, inhalt + "<title>" + e.def.name + "</title>", ' class="moebel" data-action="moebel" data-raum="' + raum.id + '" data-key="' + e.key + '"');
    });

    s += webs + sch.svg;

    // Flächen (Teppich, Rasen)
    flaechen.forEach((e) => {
      const attr = ' class="moebel" data-action="moebel" data-raum="' + raum.id + '" data-key="' + e.key + '"';
      if (e.def.breit) {
        s += g(geo.x, bodenY + 1, 1, e.def.zeichnen(e.farbe, geo.w) + "<title>" + e.def.name + "</title>", attr);
      } else {
        const w = e.def.w * s0;
        s += g(geo.x + (geo.w - w) / 2, bodenY + 4, s0, e.def.zeichnen(e.farbe) + "<title>" + e.def.name + "</title>", attr);
      }
    });

    // Bodenmöbel
    const plaetze = anordnen(geo, boden0, s0);
    const platzVon = {};
    plaetze.forEach((p) => {
      platzVon[p.key] = p;
      if (p.deko) {
        s += g(p.x, bodenY, p.s, p.def.zeichnen());
      } else {
        s += g(p.x, bodenY, p.s, p.def.zeichnen(p.farbe) + "<title>" + p.def.name + "</title>",
          ' class="moebel" data-action="moebel" data-raum="' + raum.id + '" data-key="' + p.key + '"');
      }
    });
    const fs = plaetze.length ? plaetze[0].s : s0;

    // Wollmäuse (staubsaugen) und Flecken (wischen)
    effekte.staubsaugen.forEach((e) => {
      const n = e.stand.anteil < 0.4 ? 0 : Math.min(6, Math.ceil((e.stand.anteil - 0.3) * 5));
      const rnd = Calc.zufall("staub" + raum.id + e.aufgabe.id + e.aufgabe.zuletzt);
      for (let i = 0; i < n; i++) s += g(verteilen(rnd, geo, 26 * fs), bodenY + 4, Math.max(0.75, fs), M.wollmaus());
    });
    effekte.wischen.forEach((e) => {
      const n = e.stand.anteil < 0.4 ? 0 : Math.min(5, Math.ceil((e.stand.anteil - 0.3) * 4));
      const rnd = Calc.zufall("fleck" + raum.id + e.aufgabe.id + e.aufgabe.zuletzt);
      for (let i = 0; i < n; i++) s += g(verteilen(rnd, geo, 40), bodenY + 6, 1, M.fleck(rnd()));
    });

    // Tägliche Unordnung (aufräumen): jeden Morgen neu, weg sobald erledigt
    effekte.aufraeumen.forEach((e) => {
      if (e.stand.erledigt) return;
      const pool = M.UNORDNUNG_JE_RAUM[raum.typ] || M.UNORDNUNG_JE_RAUM.standard;
      const rnd = Calc.zufall("chaos" + raum.id + heute);
      const n = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const teil = M.UNORDNUNG[pool[Math.floor(rnd() * pool.length)]];
        s += g(verteilen(rnd, geo, teil.w * fs), bodenY + 2, Math.max(0.8, fs), teil.zeichnen());
      }
    });

    // Belohnung + Haustiere, sobald der Raum mindestens sauber ist
    if (Calc.istSauber(info.status)) {
      const b = BELOHNUNG_JE_RAUM[raum.typ] || { item: "glitzer", auf: [] };
      const item = M.BELOHNUNG[b.item];
      const sc = Math.max(0.8, fs);
      const anker = b.auf.map((k) => platzVon[k]).filter(Boolean)[0];
      if (anker && anker.def.ablage) {
        s += g(anker.x + anker.w * 0.62 - item.w * sc / 2, bodenY + anker.def.ablage * anker.s, sc, item.zeichnen());
      } else if (b.schwebt) {
        s += g(geo.x + geo.w * 0.3, bodenY - 70 * s0, 1, '<g class="schwebt">' + item.zeichnen() + "</g>");
      } else {
        s += g(geo.x + geo.w * 0.8 - item.w * sc / 2, bodenY, sc, item.zeichnen());
      }
      if (raum.typ === "garten") s += g(geo.x + geo.w * 0.45, bodenY - 90, 1, '<g class="schwebt">' + M.BELOHNUNG.schmetterling.zeichnen() + "</g>");
    }
    tiere.forEach((tier, i) => {
      const t = M.TIERE[tier];
      const sc = Math.max(0.8, fs);
      let platz = null;
      if (tier === "katze") platz = platzVon.sofa || platzVon.bett || platzVon.kinderbett || platzVon.kratzbaum;
      if (tier === "hund") platz = platzVon.hundekorb;
      if (platz && platz.def.ablage) {
        s += g(platz.x + platz.w * 0.35, bodenY + platz.def.ablage * platz.s + 2, sc, t.zeichnen());
      } else if (platz) {
        s += g(platz.x + platz.w * 0.2, bodenY - 4 * sc, sc, t.zeichnen());
      } else {
        s += g(geo.x + geo.w * (0.3 + i * 0.3), bodenY, sc, t.zeichnen());
      }
    });

    // Schweben: Totenschädel bei 0 %, Fee bei 100 %
    const mitteY = Math.min(sch.unten + 30, bodenY - 30);
    if (info.status === "biohazard") s += g(geo.x + geo.w / 2, mitteY, Math.max(0.8, s0), '<g class="schwebt">' + M.schaedel() + "</g>");
    const feeX = geo.w >= 200 ? geo.x + geo.w * 0.7 : geo.x + geo.w / 2;
    if (info.status === "blitzsauber") s += g(feeX, mitteY, Math.max(0.8, s0), '<g class="schwebt">' + M.fee() + "</g>");

    // Balkongeländer vor dem Inhalt
    if (raum.typ === "balkon") {
      let d = "M" + geo.x + " " + (bodenY - 34) + "h" + geo.w;
      for (let x = geo.x + 6; x < geo.x + geo.w; x += 12) d += "M" + x + " " + (bodenY - 34) + "V" + bodenY;
      s += '<path d="' + d + '" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><path d="' + d + '" stroke="#8a5a3b" stroke-width="1" fill="none"/>';
    }

    if (gewaehlt) {
      s += '<rect x="' + (geo.x + 2) + '" y="' + (geo.y + 2) + '" width="' + (geo.w - 4) + '" height="' + (geo.h - 4) +
        '" rx="6" fill="none" stroke="#ffb703" stroke-width="4" stroke-dasharray="10 6" class="auswahl"/>';
    }
    return s + "</g>";
  }

  // Haustiere ziehen in die saubersten Räume (je Tier ein Raum)
  function tierePlatzieren(daten, infos) {
    const arten = {};
    daten.aufgaben.forEach((a) => {
      const def = M.KATALOG[a.moebel];
      if (def && def.tier && M.TIERE[def.tier]) arten[def.tier] = true;
    });
    const kandidaten = daten.raeume
      .filter((r) => Calc.istSauber(infos[r.id].status) && LIEBLINGSORTE.indexOf(r.typ) >= 0)
      .sort((a, b) => (LIEBLINGSORTE.indexOf(a.typ) - LIEBLINGSORTE.indexOf(b.typ)) || (infos[b.id].quote - infos[a.id].quote));
    const ergebnis = {};
    Object.keys(arten).forEach((tier, i) => {
      if (!kandidaten.length) return;
      const r = kandidaten[Math.min(i, kandidaten.length - 1)];
      (ergebnis[r.id] = ergebnis[r.id] || []).push(tier);
    });
    return ergebnis;
  }

  function staende(daten, heute) {
    const infos = {};
    daten.raeume.forEach((r) => {
      infos[r.id] = Calc.raumStand(daten.aufgaben.filter((a) => a.raumId === r.id), heute);
    });
    return infos;
  }

  function render(daten, heute, auswahl) {
    const infos = staende(daten, heute);
    const tiere = tierePlatzieren(daten, infos);
    let s = '<svg viewBox="0 0 1600 830" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Puppenhaus">' + defs() + kulisse();
    daten.raeume.forEach((r) => {
      const geo = LAGE[r.id];
      if (!geo) return;
      const aufgaben = daten.aufgaben.filter((a) => a.raumId === r.id);
      s += raumSVG(r, geo, infos[r.id], aufgaben, r.deko || [], heute, tiere[r.id] || [], auswahl === r.id);
    });
    return s + "</svg>";
  }

  global.Haus = {
    LAGE: LAGE,
    render: render,
    staende: staende,
    esc: esc
  };
})(window);
