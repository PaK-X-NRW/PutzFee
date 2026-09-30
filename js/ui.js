/* =====================================================================
   ui.js – kleine UI-Bausteine
   ---------------------------------------------------------------------
   - esc(text): Nutzertexte für HTML/SVG escapen
   - toast(text, { duration, aktion: { text, fn } }): Hinweis unten,
     optional mit Knopf (z. B. „Rückgängig")
   - fehlerMelden(e): Fehler als Toast + Konsole
   ===================================================================== */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  let aktuell = null;

  function toast(text, opts) {
    opts = opts || {};
    if (aktuell) aktuell.remove();
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = "<span>" + esc(text) + "</span>" + (opts.aktion ? "<button>" + esc(opts.aktion.text) + "</button>" : "");
    if (opts.aktion) {
      el.querySelector("button").addEventListener("click", () => {
        el.remove();
        Promise.resolve(opts.aktion.fn()).catch(fehlerMelden);
      });
    }
    document.body.appendChild(el);
    aktuell = el;
    setTimeout(() => { if (el.parentNode) el.remove(); if (aktuell === el) aktuell = null; }, opts.duration || 4000);
  }

  function fehlerMelden(e) {
    console.error(e);
    toast("Das hat nicht geklappt: " + ((e && e.message) || e), { duration: 8000 });
  }

  global.UI = { esc: esc, toast: toast, fehlerMelden: fehlerMelden };
})(window);
