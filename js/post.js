/* Nibo News — page d'un post + commentaires (compte requis pour commenter) */
(function () {
  const $ = id => document.getElementById(id);
  const RUBS = { politique:"Politique", sport:"Sport", social:"Social",
    economie:"Économie", international:"International", potins:"Potins" };
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const zone = $("postZone");

  function dateFr(iso) {
    const d = new Date(iso), now = new Date();
    const h = d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    if (d.toDateString() === now.toDateString()) return "Aujourd'hui, " + h;
    const hier = new Date(now); hier.setDate(now.getDate()-1);
    if (d.toDateString() === hier.toDateString()) return "Hier, " + h;
    return d.toLocaleDateString("fr-FR",{day:"numeric",month:"long"}) + ", " + h;
  }

  let postCourant = null;

  async function charger() {
    if (!id) { zone.innerHTML = '<a href="index.html" class="retour">← Retour au fil</a><p style="color:var(--texte-doux)">Post introuvable.</p>'; return; }
    if (typeof DB === "undefined" || !DB) { zone.innerHTML = '<a href="index.html" class="retour">← Retour au fil</a><p style="color:var(--texte-doux)">Connexion indisponible.</p>'; return; }

    const { data: p, error } = await DB.from("posts").select("*").eq("id", id).eq("statut","publie").maybeSingle();
    if (error || !p) { zone.innerHTML = '<a href="index.html" class="retour">← Retour au fil</a><p style="color:var(--texte-doux)">Ce post n\'existe pas ou n\'est plus publié.</p>'; return; }
    postCourant = p;

    const court = (p.texte||"").length < 120 ? " court" : "";
    const bg = p.image_url
      ? ' style="background-image:linear-gradient(160deg,rgba(20,20,26,.82),rgba(20,20,26,.92)),url(' + esc(p.image_url) + ');background-size:cover;background-position:center"'
      : '';
    zone.innerHTML =
      '<a href="index.html" class="retour">← Retour au fil</a>'
      + '<article class="post r-' + p.rubrique + '" data-date="' + (p.created_at||'') + '">'
      + '<div class="post-visuel' + court + '"' + bg + '>'
      + '<div class="post-head"><span class="post-rub">' + esc(RUBS[p.rubrique]||p.rubrique) + '</span>'
      + '<span class="post-nino">Nibo<b>News</b></span></div>'
      + '<p class="post-texte">' + esc(p.texte) + '</p>'
      + '<div class="post-foot"><span class="post-date">' + dateFr(p.created_at) + '</span>'
      + '<span class="post-watermark">Nibo<b>News</b></span></div></div>'
      + '<div class="post-actions">'
      + '<button class="act like" id="likeBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg><span class="act-count">' + (p.likes||0) + '</span></button>'
      + '<button class="act share act-share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg><span>Partager</span></button>'
      + '<button class="act act-dl" id="dlBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg><span>Image</span></button>'
      + '</div></article>';

    brancherActions(p);
    chargerCommentaires();
  }

  function brancherActions(p) {
    // Like
    let liked = new Set();
    try { liked = new Set(JSON.parse(localStorage.getItem("nibo_likes")||"[]")); } catch {}
    const lb = $("likeBtn");
    if (liked.has(p.id)) lb.classList.add("on");
    lb.addEventListener("click", async () => {
      const c = lb.querySelector(".act-count");
      let n = parseInt(c.textContent,10)||0;
      const on = lb.classList.toggle("on");
      c.textContent = on ? n+1 : Math.max(0,n-1);
      if (on) { liked.add(p.id); await DB.rpc("liker_post",{post_id:p.id}); }
      else { liked.delete(p.id); await DB.rpc("deliker_post",{post_id:p.id}); }
      try { localStorage.setItem("nibo_likes", JSON.stringify([...liked])); } catch {}
    });

    // Partage
    document.querySelector(".act.share").addEventListener("click", () => {
      let menu = document.querySelector(".share-menu");
      if (!menu) {
        menu = document.createElement("div"); menu.className = "share-menu";
        const txt = encodeURIComponent(p.texte + " — via Nibo News");
        const url = encodeURIComponent(location.href);
        menu.innerHTML =
          '<a class="share-btn share-wa" href="https://wa.me/?text=' + txt + '%20' + url + '" target="_blank" rel="noopener">WhatsApp</a>'
          + '<a class="share-btn share-fb" href="https://www.facebook.com/sharer/sharer.php?u=' + url + '" target="_blank" rel="noopener">Facebook</a>'
          + '<a class="share-btn share-x" href="https://twitter.com/intent/tweet?text=' + txt + '&url=' + url + '" target="_blank" rel="noopener">X</a>'
          + '<a class="share-btn share-tg" href="https://t.me/share/url?url=' + url + '&text=' + txt + '" target="_blank" rel="noopener">Telegram</a>';
        document.querySelector(".post-actions").after(menu);
      }
      menu.classList.toggle("open");
    });

    // Téléchargement image
    $("dlBtn").addEventListener("click", () => {
      let menu = document.querySelector(".dl-menu");
      if (!menu) {
        menu = document.createElement("div"); menu.className = "dl-menu";
        menu.innerHTML = '<button class="dl-opt" data-format="carre">Format carré (1:1)</button>'
          + '<button class="dl-opt" data-format="story">Format story (9:16)</button>';
        document.querySelector(".post-actions").after(menu);
        menu.querySelectorAll(".dl-opt").forEach(opt => opt.addEventListener("click", async () => {
          const avant = opt.textContent;
          opt.textContent = "Génération…"; opt.disabled = true;
          try {
            await window.NiboImage.generer(p, opt.getAttribute("data-format"));
            opt.textContent = "✓ Téléchargé";
          } catch { opt.textContent = "Échec"; }
          setTimeout(() => { opt.textContent = avant; opt.disabled = false; }, 1800);
        }));
      }
      menu.classList.toggle("open");
    });
  }

  // ---------- Commentaires ----------
  async function utilisateur() {
    const { data } = await DB.auth.getSession();
    return data.session ? data.session.user : null;
  }

  async function chargerCommentaires() {
    const u = await utilisateur();
    const nav = $("navAuth");
    if (u && nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }

    // Formulaire ou invitation à se connecter
    const fbox = $("commForm");
    if (u) {
      const nom = (u.user_metadata && u.user_metadata.nom) ? u.user_metadata.nom : (u.email||"").split("@")[0];
      fbox.innerHTML =
        '<div class="comm-box">'
        + '<textarea id="commTexte" placeholder="Écris ton commentaire…" maxlength="500"></textarea>'
        + '<div class="row"><span class="who">En tant que <b>' + esc(nom) + '</b></span>'
        + '<button class="btn-p" id="commEnvoyer">Publier</button></div></div>';
      $("commEnvoyer").addEventListener("click", () => envoyer(u, nom));
    } else {
      fbox.innerHTML =
        '<div class="connect-invite"><p>Connecte-toi pour laisser un commentaire.</p>'
        + '<a class="btn-p" href="connexion.html?retour=' + encodeURIComponent(location.pathname + location.search) + '">Se connecter</a> '
        + '<a class="btn-connexion" href="inscription.html">Créer un compte</a></div>';
    }

    const { data, error } = await DB.from("commentaires").select("*").eq("post_id", id).order("created_at",{ascending:false});
    const liste = $("commListe");
    $("commNb").textContent = data && data.length ? "(" + data.length + ")" : "";
    if (error || !data || !data.length) { liste.innerHTML = '<p class="comm-vide">Aucun commentaire. Sois le premier à réagir.</p>'; return; }
    liste.innerHTML = data.map(c =>
      '<div class="comm"><div class="comm-head">'
      + '<span class="comm-av">' + esc((c.auteur||"?").charAt(0).toUpperCase()) + '</span>'
      + '<span class="comm-auteur">' + esc(c.auteur) + '</span>'
      + '<span class="comm-date">' + dateFr(c.created_at) + '</span></div>'
      + '<p class="comm-texte">' + esc(c.texte) + '</p></div>'
    ).join("");
  }

  async function envoyer(u, nom) {
    const t = $("commTexte").value.trim();
    const msg = $("commMsg");
    if (!t) { msg.textContent = "Écris quelque chose avant de publier."; msg.className = "msg on err"; return; }
    msg.textContent = "Publication…"; msg.className = "msg on";
    const ent = await entrepriseId();
    const { error } = await DB.from("commentaires").insert({
      post_id: id, entreprise_id: ent, user_id: u.id, auteur: nom, texte: t
    });
    if (error) { msg.textContent = "Erreur : " + error.message; msg.className = "msg on err"; return; }
    msg.textContent = "Commentaire publié !"; msg.className = "msg on ok";
    $("commTexte").value = "";
    setTimeout(() => { msg.className = "msg"; }, 2500);
    chargerCommentaires();
  }

  charger();
})();
