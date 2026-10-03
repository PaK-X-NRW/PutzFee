/* =====================================================================
   calc.js – Rechenkern der PutzFee (frei von DOM und Speicher)
   ---------------------------------------------------------------------
   - Tageszahlen (lokales Datum → ganze Tage), Wochentage
   - Fälligkeit je Aufgabe: Rhythmus „alle n Tage" oder feste Wochentage
   - Heatmap-Farbe (grün → gelb → rot, überfällig dunkler)
   - Raumstatus: leer · biohazard · schmutzig · sauber · blitzsauber
     inkl. Sprüchen für das Raumschild
   - Zufall mit festem Startwert (tägliche Unordnung bleibt beim
     Neuladen gleich)
   ===================================================================== */
(function (global) {
  "use strict";

  const TAG_MS = 86400000;
  const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  // Lokales Datum → fortlaufende Tageszahl (unabhängig von Uhrzeit/Zeitzone)
  function tagNr(d) {
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / TAG_MS);
  }

  function datumVon(n) {
    const u = new Date(n * TAG_MS);
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  }

  function wochentagVon(n) {
    return new Date(n * TAG_MS).getUTCDay();
  }

  // Nächster Termin nach dem letzten Erledigen.
  // rhythmus: { art: "intervall", tage: 7 } | { art: "wochentage", wochentage: [1, 4] }
  function naechsterTermin(aufgabe, zuletzt) {
    const r = aufgabe.rhythmus;
    if (r.art === "wochentage" && r.wochentage && r.wochentage.length) {
      for (let n = zuletzt + 1; n <= zuletzt + 7; n++) {
        if (r.wochentage.indexOf(wochentagVon(n)) >= 0) return n;
      }
    }
    return zuletzt + Math.max(1, r.tage || 7);
  }

  // Stand einer Aufgabe an einem Tag.
  // anteil: 0 = gerade erledigt, 1 = fällig, > 1 = überfällig
  // erledigt: true, solange der nächste Termin noch nicht erreicht ist
  // („alle 7 Tage" → am Tag des Putzens + 6 Tage erledigt)
  function aufgabenStand(aufgabe, heute) {
    if (aufgabe.zuletzt == null) {
      return { anteil: 1.5, erledigt: false, faellig: heute, tageSeit: null };
    }
    const faellig = naechsterTermin(aufgabe, aufgabe.zuletzt);
    const spanne = Math.max(1, faellig - aufgabe.zuletzt);
    const seit = heute - aufgabe.zuletzt;
    return {
      anteil: Math.max(0, seit / spanne),
      erledigt: heute < faellig,
      faellig: faellig,
      tageSeit: seit
    };
  }

  // Heatmap-Farbe. anteil null = Raum ohne Aufgaben (grau).
  function heatFarbe(anteil) {
    if (anteil == null) {
      return { fill: "#cfcac3", dunkel: "#8f8a83", wand: "#e2dfda" };
    }
    const a = Math.max(0, anteil);
    const t = Math.min(a, 1);
    const hue = Math.round(130 * (1 - t));
    const ueber = a > 1 ? Math.min(0.5, a - 1) : 0;
    return {
      fill: "hsl(" + hue + ",62%," + Math.round(66 - ueber * 24) + "%)",
      dunkel: "hsl(" + hue + ",42%," + Math.round(34 - ueber * 10) + "%)",
      wand: "hsl(" + hue + ",55%," + Math.round(90 - ueber * 10) + "%)"
    };
  }

  // ---- Pastell-Heatmap: sauber = niedliche Pastelltöne, verschmutzt = röter --
  // Jedes Möbel (und jeder Raum) hat seinen festen Pastellton, abgeleitet aus dem
  // Namen – er springt also nicht. Mit dem Anteil (0 frisch → 1 fällig) mischt er
  // sich zu Rot; überfällig wird er noch etwas dunkler.
  const PASTELL = ["#fde68a", "#bde0fe", "#f5e1c8", "#c5e8b7", "#f9c6d3", "#d9c8f0"];
  const DRECK = [217, 87, 74];
  const UMRISS = [91, 70, 54];

  function hexRgb(h) {
    return [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  }

  function mischen(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t));
  }

  function grundfarbe(name) {
    return hexRgb(PASTELL[Math.floor(zufall(name)() * PASTELL.length)]);
  }

  // Feste Grundfarben: die Hecke ist sauber grün, bei Verschmutzung wird sie röter
  const FESTE_FARBE = { hecke: "#8fd18a", gardine: "#c9b6e4" };

  function pastellFarbe(name, anteil, helle, basis) {
    if (anteil == null) return heatFarbe(null);
    const t = Math.min(1, Math.max(0, anteil)) * 0.85;
    let fill = mischen(basis ? hexRgb(basis) : grundfarbe(name), DRECK, t);
    const ueber = anteil > 1 ? Math.min(0.3, (anteil - 1) * 0.3) : 0;
    fill = mischen(fill, [40, 30, 30], ueber);
    const rgb = (c) => "rgb(" + c.join(",") + ")";
    return {
      fill: rgb(fill),
      dunkel: rgb(mischen(fill, UMRISS, 0.5)),
      wand: rgb(mischen(fill, [255, 255, 255], helle || 0.5))
    };
  }

  // Möbel: Farbe nach Möbeltyp und Dringlichkeit
  function moebelFarbe(typ, anteil) {
    return pastellFarbe("moebel:" + typ, anteil, 0.5, FESTE_FARBE[typ]);
  }

  // Raum (Wand): Farbe nach Raum und Durchschnitt aller Aufgaben
  function raumFarbe(raumId, heat) {
    return pastellFarbe("raum:" + raumId, heat, 0.6);
  }

  const SPRUECHE = {
    blitzsauber: ["Blitzsauber!", "Hier wohnt die PutzFee!", "Glänzt wie neu!"],
    sehrgut: ["Sieht richtig schick aus hier", "Fast perfekt!"],
    sauber: ["Sieht ganz ordentlich aus hier", "Kann sich sehen lassen"],
    schmutzig: ["Jetzt wird's aber Zeit!", "Hier fehlt eine Putzrunde"],
    mies: ["Die Wollmäuse feiern Party", "Hilfe, wo ist der Lappen?"],
    biohazard: ["Betreten auf eigene Gefahr!", "Hier wächst schon was …"],
    leer: ["Noch keine Aufgaben"]
  };

  function spruch(art, heute) {
    const liste = SPRUECHE[art];
    return liste[Math.abs(heute) % liste.length];
  }

  // Raumstatus aus den Aufgaben eines Raums:
  // 0 % erledigt → biohazard · ab 50 % → sauber · 100 % → blitzsauber
  function raumStand(aufgaben, heute) {
    const n = aufgaben.length;
    if (!n) {
      return { status: "leer", anzahl: 0, erledigt: 0, quote: null, heat: null, spruch: spruch("leer", heute) };
    }
    let erl = 0;
    let summe = 0;
    aufgaben.forEach((a) => {
      const st = aufgabenStand(a, heute);
      if (st.erledigt) erl++;
      summe += Math.min(st.anteil, 1.5);
    });
    const quote = erl / n;
    let status = "schmutzig";
    if (erl === n) status = "blitzsauber";
    else if (erl === 0) status = "biohazard";
    else if (quote >= 0.5) status = "sauber";

    let art = status;
    if (status === "sauber" && quote >= 0.75) art = "sehrgut";
    if (status === "schmutzig" && quote < 0.25) art = "mies";
    return { status: status, anzahl: n, erledigt: erl, quote: quote, heat: summe / n, spruch: spruch(art, heute) };
  }

  function istSauber(status) {
    return status === "sauber" || status === "blitzsauber";
  }

  // ---- Texte ---------------------------------------------------------
  function rhythmusText(r) {
    if (r.art === "wochentage") {
      const tage = r.wochentage.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      return "jeden " + tage.map((t) => WOCHENTAGE[t]).join(", ");
    }
    if (r.tage === 1) return "täglich";
    return "alle " + r.tage + " Tage";
  }

  function tageText(n) {
    return n === 1 ? "1 Tag" : n + " Tagen";
  }

  function standText(aufgabe, heute) {
    const st = aufgabenStand(aufgabe, heute);
    if (st.tageSeit == null) return "noch nie erledigt";
    let zuletzt = st.tageSeit <= 0 ? "heute erledigt" : st.tageSeit === 1 ? "gestern erledigt" : "vor " + tageText(st.tageSeit) + " erledigt";
    const rest = st.faellig - heute;
    let faellig;
    if (rest > 1) faellig = "noch " + rest + " Tage";
    else if (rest === 1) faellig = "morgen fällig";
    else if (rest === 0) faellig = "heute fällig";
    else faellig = "seit " + tageText(-rest) + " fällig";
    return zuletzt + " · " + faellig;
  }

  // ---- Zufall mit festem Startwert -------------------------------------
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function zufall(startwert) {
    let a = hash(String(startwert));
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  global.Calc = {
    WOCHENTAGE: WOCHENTAGE,
    tagNr: tagNr,
    datumVon: datumVon,
    wochentagVon: wochentagVon,
    naechsterTermin: naechsterTermin,
    aufgabenStand: aufgabenStand,
    heatFarbe: heatFarbe,
    moebelFarbe: moebelFarbe,
    raumFarbe: raumFarbe,
    raumStand: raumStand,
    istSauber: istSauber,
    rhythmusText: rhythmusText,
    standText: standText,
    zufall: zufall
  };
})(window);
