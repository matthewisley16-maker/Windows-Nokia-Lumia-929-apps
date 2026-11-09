/* Runs before the app. Kept in an external file because the Windows app host
   does not execute inline script tags inside packaged HTML. */
(function () {
  function probe() {
    var r = [];
    function t(n, f) {
      try { f(); r.push(n + " ok"); }
      catch (e) { r.push(n + " FAIL(" + ((e && e.message) || e) + ")"); }
    }
    t("canvas", function () {
      var c = document.createElement("canvas");
      if (!c.getContext("2d")) { throw new Error("no 2d context"); }
    });
    t("storage", function () {
      window.localStorage.setItem("fp.probe", "1");
      window.localStorage.removeItem("fp.probe");
    });
    t("dataURL", function () {
      var c = document.createElement("canvas");
      if (!c.toDataURL) { throw new Error("missing"); }
    });
    t("elemFromPoint", function () {
      if (!document.elementFromPoint) { throw new Error("missing"); }
    });
    t("pointer", function () {
      if (!("onpointerdown" in window)) { throw new Error("missing"); }
    });
    t("touch", function () {
      if (!("ontouchstart" in window)) { throw new Error("missing"); }
    });
    return r.join(" | ");
  }

  var p = probe();
  window.__fpProbe = p;

  function show(title, detail) {
    var j = document.getElementById("jsfail");
    if (j) { j.style.display = "none"; }
    var d = document.getElementById("errbar");
    if (d) {
      d.style.display = "block";
      d.textContent = title + detail + " | " + p;
    }
  }

  window.__fpShowError = show;

  window.onerror = function (msg, src, line) {
    show("FreePaint script error: " + msg + " (line " + line + ")", "");
    return true;
  };

  // If the app never signals that it booted, say so with the probe results.
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!window.__fpBooted) {
        var j = document.getElementById("jsfail");
        if (j && j.style.display !== "none") {
          j.textContent = "FreePaint script did not run on this device. " + p;
        }
      }
    }, 700);
  }, false);
})();
