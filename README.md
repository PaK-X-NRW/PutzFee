# PutzFee 🧚

Ein verspielter Haushalts-Assistent im Puppenhaus-Look. Jede Aufgabe hat einen
Rhythmus: alle *n* Tage oder an festen Wochentagen. Wenn eine Aufgabe länger
liegen bleibt, färbt sie sich von Grün nach Rot. Im Haus zeigen Spinnweben,
Wollmäuse, Flecken und herumliegende Sachen, wo es Zeit wird. Saubere Räume
belohnen mit Katze, Wasserkessel oder Kaffeetasse, blitzsaubere mit der
PutzFee.

- **100 % lokal:** keine Anmeldung, kein Server und kein Abgleich zwischen Geräten.
- **Tablet quer:** für Touch-Bedienung gebaut.
- **Ohne Build-Schritt:** Vanilla HTML/CSS/JS, läuft per Doppelklick auf `index.html`.
- **Online:** https://putzfee.patrick-knapp.de (GitHub Pages).

## Stand: Hausansicht mit Speicherung

Der aktuelle Stand zeigt den Stil und die Spielmechanik:

- Querschnitt mit Dachboden, OG, EG, Keller, Garage, Balkon und Garten. Räume
  ohne Aufgaben bleiben grau, darunter zwei frei benennbare Räume.
- Möbel erscheinen nur, wenn eine Aufgabe sie nennt. Ihre Farbe zeigt die
  dringendste dieser Aufgaben.
- Raumschild mit Prozentanzeige und Spruch. Es gibt folgende Stufen:

  | Anteil erledigter Aufgaben | Anzeige |
  |---|---|
  | 0 % | Totenschädel und BIOHAZARD |
  | ab 50 % | Belohnung und Haustier |
  | 100 % | Fee |

- Effekte: Spinnweben (Staub wischen), Wollmäuse (Staubsaugen), Flecken (Boden
  wischen), tägliche Unordnung (Aufräumen).
- Raum oder Möbelstück antippen: Aufgaben abhaken, anlegen (mit Vorlagen) oder
  löschen, Raum umbenennen, Deko wählen.
- Nach dem Abhaken erscheint ein Hinweis mit „Rückgängig".
- Vorschau (◀ ▶ / +1 Woche): zeigt, wie es an einem anderen Tag aussieht.
  Solange die Vorschau aktiv ist, ist Abhaken gesperrt.
- Menü ☰:
  - **Sichern:** alle Daten als JSON-Datei speichern
  - **Wiederherstellen:** eine Sicherung laden; sie ersetzt alles
  - **Haus leeren:** Aufgaben, Verlauf und Deko löschen; Räume und Namen bleiben

## Datenmodell (IndexedDB `putzfee`)

Beim allerersten Start legt die App einmalig den Beispielhaushalt an.

| Store | Inhalt |
|---|---|
| `raeume` | `{ id, name, deko: [] }`. `id` ist der Platz im Haus (`Haus.LAGE`), der Typ kommt aus `Demo.RAEUME`. |
| `aufgaben` | `{ id, raumId, titel, moebel, effekt, rhythmus, zuletzt }`, siehe unten |
| `erledigungen` | Verlauf `{ id, aufgabeId, raumId, tag, ts }`, ein Eintrag je Abhaken |
| `einstellungen` | `{ key: "schema", version }`, die Datenversion für Migrationen |

Felder einer Aufgabe:
- `rhythmus`: `{ art: "intervall", tage }` oder `{ art: "wochentage", wochentage: [0–6] }`
- `zuletzt`: Tageszahl des letzten Erledigens

Tage werden als fortlaufende Tageszahl des lokalen Datums gespeichert
(`Calc.tagNr`).

## Dateien

| Datei | Namespace | Aufgabe |
|---|---|---|
| `js/calc.js` | `Calc` | Fälligkeit, Heatmap-Farbe, Raumstatus, Sprüche, Zufall mit festem Startwert |
| `js/moebel.js` | `Moebel` | SVG-Bibliothek: Möbel, Tier-Utensilien, Deko, Unordnung, Effekte, Fee, Schädel |
| `js/haus.js` | `Haus` | Lage der Räume, Aufbau des Puppenhaus-SVG |
| `js/demo.js` | `Demo` | Räume des Hausplans, Beispielhaushalt und Aufgaben-Vorlagen (speichert nichts) |
| `js/db.js` | `DB` | IndexedDB-Wrapper, übernommen aus Noten-Fritze |
| `js/ui.js` | `UI` | `esc`, Toast (mit Aktion), `fehlerMelden` |
| `js/store.js` | `Store` | Start/Migration, Räume, Aufgaben, Erledigen und Rückgängig, Haus leeren, Backup |
| `js/app.js` | – | Zustand, Raum-Panel, Vorschau, Menü, Klick-Delegation, Start |

## Geplante nächste Schritte

1. PWA (offline, Service Worker, zum Home-Bildschirm hinzufügen)
2. Listenansicht nach Dringlichkeit und „Aufgaben pro Tag"
3. Challenge-Kacheln: Blitzschnell · Ganz gewöhnlich · Ganz gründlich · Überall sauber
4. Selbsttest `tests.html` für die Rechenregeln
