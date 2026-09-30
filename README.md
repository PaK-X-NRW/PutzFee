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
- **Veröffentlichung:** über GitHub Pages geplant.

## Stand: Prototyp „Puppenhaus"

Der Prototyp soll den Stil und die Spielmechanik zeigen:

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
- Zeit vorspulen (◀ ▶ / +1 Woche), um die Heatmap zu sehen.

Die Daten liegen im Prototyp nur im Arbeitsspeicher. Nach dem Neuladen startet
der Beispielhaushalt neu.

## Dateien

| Datei | Namespace | Aufgabe |
|---|---|---|
| `js/calc.js` | `Calc` | Fälligkeit, Heatmap-Farbe, Raumstatus, Sprüche, Zufall mit festem Startwert |
| `js/moebel.js` | `Moebel` | SVG-Bibliothek: Möbel, Tier-Utensilien, Deko, Unordnung, Effekte, Fee, Schädel |
| `js/haus.js` | `Haus` | Lage der Räume, Aufbau des Puppenhaus-SVG |
| `js/demo.js` | `Demo` | Beispielhaushalt und Aufgaben-Vorlagen |
| `js/app.js` | – | Zustand, Raum-Panel, Zeitsteuerung, Klick-Delegation |

## Geplante nächste Schritte

1. Speicherung in IndexedDB und PWA (offline, Service Worker)
2. Listenansicht nach Dringlichkeit und „Aufgaben pro Tag"
3. Challenge-Kacheln: Blitzschnell · Ganz gewöhnlich · Ganz gründlich · Überall sauber
4. Selbsttest `tests.html` für die Rechenregeln
