/* Tessella — UI wiring: state, controls, drawing, export, persistence. */
(function () {
  "use strict";

  var theory = window.TessellaTheory;
  var STORAGE_KEY = "tessella.v1";
  var GRID = 3;

  var DEFAULTS = {
    mode: "p4m",
    motif: "petals",
    paletteName: "terracotta",
    tileSize: 120,
    strokeWidth: 2,
    density: 5,
    seed: 7,
    hue: 24,
    scheme: "analogous",
    showDomain: true,
    title: "Untitled pattern",
    customLines: null,
  };

  var state = loadState();
  var drawing = false;
  var drawPoints = [];

  function loadState() {
    var stored = null;
    try {
      stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    } catch (error) { stored = null; }
    return Object.assign({}, DEFAULTS, stored || {});
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) { /* storage unavailable */ }
  }

  function $(id) { return document.getElementById(id); }

  /* ---------------------------------------------------------------- motif */

  function currentPolylines() {
    if (state.customLines) return state.customLines;
    var rng = theory.mulberry32(state.seed * 7919 + state.density);
    return theory.MOTIFS[state.motif].make(rng, state.density);
  }

  function paletteColors() {
    return state.customPalette || theory.PALETTES[state.paletteName];
  }

  /* -------------------------------------------------------------- render */

  function drawPreview() {
    var canvas = $("preview");
    window.TessellaEngine.renderPattern(canvas, {
      polylines: currentPolylines(),
      mode: state.mode,
      tileSize: state.tileSize,
      grid: GRID,
      palette: paletteColors(),
      strokeWidth: state.strokeWidth,
      showDomain: state.showDomain,
    });
  }

  /* ------------------------------------------------------------- controls */

  function buildModeButtons() {
    var grid = $("modeGrid");
    grid.replaceChildren();
    Object.keys(theory.SYMMETRIES).forEach(function (mode) {
      var meta = theory.SYMMETRY_META[mode];
      var button = document.createElement("button");
      button.type = "button";
      button.className = "mode-button" + (state.mode === mode ? " active" : "");
      button.innerHTML = '<span class="mode-name">' + mode + '</span>' +
        '<span class="mode-hint">' + meta.hint + '</span>';
      button.addEventListener("click", function () {
        state.mode = mode;
        refreshModeButtons();
        $("modeNote").textContent = meta.desc;
        persist();
        drawPreview();
      });
      grid.appendChild(button);
    });
    $("modeNote").textContent = theory.SYMMETRY_META[state.mode].desc;
  }

  function refreshModeButtons() {
    document.querySelectorAll(".mode-button").forEach(function (button) {
      var name = button.querySelector(".mode-name").textContent;
      button.classList.toggle("active", state.mode === name);
    });
  }

  function buildMotifButtons() {
    var grid = $("motifGrid");
    grid.replaceChildren();
    Object.keys(theory.MOTIFS).forEach(function (key) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "motif-button" + (state.motif === key && !state.customLines ? " active" : "");
      button.textContent = theory.MOTIFS[key].label;
      button.addEventListener("click", function () {
        state.motif = key;
        state.customLines = null;
        refreshMotifButtons();
        persist();
        drawPreview();
      });
      grid.appendChild(button);
    });
  }

  function refreshMotifButtons() {
    document.querySelectorAll(".motif-button").forEach(function (button, index) {
      var key = Object.keys(theory.MOTIFS)[index];
      button.classList.toggle("active", !state.customLines && state.motif === key);
    });
  }

  function buildPaletteRow() {
    var row = $("paletteRow");
    row.replaceChildren();
    Object.keys(theory.PALETTES).forEach(function (name) {
      var colors = theory.PALETTES[name];
      var swatch = document.createElement("div");
      swatch.className = "swatch" + (state.paletteName === name ? " active" : "");
      swatch.title = name;
      swatch.style.background = "linear-gradient(90deg," + colors.join(",") + ")";
      swatch.setAttribute("role", "button");
      swatch.setAttribute("aria-label", "Palette " + name);
      swatch.addEventListener("click", function () {
        state.paletteName = name;
        refreshPaletteRow();
        persist();
        drawPreview();
      });
      row.appendChild(swatch);
    });
  }

  function refreshPaletteRow() {
    document.querySelectorAll(".swatch").forEach(function (swatch, index) {
      var name = Object.keys(theory.PALETTES)[index];
      swatch.classList.toggle("active", state.paletteName === name);
    });
  }

  function buildSliders() {
    bindSlider("tileSize", function (value) { state.tileSize = value; });
    bindSlider("strokeWidth", function (value) { state.strokeWidth = value; });
    bindSlider("density", function (value) {
      state.density = value;
      state.customLines = null;
    });
    $("hueSlider").value = String(state.hue);
    $("schemeSelect").value = state.scheme;
    $("showDomain").checked = state.showDomain;
    $("showDomain").addEventListener("change", function () {
      state.showDomain = this.checked;
      persist();
      drawPreview();
    });
    $("harmonyApply").addEventListener("click", applyHarmony);
  }

  function bindSlider(id, onChange) {
    var input = $(id);
    var output = $(id + "Value");
    input.value = String(state[id]);
    output.textContent = String(state[id]);
    input.addEventListener("input", function () {
      var value = parseFloat(this.value);
      state[id] = value;
      output.textContent = String(value);
      persist();
      drawPreview();
      if (onChange) onChange(value);
    });
  }

  function applyHarmony() {
    state.hue = parseFloat($("hueSlider").value);
    state.scheme = $("schemeSelect").value;
    var hues = theory.harmony(state.hue, state.scheme, 5);
    var colors = hues.map(function (hue) {
      return theory.hslToHex(hue, 0.45, 0.55);
    });
    state.customPalette = colors;
    persist();
    drawPreview();
  }

  /* ----------------------------------------------------------------- draw */

  function canvasPoint(event) {
    var canvas = $("preview");
    var rect = canvas.getBoundingClientRect();
    var x = (event.clientX - rect.left) / rect.width * canvas.width;
    var y = (event.clientY - rect.top) / rect.height * canvas.height;
    return { x: x / state.tileSize, y: y / state.tileSize };
  }

  function toggleDrawMode() {
    drawing = !drawing;
    drawPoints = [];
    $("drawHint").hidden = !drawing;
    $("preview").style.cursor = drawing ? "crosshair" : "default";
    $("drawToggle").classList.toggle("active", drawing);
    if (drawing) state.customLines = null;
  }

  function bindDrawing() {
    var canvas = $("preview");
    canvas.addEventListener("pointerdown", function (event) {
      if (!drawing) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      drawPoints = [canvasPoint(event)];
    });
    canvas.addEventListener("pointermove", function (event) {
      if (!drawing || drawPoints.length === 0) return;
      drawPoints.push(canvasPoint(event));
      var lines = theory.wrapAndSplit(drawPoints.slice(), 1);
      state.customLines = lines.length ? lines : null;
      refreshMotifButtons();
      drawPreview();
    });
    canvas.addEventListener("pointerup", function () {
      if (!drawing) return;
      state.customLines = drawPoints.length > 2
        ? theory.wrapAndSplit(drawPoints, 1) : null;
      drawPoints = [];
      persist();
    });
  }

  /* ------------------------------------------------------- presets/export */

  var PRESETS = [
    { name: "Moroccan Star", mode: "p4m", motif: "star", paletteName: "terracotta",
      tileSize: 140, strokeWidth: 2, density: 5, seed: 11 },
    { name: "Botanical Garden", mode: "pmm", motif: "petals", paletteName: "botanical",
      tileSize: 120, strokeWidth: 2.5, density: 6, seed: 23 },
    { name: "Midnight Waves", mode: "pm", motif: "waves", paletteName: "midnight",
      tileSize: 110, strokeWidth: 2, density: 7, seed: 5 },
    { name: "Sun Spokes", mode: "p4", motif: "radial", paletteName: "sorbet",
      tileSize: 130, strokeWidth: 3, density: 4, seed: 31 },
  ];

  function applyPreset(preset) {
    Object.keys(preset).forEach(function (key) {
      if (key in state) state[key] = preset[key];
    });
    state.customLines = null;
    state.customPalette = null;
    $("patternTitle").textContent = state.title = preset.name;
    syncControlsFromState();
    persist();
    drawPreview();
  }

  function randomize() {
    var rng = theory.mulberry32(Date.now() >>> 0);
    var modes = Object.keys(theory.SYMMETRIES);
    var motifs = Object.keys(theory.MOTIFS);
    var palettes = Object.keys(theory.PALETTES);
    state.mode = modes[Math.floor(rng() * modes.length)];
    state.motif = motifs[Math.floor(rng() * motifs.length)];
    state.paletteName = palettes[Math.floor(rng() * palettes.length)];
    state.customPalette = null;
    state.customLines = null;
    state.seed = Math.floor(rng() * 1000);
    state.density = 2 + Math.floor(rng() * 8);
    state.title = "Pattern " + state.seed;
    $("patternTitle").textContent = state.title;
    syncControlsFromState();
    persist();
    drawPreview();
  }

  function syncControlsFromState() {
    refreshModeButtons();
    refreshMotifButtons();
    refreshPaletteRow();
    ["tileSize", "strokeWidth", "density"].forEach(function (id) {
      var input = $(id);
      if (input) {
        input.value = String(state[id]);
        $(id + "Value").textContent = String(state[id]);
      }
    });
    $("modeNote").textContent = theory.SYMMETRY_META[state.mode].desc;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function exportSvg() {
    var svg = window.TessellaSvg.buildPatternSVG({
      polylines: currentPolylines(),
      mode: state.mode,
      tileSize: state.tileSize,
      palette: paletteColors(),
      strokeWidth: state.strokeWidth,
      width: state.tileSize * 4,
      height: state.tileSize * 4,
      title: state.title,
    });
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }),
      "tessella-" + state.mode + ".svg");
  }

  function exportPng() {
    var offscreen = document.createElement("canvas");
    window.TessellaEngine.renderPattern(offscreen, {
      polylines: currentPolylines(),
      mode: state.mode,
      tileSize: state.tileSize,
      grid: 4,
      palette: paletteColors(),
      strokeWidth: state.strokeWidth,
      showDomain: false,
    });
    offscreen.toBlob(function (blob) {
      if (blob) downloadBlob(blob, "tessella-" + state.mode + ".png");
    }, "image/png");
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    buildModeButtons();
    buildMotifButtons();
    buildPaletteRow();
    buildSliders();
    bindDrawing();
    syncControlsFromState();
    $("patternTitle").textContent = state.title;
    $("stageMeta").textContent = GRID + " × " + GRID + " tiles · group " + state.mode;

    $("presetButton").addEventListener("click", function () {
      var preset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
      applyPreset(preset);
    });
    $("randomize").addEventListener("click", randomize);
    $("drawToggle").addEventListener("click", toggleDrawMode);
    $("exportSvg").addEventListener("click", exportSvg);
    $("exportPng").addEventListener("click", exportPng);
    $("saveDesign").addEventListener("click", function () {
      persist();
      $("saveDesign").textContent = "Saved ✓";
      setTimeout(function () { $("saveDesign").textContent = "Save design"; }, 1500);
    });
    $("loadDesign").addEventListener("click", function () {
      state = loadState();
      syncControlsFromState();
      $("patternTitle").textContent = state.title;
      drawPreview();
    });
    $("clearDesign").addEventListener("click", function () {
      state.customLines = null;
      state.customPalette = null;
      refreshMotifButtons();
      persist();
      drawPreview();
    });

    drawPreview();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
