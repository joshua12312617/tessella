/* Tessella — canvas rendering: tiled preview with the fundamental domain
 * shaded for reference.  Browser-only (uses the 2D canvas context). */
(function (global) {
  "use strict";

  function renderPattern(canvas, options) {
    var theory = global.TessellaTheory;
    var polylines = options.polylines || [];
    var mode = options.mode || "p1";
    var tileSize = options.tileSize || 120;
    var grid = options.grid || 3;
    var palette = options.palette || ["#b5522f", "#2b1d18"];
    var background = options.background || "#ffffff";
    var strokeWidth = options.strokeWidth || 2;
    var showDomain = options.showDomain !== false;

    canvas.width = tileSize * grid;
    canvas.height = tileSize * grid;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var copies = theory.applySymmetry(polylines, mode);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var ty = 0; ty < grid; ty++) {
      for (var tx = 0; tx < grid; tx++) {
        copies.forEach(function (copy, copyIndex) {
          ctx.strokeStyle = palette[copyIndex % palette.length];
          ctx.lineWidth = strokeWidth;
          ctx.beginPath();
          copy.forEach(function (line) {
            line.forEach(function (point, index) {
              var x = (point.x + tx) * tileSize;
              var y = (point.y + ty) * tileSize;
              if (index === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
          });
          ctx.stroke();
        });
      }
    }

    if (showDomain && theory.FUNDAMENTAL_DOMAINS[mode]) {
      ctx.save();
      ctx.fillStyle = "rgba(201, 150, 60, 0.16)";
      ctx.strokeStyle = "rgba(201, 150, 60, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      theory.FUNDAMENTAL_DOMAINS[mode].forEach(function (corner, index) {
        var x = corner[0] * tileSize;
        var y = corner[1] * tileSize;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  global.TessellaEngine = { renderPattern: renderPattern };
})(typeof window !== "undefined" ? window : globalThis);
