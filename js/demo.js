/* =====================================================================
   demo.js – Beispielhaushalt und Aufgaben-Vorlagen für den Prototyp
   ---------------------------------------------------------------------
   - RAEUME: alle Räume des Puppenhauses (id = Platz im Plan, typ, name)
   - VORLAGEN: vorgegebene Aufgaben als Inspiration
   - daten(heute): Beispielhaushalt; „zuletzt" relativ zu heute, damit
     jeder Status einmal zu sehen ist (Fee, Biohazard, grau …).
     Speichert nichts – Store.start legt ihn beim ersten Start an.
   ===================================================================== */
(function (global) {
  "use strict";

  const RAEUME = [
    { id: "rumpelkammer", typ: "rumpelkammer", name: "Rumpelkammer" },
    { id: "dachzimmer1", typ: "dachzimmer", name: "Dachzimmer 1" },
    { id: "dachzimmer2", typ: "dachzimmer", name: "Dachzimmer 2" },
    { id: "buero", typ: "buero", name: "Büro" },
    { id: "schlafzimmer", typ: "schlafzimmer", name: "Schlafzimmer" },
    { id: "kinder1", typ: "kinderzimmer", name: "Kinderzimmer 1" },
    { id: "kinder2", typ: "kinderzimmer", name: "Kinderzimmer 2" },
    { id: "bad", typ: "bad", name: "Badezimmer" },
    { id: "frei1", typ: "frei", name: "Freier Raum 1" },
    { id: "flur", typ: "flur", name: "Flur" },
    { id: "wohnzimmer", typ: "wohnzimmer", name: "Wohnzimmer" },
    { id: "esszimmer", typ: "esszimmer", name: "Esszimmer" },
    { id: "kueche", typ: "kueche", name: "Küche" },
    { id: "gaestewc", typ: "gaestewc", name: "Gäste-WC" },
    { id: "keller", typ: "keller", name: "Keller 1" },
    { id: "keller2", typ: "keller", name: "Keller 2" },
    { id: "frei2", typ: "frei", name: "Freier Raum 2" },
    { id: "garage", typ: "garage", name: "Garage" },
    { id: "balkon", typ: "balkon", name: "Balkon" },
    { id: "garten", typ: "garten", name: "Garten" }
  ];

  const alle = (n) => ({ art: "intervall", tage: n });
  const an = (tage) => ({ art: "wochentage", wochentage: tage });

  const VORLAGEN = [
    { titel: "Treppe putzen", moebel: "treppe", effekt: null, rhythmus: alle(14) },
    { titel: "Wäsche waschen", moebel: "waschmaschine", effekt: "waesche", rhythmus: alle(3) },
    { titel: "Lampe reinigen", moebel: "deckenlampe", effekt: null, rhythmus: alle(60) },
    { titel: "Gardinen waschen", moebel: "gardine", effekt: null, rhythmus: alle(90) },
    { titel: "Akten sortieren", moebel: "aktenstapel", effekt: null, rhythmus: alle(14) },
    { titel: "Schreibtisch abwischen", moebel: "schreibtisch", effekt: "flecken", rhythmus: alle(7) },
    { titel: "Aufräumen", moebel: null, effekt: "aufraeumen", rhythmus: alle(1) },
    { titel: "Staub wischen", moebel: null, effekt: "staubwischen", rhythmus: alle(7) },
    { titel: "Staubsaugen", moebel: null, effekt: "staubsaugen", rhythmus: alle(7) },
    { titel: "Boden wischen", moebel: null, effekt: "wischen", rhythmus: alle(7) },
    { titel: "Fenster putzen", moebel: "fenster", effekt: null, rhythmus: alle(90) },
    { titel: "Sofa absaugen", moebel: "sofa", effekt: null, rhythmus: alle(30) },
    { titel: "Sofabezug waschen", moebel: "sofa", effekt: null, rhythmus: alle(180) },
    { titel: "Bett frisch beziehen", moebel: "bett", effekt: null, rhythmus: alle(14) },
    { titel: "Kleiderschrank auswischen", moebel: "schrank", effekt: null, rhythmus: alle(90) },
    { titel: "Kühlschrank auswischen", moebel: "kuehlschrank", effekt: null, rhythmus: alle(30) },
    { titel: "Herd & Backofen reinigen", moebel: "herd", effekt: null, rhythmus: alle(14) },
    { titel: "WC putzen", moebel: "wc", effekt: null, rhythmus: alle(3) },
    { titel: "Badewanne putzen", moebel: "badewanne", effekt: null, rhythmus: alle(7) },
    { titel: "Spiegel putzen", moebel: "spiegel", effekt: null, rhythmus: alle(7) },
    { titel: "Waschmaschine reinigen", moebel: "waschmaschine", effekt: null, rhythmus: alle(30) },
    { titel: "Katzenklo säubern", moebel: "katzenklo", effekt: null, rhythmus: alle(1) },
    { titel: "Futternäpfe spülen", moebel: "futternapf", effekt: null, rhythmus: alle(1) },
    { titel: "Kratzbaum absaugen", moebel: "kratzbaum", effekt: null, rhythmus: alle(14) },
    { titel: "Aquarium reinigen", moebel: "aquarium", effekt: null, rhythmus: alle(14) },
    { titel: "Hundekorb waschen", moebel: "hundekorb", effekt: null, rhythmus: alle(14) },
    { titel: "Mülltonne rausstellen", moebel: "muelltonne", effekt: null, rhythmus: an([1]) },
    { titel: "Pflanzen gießen", moebel: "pflanzen", effekt: null, rhythmus: an([1, 4]) },
    { titel: "Rasen mähen", moebel: "rasen", effekt: null, rhythmus: alle(7) }
  ];

  function daten(heute) {
    let n = 0;
    const aufgaben = [];
    // vorTagen: vor wie vielen Tagen zuletzt erledigt (null = noch nie)
    function A(raumId, titel, moebel, effekt, rhythmus, vorTagen) {
      const a = {
        id: "a" + (++n), raumId: raumId, titel: titel, moebel: moebel, effekt: effekt,
        rhythmus: rhythmus, zuletzt: vorTagen == null ? null : heute - vorTagen
      };
      aufgaben.push(a);
      return a;
    }

    // Wohnzimmer: sauber, Katze auf dem Sofa, aber heute noch nicht aufgeräumt
    A("wohnzimmer", "Staubsaugen", null, "staubsaugen", alle(7), 2);
    A("wohnzimmer", "Staub wischen", null, "staubwischen", alle(7), 3);
    A("wohnzimmer", "Sofa absaugen", "sofa", null, alle(30), 10);
    A("wohnzimmer", "Fernseher abstauben", "tv", null, alle(14), 5);
    A("wohnzimmer", "Aufräumen", null, "aufraeumen", alle(1), 1);
    A("wohnzimmer", "Kratzbaum absaugen", "kratzbaum", null, alle(14), 3);
    A("wohnzimmer", "Fenster putzen", "fenster", "fenster", alle(90), 40);
    A("wohnzimmer", "Kamin ausfegen", "kamin", null, alle(60), 30);
    A("wohnzimmer", "Gardinen waschen", "gardine", null, alle(90), 30);
    A("wohnzimmer", "Lampe reinigen", "deckenlampe", null, alle(60), 20);
    A("wohnzimmer", "Teppich ausklopfen", "teppich", null, alle(60), 20);

    // Küche: alles erledigt → Fee + Wasserkessel
    A("kueche", "Herd reinigen", "herd", null, alle(7), 3);
    A("kueche", "Kühlschrank auswischen", "kuehlschrank", null, alle(30), 5);
    A("kueche", "Spüle putzen", "spuele", null, alle(3), 1);
    A("kueche", "Boden wischen", null, "wischen", alle(7), 2);
    A("kueche", "Futternäpfe spülen", "futternapf", null, alle(1), 0);

    // Esszimmer: genau die Hälfte → sauber, Kaffeetasse
    A("esszimmer", "Esstisch abwischen", "esstisch", "glas", alle(1), 1);
    A("esszimmer", "Staubsaugen", null, "staubsaugen", alle(7), 9);
    A("esszimmer", "Staub wischen", null, "staubwischen", alle(14), 6);
    A("esszimmer", "Aquarium reinigen", "aquarium", null, alle(14), 12);

    // Bad: nichts erledigt → BIOHAZARD
    A("bad", "Badewanne putzen", "badewanne", null, alle(7), 9);
    A("bad", "WC putzen", "wc", null, alle(3), 5);
    A("bad", "Waschbecken putzen", "waschbecken", null, alle(7), 8);
    A("bad", "Boden wischen", null, "wischen", alle(7), 12);
    A("bad", "Spiegel putzen", "spiegel", null, alle(7), 12);
    A("bad", "Staub wischen", null, "staubwischen", alle(14), 25);
    A("bad", "Dusche putzen", "dusche", "handtuch", alle(7), 6);

    // Gäste-WC: blitzsauber
    A("gaestewc", "WC putzen", "wc", null, alle(7), 4);
    A("gaestewc", "Waschbecken putzen", "waschbecken", null, alle(7), 4);

    // Schlafzimmer: 40 % → schmutzig, Spinnweben
    A("schlafzimmer", "Bett frisch beziehen", "bett", null, alle(14), 10);
    A("schlafzimmer", "Kleiderschrank auswischen", "schrank", null, alle(90), 95);
    A("schlafzimmer", "Staubsaugen", null, "staubsaugen", alle(7), 6);
    A("schlafzimmer", "Staub wischen", null, "staubwischen", alle(14), 16);
    A("schlafzimmer", "Aufräumen", null, "aufraeumen", alle(1), 2);

    // Kinderzimmer 1: 60 % → sauber, aber Spielzeug und Wollmäuse
    A("kinder1", "Spielzeug aufräumen", null, "aufraeumen", alle(1), 1);
    A("kinder1", "Spielzeugkiste auswischen", "spielzeugkiste", null, alle(30), 20);
    A("kinder1", "Bett frisch beziehen", "kinderbett", null, alle(14), 4);
    A("kinder1", "Staubsaugen", null, "staubsaugen", alle(7), 9);
    A("kinder1", "Schreibtisch aufräumen", "schreibtisch", null, alle(7), 2);

    // Flur: 3 von 4
    A("flur", "Garderobe ausmisten", "garderobe", null, alle(30), 12);
    A("flur", "Schuhregal abwischen", "schuhregal", null, alle(14), 3);
    A("flur", "Boden wischen", null, "wischen", alle(7), 8);
    A("flur", "Katzenklo säubern", "katzenklo", "fliegen", alle(1), 0);
    // Treppe: je Etage eine eigene Aufgabe
    [["keller", 20], ["eg", 6], ["og", 16], ["dach", 2]].forEach(([etage, vor]) => {
      A("flur", "Treppe putzen", "treppe", null, alle(14), vor).exemplar = etage;
    });

    // Rumpelkammer, Keller, Garage, Balkon, Garten
    A("rumpelkammer", "Kartons sortieren", "kartons", null, alle(180), 150);
    A("rumpelkammer", "Staub wischen", null, "staubwischen", alle(90), 60);
    A("rumpelkammer", "Staubsaugen", null, "staubsaugen", alle(30), 45);
    A("rumpelkammer", "Gerümpel ausmisten", "geruempel", null, alle(90), 60);
    // Büro
    A("buero", "Akten sortieren", "aktenstapel", null, alle(14), 9);
    A("buero", "Aktenschrank auswischen", "aktenschrank", null, alle(60), 40);
    A("buero", "Bürostuhl absaugen", "buerostuhl", null, alle(30), 12);
    A("buero", "Schreibtisch abwischen", "schreibtisch", "flecken", alle(7), 3);
    A("buero", "Staubsaugen", null, "staubsaugen", alle(7), 8);
    A("keller", "Gefriertruhe abtauen", "gefriertruhe", null, alle(180), 200);
    A("keller", "Regal sortieren", "regal", null, alle(90), 30);
    A("keller", "Waschmaschine reinigen", "waschmaschine", null, alle(30), 40);
    A("keller", "Wäsche waschen", "waschmaschine", "waesche", alle(3), 2);
    A("keller", "Heizung warten", "heizung", null, alle(365), 200);
    A("keller", "Boden fegen", null, "staubsaugen", alle(30), 50);
    A("garage", "Auto waschen", "auto", null, alle(30), 20);
    A("garage", "Werkbank aufräumen", "werkbank", null, alle(60), 70);
    A("garage", "Mülltonne rausstellen", "muelltonne", null, an([1]), 2);
    A("balkon", "Pflanzen gießen", "pflanzen", null, an([1, 4]), 1);
    A("balkon", "Boden fegen", null, "staubsaugen", alle(14), 4);
    A("garten", "Rasen mähen", "rasen", null, alle(7), 9);
    A("garten", "Hecke schneiden", "hecke", null, alle(60), 20);
    A("garten", "Beet jäten", "beet", null, alle(14), 10);
    A("garten", "Gartenmöbel abwischen", "gartenmoebel", null, alle(30), 5);

    return {
      raeume: RAEUME.map((r) => ({ id: r.id, typ: r.typ, name: r.name })),
      aufgaben: aufgaben,
      deko: {
        wohnzimmer: ["bild", "lampe"],
        schlafzimmer: ["bild"],
        esszimmer: ["bild", "pflanze"],
        kueche: ["uhr"],
        flur: ["uhr"],
        kinder1: ["bild"]
      }
    };
  }

  global.Demo = { RAEUME: RAEUME, VORLAGEN: VORLAGEN, daten: daten };
})(window);
