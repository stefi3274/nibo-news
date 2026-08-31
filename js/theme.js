(function () {
  "use strict";
  function appliquer(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }
  function basculer() {
    const actuel = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const suivant = actuel === "dark" ? "light" : "dark";
    appliquer(suivant);
    try { localStorage.setItem("nibo-theme", suivant); } catch (e) {}
  }
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.addEventListener("click", basculer);
    });
  });
  window.NiboTheme = { basculer: basculer };
})();
