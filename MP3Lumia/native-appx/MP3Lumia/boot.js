/* Runs before the app. Kept as a separate file because the Windows app host
   does not run inline script inside packaged HTML. It surfaces a fatal error
   instead of leaving a blank page. */
(function () {
  "use strict";

  function probe() {
    var out = [];
    function t(name, fn) {
      try { fn(); out.push(name + " ok"); }
      catch (e) { out.push(name + " FAIL(" + ((e && e.message) || e) + ")"); }
    }
    t("audio", function () {
      var a = document.createElement("audio");
      if (!a.canPlayType || !a.canPlayType("audio/mpeg")) throw new Error("no mp3");
    });
    t("storage", function () {
      window.localStorage.setItem("mp3.probe", "1");
      window.localStorage.removeItem("mp3.probe");
    });
    t("promise", function () {
      if (typeof Promise === "undefined") throw new Error("missing");
    });
    t("fileapi", function () {
      if (typeof FileReader === "undefined") throw new Error("missing");
    });
    t("webaudio", function () {
      if (!(window.AudioContext || window.webkitAudioContext)) throw new Error("no AudioContext - EQ bypassed");
    });
    return out.join(" | ");
  }

  var p = probe();
  window.__mp3Probe = p;

  function fail(title, detail) {
    var box = document.getElementById("jsfail");
    if (box) {
      box.style.display = "block";
      box.textContent = title + (detail ? " " + detail : "") + "\n\n" + p;
    }
    var boot = document.getElementById("boot");
    if (boot) boot.style.display = "none";
  }

  window.__mp3Fail = fail;

  window.onerror = function (msg, src, line) {
    fail("MP3Lumia script error: " + msg + " (line " + line + ")", "");
    return true;
  };

  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!window.MP3_READY) {
        fail("MP3Lumia did not start on this device.", "app.js did not run or threw while starting.");
      }
    }, 1400);
  }, false);
})();
