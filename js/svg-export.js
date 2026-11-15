/* Tessella — vector export: a seamless <pattern>-based SVG built from the
 * same theory module the canvas preview uses.  Pure string generation, so it
 * runs in the browser and under Node for tests. */
(function (global) {
  "use strict";

  var theory = (typeof module !== "undefined" && module.exports)
    ? require("./theory.js")
    : global.TessellaTheory;

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pathData(points, scale) {
    return points.map(function (point, index) {
      var command = index === 0 ? "M" : "L";
      return command + (point.x * scale).toFixed(2) + " " + (point.y * scale).toFixed(2);
    }).join(" ");
  }

  /* Build a seamless SVG pattern.  The motif is placed in a <pattern> so the
   * exported file tiles at any size, vector-sharp. */
  function buildPatternSVG(options) {
    var polylines = options.polylines || [];
    var mode = options.mode || "p1";
    var tileSize = options.tileSize || 120;
    var palette = options.palette || ["#b5522f", "#2b1d18"];
    var strokeWidth = options.strokeWidth || 2;
    var width = options.width || tileSize * 3;
    var height = options.height || tileSize * 3;
    var background = options.background || "#ffffff";
    var title = options.title || "Tessella pattern";

    var copies = theory.applySymmetry(polylines, mode);
    var groups = copies.map(function (copy, index) {
      var color = palette[index % palette.length];
      var paths = copy.map(function (line) {
        return '<path d="' + pathData(line, tileSize) + '" fill="none" stroke="' +
          escapeXml(color) + '" stroke-width="' + strokeWidth +
          '" stroke-linecap="round" stroke-linejoin="round"/>';
      }).join("\n    ");
      return '    <g>' + paths + '</g>';
    }).join("\n");

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
      '" viewBox="0 0 ' + width + ' ' + height + '">\n' +
      '  <title>' + escapeXml(title) + '</title>\n' +
      '  <defs>\n' +
      '    <pattern id="tessella" width="' + tileSize + '" height="' + tileSize +
      '" patternUnits="userSpaceOnUse">\n' +
      groups + "\n" +
      '    </pattern>\n' +
      '  </defs>\n' +
      '  <rect width="' + width + '" height="' + height + '" fill="' +
      escapeXml(background) + '"/>\n' +
      '  <rect width="' + width + '" height="' + height + '" fill="url(#tessella)"/>\n' +
      '</svg>\n';
  }

  var exporter = { buildPatternSVG: buildPatternSVG };
  global.TessellaSvg = exporter;
  if (typeof module !== "undefined" && module.exports) module.exports = exporter;
})(typeof window !== "undefined" ? window : globalThis);
