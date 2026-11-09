/* Runs before the app. External file because the Windows app host does not run
   inline script inside packaged HTML. Surfaces a fatal error instead of a blank page. */
(function () {
  "use strict";

  function probe() {
    var out = [];
    function t(name, fn) {
      try { fn(); out.push(name + " ok"); }
      catch (e) { out.push(name + " FAIL(" + ((e && e.message) || e) + ")"); }
    }
    t("video", function () {
      if (!document.createElement("video").canPlayType) throw new Error("missing");
    });
    t("storage", function () {
      window.localStorage.setItem("mp4.probe", "1");
      window.localStorage.removeItem("mp4.probe");
    });
    t("promise", function () {
      if (typeof Promise === "undefined") throw new Error("missing");
    });
    t("pointer", function () {
      if (!("onpointerdown" in window)) throw new Error("missing");
    });
    return out.join(" | ");
  }

  var p = probe();
  window.__mp4Probe = p;

  function fail(title, detail) {
    var box = document.getElementById("jsfail");
    if (box) {
      box.style.display = "block";
      box.textContent = title + (detail ? " " + detail : "") + "\n\n" + p;
    }
    var boot = document.getElementById("boot");
    if (boot) boot.style.display = "none";
  }

  window.__mp4Fail = fail;

  window.onerror = function (msg, src, line) {
    fail("MP4Lumia script error: " + msg + " (line " + line + ")", "");
    return true;
  };

  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!window.MP4_READY) {
        fail("MP4Lumia did not start on this device.", "app.js did not run or threw while starting.");
      }
    }, 1200);
  }, false);
})();
