/* =====================================================================
   moebel.js – SVG-Bibliothek im Puppenhaus-Stil
   ---------------------------------------------------------------------
   Alle Zeichnungen liefern SVG-Strings in lokalen Koordinaten:
   Ursprung = unten links, gezeichnet wird nach oben (negative y).
   - KATALOG: Möbel & Tier-Utensilien, die über Aufgaben erscheinen.
     zeichnen(f) bekommt die Heatmap-Farbe f = { fill, dunkel }.
     art: "boden" (steht auf dem Boden) | "wand" (hängt an der Wand)
          | "flaeche" (liegt flach über die Breite, z. B. Teppich, Rasen)
     ablage: Höhe (negativ), auf der Belohnungen/Tiere Platz nehmen.
   - DEKO: feste Farben, ohne Heatmap (Wandbild, Uhr, Pflanze, Lampe)
   - UNORDNUNG, BELOHNUNG, Tiere, Wollmaus, Fleck, Spinnweben,
     Totenschädel, Fee
   ===================================================================== */
(function (global) {
  "use strict";

  const OL = "#5b4636";     // Umrisslinie
  const HOLZ = "#c8925f";
  const HELL = "#fff7e8";
  const METALL = "#f4f6fa";
  const BUCH = ["#f6bfb0", "#b8d8ea", "#bfe0c2", "#fbe7b0", "#d7c3ef", "#f9d5e5"];
  const BUCH_BREITE = [5, 4, 6, 4, 5, 7, 4, 5, 6];
  const BUCH_HOEHE = [26, 20, 30, 18, 24, 32, 21, 28, 19, 25];

  function r1(v) { return Math.round(v * 10) / 10; }

  function R(x, y, w, h, fill, rx, extra) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) +
      '" fill="' + fill + '" stroke="' + OL + '" stroke-width="2"' + (extra || "") + "/>";
  }
  function C(cx, cy, r, fill, extra) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '" stroke="' + OL + '" stroke-width="2"' + (extra || "") + "/>";
  }
  function E(cx, cy, rx, ry, fill, extra) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '" stroke="' + OL + '" stroke-width="2"' + (extra || "") + "/>";
  }
  function P(d, fill, extra) {
    return '<path d="' + d + '" fill="' + fill + '" stroke="' + OL + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' + (extra || "") + "/>";
  }
  function L(x1, y1, x2, y2, farbe, breite) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (farbe || OL) +
      '" stroke-width="' + (breite || 2) + '" stroke-linecap="round"/>';
  }
  const OHNE = ' stroke="none"';

  function stern(cx, cy, r, fill, extra) {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      d += (i === 0 ? "M" : "L") + r1(cx + rr * Math.cos(a)) + " " + r1(cy + rr * Math.sin(a));
    }
    return '<path d="' + d + 'Z" fill="' + fill + '" stroke="' + OL + '" stroke-width="1.2" stroke-linejoin="round"' + (extra || "") + "/>";
  }

  // Bücher: unregelmäßige Breiten und Höhen, ab und zu eine Lücke oder ein schräges Buch
  // Bücher: unregelmäßige Breiten und Höhen, ab und zu eine Lücke; bleiben im Regal
  // Stapel liegender Bücher (auf einem Regalbrett, Unterkante auf dem Brett)
  function stapel(x, y) {
    return R(x, y - 5, 14, 5, BUCH[0], 1, ' stroke-width="1"') + R(x + 1, y - 10, 12, 5, BUCH[1], 1, ' stroke-width="1"') +
      R(x - 1, y - 15, 15, 5, BUCH[2], 1, ' stroke-width="1"');
  }

  function buecher(x, y, breite, maxH) {
    let s = "";
    let px = x;
    let i = 0;
    while (px < x + breite - 2) {
      if (i % 7 === 6) { px += 7; i++; continue; }
      const b = Math.min(BUCH_BREITE[i % BUCH_BREITE.length], x + breite - px);
      const h = Math.min(BUCH_HOEHE[(i * 3) % BUCH_HOEHE.length], maxH || 99);
      s += R(px, y - h, b, h, BUCH[(i * 5) % BUCH.length], 0, ' stroke-width="1"');
      px += b + 1;
      i++;
    }
    return s;
  }

  function bett(breite) {
    return function (f) {
      return R(12, -18, 6, 18, METALL, 2) + R(breite - 20, -18, 6, 18, METALL, 2) +
        R(0, -60, 10, 60, METALL, 5) + R(breite - 10, -40, 10, 40, METALL, 5) +
        C(5, -62, 6, METALL) + C(breite - 5, -42, 6, METALL) +
        R(8, -36, breite - 16, 18, HELL, 5) +
        E(26, -39, breite > 100 ? 15 : 12, 7, "#ffffff") +
        R(44, -38, breite - 50, 20, f.fill, 7) +
        L(58, -35, 58, -21, f.dunkel, 1.5);
    };
  }

  // ---- Möbel & Utensilien (Heatmap-Farbe) -----------------------------
  const KATALOG = {
    sofa: { name: "Sofa", gruppe: "Wohnen", w: 110, h: 56, ablage: -32, zeichnen: function (f) {
      return R(4, -56, 102, 30, f.fill, 10) + R(10, -8, 6, 8, HOLZ) + R(94, -8, 6, 8, HOLZ) +
        R(4, -32, 102, 24, f.fill, 6) + L(55, -30, 55, -10, f.dunkel) + E(30, -38, 12, 7, HELL) +
        R(-2, -44, 18, 38, f.fill, 8) + R(94, -44, 18, 38, f.fill, 8);
    } },
    sessel: { name: "Sessel", gruppe: "Wohnen", w: 56, h: 56, ablage: -32, zeichnen: function (f) {
      return R(4, -56, 48, 30, f.fill, 10) + R(10, -8, 6, 8, HOLZ) + R(40, -8, 6, 8, HOLZ) +
        R(4, -32, 48, 24, f.fill, 6) + R(-2, -44, 14, 38, f.fill, 7) + R(44, -44, 14, 38, f.fill, 7);
    } },
    tv: { name: "Fernseher", gruppe: "Wohnen", w: 70, h: 64, zeichnen: function (f) {
      return R(31, -30, 8, 6, "#555") + R(6, -64, 58, 36, "#34344a", 4) +
        P("M14 -58 L26 -58 L18 -34 L10 -34Z", "rgba(255,255,255,.22)", OHNE) +
        R(0, -24, 70, 24, f.fill, 3) + L(35, -22, 35, -2, f.dunkel);
    } },
    regal: { name: "Bücherregal", gruppe: "Wohnen", w: 50, h: 100, zeichnen: function (f) {
      return R(0, -100, 50, 100, f.fill, 2) + R(5, -95, 40, 88, "#f6e6cc", 0, ' stroke-width="1"') +
        buecher(7, -66, 26, 27) + buecher(7, -36, 20, 27) + stapel(28, -36) +
        '<g transform="translate(12 -8) rotate(14)">' + R(-5, -22, 5, 22, BUCH[2], 0, ' stroke-width="1"') + "</g>" +
        buecher(18, -8, 25, 25) +
        // Blumentopf oben auf dem Regal, die Pflanze hängt an der Vorderseite herab
        R(13, -112, 22, 3, "#c9653f", 1, ' stroke-width="1"') + P("M14 -100 L34 -100 L31 -109 L17 -109Z", "#e08a5a", ' stroke-width="1"') +
        L(24, -112, 22, -124, "#4f772d", 1.5) + E(19, -124, 4, 3, "#6a994e", ' stroke-width="1"') + E(27, -125, 4, 3, "#81b29a", ' stroke-width="1"') +
        '<path d="M20 -109 Q10 -104 12 -94 Q14 -84 6 -78" fill="none" stroke="#4f772d" stroke-width="1.5"/>' +
        E(10, -100, 3, 2, "#6a994e", ' stroke-width="1"') + E(12, -90, 3, 2, "#81b29a", ' stroke-width="1"') + E(7, -80, 3, 2, "#6a994e", ' stroke-width="1"') +
        L(5, -66, 45, -66, f.dunkel, 3) + L(5, -36, 45, -36, f.dunkel, 3);
    } },
    kommode: { name: "Kommode", gruppe: "Wohnen", w: 60, h: 52, ablage: -52, zeichnen: function (f) {
      return R(4, -8, 6, 8, HOLZ) + R(50, -8, 6, 8, HOLZ) + R(0, -52, 60, 44, f.fill, 4) +
        L(2, -38, 58, -38, f.dunkel) + L(2, -23, 58, -23, f.dunkel) +
        C(30, -45, 2.5, HELL) + C(30, -30, 2.5, HELL) + C(30, -15, 2.5, HELL);
    } },
    esstisch: { name: "Esstisch", gruppe: "Wohnen", w: 124, h: 62, ablage: -42, zeichnen: function (f) {
      const stuhl = function (x) {
        return P("M" + x + " -26 L" + x + " -48 Q" + x + " -58 " + (x + 9) + " -54 Q" + (x + 18) + " -58 " + (x + 18) + " -48 L" + (x + 18) + " -26Z", f.fill, ' stroke-width="1.5"') +
          R(x - 1, -27, 20, 5, "#ffd6e0", 2) + L(x + 3, -22, x + 3, 0, OL, 2) + L(x + 15, -22, x + 15, 0, OL, 2);
      };
      return stuhl(0) + stuhl(106) + L(62, -38, 62, 0, OL, 4) + E(62, 0, 18, 3, "#8a5a3b") +
        E(62, -42, 56, 8, f.fill) + E(62, -40, 48, 4, "#ffffff", ' stroke-width="1"');
    } },
    bett: { name: "Bett", gruppe: "Schlafen", w: 120, h: 60, ablage: -38, zeichnen: bett(120) },
    kinderbett: { name: "Kinderbett", gruppe: "Schlafen", w: 90, h: 60, ablage: -38, zeichnen: bett(90) },
    schrank: { name: "Kleiderschrank", gruppe: "Schlafen", w: 60, h: 112, zeichnen: function (f) {
      return R(4, -6, 8, 6, HOLZ) + R(48, -6, 8, 6, HOLZ) + R(0, -106, 60, 100, f.fill, 3) +
        R(-3, -112, 66, 6, HOLZ, 2) + L(30, -104, 30, -8, f.dunkel) +
        C(25, -58, 2.5, HELL) + C(35, -58, 2.5, HELL);
    } },
    schreibtisch: { name: "Schreibtisch", gruppe: "Schlafen", w: 84, h: 74, ablage: -50, zeichnen: function (f) {
      return R(4, -44, 5, 44, f.fill) + R(56, -44, 24, 36, f.fill, 2) + L(58, -26, 78, -26, f.dunkel) +
        R(0, -50, 84, 6, f.fill, 2) + P("M16 -50 L20 -64 L44 -64 L42 -50Z", "#8d99ae") +
        L(70, -50, 70, -66) + P("M62 -66 L78 -66 L74 -74 L66 -74Z", "#f2cc8f");
    } },
    spielzeugkiste: { name: "Spielzeugkiste", gruppe: "Schlafen", w: 48, h: 44, zeichnen: function (f) {
      return C(14, -38, 6, "#e63946") + R(0, -30, 48, 30, f.fill, 4) + R(-2, -37, 52, 8, f.fill, 3) +
        stern(24, -15, 8, "#f2cc8f");
    } },
    teppich: { name: "Teppich", gruppe: "Wohnen", art: "flaeche", w: 110, h: 6, zeichnen: function (f) {
      let s = "";
      for (let x = 8; x <= 102; x += 8) s += L(x, -1, x, 3, f.dunkel, 1.2);
      return s + E(55, -3, 52, 5, f.fill) + E(55, -3, 34, 2.5, "none", ' stroke="' + f.dunkel + '" stroke-width="1.2"');
    } },
    herd: { name: "Herd", gruppe: "Küche & Bad", w: 50, h: 64, ablage: -64, zeichnen: function (f) {
      return R(0, -58, 50, 58, f.fill, 3) + R(-1, -64, 52, 7, "#4d4d57", 2) +
        R(8, -44, 34, 26, "#3d3d4a", 3) + L(10, -48, 40, -48, HELL, 3) +
        C(12, -53, 2.2, HELL) + C(25, -53, 2.2, HELL) + C(38, -53, 2.2, HELL);
    } },
    kuehlschrank: { name: "Kühlschrank", gruppe: "Küche & Bad", w: 46, h: 104, zeichnen: function (f) {
      return R(0, -104, 46, 104, f.fill, 7) + L(2, -68, 44, -68, f.dunkel) +
        R(36, -96, 4, 20, HELL, 2) + R(36, -60, 4, 28, HELL, 2) + C(14, -86, 3, "#e07a5f");
    } },
    spuele: { name: "Spüle", gruppe: "Küche & Bad", w: 64, h: 76, ablage: -62, zeichnen: function (f) {
      return R(2, -56, 60, 56, f.fill, 3) + L(32, -54, 32, -4, f.dunkel) +
        C(26, -30, 2, HELL) + C(38, -30, 2, HELL) + R(0, -62, 64, 7, "#e3e3e3", 2) +
        P("M44 -62 L44 -76 L32 -76 L32 -71", "none");
    } },
    badewanne: { name: "Badewanne", gruppe: "Küche & Bad", w: 104, h: 58, ablage: -46, zeichnen: function (f) {
      return C(16, -5, 5, HOLZ) + C(88, -5, 5, HOLZ) +
        P("M2 -42 L102 -42 L96 -14 Q92 -8 84 -8 L20 -8 Q12 -8 8 -14 Z", f.fill) +
        R(-2, -46, 108, 6, HELL, 3) + P("M94 -46 L94 -58 L84 -58", "none");
    } },
    dusche: { name: "Dusche", gruppe: "Küche & Bad", w: 54, h: 112, zeichnen: function (f) {
      return R(3, -104, 48, 94, f.fill, 2, ' fill-opacity=".3"') + R(0, -10, 54, 10, f.fill, 3) +
        P("M40 -104 L40 -112 M40 -112 L28 -112 L28 -100", "none") + E(28, -98, 7, 3, "#bbb") +
        L(24, -90, 22, -80, "#8ecae6", 1.5) + L(30, -90, 30, -78, "#8ecae6", 1.5) + L(35, -90, 38, -80, "#8ecae6", 1.5);
    } },
    wc: { name: "WC", gruppe: "Küche & Bad", w: 40, h: 50, zeichnen: function (f) {
      return R(24, -50, 14, 28, f.fill, 3) +
        P("M0 -26 L32 -26 Q32 -14 22 -12 L22 0 L8 0 L10 -12 Q0 -16 0 -26Z", f.fill) +
        R(-2, -29, 36, 5, HELL, 2);
    } },
    waschbecken: { name: "Waschbecken", gruppe: "Küche & Bad", w: 44, h: 72, ablage: -62, zeichnen: function (f) {
      return R(16, -50, 12, 50, f.fill, 3) +
        P("M0 -62 L44 -62 Q42 -48 22 -48 Q2 -48 0 -62Z", f.fill) + P("M22 -62 L22 -71 L14 -71", "none");
    } },
    waschmaschine: { name: "Waschmaschine", gruppe: "Küche & Bad", w: 46, h: 56, ablage: -56, zeichnen: function (f) {
      return R(0, -56, 46, 56, f.fill, 5) + L(2, -44, 44, -44, f.dunkel) +
        C(23, -22, 15, "#dfe6ea") + C(23, -22, 10, "#a9d6ee") + C(38, -50, 3, HELL) + R(5, -52, 14, 5, HELL, 1);
    } },
    garderobe: { name: "Garderobe", gruppe: "Flur", w: 46, h: 104, zeichnen: function (f) {
      return R(8, -6, 30, 6, HOLZ, 2) + R(20, -100, 6, 94, HOLZ, 2) + L(8, -94, 38, -94, HOLZ, 4) +
        P("M26 -92 L38 -92 L42 -60 L28 -60Z", "#81b29a") + P("M8 -92 L22 -92 L24 -50 L4 -50Z", f.fill) +
        P("M26 -98 L42 -98 L39 -106 L29 -106Z", f.fill);
    } },
    schuhregal: { name: "Schuhregal", gruppe: "Flur", w: 52, h: 36, ablage: -36, zeichnen: function (f) {
      return R(0, -36, 52, 36, f.fill, 3) + L(2, -18, 50, -18, f.dunkel) +
        schuh(4, -18, "#f9c6d3") + schuh(24, -18, "#bde0fe") + schuh(12, 0, "#fde68a");
    } },
    muelltonne: { name: "Mülltonne", gruppe: "Draußen & Keller", w: 36, h: 54, zeichnen: function (f) {
      return C(8, -4, 4, "#444") + R(2, -46, 32, 44, f.fill, 3) + R(0, -54, 36, 8, f.dunkel, 3) +
        L(10, -40, 10, -8, f.dunkel, 1.5) + L(18, -40, 18, -8, f.dunkel, 1.5) + L(26, -40, 26, -8, f.dunkel, 1.5);
    } },
    auto: { name: "Auto", gruppe: "Draußen & Keller", w: 150, h: 58, zeichnen: function (f) {
      return P("M6 -14 L6 -30 Q8 -36 20 -38 L42 -40 L58 -56 L104 -56 L124 -40 L140 -36 Q148 -32 146 -14 Z", f.fill) +
        P("M62 -52 L80 -52 L80 -40 L50 -40Z", "#cfe9f7") + P("M86 -52 L102 -52 L116 -40 L86 -40Z", "#cfe9f7") +
        C(36, -12, 12, "#3d3d4a") + C(36, -12, 5, "#bbb") + C(114, -12, 12, "#3d3d4a") + C(114, -12, 5, "#bbb") +
        E(143, -28, 3, 4, "#f9e79f");
    } },
    werkbank: { name: "Werkbank", gruppe: "Draußen & Keller", w: 84, h: 68, ablage: -58, zeichnen: function (f) {
      return R(4, -50, 6, 50, HOLZ) + R(74, -50, 6, 50, HOLZ) + L(8, -16, 76, -16, HOLZ, 5) +
        R(0, -58, 84, 8, f.fill, 2) + R(60, -66, 14, 8, "#8d99ae", 2) +
        L(18, -62, 38, -62, HOLZ, 3) + R(34, -68, 8, 12, "#8d99ae", 1);
    } },
    gefriertruhe: { name: "Gefriertruhe", gruppe: "Draußen & Keller", w: 72, h: 48, zeichnen: function (f) {
      return R(0, -44, 72, 44, f.fill, 5) + R(-2, -48, 76, 8, f.fill, 3) + R(30, -40, 12, 4, HELL, 2) +
        L(8, -12, 20, -12, f.dunkel, 1.5) + L(8, -8, 20, -8, f.dunkel, 1.5);
    } },
    kartons: { name: "Kartons", gruppe: "Draußen & Keller", w: 64, h: 44, zeichnen: function (f) {
      return R(28, -44, 34, 44, f.fill, 2) + R(40, -44, 10, 6, HELL, 0, ' stroke-width="1"') +
        R(0, -28, 34, 28, f.fill, 2) + R(12, -28, 10, 6, HELL, 0, ' stroke-width="1"');
    } },
    rasen: { name: "Rasen", gruppe: "Draußen & Keller", art: "flaeche", w: 100, h: 10, breit: true, zeichnen: function (f, breite) {
      let d = "";
      for (let x = 4; x < breite - 4; x += 9) {
        d += "M" + x + " 0 L" + (x + 2) + " -9 L" + (x + 4) + " 0 L" + (x + 6) + " -6 L" + (x + 7) + " 0 ";
      }
      return '<path d="' + d + '" fill="' + f.fill + '" stroke="' + f.dunkel + '" stroke-width="1.2" stroke-linejoin="round"/>';
    } },
    beet: { name: "Blumenbeet", gruppe: "Draußen & Keller", w: 72, h: 34, zeichnen: function (f) {
      let s = R(0, -12, 72, 12, "#7a5236", 5);
      for (let x = 10; x <= 62; x += 13) {
        s += L(x, -12, x, -26, "#4f772d", 2) + C(x, -28, 5.5, f.fill) + C(x, -28, 2, "#f9e79f", ' stroke-width="1"');
      }
      return s;
    } },
    hecke: { name: "Hecke", gruppe: "Draußen & Keller", w: 76, h: 58, zeichnen: function (f) {
      return C(16, -20, 18, f.fill) + C(58, -20, 18, f.fill) + C(37, -36, 22, f.fill) +
        R(8, -10, 60, 10, f.fill, 5, OHNE) + L(8, -1, 68, -1, OL);
    } },
    gartenmoebel: { name: "Gartenmöbel", gruppe: "Draußen & Keller", w: 84, h: 44, ablage: -34, zeichnen: function (f) {
      const stuhl = function (x) {
        return R(x, -12, 16, 4, f.fill, 2) + L(x + 2, -8, x + 2, 0, OL, 2) + L(x + 14, -8, x + 14, 0, OL, 2) +
          P("M" + x + " -12 L" + x + " -30 Q" + x + " -38 " + (x + 8) + " -34 Q" + (x + 16) + " -38 " + (x + 16) + " -30 L" + (x + 16) + " -12Z", f.fill, ' stroke-width="1.5"');
      };
      return L(42, -26, 42, 0, OL, 3) + E(42, 0, 14, 3, "#8a5a3b") + E(42, -30, 26, 5, f.fill) + stuhl(0) + stuhl(68);
    } },
    pflanzen: { name: "Balkonpflanzen", gruppe: "Draußen & Keller", w: 52, h: 46, zeichnen: function (f) {
      return P("M12 -18 Q4 -34 10 -42 Q16 -30 14 -18Z", "#6a994e") + P("M26 -18 Q26 -36 30 -44 Q34 -30 28 -18Z", "#81b29a") +
        P("M40 -18 Q48 -32 44 -40 Q36 -30 38 -18Z", "#6a994e") +
        C(10, -42, 4, "#f28482") + C(30, -44, 4, "#f7b267") + C(44, -40, 4, "#f28482") +
        R(0, -18, 52, 18, f.fill, 3);
    } },
    fenster: { name: "Fenster", gruppe: "Wand", art: "wand", w: 52, h: 60, zeichnen: function (f) {
      return R(0, -60, 52, 58, f.fill, 3) + R(5, -55, 42, 48, "#cfe9f7", 1) +

        L(26, -55, 26, -7, f.dunkel) + L(5, -31, 47, -31, f.dunkel) + R(-4, -4, 60, 6, HELL, 2);
    } },
    spiegel: { name: "Spiegel", gruppe: "Wand", w: 30, h: 50, art: "wand", zeichnen: function (f) {
      return R(0, -50, 30, 50, f.fill, 4) + R(4, -46, 22, 42, "#e3f2f9", 2, ' stroke-width="1.5"') +
        C(15, -53, 3, "#ff9ec7") + C(2, -48, 2.5, "#ffe066") + C(28, -48, 2.5, "#ffe066") +
        C(2, -2, 2.5, "#ffe066") + C(28, -2, 2.5, "#ffe066") + L(8, -38, 12, -44, "#ffffff", 2.5);
    } },
    // Tiere
    katzenklo: { name: "Katzenklo", gruppe: "Tiere", w: 48, h: 30, tier: "katze", zeichnen: function (f) {
      return P("M2 -10 L2 -20 Q24 -36 46 -20 L46 -10Z", f.fill) + E(24, -17, 8, 6, "#3d3d4a") +
        R(0, -10, 48, 10, f.fill, 3);
    } },
    futternapf: { name: "Futternapf", gruppe: "Tiere", w: 32, h: 16, tier: "katze", zeichnen: function (f) {
      return C(10, -13, 2.5, "#a0522d", ' stroke-width="1"') + C(16, -14, 2.5, "#a0522d", ' stroke-width="1"') +
        C(22, -13, 2.5, "#a0522d", ' stroke-width="1"') + P("M0 -12 L32 -12 L27 0 L5 0Z", f.fill);
    } },
    kratzbaum: { name: "Kratzbaum", gruppe: "Tiere", w: 48, h: 104, tier: "katze", ablage: -104, zeichnen: function (f) {
      let s = R(19, -96, 10, 88, "#d9b98c", 2);
      for (let y = -90; y < -12; y += 7) s += L(20, y, 28, y + 3, "#b08a5a", 1.2);
      return s + R(0, -8, 48, 8, f.fill, 3) + R(4, -62, 40, 7, f.fill, 3) + R(8, -104, 32, 9, f.fill, 4) +
        L(40, -55, 40, -46, OL, 1) + C(40, -43, 3, "#e07a5f", ' stroke-width="1"');
    } },
    aquarium: { name: "Aquarium", gruppe: "Tiere", w: 62, h: 60, tier: "fisch", zeichnen: function (f) {
      return R(4, -22, 54, 22, HOLZ, 2) + R(0, -58, 62, 36, "#9fd3ea", 2) +
        R(2, -30, 58, 7, "#f2dca8", 0, OHNE) +
        P("M12 -30 Q8 -42 14 -50 M16 -30 Q20 -40 16 -46 M50 -30 Q46 -42 52 -48", "none", ' stroke="#4f772d"') +
        E(24, -44, 6, 4, "#f4a259", ' stroke-width="1"') + P("M18 -44 L13 -48 L13 -40Z", "#f4a259", ' stroke-width="1"') +
        E(42, -36, 5, 3, "#e63946", ' stroke-width="1"') + P("M47 -36 L51 -39 L51 -33Z", "#e63946", ' stroke-width="1"') +
        '<rect x="0" y="-58" width="62" height="36" rx="2" fill="none" stroke="' + f.fill + '" stroke-width="4"/>' +
        R(-2, -61, 66, 5, f.fill, 2);
    } },
    hundekorb: { name: "Hundebettchen", gruppe: "Tiere", w: 80, h: 30, tier: "hund", zeichnen: function (f) {
      return R(0, -14, 80, 14, f.fill, 5) + P("M12 -14 Q14 -26 40 -26 Q66 -26 68 -14Z", "#f1ead8", ' stroke-width="1"') +
        R(0, -30, 12, 30, f.fill, 5) + R(68, -30, 12, 30, f.fill, 5) +
        R(12, -16, 56, 3, "#e6dcc6", 1, ' stroke-width="1"');
    } },
    vogelkaefig: { name: "Vogelkäfig", gruppe: "Tiere", w: 38, h: 66, tier: "vogel", zeichnen: function (f) {
      let s = C(19, -62, 3, "none");
      s += E(19, -24, 6, 5, "#f9e79f", ' stroke-width="1.2"') + C(23, -30, 4, "#f9e79f", ' stroke-width="1.2"') +
        P("M27 -30 L31 -29 L27 -28Z", "#f4a259", ' stroke-width="1"') + L(12, -16, 26, -16, HOLZ, 2);
      for (let x = 6; x <= 32; x += 6.5) s += L(x, -40 - (x === 19 ? 18 : Math.abs(19 - x) < 7 ? 14 : 4), x, -6, f.dunkel, 1.2);
      return s + P("M2 -6 L2 -40 Q19 -64 36 -40 L36 -6", "none", ' stroke="' + f.fill + '" stroke-width="3"') +
        R(0, -6, 38, 6, f.fill, 2);
    } },
    klavier: { name: "Klavier", gruppe: "Musik", w: 104, h: 90, zeichnen: function (f) {
      let s = R(6, -78, 92, 44, f.fill, 4) + R(4, -82, 96, 6, f.dunkel, 3) +
        R(38, -72, 28, 16, "#ffffff", 1, ' stroke-width="1"') +
        L(42, -67, 62, -67, OL, 0.8) + L(42, -64, 62, -64, OL, 0.8) + L(42, -61, 62, -61, OL, 0.8) +
        C(50, -64, 1.6, OL, OHNE);
      s += R(8, -50, 88, 10, "#ffffff", 2, ' stroke-width="1"');
      for (let x = 14; x <= 92; x += 6) s += L(x, -50, x, -40, OL, 1);
      s += R(46, -5, 4, 5, "#d9a441", 1, ' stroke-width="1"') + R(52, -5, 4, 5, "#d9a441", 1, ' stroke-width="1"') +
        R(58, -5, 4, 5, "#d9a441", 1, ' stroke-width="1"');
      return s + L(16, -34, 12, 0, OL, 3) + L(88, -34, 92, 0, OL, 3) +
        R(31, -26, 42, 10, f.fill, 4) + L(40, -16, 38, 0, OL, 2) + L(66, -16, 68, 0, OL, 2);
    } },
    gitarre: { name: "Gitarre", gruppe: "Musik", w: 30, h: 90, zeichnen: function (f) {
      return R(11, -90, 8, 8, "#5b3a1a", 2) + R(12, -84, 6, 42, "#5b3a1a", 1) +
        P("M15 -50 C4 -50 2 -38 6 -28 C0 -20 4 -4 15 -4 C26 -4 30 -20 24 -28 C28 -38 26 -50 15 -50Z", f.fill) +
        C(15, -26, 3.5, "#333") + R(11, -18, 8, 4, "#5b3a1a", 1);
    } },
    staffelei: { name: "Staffelei", gruppe: "Hobby", w: 50, h: 92, zeichnen: function (f) {
      return L(4, 0, 22, -86, HOLZ, 4) + L(46, 0, 26, -86, HOLZ, 4) + R(8, -76, 38, 46, f.fill, 2) +
        C(20, -54, 5, "#81b29a", ' stroke-width="1"') + C(32, -42, 4, "#f2cc8f", ' stroke-width="1"');
    } },
    naehmaschine: { name: "Nähmaschine", gruppe: "Hobby", w: 80, h: 84, zeichnen: function (f) {
      return R(0, -18, 78, 18, f.fill, 4) + R(56, -62, 18, 46, f.fill, 4) +
        R(16, -64, 58, 14, f.fill, 6) + L(26, -50, 26, -26, OL, 2.5) +
        R(62, -78, 10, 14, "#e0523d", 3, ' stroke-width="1"');
    } },
    laufband: { name: "Laufband", gruppe: "Sport", w: 96, h: 64, zeichnen: function (f) {
      return R(0, -10, 96, 10, "#3d3d4a", 4) + R(4, -14, 88, 4, f.fill, 2) + L(86, -14, 86, -56, OL, 4) +
        R(78, -64, 18, 10, f.fill, 3) + L(86, -56, 96, -62, OL, 3);
    } },
    hantelbank: { name: "Hantelbank", gruppe: "Sport", w: 64, h: 40, zeichnen: function (f) {
      return R(8, -24, 48, 10, f.fill, 4) + R(14, -14, 6, 14, HOLZ) + R(44, -14, 6, 14, HOLZ) +
        L(0, -34, 64, -34, "#8d99ae", 3) + C(4, -34, 6, "#444") + C(60, -34, 6, "#444");
    } },
    heizung: { name: "Heizungsanlage", gruppe: "Draußen & Keller", w: 66, h: 92, zeichnen: function (f) {
      return R(0, -88, 66, 88, f.fill, 6) + C(33, -44, 14, HELL) + C(56, -72, 5, HELL) +
        P("M28 -50 Q24 -40 28 -34 Q34 -40 28 -50", "#e07a5f") + L(6, -88, 6, -96, OL, 3) + L(60, -88, 60, -96, OL, 3);
    } },
    kamin: { name: "Kamin", gruppe: "Wohnen", w: 96, h: 84, zeichnen: function (f) {
      return R(0, -80, 96, 80, f.fill, 3) + R(14, -50, 68, 50, "#2b2b2b", 2) +
        E(48, -22, 12, 14, "#f4a259") + E(48, -20, 6, 8, "#ffd60a") + R(-6, -88, 108, 8, f.fill, 3);
    } },
    heizkoerper: { name: "Heizkörper", gruppe: "Haushalt", w: 80, h: 44, art: "wand", zeichnen: function (f) {
      let s = R(0, -44, 80, 44, f.fill, 3);
      for (let x = 8; x <= 72; x += 8) s += L(x, -40, x, -6, f.dunkel, 2);
      return s;
    } },
    waeschekorb: { name: "Wäschekorb", gruppe: "Haushalt", w: 46, h: 30, zeichnen: function (f) {
      return P("M2 -28 L44 -28 L38 0 L8 0Z", f.fill) + P("M10 -28 Q14 -40 20 -30 Q26 -42 32 -28Z", "#f9c6d3", ' stroke-width="1.5"') +
        L(8, -14, 38, -14, f.dunkel, 1);
    } },
    waeschestaender: { name: "Wäscheständer", gruppe: "Haushalt", w: 80, h: 76, zeichnen: function () {
      return R(2, -70, 5, 70, "#8d99ae", 2, ' stroke-width="1"') + R(73, -70, 5, 70, "#8d99ae", 2, ' stroke-width="1"') +
        L(4, -62, 76, -62, OL, 2.5) +
        P("M14 -62 Q22 -57 30 -62 L40 -56 L36 -46 L32 -48 L32 -34 L12 -34 L12 -48 L8 -46 L4 -56Z", "#fde68a", ' stroke-width="1.5"') +
        R(44, -62, 12, 26, "#f9a8d4", 2, ' stroke-width="1.5"') +
        P("M14 -26 Q18 -20 14 -14 Q10 -20 14 -26Z", "#7fc8f8", ' stroke-width="1"') +
        P("M44 -26 Q48 -20 44 -14 Q40 -20 44 -26Z", "#7fc8f8", ' stroke-width="1"') +
        P("M64 -20 Q68 -14 64 -8 Q60 -14 64 -20Z", "#7fc8f8", ' stroke-width="1"');
    } },
    buegelbrett: { name: "Bügelbrett", gruppe: "Haushalt", w: 100, h: 90, zeichnen: function (f) {
      return L(12, -42, 84, 0, "#5b4636", 3) + L(84, -42, 12, 0, "#5b4636", 3) +
        P("M0 -48 L92 -48 Q98 -48 98 -42 L96 -40 L4 -40 Q0 -40 0 -44Z", "#f4f6fa", ' stroke-width="1.5"') +
        '<g transform="translate(43 -48) scale(0.8)">' +
        P("M0 0 Q5 -21 23 -24 L51 -24 L54 0Z", "#4a8fd6", ' stroke="#222" stroke-width="1.6"') +
        '<path d="M20 -43 L45 -43 Q51 -43 52 -36 L52 -24" fill="none" stroke="#222" stroke-width="11" stroke-linecap="round"/>' +
        '<path d="M20 -43 L45 -43 Q51 -43 52 -36 L52 -24" fill="none" stroke="#4a8fd6" stroke-width="7" stroke-linecap="round"/>' +
        "</g>";
    } },
    gartenbank: { name: "Gartenbank", gruppe: "Draußen & Keller", w: 80, h: 42, zeichnen: function (f) {
      return R(0, -22, 80, 8, f.fill, 2) + R(0, -40, 80, 6, f.fill, 2) + R(6, -14, 5, 14, HOLZ) + R(69, -14, 5, 14, HOLZ) +
        L(6, -22, 6, -40, HOLZ, 3) + L(74, -22, 74, -40, HOLZ, 3);
    } },
    korb: { name: "Korb", gruppe: "Haushalt", w: 36, h: 26, zeichnen: function (f) {
      return P("M0 -24 Q18 -40 36 -24 L30 0 L6 0Z", f.fill) + L(8, -14, 28, -14, f.dunkel, 1) + L(6, -7, 30, -7, f.dunkel, 1);
    } },
    geruempel: { name: "Dachboden-Gerümpel", gruppe: "Dachboden", w: 96, h: 72, zeichnen: function (f) {
      return R(0, -40, 40, 40, f.fill, 2) + L(0, -40, 40, 0, f.dunkel, 1) + L(40, -40, 0, 0, f.dunkel, 1) +
        R(14, -58, 34, 18, f.fill, 2) +
        R(46, -26, 34, 26, f.fill, 2) +
        R(56, -48, 4, 22, "#9b72cf", 1) + L(78, -60, 78, -26, OL, 2) +
        P("M66 -60 L90 -60 L86 -74 L70 -74Z", "#f9c6d3", ' stroke-width="1.5"');
    } },
    gardine: { name: "Gardinen", gruppe: "Wand", w: 84, h: 90, art: "wand", zeichnen: function (f) {
      return L(0, -90, 84, -90, "#8d99ae", 3) + R(0, -86, 14, 86, f.fill, 2) + R(70, -86, 14, 86, f.fill, 2);
    } },
    deckenlampe: { name: "Deckenlampe", gruppe: "Decke", w: 40, h: 24, art: "decke", zeichnen: function (f) {
      return L(20, 0, 20, 12, OL, 1.5) + P("M4 24 L36 24 L28 12 L12 12Z", f.fill) + C(20, 22, 3, "#ffe8a3", ' stroke-width="1"');
    } },
    aktenstapel: { name: "Aktenstapel", gruppe: "Büro", w: 40, h: 30, zeichnen: function (f) {
      return R(0, -10, 40, 10, "#f5e1c8", 1, ' stroke-width="1"') + R(2, -20, 38, 10, "#fde68a", 1, ' stroke-width="1"') +
        R(0, -30, 40, 10, f.fill, 1, ' stroke-width="1"');
    } },
    buerostuhl: { name: "Bürostuhl", gruppe: "Büro", w: 40, h: 60, zeichnen: function (f) {
      return R(6, -30, 28, 8, f.fill, 3) + R(8, -62, 24, 34, f.fill, 6) + L(20, -22, 20, -4, OL, 3) + L(8, -2, 32, -2, OL, 3);
    } },
    aktenschrank: { name: "Aktenschrank", gruppe: "Büro", w: 56, h: 96, zeichnen: function (f) {
      return R(0, -96, 56, 96, f.fill, 2) + L(0, -64, 56, -64, f.dunkel, 1.5) + L(0, -32, 56, -32, f.dunkel, 1.5) +
        R(24, -84, 8, 4, HELL, 1) + R(24, -52, 8, 4, HELL, 1) + R(24, -20, 8, 4, HELL, 1);
    } }
  };

  // ---- Deko (ohne Heatmap) ------------------------------------------
  const DEKO = {
    bild: { name: "Katzenbild", art: "wand", w: 44, h: 34, zeichnen: function () {
      return R(0, -34, 44, 34, "#9ecbe8", 3) + R(5, -29, 34, 24, "#fff1c9", 0, ' stroke-width="1"') +
        P("M12 -20 L14 -31 L21 -24Z", "#f4a259", ' stroke-width="1"') + P("M32 -20 L30 -31 L23 -24Z", "#f4a259", ' stroke-width="1"') +
        E(22, -18, 11, 8, "#f4a259", ' stroke-width="1"') +
        C(17, -19, 1.8, "#333", OHNE) + C(27, -19, 1.8, "#333", OHNE) +
        P("M20 -15 L24 -15 L22 -13Z", "#e07a5f", ' stroke-width="1"') +
        L(8, -15, 15, -14, OL, 1) + L(8, -12, 15, -12, OL, 1) + L(29, -14, 36, -15, OL, 1) + L(29, -12, 36, -12, OL, 1);
    } },
    uhr: { name: "Wanduhr", art: "wand", w: 36, h: 36, zeichnen: function () {
      let s = C(18, -18, 17, "#9ecbe8", ' stroke-width="1"') + C(18, -18, 14, HELL, ' stroke="#6fa3c9" stroke-width="2"');
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        s += C(r1(18 + 11 * Math.sin(a)), r1(-18 - 11 * Math.cos(a)), 1, OL, OHNE);
      }
      return s + L(18, -18, 18, -28, OL, 2) + L(18, -18, 25, -14, OL, 2) + C(18, -18, 1.8, OL, OHNE);
    } },
    pflanze: { name: "Zimmerpflanze", art: "boden", w: 32, h: 58, zeichnen: function () {
      return P("M16 -20 Q2 -40 8 -54 Q18 -40 16 -20Z", "#6a994e") + P("M16 -20 Q30 -38 26 -52 Q14 -40 16 -20Z", "#81b29a") +
        P("M16 -20 Q15 -46 18 -58 Q22 -40 16 -20Z", "#6a994e") + P("M6 -20 L26 -20 L23 0 L9 0Z", "#c8693b");
    } },
    lampe: { name: "Stehlampe", art: "boden", w: 26, h: 94, zeichnen: function () {
      return '<circle cx="13" cy="-66" r="16" fill="#ffe8a3" opacity=".45"/>' +
        E(13, -3, 11, 3, "#8a5a3b") + L(13, -4, 13, -74, "#8a5a3b", 3) + P("M2 -72 L24 -72 L19 -94 L7 -94Z", "#f2cc8f");
    } },
    lichterkette: { name: "Lichterkette", art: "wand", w: 96, h: 16, zeichnen: function () {
      let s = P("M0 2 Q24 14 48 2 Q72 14 96 2", "none", ' stroke="#8d6a4a" stroke-width="1.5"');
      const farben = ["#ffd166", "#f28482", "#bde0fe"];
      for (let x = 6, i = 0; x < 96; x += 14, i++) s += C(x, 6, 2.5, farben[i % 3], ' stroke-width="0.8"');
      return s;
    } },
    diskokugel: { name: "Diskokugel", art: "decke", w: 30, h: 36, zeichnen: function () {
      return L(15, 0, 15, 10, OL, 1) + C(15, 22, 12, "#e0e0e0", ' stroke-width="1"') +
        R(9, 18, 3, 3, "#ffffff", 0, OHNE) + R(18, 22, 3, 3, "#bde0fe", 0, OHNE) + R(12, 27, 3, 3, "#fde68a", 0, OHNE);
    } }
  };

  // ---- Unordnung (Aufgabe „aufräumen") ------------------------------
  const UNORDNUNG = {
    teddy: { w: 26, zeichnen: function () {
      const fell = "#c68b59";
      const st = ' stroke-width="1.5"';
      return E(12, -10, 7, 8, fell, st) + E(2, -12, 4, 3, fell, st) + E(22, -12, 4, 3, fell, st) +
        E(7, -2, 4, 3, fell, st) + E(17, -2, 4, 3, fell, st) +
        C(12, -24, 7, fell, st) + C(6, -31, 3, fell, st) + C(18, -31, 3, fell, st) +
        C(9.5, -26, 1, OL, OHNE) + C(14.5, -26, 1, OL, OHNE) + C(12, -22, 1.4, OL, OHNE) + L(10, -18.5, 14, -18.5, OL, 1);
    } },
    ball: { w: 16, zeichnen: function () {
      return C(8, -8, 8, "#e63946", ' stroke-width="1.5"') + P("M1 -10 Q8 -4 15 -10", "none", ' stroke="#ffffff" stroke-width="2.5"');
    } },
    bauklotz: { w: 26, zeichnen: function () {
      return R(0, -12, 12, 12, "#f4a259", 1, ' stroke-width="1.5"') + R(13, -12, 12, 12, "#3d85c6", 1, ' stroke-width="1.5"') +
        P("M6 -12 L12 -22 L18 -12Z", "#81b29a", ' stroke-width="1.5"');
    } },
    wolle: { w: 28, zeichnen: function () {
      return L(12, -2, 27, -20, "#bbbbbb", 2) + L(16, -1, 25, -22, "#bbbbbb", 2) + C(9, -8, 8, "#b56576", ' stroke-width="1.5"') +
        P("M3 -11 Q9 -6 15 -12 M4 -5 Q10 -2 16 -6", "none", ' stroke="#8d4a5a" stroke-width="1"');
    } },
    socke: { w: 22, zeichnen: function () {
      return P("M0 -14 L8 -14 L8 -6 L20 -6 Q23 0 16 0 L4 0 Q0 0 0 -4Z", "#6c9bd2", ' stroke-width="1.5"');
    } },
    tshirt: { w: 30, zeichnen: function () {
      return P("M0 -6 L6 -14 L12 -12 L18 -14 L26 -10 L30 -4 L24 0 L4 0Z", "#f28482", ' stroke-width="1.5"');
    } },
    handtuch: { w: 30, zeichnen: function () {
      return P("M0 -8 Q8 -13 16 -8 Q24 -3 30 -8 L30 0 L0 0Z", "#8ecae6", ' stroke-width="1.5"') + L(4, -4, 26, -4, "#ffffff", 2);
    } },
    teller: { w: 26, zeichnen: function () {
      return E(13, -3, 13, 3, "#ffffff", ' stroke-width="1.5"') + E(13, -7, 12, 3, "#ffffff", ' stroke-width="1.5"') +
        E(13, -11, 11, 3, "#f6e6cc", ' stroke-width="1.5"');
    } },
    tasse: { w: 18, zeichnen: function () {
      return P("M12 -9 Q18 -6 12 -3", "none", ' stroke-width="1.5"') + R(0, -12, 12, 12, "#ffffff", 2, ' stroke-width="1.5"') +
        R(2, -8, 8, 3, "#a0522d", 0, OHNE);
    } },
    schuh: { w: 24, zeichnen: function () {
      return P("M0 -12 L8 -12 Q10 -6 22 -5 Q25 0 20 0 L0 0Z", "#6d4c41", ' stroke-width="1.5"');
    } }
  };

  const UNORDNUNG_JE_RAUM = {
    kinderzimmer: ["teddy", "ball", "bauklotz", "socke", "tshirt"],
    wohnzimmer: ["wolle", "teddy", "tasse", "socke", "ball", "tshirt"],
    kueche: ["teller", "tasse", "handtuch"],
    esszimmer: ["teller", "tasse", "wolle"],
    bad: ["handtuch", "socke", "tshirt"],
    gaestewc: ["handtuch"],
    schlafzimmer: ["tshirt", "socke", "wolle", "handtuch"],
    flur: ["schuh", "socke", "ball"],
    standard: ["socke", "tasse", "wolle", "tshirt", "ball"]
  };

  // ---- Effekte -------------------------------------------------------
  function wollmaus() {
    const st = ' stroke="#948b7e" stroke-width="1.2"';
    return '<circle cx="7" cy="-6" r="6" fill="#d2cbc0"' + st + "/>" +
      '<circle cx="21" cy="-5" r="5" fill="#d2cbc0"' + st + "/>" +
      '<circle cx="14" cy="-8" r="8" fill="#ddd6cb"' + st + "/>" +
      '<circle cx="11.5" cy="-9" r="1.3" fill="#333"/><circle cx="16.5" cy="-9" r="1.3" fill="#333"/>';
  }

  function fleck(rnd) {
    const b = 22 + Math.round(rnd * 14);
    return '<ellipse cx="' + (b / 2) + '" cy="-2" rx="' + (b / 2) + '" ry="3.5" fill="#7a5a3a" opacity=".45"/>' +
      '<ellipse cx="' + (b + 6) + '" cy="-2" rx="4" ry="2" fill="#7a5a3a" opacity=".45"/>';
  }

  // Spinnweben in der Ecke oben links (für rechts spiegeln)
  function spinnweben(g, spinne) {
    const winkel = [0, 22.5, 45, 67.5, 90];
    const pkt = (a, r) => [r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)];
    let d = "";
    winkel.forEach((a) => {
      const p = pkt(a, g);
      d += "M0 0 L" + r1(p[0]) + " " + r1(p[1]) + " ";
    });
    [0.35, 0.65, 0.95].forEach((f) => {
      for (let i = 0; i < winkel.length - 1; i++) {
        const p1 = pkt(winkel[i], g * f);
        const p2 = pkt(winkel[i + 1], g * f);
        const mx = (p1[0] + p2[0]) / 2 * 0.8;
        const my = (p1[1] + p2[1]) / 2 * 0.8;
        d += (i === 0 ? "M" + r1(p1[0]) + " " + r1(p1[1]) + " " : "") + "Q" + r1(mx) + " " + r1(my) + " " + r1(p2[0]) + " " + r1(p2[1]) + " ";
      }
    });
    let s = '<path d="' + d + '" fill="none" stroke="#6f6f6f" stroke-width="1.1"/>';
    if (spinne) {
      const sx = g * 0.45;
      const sy = g * 0.45 + 18;
      s += '<line x1="' + r1(sx) + '" y1="' + r1(g * 0.3) + '" x2="' + r1(sx) + '" y2="' + r1(sy) + '" stroke="#6f6f6f" stroke-width="1"/>' +
        '<path d="M' + r1(sx - 6) + " " + r1(sy - 3) + " L" + r1(sx + 6) + " " + r1(sy + 3) + " M" + r1(sx - 6) + " " + r1(sy + 3) +
        " L" + r1(sx + 6) + " " + r1(sy - 3) + " M" + r1(sx - 7) + " " + r1(sy) + " L" + r1(sx + 7) + " " + r1(sy) +
        '" stroke="#222" stroke-width="1.3"/>' + '<circle cx="' + r1(sx) + '" cy="' + r1(sy) + '" r="3.5" fill="#222"/>';
    }
    return s;
  }

  // ---- Belohnungen (Raum mindestens sauber) --------------------------
  function dampf(x, y) {
    return '<path class="dampf" d="M' + x + " " + y + " q-4 -5 0 -10 q4 -5 0 -10" + '" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>';
  }

  const BELOHNUNG = {
    kessel: { w: 40, zeichnen: function () {
      return P("M30 -12 L40 -20 L38 -23 L28 -17Z", "#e63946", ' stroke-width="1.5"') +
        P("M4 0 Q0 -20 17 -22 Q34 -20 30 0Z", "#e63946", ' stroke-width="1.5"') +
        E(17, -22, 7, 3, "#c1121f", ' stroke-width="1.5"') + C(17, -26, 2.5, "#333", ' stroke-width="1"') +
        P("M7 -18 Q17 -34 27 -18", "none", ' stroke-width="2"') + dampf(40, -24);
    } },
    kaffee: { w: 22, zeichnen: function () {
      return E(8, 0, 11, 2.5, "#ffffff", ' stroke-width="1.5"') + P("M13 -10 Q19 -7 13 -4", "none", ' stroke-width="1.5"') +
        R(1, -13, 12, 12, "#ffffff", 3, ' stroke-width="1.5"') + dampf(6, -15) + dampf(10, -16);
    } },
    ente: { w: 22, zeichnen: function () {
      return E(10, -7, 10, 7, "#ffd60a", ' stroke-width="1.5"') + C(17, -16, 5, "#ffd60a", ' stroke-width="1.5"') +
        P("M21 -16 L26 -15 L21 -13Z", "#f4a259", ' stroke-width="1"') + C(18, -17, 1, OL, OHNE);
    } },
    vase: { w: 20, zeichnen: function () {
      return L(8, -16, 5, -32, "#4f772d", 1.5) + L(10, -16, 10, -36, "#4f772d", 1.5) + L(12, -16, 16, -31, "#4f772d", 1.5) +
        C(5, -33, 3.5, "#f28482", ' stroke-width="1"') + C(10, -37, 3.5, "#f9e79f", ' stroke-width="1"') + C(16, -32, 3.5, "#9b72cf", ' stroke-width="1"') +
        P("M6 0 L4 -12 Q10 -20 16 -12 L14 0Z", "#6c9bd2", ' stroke-width="1.5"');
    } },
    teddy: { w: 24, zeichnen: function () { return UNORDNUNG.teddy.zeichnen(); } },
    sonnenblume: { w: 24, zeichnen: function () {
      let s = L(12, 0, 12, -46, "#4f772d", 2.5) + E(7, -22, 6, 3, "#6a994e", ' stroke-width="1"');
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        s += E(r1(12 + 8 * Math.cos(a)), r1(-52 + 8 * Math.sin(a)), 4, 4, "#ffd60a", ' stroke-width="1"');
      }
      return s + C(12, -52, 6, "#8a5a3b", ' stroke-width="1"');
    } },
    schmetterling: { w: 20, zeichnen: function () {
      return '<g class="flattert">' + E(5, -10, 5, 6, "#f28482", ' stroke-width="1"') + E(15, -10, 5, 6, "#f28482", ' stroke-width="1"') +
        E(6, -3, 3.5, 4, "#f7b267", ' stroke-width="1"') + E(14, -3, 3.5, 4, "#f7b267", ' stroke-width="1"') + "</g>" +
        L(10, -14, 10, 0, OL, 2);
    } },
    glitzer: { w: 30, zeichnen: function () {
      return stern(6, -8, 5, "#ffe066", ' class="funkeln"') + stern(22, -20, 7, "#ffe066", ' class="funkeln" style="animation-delay:.5s"') +
        stern(14, -34, 4, "#ffe066", ' class="funkeln" style="animation-delay:1s"');
    } }
  };

  // ---- Tiere -----------------------------------------------------------
  // ---- Tiere: Katzen und Hunde in verschiedenen Farben ---------------------
  const TIER_FARBEN = {
    katze: [["orange", "Orange"], ["grau", "Grau"], ["schwarz", "Schwarz"], ["weiss", "Weiß"],
      ["schwarzweiss", "Schwarz-Weiß"], ["getigert", "Grau getigert"], ["tortie", "Schwarz-braun (Tortie)"], ["dreifarbig", "Dreifarbig"]],
    hund: [["schwarz", "Schwarz"], ["weiss", "Weiß"], ["braun", "Braun"], ["schwarzweiss", "Schwarz-Weiß gescheckt"]]
  };
  const FELL = { orange: "#f4a259", grau: "#9aa0a6", schwarz: "#3d3d4a", weiss: "#fbf7f0", schwarzweiss: "#fbf7f0",
    getigert: "#9aa0a6", tortie: "#3d3d4a", dreifarbig: "#fbf7f0", braun: "#a47148" };
  const RAND = { orange: "#d9822b", grau: "#6e747b", schwarz: "#25252e", weiss: "#b5aa9a", schwarzweiss: "#b5aa9a",
    getigert: "#4b5058", tortie: "#25252e", dreifarbig: "#b5aa9a", braun: "#6f4e37" };

  function tp(d, fill, st) {
    return '<path d="' + d + '" fill="' + fill + '" stroke="' + st + '" stroke-width="1" stroke-linejoin="round"/>';
  }
  function tl(d, st, w) {
    return '<path d="' + d + '" fill="none" stroke="' + st + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  }
  function tk(cx, cy, r, fill, st) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '"' + (st ? ' stroke="' + st + '" stroke-width="1"' : "") + "/>";
  }
  function te(cx, cy, rx, ry, fill, st) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + (st ? ' stroke="' + st + '" stroke-width="1"' : "") + "/>";
  }
  function tr(x, y, w, h, fill, st) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" fill="' + fill + '" stroke="' + st + '" stroke-width="1"/>';
  }

  function katzeZeichnen(farbe) {
    const f = FELL[farbe] || FELL.orange;
    const r = RAND[farbe] || RAND.orange;
    // Schwanz schwingt leicht um seine Wurzel
    let s = '<g>' + tl("M8 -2 Q-8 -4 -4 -20", r, 4) +
      '<animateTransform attributeName="transform" type="rotate" values="-8 8 -2;8 8 -2;-8 8 -2" dur="2.6s" repeatCount="indefinite"/></g>' +
      tp("M6 0 Q2 -18 12 -24 Q22 -26 26 -14 Q28 -4 24 0Z", f, r) +
      tp("M15 -33 L16 -43 L21 -36Z", f, r) + tp("M24 -36 L29 -43 L30 -32Z", f, r) +
      tk(22, -28, 9, f, r) +
      tl("M16 -29 Q18 -31 20 -29 M24 -29 Q26 -31 28 -29", "#333", 1.5) +
      tk(22, -25, 1.3, "#e07a5f") +
      tl("M12 -12 L16 -10 M12 -8 L16 -6", r, 1.5);
    if (farbe === "schwarzweiss") s += te(14, -14, 6, 6, "#3d3d4a") + tp("M13 -28 Q13 -37 22 -37 L22 -28Z", "#3d3d4a", "#3d3d4a");
    if (farbe === "getigert") s += tl("M12 -30 L14 -22 M18 -32 L20 -22 M24 -30 L25 -22", r, 1.5);
    if (farbe === "tortie") s += te(16, -14, 7, 5, "#b5733c") + te(28, -8, 5, 4, "#b5733c") + tk(26, -30, 3, "#b5733c");
    if (farbe === "dreifarbig") s += te(14, -14, 6, 5, "#3d3d4a") + te(28, -8, 5, 4, "#f4a259") + tp("M13 -28 Q13 -37 22 -37 L22 -28Z", "#f4a259", "#f4a259");
    return s;
  }

  function hundZeichnen(farbe) {
    const f = FELL[farbe] || FELL.braun;
    const r = RAND[farbe] || RAND.braun;
    // Schwanz wedelt schnell um seine Wurzel
    let s = '<g>' + tl("M6 -30 Q-4 -42 4 -46", r, 4) +
      '<animateTransform attributeName="transform" type="rotate" values="-16 6 -30;16 6 -30;-16 6 -30" dur="0.9s" repeatCount="indefinite"/></g>' +
      tr(7, -18, 4, 18, f, r) + tr(15, -18, 4, 18, f, r) + tr(27, -18, 4, 18, f, r) + tr(35, -18, 4, 18, f, r) +
      '<rect x="4" y="-36" width="40" height="22" rx="11" fill="' + f + '" stroke="' + r + '" stroke-width="1"/>' +
      te(40, -40, 10, 8, f, r) +
      P("M32 -44 Q26 -44 25 -36 Q25 -28 30 -29 Q33 -36 34 -40Z", r, r) +
      tk(49, -41, 2.2, "#333") + tk(37, -43, 1.4, "#333");
    if (farbe === "schwarzweiss") s += te(14, -28, 8, 6, "#3d3d4a");
    return s;
  }

  const TIERE = {
    katze: { name: "Katze", w: 38, zeichnen: katzeZeichnen },
    hund: { name: "Hund", w: 50, zeichnen: hundZeichnen }
  };

  // ---- Schädel & Fee (schweben über den Möbeln, Mittelpunkt 0/0) -------
  function schaedel() {
    const rot = "#d62828";
    const dunkel = "#2b0a0a";
    return '<circle cx="0" cy="-2" r="32" fill="' + rot + '" opacity=".16"/>' +
      L(-24, -24, 24, 16, rot, 7) + L(24, -24, -24, 16, rot, 7) +
      C(-25, -25, 5, rot) + C(25, -25, 5, rot) + C(-25, 17, 5, rot) + C(25, 17, 5, rot) +
      R(-10, 2, 20, 13, rot, 3) + C(0, -8, 17, rot) +
      '<circle cx="-7" cy="-8" r="5" fill="' + dunkel + '"/><circle cx="7" cy="-8" r="5" fill="' + dunkel + '"/>' +
      '<path d="M0 -2 L-3 4 L3 4Z" fill="' + dunkel + '"/>' + L(-5, 9, -5, 15, dunkel, 1.5) + L(0, 9, 0, 15, dunkel, 1.5) + L(5, 9, 5, 15, dunkel, 1.5);
  }

  function fee() {
    const fluegel = ' stroke="#4f9d69" stroke-width="1.5"';
    return '<circle cx="0" cy="0" r="30" fill="#b7f0c4" opacity=".35"/>' +
      '<ellipse class="fluegel" cx="-12" cy="-6" rx="12" ry="17" fill="#d8ffe3" opacity=".85"' + fluegel + "/>" +
      '<ellipse class="fluegel" cx="12" cy="-6" rx="12" ry="17" fill="#d8ffe3" opacity=".85"' + fluegel + "/>" +
      P("M-10 18 L0 -4 L10 18Z", "#3fae5a", ' stroke-width="1.5"') +
      C(0, -11, 7, "#ffe0c2", ' stroke-width="1.5"') +
      P("M-7 -12 Q0 -24 7 -12 Q4 -18 0 -18 Q-4 -18 -7 -12Z", "#7ac943", ' stroke-width="1.2"') +
      C(-2.5, -11, 0.9, OL, OHNE) + C(2.5, -11, 0.9, OL, OHNE) +
      P("M-2 -8 Q0 -6.5 2 -8", "none", ' stroke-width="1"') +
      L(7, 4, 19, -14, "#8a5a3b", 2) + stern(20, -16, 5, "#ffe066") +
      stern(-24, -20, 4, "#ffe066", ' class="funkeln"') + stern(26, 8, 3.5, "#ffe066", ' class="funkeln" style="animation-delay:.6s"') +
      stern(-20, 14, 3, "#ffe066", ' class="funkeln" style="animation-delay:1.1s"');
  }

  // ---- Effekte an einzelnen Möbeln ----------------------------------
  // Glas umgekippt (Tisch abwischen): liegt am Tischrand, Pfütze davor
  function glasKippt() {
    return E(12, 1, 11, 2.5, "#bde0fe", ' stroke-width="1"') +
      P("M2 -4 L14 -6 L18 -2 L8 0Z", "rgba(190,225,245,.8)", ' stroke-width="1"');
  }

  // Flecken auf dem Möbel selbst
  function fleckAufMoebel(rnd) {
    const b = 8 + Math.round(rnd() * 8);
    return '<ellipse cx="0" cy="0" rx="' + b + '" ry="' + r1(b * 0.7) + '" fill="#7a5a3a" opacity=".5"/>';
  }

  // Fliege (am Katzenklo oder in der Küche)
  function fliege() {
    return '<g class="flattert"><ellipse cx="0" cy="0" rx="2.2" ry="1.6" fill="#333"/>' +
      '<ellipse cx="-2" cy="-3" rx="2" ry="1.2" fill="#ffffff" opacity=".8"/><ellipse cx="2" cy="-3" rx="2" ry="1.2" fill="#ffffff" opacity=".8"/></g>';
  }

  // Turnschuh von der Seite, Sohle hell
  function schuh(x, y, farbe) {
    return '<g transform="translate(' + x + " " + y + ')">' +
      P("M0 0 L0 -9 Q2 -12 8 -11 L12 -8 Q18 -6 19 -2 L19 0Z", farbe, ' stroke-width="1"') +
      L(0, -2, 19, -2, "#ffffff", 1.5) + "</g>";
  }

  global.Moebel = {
    KATALOG: KATALOG,
    DEKO: DEKO,
    UNORDNUNG: UNORDNUNG,
    UNORDNUNG_JE_RAUM: UNORDNUNG_JE_RAUM,
    BELOHNUNG: BELOHNUNG,
    TIERE: TIERE,
    TIER_FARBEN: TIER_FARBEN,
    wollmaus: wollmaus,
    glasKippt: glasKippt,
    fleckAufMoebel: fleckAufMoebel,
    fliege: fliege,
    fleck: fleck,
    spinnweben: spinnweben,
    schaedel: schaedel,
    fee: fee,
    stern: stern,
    r1: r1
  };
})(window);
