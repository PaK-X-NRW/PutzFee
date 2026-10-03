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
    rumpelkammer: zelle(420, 125, 130, 135),
    dachzimmer1: zelle(550, 125, 290, 135),
    dachzimmer2: zelle(840, 125, 290, 135),
    buero: zelle(1130, 125, 225, 135),
    schlafzimmer: zelle(420, 260, 260, 190),
    kinder1: zelle(680, 260, 200, 190),
    kinder2: zelle(880, 260, 200, 190),
    bad: zelle(1080, 260, 190, 190),
    frei1: zelle(1270, 260, 150, 190),
    flur: zelle(300, 450, 120, 190),
    wohnzimmer: zelle(420, 450, 330, 190),
    esszimmer: zelle(750, 450, 240, 190),
    kueche: zelle(990, 450, 270, 190),
    gaestewc: zelle(1260, 450, 160, 190),
    keller: zelle(420, 645, 333, 160),
    keller2: zelle(753, 645, 333, 160),
    frei2: zelle(1086, 645, 334, 160),
    garage: zelle(85, 460, 205, 180),
    balkon: { x: 1432, y: 265, w: 140, h: 190 },
    garten: { x: 1450, y: 460, w: 262, h: 185 }
  };

  const DRAUSSEN = { garten: true, balkon: true };

  const MUSTER = {
    wohnzimmer: "streifen", esszimmer: "streifen", schlafzimmer: "streifen", flur: "streifen",
    kinderzimmer: "punkte", frei: "punkte", bad: "fliesen", gaestewc: "fliesen", kueche: "fliesen",
    keller: "ziegel", garage: "ziegel", rumpelkammer: "bretter", dachzimmer: "bretter", buero: "streifen"
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

  const BAUM = '<rect x="1676" y="520" width="14" height="112" fill="#8a5a3b"/><circle cx="1683" cy="505" r="34" fill="#6a994e"/>' +
    '<circle cx="1660" cy="525" r="22" fill="#81b29a"/><circle cx="1703" cy="527" r="20" fill="#81b29a"/>';

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

  // ---- Treppenhaus: der Flur reicht vom Dachboden bis zum Keller ---------
  const TREPPE_X = 300;
  const TREPPE_W = 120;
  // Etagen von unten nach oben. boden = Fußbodenhöhe (wie bodenY der Räume),
  // oben = Fußbodenhöhe der nächsten Etage (Dachboden: nur Podest)
  const ETAGEN = [
    { key: "keller", name: "Keller", boden: 795, oben: 630 },
    { key: "eg", name: "Erdgeschoss", boden: 630, oben: 440 },
    { key: "og", name: "Obergeschoss", boden: 440, oben: 250 },
    { key: "dach", name: "Dachboden", boden: 250, oben: null }
  ];

  function treppenhausWand() {
    // Schacht beginnt beim Dachboden-Fußboden (darüber ist nur Dach)
    return '<rect x="' + TREPPE_X + '" y="250" width="' + TREPPE_W + '" height="560" fill="#efe3d0"/>';
  }

  // Ein Abschnitt je Etage: Podest, Lauf links→rechts bis zum Zwischenpodest,
  // Lauf rechts→links bis zur nächsten Etage. Antippbar als Möbelstück „treppe“.
  // Treppe wie im Bauplan: je Geschoss ein gerader Lauf von der Decke unten nach
  // rechts oben. Stufenlinie, schräge Wange darunter, Geschossdecken als Doppellinie.
  // Die Stufen tragen die Heatmap-Farbe der Treppen-Aufgabe, der Rest ist dünn und braun.
  function treppenabschnitt(e, farbe) {
    const yB = e.boden;
    const strich = "#7a5f4e";
    const x0 = 306;
    const x1 = 414;
    let d = "";
    let wange = "";
    if (e.oben != null) {
      const n = 8;
      const sh = (yB - e.oben) / n;
      const sw = (x1 - x0) / n;
      d = "M" + x0 + " " + yB;
      for (let i = 0; i < n; i++) d += " V" + r1(yB - (i + 1) * sh) + " H" + r1(x0 + (i + 1) * sw);
      // Wange: schräge Linie leicht unterhalb der Stufen
      wange = "M" + x0 + " " + r1(yB + 6) + " L" + x1 + " " + r1(e.oben + 6);
    }
    // Unsichtbare Trefferfläche um den Lauf (oder die Decke), damit sie antippbar ist
    const treffer = d
      ? '<path d="' + d + '" fill="none" stroke="transparent" stroke-width="22"/>'
      : '<rect x="' + TREPPE_X + '" y="' + (yB - 16) + '" width="' + TREPPE_W + '" height="26" fill="transparent"/>';
    let s = treffer;
    if (d) {
      // Körper weiß ausgemalt: zwischen Stufenlinie und Wange
      const koerper = d + " L" + x1 + " " + r1(e.oben + 6) + " L" + x0 + " " + r1(yB + 6) + " Z";
      s += '<path d="' + koerper + '" fill="#ffffff" stroke="none"/>' +
        '<path d="' + d + '" fill="none" stroke="' + (farbe ? farbe.dunkel : strich) + '" stroke-width="2"/>' +
        '<path d="' + wange + '" fill="none" stroke="' + strich + '" stroke-width="1"/>';
    }
    // Geschossdecke als Doppellinie
    s += '<path d="M' + TREPPE_X + " " + yB + "H" + (TREPPE_X + TREPPE_W) + " M" + TREPPE_X + " " + (yB + 4) + "H" + (TREPPE_X + TREPPE_W) +
      '" fill="none" stroke="' + strich + '" stroke-width="1"/>';
    return '<g class="moebel" data-action="moebel" data-raum="flur" data-key="treppe-' + e.key + '"><title>Treppe · ' + e.name + "</title>" + s + "</g>";
  }

  // Treppen liegen hinter den Möbeln des Flurs. Farbe = Aufgabe „Treppe putzen“ dieser Etage
  function treppenhaus(aufgaben, heute) {
    const stand = {};
    aufgaben.forEach((a) => {
      if (a.moebel !== "treppe" || !a.exemplar) return;
      const st = Calc.aufgabenStand(a, heute);
      if (!stand[a.exemplar] || stand[a.exemplar].anteil < st.anteil) stand[a.exemplar] = st;
    });
    return ETAGEN.map((e) => treppenabschnitt(e, stand[e.key] ? Calc.moebelFarbe("treppe", stand[e.key].anteil) : null)).join("");
  }

  function kulisse() {
    let s = '<rect x="0" y="0" width="1720" height="640" fill="url(#himmel)"/>';
    s += g(1620, 80, 1, '<circle r="34" fill="#ffd166"/><g stroke="#ffd166" stroke-width="4" stroke-linecap="round"><path d="M0 -48V-58M0 48V58M-48 0H-58M48 0H58M-34 -34L-41 -41M34 34L41 41M-34 34L-41 41M34 -34L41 -41"/></g>');
    s += wolke(160, 110, 1) + wolke(420, 60, 0.7) + wolke(1460, 170, 0.8);
    // Erde + Wiese
    s += '<rect x="0" y="640" width="1720" height="190" fill="url(#m-erde)"/>';
    s += '<path d="M0 634 Q20 626 40 634 T80 634 T120 634 T160 634 T200 634 T240 634 T280 634 V648 H0Z M1430 634 Q1450 626 1470 634 T1510 634 T1550 634 T1590 634 T1630 634 T1670 634 T1720 634 V648 H1430Z" fill="#7cb35a"/>';
    // Gartenzaun
    let zaun = "";
    for (let x = 1462; x < 1710; x += 16) zaun += '<path d="M' + x + " 632 V590 L" + (x + 5) + " 583 L" + (x + 10) + " 590 V632Z" + '"/>';
    s += '<g fill="#ffffff" stroke="#c9b8a3" stroke-width="1.2">' + zaun + '<rect x="1456" y="598" width="254" height="5"/><rect x="1456" y="618" width="254" height="5"/></g>';
    // Garage + Haus-Rahmen
    s += '<rect x="80" y="455" width="215" height="185" rx="4" fill="#8a5a3b"/><rect x="72" y="447" width="231" height="12" rx="4" fill="#6f4a31"/>';
    s += '<rect x="290" y="250" width="1140" height="560" rx="4" fill="#8a5a3b"/>';
    // Balkonplatte
    s += '<rect x="1425" y="445" width="152" height="12" rx="3" fill="#8a5a3b"/>';
    // Dach (Mansarde) mit Schornstein und Rundfenster
    s += '<path d="M268 262 L370 118 L1350 118 L1452 262Z" fill="url(#m-dach)" stroke="#8a3a2e" stroke-width="3" stroke-linejoin="round"/>';
    s += '<rect x="1120" y="52" width="40" height="60" fill="#b5654f" stroke="#8a3a2e" stroke-width="3"/><rect x="1114" y="46" width="52" height="10" fill="#8a3a2e"/>';
    s += '<path d="M440 124 L860 36 L1280 124Z" fill="url(#m-dach)" stroke="#8a3a2e" stroke-width="3" stroke-linejoin="round"/>';
    s += '<circle cx="860" cy="92" r="15" fill="#cfe9f7" stroke="#8a5a3b" stroke-width="4"/><path d="M845 92H875M860 77V107" stroke="#8a5a3b" stroke-width="2"/>';
    // Treppenhaus-Wand (liegt über dem Dach, damit der Schacht bis unters Dach reicht)
    s += treppenhausWand();
    return s;
  }

  // ---- Raum-Bausteine -------------------------------------------------
  function wand(raum, geo, farbe) {
    // Der Flur ist Teil des Treppenschachts: die Wand zeichnet der Schacht selbst
    if (raum.typ === "flur") return "";
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
    const farben = { holz: ["#ecd08e", "#d6b46a", 34], fliese: ["#ebe6dc", "#cfc6b8", 14], beton: ["#b8b1a7", "#a39c92", 60], gras: ["#7cb35a", "#6a9c4b", 12], platte: ["#e2c184", "#cfae6c", 40] };
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

  // Möbel nebeneinander auf den Boden stellen; hohe Möbel an die Ränder.
  // Exemplare mit gespeicherter Position (x) bleiben dort, der Rest wird verteilt.
  function festeX(geo, x, w) {
    return Math.max(geo.x + 5, Math.min(x, geo.x + geo.w - 5 - w));
  }

  function anordnen(geo, eintraege, s0) {
    // Der Maßstab richtet sich nach allen Möbeln der Gruppe, auch den festen.
    // So ändert sich die Größe nicht, wenn ein Möbel verschoben wird.
    const rand = 8;
    const platz = geo.w - 2 * rand;
    const summe = eintraege.reduce((a, e) => a + e.def.w, 0);
    let s = s0;
    if (eintraege.length && summe * s + 6 * (eintraege.length + 1) > platz) s = (platz - 6 * (eintraege.length + 1)) / summe;

    const fest = eintraege.filter((e) => e.x != null);
    const frei = eintraege.filter((e) => e.x == null);
    const hoch = frei.filter((e) => e.def.h >= 90);
    const reihe = frei.filter((e) => e.def.h < 90);
    hoch.forEach((e, i) => { if (i % 2 === 0) reihe.unshift(e); else reihe.push(e); });
    let ergebnis = [];
    if (reihe.length) {
      const summeReihe = reihe.reduce((a, e) => a + e.def.w * s, 0);
      const luecke = (platz - summeReihe) / (reihe.length + 1);
      let x = geo.x + rand + luecke;
      ergebnis = reihe.map((e) => {
        const p = { key: e.key, typ: e.typ, def: e.def, deko: e.deko, farbe: e.farbe, x: x, w: e.def.w * s, h: e.def.h * s, s: s };
        x += p.w + luecke;
        return p;
      });
    }
    fest.forEach((e) => {
      const w = e.def.w * s;
      ergebnis.push({ key: e.key, typ: e.typ, def: e.def, deko: e.deko, farbe: e.farbe, x: festeX(geo, e.x, w), w: w, h: e.def.h * s, s: s });
    });
    return ergebnis;
  }

  // Verschiebe-Attribute (nur im Umgestalten-Modus): Exemplar-Id, Ausgangslage, Maße
  let umgestaltenAktiv = false;
  function zieh(raum, p, y) {
    if (!umgestaltenAktiv) return "";
    return ' data-drag="' + (p.deko ? "deko:" : "") + p.key + '" data-x="' + r1(p.x) + '" data-y="' + r1(y) + '" data-s="' + p.s +
      '" data-w="' + r1(p.def.w * p.s) + '" data-raum="' + raum.id + '"';
  }

  function verteilen(rnd, geo, breite) {
    return geo.x + 10 + rnd() * Math.max(0, geo.w - 20 - breite);
  }

  // Effekte, die an einem Möbel hängen. z = Lage des Exemplars (x, y, s, def, w)
  function zielEffekt(raum, e, z) {
    const a = e.stand.anteil;
    const rnd = Calc.zufall(e.aufgabe.effekt + raum.id + e.aufgabe.id + e.aufgabe.zuletzt);
    const h = z.def.h * z.s;
    if (e.aufgabe.effekt === "waesche") {
      // Wäscheberg neben der Waschmaschine oder dem Korb
      const n = a < 0.4 ? 0 : Math.min(6, Math.ceil((a - 0.3) * 5));
      let s = "";
      for (let i = 0; i < n; i++) {
        const teil = M.UNORDNUNG[i % 2 ? "tshirt" : "socke"];
        s += g(z.x + z.w + 2 + (i % 3) * 7, z.y + 2, Math.max(0.8, z.s), teil.zeichnen());
      }
      return s;
    }
    if (e.aufgabe.effekt === "glas") {
      // Umgekipptes Glas auf der Tischplatte
      if (a < 0.4 || !z.def.ablage) return "";
      return g(z.x + z.w * 0.7, z.y + z.def.ablage * z.s, Math.max(0.8, z.s), M.glasKippt());
    }
    if (e.aufgabe.effekt === "flecken") {
      // Flecken auf dem Möbel
      const n = a < 0.4 ? 0 : Math.min(3, Math.ceil((a - 0.3) * 3));
      let s = "";
      for (let i = 0; i < n; i++) {
        s += g(z.x + z.w * (0.25 + rnd() * 0.5), z.y - h * (0.25 + rnd() * 0.5), z.s, M.fleckAufMoebel(rnd));
      }
      return s;
    }
    if (e.aufgabe.effekt === "fliegen") {
      // Fliegen schwirren um das Möbel
      const n = a < 0.4 ? 0 : Math.min(5, Math.ceil((a - 0.3) * 5));
      let s = "";
      for (let i = 0; i < n; i++) {
        s += g(z.x - 8 + rnd() * (z.w + 16), z.y - h - 6 - rnd() * 14, 1, M.fliege());
      }
      return s;
    }
    if (e.aufgabe.effekt === "handtuch") {
      // Handtuch hängt über der verschmutzten Dusche
      if (a < 0.4) return "";
      return g(z.x + z.w * 0.55, z.y - h + 8, Math.max(0.8, z.s),
        '<path d="M0 0 L16 0 L16 30 Q8 34 0 30Z" fill="#8ecae6" stroke="#5b4636" stroke-width="1.2"/>' +
        '<path d="M0 6 L16 6 M0 12 L16 12" stroke="#ffffff" stroke-width="2"/>');
    }
    // Fenster: Schmutzschleier über dem Fenster, je dreckiger desto dichter
    if (a < 0.3) return "";
    return '<rect x="' + r1(z.x) + '" y="' + r1(z.y - h) + '" width="' + r1(z.w) + '" height="' + r1(h) +
      '" rx="2" fill="#8a7a5a" opacity="' + r1(Math.min(0.45, a * 0.35)) + '"/>';
  }

  // ---- Ein Raum ---------------------------------------------------------
  function raumSVG(raum, geo, info, aufgaben, deko, heute, tiere, gewaehlt, instanzen) {
    const draussen = !!DRAUSSEN[raum.typ];
    const bodenY = geo.y + geo.h - 10;
    const s0 = Math.min(1, (geo.h - 10 - 58) / 112);
    const raumFarbe = Calc.raumFarbe(raum.id, info.heat);

    // Möbel = Exemplare, die eine Aufgabe nennen. Farbe = dringendste ihrer Aufgaben
    const exemplare = {};
    instanzen.forEach((m) => { exemplare[m.id] = m; });
    const moebel = {};
    const effekte = { staubwischen: [], staubsaugen: [], wischen: [], aufraeumen: [], waesche: [], glas: [], flecken: [], fliegen: [], fenster: [], handtuch: [] };
    const ziele = {};  // Exemplar-Id → Lage, damit Effekte am Möbel selbst erscheinen
    aufgaben.forEach((a) => {
      const st = Calc.aufgabenStand(a, heute);
      const m = a.moebelId && exemplare[a.moebelId];
      if (m && M.KATALOG[m.typ]) {
        if (!moebel[m.id] || moebel[m.id].anteil < st.anteil) moebel[m.id] = { anteil: st.anteil, typ: m.typ, x: m.x, etage: m.etage };
      }
      if (a.effekt && effekte[a.effekt]) effekte[a.effekt].push({ aufgabe: a, stand: st });
    });

    const boden0 = [];
    const wand0 = [];
    const flaechen = [];
    Object.keys(moebel).forEach((key) => {
      const def = M.KATALOG[moebel[key].typ];
      const e = { key: key, typ: moebel[key].typ, def: def, farbe: Calc.moebelFarbe(moebel[key].typ, moebel[key].anteil), x: moebel[key].x, etage: moebel[key].etage };
      if (def.art === "wand" || def.art === "decke") wand0.push(e);
      else if (def.art === "flaeche") flaechen.push(e);
      else boden0.push(e);
    });
    deko.forEach((key) => {
      const def = M.DEKO[key];
      if (!def) return;
      const e = { key: key, def: def, deko: true, x: (raum.dekoPos || {})[key], etage: (raum.dekoEtage || {})[key] };
      if (def.art === "wand" || def.art === "decke") wand0.push(e);
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
    // Gardinen hängen an einem Fenster des Raums; ohne Fenster gibt es keine
    const fenster = [];
    const gardinen = wand0.filter((e) => e.typ === "gardine");
    // Flur: Wand- und Deckenteile auf anderen Etagen werden dort gezeichnet
    const etagenWand = raum.typ === "flur" ? wand0.filter((e) => e.etage && e.etage !== "eg" && e.etage !== "dach") : [];
    const andere = wand0.filter((e) => e.typ !== "gardine" && etagenWand.indexOf(e) < 0);
    andere.forEach((e, i) => {
      const w = e.def.w * s0;
      const x = e.x != null ? festeX(geo, e.x, w) : geo.x + (i + 1) * geo.w / (andere.length + 1) - w / 2;
      // Deckenmöbel hängen knapp unter dem Schild
      const y = e.def.art === "decke" ? sch.unten + 4 : wandOben + e.def.h * s0;
      const inhalt = e.deko ? e.def.zeichnen() : e.def.zeichnen(e.farbe);
      if (!e.deko) ziele[e.key] = { x: x, y: y, s: s0, def: e.def, w: w };
      if (!e.deko && e.typ === "fenster") fenster.push({ x: x, y: y });
      s += e.deko ? g(x, y, s0, inhalt, zieh(raum, { key: e.key, deko: true, def: e.def, x: x, s: s0 }, y))
        : g(x, y, s0, inhalt + "<title>" + e.def.name + "</title>", ' class="moebel" data-action="moebel" data-raum="' + raum.id + '" data-key="' + e.key + '"' + zieh(raum, { key: e.key, def: e.def, x: x, s: s0 }, y));
    });
    gardinen.forEach((e, i) => {
      if (!fenster.length) return;
      const f = fenster[i % fenster.length];
      s += g(f.x - 16, f.y, s0, e.def.zeichnen(e.farbe) + "<title>" + e.def.name + "</title>",
        ' class="moebel" data-action="moebel" data-raum="' + raum.id + '" data-key="' + e.key + '"');
    });

    // Flur: Wand- und Deckenteile auf anderen Etagen – in fester Größe, vor der Treppe
    ETAGEN.forEach((et) => {
      const liste = etagenWand.filter((e) => e.etage === et.key);
      liste.forEach((e, i) => {
        const w = e.def.w * s0;
        const x = e.x != null ? festeX({ x: TREPPE_X, w: TREPPE_W }, e.x, w) : TREPPE_X + (i + 1) * TREPPE_W / (liste.length + 1) - w / 2;
        // Deckenteile hängen unter der Decke der Etage, Wandteile auf Schrankhöhe
        const y = e.def.art === "decke" ? et.boden - 185 : et.boden - 60;
        ziele[e.key] = { x: x, y: y, s: s0, def: e.def, w: w };
        const zieher = { key: e.key, deko: e.deko, def: e.def, x: x, s: s0 };
        s += e.deko ? g(x, y, s0, e.def.zeichnen(), zieh(raum, zieher, y))
          : g(x, y, s0, e.def.zeichnen(e.farbe) + "<title>" + e.def.name + "</title>",
            ' class="moebel" data-action="moebel" data-raum="' + raum.id + '" data-key="' + e.key + '"' + zieh(raum, zieher, y));
      });
    });

    // Treppe nach den Wandobjekten (Fenster liegen dahinter), vor Schild und Bodenmöbeln
    if (raum.typ === "flur") s += treppenhaus(aufgaben, heute);
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
    // Auf dem Dachboden steht kein Flur-Möbel (alte Angaben „dach“ bleiben im Erdgeschoss)
    const etagenMoebel = raum.typ === "flur" ? boden0.filter((e) => e.etage && e.etage !== "eg" && e.etage !== "dach") : [];
    const plaetze = anordnen(geo, boden0.filter((e) => etagenMoebel.indexOf(e) < 0), s0);
    const platzVon = {};
    plaetze.forEach((p) => {
      if (!p.deko && !platzVon[p.typ]) platzVon[p.typ] = p;
      if (!p.deko) ziele[p.key] = { x: p.x, y: bodenY, s: p.s, def: p.def, w: p.w };
      if (p.deko) {
        s += g(p.x, bodenY, p.s, p.def.zeichnen(), zieh(raum, p, bodenY));
      } else {
        s += g(p.x, bodenY, p.s, p.def.zeichnen(p.farbe) + "<title>" + p.def.name + "</title>",
          ' class="moebel" data-action="moebel" data-raum="' + raum.id + '" data-key="' + p.key + '"' + zieh(raum, p, bodenY));
      }
    });
    // Flur: Möbel auf Dachboden, OG oder Keller stehen im Schacht auf der Decke der Etage
    ETAGEN.forEach((et) => {
      const liste = etagenMoebel.filter((e) => e.etage === et.key);
      if (!liste.length) return;
      anordnen({ x: TREPPE_X, w: TREPPE_W }, liste, s0).forEach((p) => {
        ziele[p.key] = { x: p.x, y: et.boden, s: p.s, def: p.def, w: p.w };
        s += g(p.x, et.boden, p.s, p.def.zeichnen(p.farbe) + (p.deko ? "" : "<title>" + p.def.name + "</title>"),
          p.deko ? zieh(raum, p, et.boden) : ' class="moebel" data-action="moebel" data-raum="' + raum.id + '" data-key="' + p.key + '"' + zieh(raum, p, et.boden));
      });
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

    // Effekte am Möbel selbst (Aufgabe nennt das Exemplar)
    ["waesche", "glas", "flecken", "fliegen", "fenster", "handtuch"].forEach((art) => {
      effekte[art].forEach((e) => {
        const z = ziele[e.aufgabe.moebelId];
        if (z) s += zielEffekt(raum, e, z);
      });
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
      const t = M.TIERE[tier.art];
      if (!t) return;
      const sc = Math.max(0.8, fs);
      let platz = null;
      if (tier.art === "katze") platz = platzVon.sofa || platzVon.bett || platzVon.kinderbett || platzVon.kratzbaum;
      if (tier.art === "hund") platz = platzVon.hundekorb;
      const z = t.zeichnen(tier.farbe);
      if (platz && platz.def.ablage) {
        s += g(platz.x + platz.w * 0.35 + i * 14 * sc, bodenY + platz.def.ablage * platz.s + 2, sc, z);
      } else if (platz) {
        s += g(platz.x + platz.w * 0.2 + i * 14 * sc, bodenY - 4 * sc, sc, z);
      } else {
        s += g(geo.x + geo.w * (0.3 + (i % 3) * 0.2), bodenY, sc, z);
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
  // ---- Tiere laufen durchs Haus -------------------------------------------
  // Jedes Tier hat einen Rundweg über die sauberen Lieblingsräume (ohne Garten
  // und Balkon). Zwischen Etagen geht es über die Mitte des Treppenhauses.
  // Je dreckiger das Haus, desto länger bleibt ein Tier an jedem Ort.
  function sauberRaeume(daten, infos) {
    return daten.raeume
      .filter((r) => Calc.istSauber(infos[r.id].status) && LIEBLINGSORTE.indexOf(r.typ) >= 0 && !DRAUSSEN[r.typ])
      .sort((a, b) => (LIEBLINGSORTE.indexOf(a.typ) - LIEBLINGSORTE.indexOf(b.typ)) || (infos[b.id].quote - infos[a.id].quote));
  }

  // Haus-Schmutz: 0 = alles erledigt, 1 = nichts erledigt
  function schmutz(daten, infos) {
    let alle = 0;
    let erl = 0;
    Object.keys(infos).forEach((k) => { alle += infos[k].anzahl; erl += infos[k].erledigt; });
    return alle ? 1 - erl / alle : 1;
  }

  // Aufenthalte eines Tieres: drei bis fünf Minuten je Raum (je dreckiger, desto
  // länger), dann verschwindet es kurz und taucht im nächsten Raum wieder auf.
  // Ergebnis: SVG-Animation für die Position (springt) und die Deckkraft (blendet).
  function tierWeg(raeume, i, dreck) {
    const n = raeume.length;
    const verweil = 180 + 120 * dreck;   // Sekunden je Raum
    const blende = 1;                    // Sekunden zum Ausblenden und Einblenden
    const ort = (r) => {
      const g = LAGE[r.id];
      return r1(g.x + g.w * (0.25 + 0.5 * (((i * 7) % 5) / 4))) + " " + r1(g.y + g.h - 10);
    };
    const T = n * verweil;
    const orte = [];
    const zeitenOrt = [];
    for (let k = 0; k < n; k++) {
      orte.push(ort(raeume[(i + k) % n]));
      zeitenOrt.push((k * verweil / T).toFixed(4));
    }
    const dek = [1];
    const dekZeiten = [0];
    for (let k = 1; k < n; k++) {
      const t = k * verweil;
      dek.push(1, 0, 1);
      dekZeiten.push(((t - blende) / T).toFixed(4), (t / T).toFixed(4), ((t + blende) / T).toFixed(4));
    }
    dek.push(1);
    dekZeiten.push(1);
    return {
      orte: orte.join(";"),
      orteZeiten: n > 1 ? zeitenOrt.join(";") : "0;1",
      orteWerte: n > 1 ? orte.join(";") : orte[0] + ";" + orte[0],
      deckkraft: dek.join(";"),
      deckkraftZeiten: dekZeiten.join(";"),
      dauer: r1(T)
    };
  }

  function staende(daten, heute) {
    const infos = {};
    daten.raeume.forEach((r) => {
      infos[r.id] = Calc.raumStand(daten.aufgaben.filter((a) => a.raumId === r.id), heute);
    });
    return infos;
  }

  function render(daten, heute, auswahl, umgestalten) {
    umgestaltenAktiv = !!umgestalten;
    const infos = staende(daten, heute);
    let s = '<svg viewBox="0 0 1720 830" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Puppenhaus">' + defs() + kulisse();
    daten.raeume.forEach((r) => {
      const geo = LAGE[r.id];
      if (!geo) return;
      const aufgaben = daten.aufgaben.filter((a) => a.raumId === r.id);
      const instanzen = (daten.moebel || []).filter((m) => m.raumId === r.id);
      s += raumSVG(r, geo, infos[r.id], aufgaben, r.deko || [], heute, [], auswahl === r.id, instanzen);
    });
    // Tiere: jedes läuft seinen Rundweg (Animation), über allen Räumen
    const raeume = sauberRaeume(daten, infos);
    const dreck = schmutz(daten, infos);
    (daten.tiere || []).forEach((tier, i) => {
      if (!raeume.length || !M.TIERE[tier.art]) return;
      const w = tierWeg(raeume, i, dreck);
      s += '<g><animateTransform attributeName="transform" type="translate" calcMode="discrete" values="' + w.orteWerte +
        '" keyTimes="' + (raeume.length > 1 ? w.orteZeiten : "0;1") + '" dur="' + w.dauer + 's" repeatCount="indefinite"/>' +
        '<animate attributeName="opacity" values="' + w.deckkraft + '" keyTimes="' + w.deckkraftZeiten +
        '" dur="' + w.dauer + 's" repeatCount="indefinite"/>' +
        "<g>" + M.TIERE[tier.art].zeichnen(tier.farbe) + "</g></g>";
    });
    return s + "</svg>";
  }

  global.Haus = {
    LAGE: LAGE,
    ETAGEN: ETAGEN,
    render: render,
    staende: staende,
    esc: esc
  };
})(window);
