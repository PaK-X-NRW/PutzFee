# CLAUDE.md – Arbeitsanleitung für Claude

Verbindliche Regeln für dieses Repository. Das technische Vorbild ist
Noten-Fritze (`c:\Repo\Noten_Fritze`). Muster von dort bitte übernehmen, statt
neue zu erfinden.

## 1. Was ist PutzFee?

PutzFee ist ein Haushalts-Assistent mit Gamification im Puppenhaus-Look. Die
Ideen stammen von der Partnerin des Entwicklers; sie ist die eigentliche
Nutzerin.

Es gibt zwei Ansichten:
- **Hausansicht:** seitlicher Querschnitt wie ein offenes Puppenhaus.
- **Listenansicht:** Aufgaben nach Dringlichkeit, Challenge-Kacheln. Sie ist
  noch nicht gebaut.

- **UI-Sprache:** Deutsch, verspielt und charmant.
- **Zielgerät:** Tablet im Querformat, Touch.
- **Daten:** 100 % lokal. Kein Server, keine Telemetrie, **kein Abgleich
  zwischen Geräten** (bewusst so entschieden).
- **Veröffentlichung:** über GitHub Pages.

## 2. Harte technische Regeln

1. Kein Build-Schritt, keine Abhängigkeiten, kein CDN. Das gilt auch für kleine
   Bibliotheken: Vanilla HTML/CSS/JS.
2. Klassische `<script>`-Tags, keine ES-Module. Die App muss per `file://`
   laufen.
3. Code-Stil wie in Noten-Fritze:
   - `const`/`let` und Arrow Functions
   - Strings mit `+` verketten, keine Template-Literals
   - jede Datei als IIFE mit `"use strict";`
   - Header-Kommentar `/* ===` am Dateianfang
4. Grafik ist **selbst gebautes Inline-SVG**, keine Rasterbilder. Nur so lassen
   sich Möbel stufenlos mit der Heatmap-Farbe einfärben.
5. Nutzertexte (Raum- und Aufgabennamen) immer escapen, bevor sie ins
   HTML/SVG gehen.
6. Interaktion läuft über `data-action` und zentrale Delegation, kein
   Inline-`onclick`.
7. Minimale, fokussierte Änderungen. Keine ungefragten Refactorings.

## 3. Fachregeln (mit der Nutzerin abgestimmt)

- **Rhythmus je Aufgabe:** Jede Aufgabe hat **entweder** ein Intervall
  („alle *n* Tage") **oder** feste Wochentage.
  - Wochentags-Aufgaben gelten bis zum nächsten geplanten Wochentag als
    erledigt.
- **Wann eine Aufgabe als erledigt gilt:** solange ihr nächster Termin noch
  nicht erreicht ist. Beispiel „alle 7 Tage": Sie gilt am Putztag und an den
  6 Tagen danach als erledigt, wird dabei aber in der Heatmap immer röter.
  - Rechnung: `Calc.aufgabenStand`
  - `anteil` 0 = frisch, 1 = fällig, > 1 = überfällig (dunkleres Rot)
- **Raumstatus** (`Calc.raumStand`), gemessen am Anteil erledigter Aufgaben:

  | Anteil | Status | Anzeige |
  |---|---|---|
  | 0 % | biohazard | roter Totenschädel, „BIOHAZARD" |
  | über 0 %, unter 50 % | schmutzig | – |
  | ab 50 % | sauber | Belohnung im Raum, Haustier darf dort sein |
  | 100 % | blitzsauber | grüne Fee |
  | ohne Aufgaben | leer | Raum grau |

- **Möbel** erscheinen nur, wenn eine Aufgabe des Raums sie nennt. Ihre Farbe
  zeigt die dringendste dieser Aufgaben.
- **Effekte** hängen am Feld `effekt` einer Aufgabe:

  | `effekt` | Bild im Raum |
  |---|---|
  | `aufraeumen` | Unordnung, jeden Tag neu gewürfelt über `Calc.zufall(Tag + Raum)`; verschwindet, sobald erledigt |
  | `staubwischen` | Spinnweben oben in den Ecken |
  | `staubsaugen` | Wollmäuse |
  | `wischen` | Flecken |

- **Haustiere** leiten sich aus den Utensilien ab (`KATALOG[..].tier`). Sie
  gehen in den liebsten sauberen Raum (`LIEBLINGSORTE` in `haus.js`).
- **Räume** sind umbenennbar. Die Lage im Haus kommt aus `Haus.LAGE` und hängt
  an der Raum-ID, nicht am Namen. Es gibt zwei freie Räume (`frei1`, `frei2`).
- Bei offenen fachlichen Fragen (Haushaltsabläufe, Spielregeln) **fragen, nicht
  raten**.

## 4. Arbeitsweise

- **Erst planen, dann bauen:** betroffene Stellen lesen, den Plan kurz
  vorlegen und auf Zustimmung warten. Ausnahme sind winzige, offensichtliche
  Korrekturen.
- **Wirkung vor Code:** zuerst beschreiben, was sich auf dem Bildschirm ändert,
  dann die Dateien nennen.
- **Verifikation:** `index.html` im Browser öffnen, den Flow durchklicken
  (Raum antippen, abhaken, Zeit vorspulen) und auf Fehler in der Konsole
  achten.
- **Commit-Messages** auf Deutsch, kurz.
- Sobald es einen Service Worker gibt, gilt dieselbe Cache- und
  Versionsregel wie in Noten-Fritze: Die Versionsnummer wird nur auf Ansage
  erhöht.
