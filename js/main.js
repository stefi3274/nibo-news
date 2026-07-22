/* Nibo News — fil de posts (charge depuis Supabase, sinon démo) */
(function () {
  const RUBS = { politique:"Politique", sport:"Sport", social:"Social",
    economie:"Économie", international:"International", potins:"Potins" };
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fil = document.getElementById("fil");

  function dateFr(iso) {
    const d = new Date(iso), now = new Date();
    const h = d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    if (d.toDateString() === now.toDateString()) return "Aujourd'hui, " + h;
    const hier = new Date(now); hier.setDate(now.getDate()-1);
    if (d.toDateString() === hier.toDateString()) return "Hier, " + h;
    return d.toLocaleDateString("fr-FR",{day:"numeric",month:"long"}) + ", " + h;
  }

  function carte(p) {
    const court = (p.texte||"").length < 120 ? " court" : "";
    const bgStyle = p.image_url
      ? ' style="background-image:linear-gradient(160deg,rgba(20,20,26,.82),rgba(20,20,26,.92)),url(' + esc(p.image_url) + ');background-size:cover;background-position:center"'
      : '';
    return '<article class="post r-' + p.rubrique + '" data-id="' + p.id + '" data-date="' + (p.created_at||"") + '">'
      + '<div class="post-visuel' + court + '"' + bgStyle + '>'
      + '<div class="post-head"><span class="post-rub">' + esc(RUBS[p.rubrique]||p.rubrique) + '</span>'
      + '<span class="post-nino">Nibo<b>News</b></span></div>'
      + '<p class="post-texte">' + esc(p.texte) + '</p>'
      + '<div class="post-foot"><span class="post-date">' + dateFr(p.created_at) + '</span>'
      + '<span class="post-watermark">Nibo<b>News</b></span></div>'
      + '</div>'
      + '<div class="post-actions">'
      + '<button class="act like" data-like="' + p.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg><span class="act-count">' + (p.likes||0) + '</span></button>'
      + '<button class="act comment" data-comment="' + p.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.5 8.5 0 0 1-11.7 7.9L3 21l1.6-6.3A8.5 8.5 0 1 1 21 11.5z"/></svg><span class="act-count">0</span></button>'
      + '<button class="act share act-share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg><span>Partager</span></button>'
      + '<button class="act act-dl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg><span>Image</span></button>'
      + '</div></article>';
  }

  async function charger() {
    if (!fil) return;
    const vide = document.getElementById("filVide");
    if (typeof DB === "undefined" || !DB) { brancher(); return; }
    const ent = await entrepriseId();
    if (!ent) { brancher(); return; }
    const { data, error } = await DB.from("posts").select("*").eq("statut","publie").order("created_at",{ascending:false}).limit(50);
    if (error || !data || !data.length) {
      // Pas encore de posts : on garde l'état vide
      brancher(); return;
    }
    if (vide) vide.remove();
    fil.innerHTML = data.map(carte).join("");
    brancher();
  }

  // Filtres de rubriques
  function initFiltres() {
    const chips = document.querySelectorAll(".rub-chip");
    chips.forEach(chip => chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.toggle("on", c === chip));
      const rub = chip.getAttribute("data-rub");
      const posts = document.querySelectorAll(".post");
      let visibles = 0;
      posts.forEach(p => {
        const ok = (rub === "tous" || p.classList.contains("r-" + rub));
        p.style.display = ok ? "" : "none";
        if (ok) visibles++;
      });
      // Message si la rubrique choisie n'a aucun post
      let vide = document.getElementById("rubVide");
      if (posts.length && visibles === 0) {
        if (!vide) {
          vide = document.createElement("div");
          vide.id = "rubVide"; vide.className = "fil-vide";
          vide.innerHTML = '<h2>Rien dans cette rubrique</h2><p>Aucune actualité publiée ici pour le moment.</p>';
          fil.appendChild(vide);
        }
        vide.style.display = "";
      } else if (vide) {
        vide.style.display = "none";
      }
    }));
  }

  // Like (libre, mémoire navigateur pour éviter le double-like évident)
  function likedSet() { try { return new Set(JSON.parse(localStorage.getItem("nibo_likes")||"[]")); } catch { return new Set(); } }
  function saveLiked(s) { try { localStorage.setItem("nibo_likes", JSON.stringify([...s])); } catch {} }

  function brancher() {
    initFiltres();
    const liked = likedSet();

    document.querySelectorAll(".act.like").forEach(btn => {
      const id = btn.getAttribute("data-like");
      if (id && liked.has(id)) btn.classList.add("on");
      btn.addEventListener("click", async () => {
        const count = btn.querySelector(".act-count");
        let n = parseInt(count.textContent,10)||0;
        const on = btn.classList.toggle("on");
        count.textContent = on ? n+1 : Math.max(0,n-1);
        if (id && typeof DB !== "undefined" && DB) {
          if (on) { liked.add(id); await DB.rpc("liker_post",{post_id:id}); }
          else { liked.delete(id); await DB.rpc("deliker_post",{post_id:id}); }
          saveLiked(liked);
        }
      });
    });

    document.querySelectorAll(".act.comment").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-comment");
        if (id) location.href = "post.html?id=" + id;
      });
    });

    document.querySelectorAll(".act.share").forEach(btn => {
      btn.addEventListener("click", () => {
        const post = btn.closest(".post");
        let menu = post.querySelector(".share-menu");
        if (!menu) {
          menu = document.createElement("div"); menu.className = "share-menu";
          const txt = encodeURIComponent(post.querySelector(".post-texte").textContent + " — via Nibo News");
          const url = encodeURIComponent(location.href);
          menu.innerHTML =
            '<a class="share-btn share-wa" href="https://wa.me/?text=' + txt + '" target="_blank" rel="noopener">WhatsApp</a>'
            + '<a class="share-btn share-fb" href="https://www.facebook.com/sharer/sharer.php?u=' + url + '" target="_blank" rel="noopener">Facebook</a>'
            + '<a class="share-btn share-x" href="https://twitter.com/intent/tweet?text=' + txt + '" target="_blank" rel="noopener">X</a>'
            + '<a class="share-btn share-tg" href="https://t.me/share/url?url=' + url + '&text=' + txt + '" target="_blank" rel="noopener">Telegram</a>';
          btn.closest(".post-actions").after(menu);
        }
        menu.classList.toggle("open");
        const dl = post.querySelector(".dl-menu"); if (dl) dl.classList.remove("open");
      });
    });

    document.querySelectorAll(".act-dl").forEach(btn => {
      btn.addEventListener("click", () => {
        const post = btn.closest(".post");
        let menu = post.querySelector(".dl-menu");
        if (!menu) {
          menu = document.createElement("div"); menu.className = "dl-menu";
          menu.innerHTML = '<button class="dl-opt" data-format="carre">Format carré (1:1)</button>'
            + '<button class="dl-opt" data-format="story">Format story (9:16)</button>';
          btn.closest(".post-actions").after(menu);
          menu.querySelectorAll(".dl-opt").forEach(opt => opt.addEventListener("click", async () => {
            const fmt = opt.getAttribute("data-format");
            const avant = opt.textContent;
            opt.textContent = "Génération…"; opt.disabled = true;
            try {
              const donnees = postDepuisCarte(post);
              await window.NiboImage.generer(donnees, fmt);
              opt.textContent = "✓ Téléchargé";
              setTimeout(() => { opt.textContent = avant; opt.disabled = false; }, 1800);
            } catch (e) {
              opt.textContent = "Échec, réessaie";
              setTimeout(() => { opt.textContent = avant; opt.disabled = false; }, 1800);
            }
          }));
        }
        menu.classList.toggle("open");
        const sh = post.querySelector(".share-menu"); if (sh) sh.classList.remove("open");
      });
    });
  }

  // Reconstitue les données d'un post depuis sa carte affichée
  function postDepuisCarte(el) {
    let rubrique = "politique";
    for (const c of el.classList) if (c.startsWith("r-")) rubrique = c.slice(2);
    const visuel = el.querySelector(".post-visuel");
    let image_url = null;
    if (visuel && visuel.style.backgroundImage) {
      const m = visuel.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (m) image_url = m[1];
    }
    return {
      rubrique,
      texte: el.querySelector(".post-texte") ? el.querySelector(".post-texte").textContent : "",
      image_url,
      created_at: el.getAttribute("data-date") || new Date().toISOString()
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", charger);
  else charger();
})();

/* Newsletter — collecte des emails */
(function () {
  const btn = document.getElementById("nlBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const inp = document.getElementById("nlEmail");
    const msg = document.getElementById("nlMsg");
    const email = (inp.value||"").trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      msg.textContent = "Entre une adresse email valide."; msg.className = "nl-msg err"; return;
    }
    if (typeof DB === "undefined" || !DB) {
      msg.textContent = "Service indisponible pour le moment."; msg.className = "nl-msg err"; return;
    }
    msg.textContent = "Inscription…"; msg.className = "nl-msg";
    const ent = await entrepriseId();
    const { error } = await DB.from("abonnes").insert({ entreprise_id: ent, email: email });
    if (error) {
      msg.textContent = error.message.includes("duplicate") || error.code === "23505"
        ? "Tu es déjà abonné, merci !" : "Erreur, réessaie plus tard.";
      msg.className = "nl-msg " + (error.code === "23505" ? "ok" : "err");
      return;
    }
    msg.textContent = "Merci ! Tu es abonné à Nibo News."; msg.className = "nl-msg ok";
    inp.value = "";
  });
})();
