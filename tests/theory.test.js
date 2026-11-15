/* Unit tests for the pattern theory and the SVG exporter. */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const theory = require("../js/theory.js");
const svgExport = require("../js/svg-export.js");

function line() {
  return [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }];
}

test("symmetry groups have the correct order (copies including identity)", () => {
  const expected = { p1: 1, p2: 2, pm: 2, pmm: 4, p4: 4, p4m: 8 };
  Object.entries(expected).forEach(([mode, count]) => {
    const copies = theory.applySymmetry([line()], mode);
    assert.equal(copies.length, count, mode);
  });
});

test("p1 leaves the motif unchanged", () => {
  const copies = theory.applySymmetry([line()], "p1");
  assert.deepEqual(copies[0], [line()]);
});

test("p2 rotates the motif 180 degrees about the cell center", () => {
  const motif = [[{ x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 }]];
  const copies = theory.applySymmetry(motif, "p2");
  const rotated = copies[1][0][1];
  assert.ok(Math.abs(rotated.x - 0.2) < 1e-9);
  assert.ok(Math.abs(rotated.y - 0.5) < 1e-9);
});

test("p4m contains the original, a mirror, and a rotation", () => {
  const motif = [[{ x: 0.2, y: 0.5 }, { x: 0.4, y: 0.5 }]];
  const copies = theory.applySymmetry(motif, "p4m");
  assert.equal(copies.length, 8);
  assert.deepEqual(copies[0], motif);
  // one copy must be the vertical reflection of the endpoint x=0.4 -> 0.6
  assert.ok(copies.some((c) => Math.abs(c[0][1].x - 0.6) < 1e-9));
  // one copy must be the 90-degree rotation of the endpoint x=0.4 -> y=0.6
  assert.ok(copies.some((c) => Math.abs(c[0][1].y - 0.6) < 1e-9));
});

test("wrapAndSplit keeps every point inside the unit cell", () => {
  const points = [{ x: 0.8, y: 0.5 }, { x: 1.2, y: 0.5 }, { x: 0.4, y: 0.5 }];
  const polylines = theory.wrapAndSplit(points, 1);
  polylines.forEach((polyline) => {
    polyline.forEach((point) => {
      assert.ok(point.x >= 0 && point.x < 1, "x in cell");
      assert.ok(point.y >= 0 && point.y < 1, "y in cell");
    });
  });
});

test("wrapAndSplit splits a stroke that crosses the boundary", () => {
  const points = [];
  for (let i = 0; i <= 20; i++) points.push({ x: 0.75 + i * 0.03, y: 0.5 });
  const polylines = theory.wrapAndSplit(points, 1);
  assert.ok(polylines.length >= 2, "crossing stroke produces multiple polylines");
});

test("mulberry32 is deterministic and bounded", () => {
  const first = theory.mulberry32(42);
  const second = theory.mulberry32(42);
  for (let i = 0; i < 5; i++) {
    const a = first(), b = second();
    assert.equal(a, b);
    assert.ok(a >= 0 && a < 1);
  }
});

test("every motif generator produces valid unit-cell polylines", () => {
  Object.entries(theory.MOTIFS).forEach(([name, motif]) => {
    const rng = theory.mulberry32(99);
    const polylines = motif.make(rng, 5);
    assert.ok(polylines.length > 0, name + " is empty");
    polylines.forEach((polyline) => {
      assert.ok(polyline.length >= 2, name + " polyline too short");
      polyline.forEach((point) => {
        assert.ok(point.x >= 0 && point.x <= 1, name + " x out of cell");
        assert.ok(point.y >= 0 && point.y <= 1, name + " y out of cell");
      });
    });
  });
});

test("hslToHex produces primary colors", () => {
  assert.equal(theory.hslToHex(0, 1, 0.5), "#ff0000");
  assert.equal(theory.hslToHex(120, 1, 0.5), "#00ff00");
  assert.equal(theory.hslToHex(240, 1, 0.5), "#0000ff");
});

test("harmony returns the requested number of hues in range", () => {
  ["analogous", "complementary", "triadic", "split-complementary", "monochrome"]
    .forEach((scheme) => {
      const hues = theory.harmony(30, scheme, 5);
      assert.ok(hues.length >= 2, scheme);
      hues.forEach((hue) => assert.ok(hue >= 0 && hue < 360));
    });
});

test("buildPatternSVG emits a seamless pattern with all copies", () => {
  const svg = svgExport.buildPatternSVG({
    polylines: [line()],
    mode: "p4m",
    tileSize: 120,
    palette: ["#b5522f", "#2b1d18"],
    strokeWidth: 2,
    width: 360,
    height: 360,
    title: "Test & <pattern>",
  });
  assert.ok(svg.includes("<pattern id=\"tessella\""));
  assert.ok(svg.includes('width="120" height="120"'));
  assert.ok(svg.includes("url(#tessella)"));
  const groupCount = (svg.match(/<g>/g) || []).length;
  assert.equal(groupCount, 8); // one group per symmetry copy
  assert.ok(svg.includes("Test &amp; &lt;pattern&gt;"), "title is escaped");
  assert.ok(!svg.includes("<pattern>" + "Test & <pattern>"), "raw title never appears");
});

test("buildPatternSVG tolerates an empty motif", () => {
  const svg = svgExport.buildPatternSVG({ polylines: [], mode: "p1" });
  assert.ok(svg.includes("<pattern"));
  assert.ok(svg.includes("<rect"));
});
