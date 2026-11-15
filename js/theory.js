/* Tessella — pure pattern theory: crystallographic symmetry groups, seamless
 * stroke wrapping, procedural motifs, seeded randomness, and color.
 * Browser-global + CommonJS dual export so Node's test runner can exercise
 * every piece of math without a DOM or canvas. */
(function (global) {
  "use strict";

  var TAU = Math.PI * 2;

  /* ------------------------------------------------------------- geometry */

  function mod(value, size) {
    return ((value % size) + size) % size;
  }

  /* Affine transforms about the cell center c = (0.5, 0.5), in unit coords. */
  function aroundCenter(p, a, b, c, d) {
    var cx = 0.5, cy = 0.5;
    var x = p.x - cx, y = p.y - cy;
    return { x: a * x + b * y + cx, y: c * x + d * y + cy };
  }
  var rot90 = function (p) { return aroundCenter(p, 0, -1, 1, 0); };
  var rot180 = function (p) { return aroundCenter(p, -1, 0, 0, -1); };
  var rot270 = function (p) { return aroundCenter(p, 0, 1, -1, 0); };
  var reflectV = function (p) { return aroundCenter(p, -1, 0, 0, 1); };
  var reflectH = function (p) { return aroundCenter(p, 1, 0, 0, -1); };
  var reflectD1 = function (p) { return aroundCenter(p, 0, 1, 1, 0); };
  var reflectD2 = function (p) { return aroundCenter(p, 0, -1, -1, 0); };

  /* The additional copies each group applies to a motif (the identity copy
   * is implicit).  Counts including the identity: p1=1, p2=2, pm=2,
   * pmm=4, p4=4, p4m=8 — the order of each group. */
  var SYMMETRIES = {
    p1: [],
    p2: [rot180],
    pm: [reflectV],
    pmm: [reflectV, reflectH, rot180],
    p4: [rot90, rot180, rot270],
    p4m: [rot90, rot180, rot270, reflectV, reflectH, reflectD1, reflectD2],
  };

  var SYMMETRY_META = {
    p1: { hint: "translate", count: 1, desc: "The motif simply repeats — the starting point of the classification." },
    p2: { hint: "180° turns", count: 2, desc: "Every motif reappears rotated half a turn around each tile center." },
    pm: { hint: "mirror", count: 2, desc: "A single reflection axis runs through every tile." },
    pmm: { hint: "mirrors + turns", count: 4, desc: "Two perpendicular mirrors generate four copies per tile." },
    p4: { hint: "90° turns", count: 4, desc: "Fourfold rotation centers create pinwheel symmetry." },
    p4m: { hint: "full square", count: 8, desc: "The richest square group: rotations plus every reflection." },
  };

  function applySymmetry(polylines, mode) {
    var transforms = SYMMETRIES[mode] || [];
    var copies = [polylines];
    transforms.forEach(function (transform) {
      copies.push(polylines.map(function (line) {
        return line.map(transform);
      }));
    });
    return copies;
  }

  /* Wrap stroke points into the unit cell, splitting polylines wherever a
   * segment crosses a cell boundary — this is what makes hand-drawn motifs
   * tile seamlessly. */
  function wrapAndSplit(points, size) {
    size = size || 1;
    var polylines = [];
    var current = [];
    var previous = null;
    points.forEach(function (point) {
      var wrapped = { x: mod(point.x, size), y: mod(point.y, size) };
      if (previous &&
          (Math.abs(wrapped.x - previous.x) > size * 0.5 ||
           Math.abs(wrapped.y - previous.y) > size * 0.5)) {
        if (current.length >= 2) polylines.push(current);
        current = [previous]; // the boundary point bridges both sides
      }
      current.push(wrapped);
      previous = wrapped;
    });
    if (current.length >= 2) polylines.push(current);
    return polylines;
  }

  /* Fundamental domains (unit coords) — the smallest region that, combined
   * with the group's transforms, reconstructs the entire pattern.  Drawn as
   * a shaded overlay in the preview. */
  var FUNDAMENTAL_DOMAINS = {
    p1: [[0, 0], [1, 0], [1, 1], [0, 1]],
    p2: [[0, 0], [0.5, 0], [0.5, 1], [0, 1]],
    pm: [[0, 0], [0.5, 0], [0.5, 1], [0, 1]],
    pmm: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]],
    p4: [[0.5, 0.5], [1, 0.5], [0.5, 1]],
    p4m: [[0.5, 0.5], [1, 0.5], [1, 1]],
  };

  /* -------------------------------------------------------- seeded random */

  function mulberry32(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) | 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* --------------------------------------------------------------- motifs */

  function samplePolyline(fn, steps) {
    var points = [];
    for (var i = 0; i <= steps; i++) points.push(fn(i / steps));
    return points;
  }

  function motifDots(rng, density) {
    var n = Math.round(2 + density * 1.1);
    var lines = [];
    for (var gx = 0; gx <= n; gx++) {
      for (var gy = 0; gy <= n; gy++) {
        // skip the tile boundary so dots never straddle the seam
        if (gx === 0 || gx === n || gy === 0 || gy === n) continue;
        var x = gx / n, y = gy / n;
        if (rng() < 0.25) continue;
        lines.push([
          { x: x - 0.01, y: y - 0.01 },
          { x: x + 0.01, y: y + 0.01 },
        ]);
      }
    }
    return lines;
  }

  function motifRadial(rng, density) {
    var spokes = Math.round(5 + density * 0.8);
    var lines = [];
    for (var k = 0; k < spokes; k++) {
      var angle = (k / spokes) * TAU + rng() * 0.25;
      var reach = 0.30 + rng() * 0.16;
      var from = { x: 0.5 + Math.cos(angle) * 0.06, y: 0.5 + Math.sin(angle) * 0.06 };
      var to = { x: 0.5 + Math.cos(angle) * reach, y: 0.5 + Math.sin(angle) * reach };
      lines.push([from, to]);
    }
    return lines;
  }

  function motifPetals(rng, density) {
    var petals = Math.round(3 + density * 0.5);
    var lines = [];
    for (var k = 0; k < petals; k++) {
      var angle = (k / petals) * TAU;
      lines.push(samplePolyline(function (t) {
        var radius = Math.sin(Math.PI * t) * 0.30;
        var spread = (t - 0.5) * 0.9;
        var theta = angle + spread;
        return { x: 0.5 + Math.cos(theta) * radius, y: 0.5 + Math.sin(theta) * radius };
      }, 26));
    }
    return lines;
  }

  function motifSpiral(rng) {
    var lines = [samplePolyline(function (t) {
      var theta = t * Math.PI * 6 + rng() * TAU;
      var radius = 0.03 + t * 0.38;
      return { x: 0.5 + Math.cos(theta) * radius, y: 0.5 + Math.sin(theta) * radius };
    }, 110)];
    return lines;
  }

  function motifZigzag(rng, density) {
    var rows = Math.max(2, Math.round(density * 0.8));
    var teeth = Math.max(3, Math.round(density * 0.9));
    var lines = [];
    for (var r = 0; r < rows; r++) {
      var base = (r + 0.5) / rows;
      lines.push(samplePolyline(function (t) {
        var x = t;
        var y = base + Math.abs(Math.sin(t * Math.PI * teeth)) * (0.5 / rows) - 0.25 / rows;
        return { x: x, y: y };
      }, teeth * 4));
    }
    return lines;
  }

  function motifArcs(rng, density) {
    var arcs = Math.round(2 + density * 0.7);
    var lines = [];
    for (var k = 0; k < arcs; k++) {
      var x = 0.15 + rng() * 0.7, y = 0.15 + rng() * 0.7;
      var radius = 0.08 + rng() * 0.18;
      var start = rng() * TAU;
      lines.push(samplePolyline(function (t) {
        var theta = start + t * Math.PI * 0.5 * (rng() < 0.5 ? 1 : 1.6);
        return { x: x + Math.cos(theta) * radius, y: y + Math.sin(theta) * radius };
      }, 22));
    }
    return lines;
  }

  function motifStar(rng) {
    var spikes = 5 + Math.floor(rng() * 4);
    var lines = [samplePolyline(function (t) {
      var turns = Math.floor(t * spikes);
      var phase = t * spikes - turns;
      var radius = phase < 0.5 ? 0.42 : 0.18;
      var theta = (turns + phase) / spikes * TAU - Math.PI / 2;
      return { x: 0.5 + Math.cos(theta) * radius, y: 0.5 + Math.sin(theta) * radius };
    }, spikes * 2 + 1)];
    lines[0].push(lines[0][0]); // close the star
    return lines;
  }

  function motifWaves(rng, density) {
    var rows = Math.max(2, Math.round(density * 0.7));
    var lines = [];
    for (var r = 0; r < rows; r++) {
      var phase = rng() * TAU;
      var base = (r + 0.5) / rows;
      lines.push(samplePolyline(function (t) {
        var y = base + Math.sin(t * TAU * 1.5 + phase) * (0.22 / rows);
        return { x: t, y: y };
      }, 48));
    }
    return lines;
  }

  var MOTIFS = {
    dots: { label: "Dots", make: motifDots },
    radial: { label: "Radial", make: motifRadial },
    petals: { label: "Petals", make: motifPetals },
    spiral: { label: "Spiral", make: motifSpiral },
    zigzag: { label: "Zigzag", make: motifZigzag },
    arcs: { label: "Arcs", make: motifArcs },
    star: { label: "Star", make: motifStar },
    waves: { label: "Waves", make: motifWaves },
  };

  /* ----------------------------------------------------------------- color */

  function hslToHex(hue, saturation, lightness) {
    var h = mod(hue, 360) / 360;
    var s = Math.min(1, Math.max(0, saturation));
    var l = Math.min(1, Math.max(0, lightness));
    function channel(n) {
      var k = (n + h * 12) % 12;
      var a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    }
    return "#" + [channel(0), channel(8), channel(4)]
      .map(function (v) { return v.toString(16).padStart(2, "0"); }).join("");
  }

  function harmony(baseHue, scheme, count) {
    count = count || 5;
    if (scheme === "complementary") return [baseHue, (baseHue + 180) % 360];
    if (scheme === "triadic") return [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360];
    if (scheme === "split-complementary") return [baseHue, (baseHue + 150) % 360, (baseHue + 210) % 360];
    if (scheme === "monochrome") return Array(count).fill(baseHue % 360);
    var spread = Math.max(count - 1, 1) * 14;
    var hues = [];
    for (var i = 0; i < count; i++) {
      hues.push((baseHue - spread / 2 + i * spread / Math.max(count - 1, 1)) % 360);
    }
    return hues;
  }

  var PALETTES = {
    terracotta: ["#2b1d18", "#7c3b26", "#b5522f", "#d98e5f", "#f3e2d8"],
    botanical: ["#1d2b20", "#33543c", "#5c7f5f", "#a3b98e", "#e7ecd9"],
    midnight: ["#141c2e", "#24365c", "#3e5c8f", "#7d96bf", "#dbe4f0"],
    sand: ["#3a2e23", "#7a6248", "#c1a06b", "#e6d3a8", "#faf5e8"],
    sorbet: ["#3c1d3a", "#8f3f66", "#d97a97", "#f2b7c0", "#fbe9ee"],
    graphite: ["#141414", "#333333", "#5f5f5f", "#9c9c9c", "#e8e8e8"],
  };

  var theory = {
    TAU: TAU,
    SYMMETRIES: SYMMETRIES,
    SYMMETRY_META: SYMMETRY_META,
    FUNDAMENTAL_DOMAINS: FUNDAMENTAL_DOMAINS,
    MOTIFS: MOTIFS,
    PALETTES: PALETTES,
    applySymmetry: applySymmetry,
    wrapAndSplit: wrapAndSplit,
    mulberry32: mulberry32,
    hslToHex: hslToHex,
    harmony: harmony,
    mod: mod,
  };

  global.TessellaTheory = theory;
  if (typeof module !== "undefined" && module.exports) module.exports = theory;
})(typeof window !== "undefined" ? window : globalThis);
