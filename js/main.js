/* Nibo News — interactions de la vitrine (démo)
   Filtres de rubriques, like visuel, menus partage/téléchargement */
(function () {
  // Filtres de rubriques
  const chips = document.querySelectorAll(".rub-chip");
  const posts = document.querySelectorAll(".post");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.toggle("on", c === chip));
      const rub = chip.getAttribute("data-rub");
      posts.forEach(p => {
        p.style.display = (rub === "tous" || p.classList.contains("r-" + rub)) ? "" : "none";
      });
    });
  });

  // Like (visuel seulement en démo)
  document.querySelectorAll(".act.like").forEach(btn => {
    btn.addEventListener("click", () => {
      const count = btn.querySelector(".act-count");
      const on = btn.classList.toggle("on");
      let n = parseInt(count.textContent, 10) || 0;
      count.textContent = on ? n + 1 : n - 1;
    });
  });

  // Menu partage (ouvre/ferme sous le post)
  document.querySelectorAll(".act.share").forEach(btn => {
    btn.addEventListener("click", () => {
      const post = btn.closest(".post");
      let menu = post.querySelector(".share-menu");
      if (!menu) {
        menu = document.createElement("div");
        menu.className = "share-menu";
        const txt = encodeURIComponent(post.querySelector(".post-texte").textContent + " — via Nibo News");
        menu.innerHTML =
          '<a class="share-btn share-wa" href="https://wa.me/?text=' + txt + '" target="_blank" rel="noopener">WhatsApp</a>'
          + '<a class="share-btn share-fb" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.href) + '" target="_blank" rel="noopener">Facebook</a>'
          + '<a class="share-btn share-x" href="https://twitter.com/intent/tweet?text=' + txt + '" target="_blank" rel="noopener">X</a>'
          + '<a class="share-btn share-tg" href="https://t.me/share/url?url=' + encodeURIComponent(location.href) + '&text=' + txt + '" target="_blank" rel="noopener">Telegram</a>';
        btn.closest(".post-actions").after(menu);
      }
      menu.classList.toggle("open");
      const dl = post.querySelector(".dl-menu");
      if (dl) dl.classList.remove("open");
    });
  });

  // Menu téléchargement (carré / story)
  document.querySelectorAll(".act-dl").forEach(btn => {
    btn.addEventListener("click", () => {
      const post = btn.closest(".post");
      let menu = post.querySelector(".dl-menu");
      if (!menu) {
        menu = document.createElement("div");
        menu.className = "dl-menu";
        menu.innerHTML =
          '<button class="dl-opt" data-format="carre">Format carré (1:1)</button>'
          + '<button class="dl-opt" data-format="story">Format story (9:16)</button>';
        btn.closest(".post-actions").after(menu);
        menu.querySelectorAll(".dl-opt").forEach(opt => {
          opt.addEventListener("click", () => {
            alert("La génération d'image (" + opt.getAttribute("data-format") + ") sera activée à la prochaine étape.");
          });
        });
      }
      menu.classList.toggle("open");
      const sh = post.querySelector(".share-menu");
      if (sh) sh.classList.remove("open");
    });
  });
})();
