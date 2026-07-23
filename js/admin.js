/* Admin Nibo News — créer/gérer posts, valider contributions */
(function () {
  const $ = id => document.getElementById(id);

  const BUCKET = "Images";
  const RUBS = { politique:"Politique", sport:"Sport", social:"Social",
    economie:"Économie", international:"International", potins:"Potins" };
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const status = (m, t) => { const e = $("admMsg"); if(e){e.textContent = m; e.className = "msg on " + (t||"ok");} };
  const dateFr = iso => new Date(iso).toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  // Onglets (indépendant de Supabase)
  document.querySelectorAll(".adm-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const t = tab.getAttribute("data-tab");
      document.querySelectorAll(".adm-tab").forEach(x => x.classList.toggle("on", x === tab));
      ["creer","posts","contrib"].forEach(k => {
        const el = $("tab-" + k); if (el) el.style.display = (t === k) ? "block" : "none";
      });
      if (t === "posts") lancerAvecDB("postsList", chargerPosts);
      if (t === "contrib") lancerAvecDB("contribList", chargerContrib);
    });
  });

  // Compteur de caractères (indépendant de Supabase)
  const ta = $("postTexte");
  if (ta) ta.addEventListener("input", () => { const c=$("compteur"); if(c) c.textContent = ta.value.length; });

  // Récupère la connexion, en attendant si nécessaire
  async function db() {
    return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null);
  }

  // Attend que la connexion soit prête avant de charger, au lieu d'abandonner
  async function lancerAvecDB(zoneId, fn) {
    const box = $(zoneId);
    if (box) box.innerHTML = "<p class='empty'>Chargement…</p>";
    const db = window.DB || (window.attendreDB ? await window.attendreDB(8000) : null);
    if (!db) {
      if (box) box.innerHTML = "<p class='empty' style='color:#f87171'>Connexion au serveur impossible."
        + "<br><br>Vérifie ta connexion internet, puis recharge la page.</p>";
      return;
    }
    fn();
  }

  // Si la connexion tarde, on attend en arrière-plan sans bloquer l'interface
  if (!window.DB && window.attendreDB) {
    window.attendreDB(8000).then(db => {
      if (db) { refreshAuth(); }
      else { const s = $("setupNote"); if (s) s.style.display = "block"; }
    });
  }

  // Image de fond
  let imgFile = null;
  const drop = $("imgDrop"), input = $("imgInput");
  if (drop) {
    drop.addEventListener("click", () => input.click());
    input.addEventListener("change", function () {
      const f = this.files[0];
      if (!f) return;
      if (f.size > 5*1024*1024) { status("Image trop lourde (max 5 Mo).","err"); this.value=""; return; }
      imgFile = f; $("imgTxt").textContent = "✓ " + f.name; drop.classList.add("has");
    });
  }

  // Auth
  async function refreshAuth() {
    const { data } = await (await db()).auth.getSession();
    if (data.session) { $("loginCard").style.display="none"; $("panel").style.display="block"; }
    else { $("loginCard").style.display="block"; $("panel").style.display="none"; }
  }
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const st = $("loginMsg"); st.textContent="Connexion…"; st.className="msg on";
    const { error } = await (await db()).auth.signInWithPassword({ email:$("admEmail").value.trim(), password:$("admPass").value });
    if (error) { st.textContent="Email ou mot de passe incorrect."; st.className="msg on err"; return; }
    st.className="msg"; refreshAuth();
  });
  $("logoutBtn").addEventListener("click", async () => { await (await db()).auth.signOut(); refreshAuth(); });

  // Publier un post
  $("publierBtn").addEventListener("click", async () => {
    const texte = $("postTexte").value.trim();
    const rub = (document.querySelector('input[name="rub"]:checked')||{}).value;
    if (!texte) { status("Écris le texte du post.","err"); return; }
    status("Publication…","");
    const ent = await entrepriseId();
    if (!ent) { status("Entreprise introuvable.","err"); return; }

    let image_url = null, image_chemin = null;
    if (imgFile) {
      const ext = (imgFile.name.split(".").pop()||"jpg").toLowerCase();
      image_chemin = "nibo/posts/" + Date.now() + "." + ext;
      const up = await (await db()).storage.from(BUCKET).upload(image_chemin, imgFile);
      if (up.error) { status("Échec image : " + up.error.message,"err"); return; }
      image_url = (await db()).storage.from(BUCKET).getPublicUrl(image_chemin).data.publicUrl;
    }

    const { error } = await (await db()).from("posts").insert({
      entreprise_id: ent, rubrique: rub, texte: texte,
      image_url, image_chemin,
      auteur: $("postAuteur").value.trim() || "Nibo News",
      source: $("postSource").value.trim() || null,
      langue: (document.querySelector('input[name="lang"]:checked')||{}).value || "fr",
      statut: "publie"
    });
    if (error) { status("Erreur : " + error.message,"err"); return; }
    status("Post publié !","ok");
    $("postTexte").value=""; $("compteur").textContent="0"; $("postAuteur").value=""; $("postSource").value="";
    imgFile=null; $("imgTxt").textContent="Clique pour ajouter une image de fond"; drop.classList.remove("has");
  });

  // Empêche un chargement de rester bloqué indéfiniment
  function avecDelai(promesse, ms, messageErreur) {
    return Promise.race([
      promesse,
      new Promise((_, rej) => setTimeout(() => rej(new Error(messageErreur || "Délai dépassé")), ms))
    ]);
  }

  // Mes posts
  async function chargerPosts() {
    const box = $("postsList");
    box.innerHTML = "<p class='empty'>Chargement…</p>";
    try {
      const ent = await avecDelai(entrepriseId(), 10000, "La connexion prend trop de temps.");
      if (!ent) {
        box.innerHTML = "<p class='empty'>Impossible de trouver l'entreprise Nibo. Vérifie que le SQL a bien été exécuté.</p>";
        return;
      }
      const { data, error } = await avecDelai(
        (await db()).from("posts").select("*").eq("entreprise_id", ent).order("created_at",{ascending:false}),
        10000, "La connexion prend trop de temps.");

      if (error) {
        box.innerHTML = "<p class='empty' style='color:#f87171'>Erreur : " + esc(error.message)
          + "<br><br>Si le message parle de permissions, ton compte n'est peut-être pas relié à Nibo News.</p>";
        return;
      }
      if (!data || !data.length) {
        box.innerHTML = "<p class='empty'>Aucun post pour l'instant. Crée ton premier post dans l'onglet « Créer un post ».</p>";
        return;
      }

      box.innerHTML = data.map(p =>
        '<div class="liste-item r-' + p.rubrique + '" style="border-left-color:var(--' + p.rubrique + ')">'
        + '<div class="li-rub" style="color:var(--' + p.rubrique + ')">' + esc(RUBS[p.rubrique]||p.rubrique) + '</div>'
        + '<div class="li-texte">' + esc(p.texte) + '</div>'
        + '<div class="li-meta">' + dateFr(p.created_at) + ' · ♥ ' + (p.likes||0)
        + (p.image_url?' · image':'') + (p.source?' · source : '+esc(p.source):'') + (p.langue==='ht'?' · <span style="color:var(--pourpre-c)">Kreyòl</span>':'') + '</div>'
        + '<div class="li-act"><button class="no" data-del="' + p.id + '">Supprimer</button></div>'
        + '</div>'
      ).join("");
      box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => supprimerPost(b.getAttribute("data-del")));
    } catch (e) {
      box.innerHTML = "<p class='empty' style='color:#f87171'>Erreur de chargement : " + esc(String(e && e.message || e)) + "</p>";
    }
  }
  async function supprimerPost(id) {
    if (!confirm("Supprimer ce post définitivement ?")) return;
    try {
      const { data:p } = await (await db()).from("posts").select("image_chemin").eq("id",id).maybeSingle();
      if (p && p.image_chemin) await (await db()).storage.from(BUCKET).remove([p.image_chemin]);
      const { error } = await (await db()).from("posts").delete().eq("id",id);
      if (error) { status("Suppression impossible : " + error.message, "err"); return; }
      status("Post supprimé.","ok");
      chargerPosts();
    } catch (e) {
      status("Erreur : " + (e && e.message || e), "err");
    }
  }

  // Contributions
  async function chargerContrib() {
    const box = $("contribList");
    box.innerHTML = "<p class='empty'>Chargement…</p>";
    try {
      const ent = await avecDelai(entrepriseId(), 10000, "La connexion prend trop de temps.");
      if (!ent) { box.innerHTML = "<p class='empty'>Entreprise introuvable.</p>"; return; }
      const { data, error } = await avecDelai(
        (await db()).from("nibo_contributions").select("*")
          .eq("entreprise_id", ent).eq("statut","a_verifier")
          .order("created_at",{ascending:false}),
        10000, "La connexion prend trop de temps.");
      if (error) {
        box.innerHTML = "<p class='empty' style='color:#f87171'>Erreur : " + esc(error.message) + "</p>";
        return;
      }
      if (!data || !data.length) { box.innerHTML = "<p class='empty'>Aucune contribution à vérifier.</p>"; return; }
      box.innerHTML = data.map(c =>
        '<div class="liste-item r-' + (c.rubrique||'social') + '" style="border-left-color:var(--' + (c.rubrique||'social') + ')">'
        + '<div class="li-rub" style="color:var(--' + (c.rubrique||'social') + ')">' + esc(RUBS[c.rubrique]||c.rubrique||'—') + '</div>'
        + '<div class="li-texte">' + esc(c.texte) + '</div>'
        + '<div class="li-meta">Par ' + esc(c.auteur) + (c.contact?' · '+esc(c.contact):'')
        + (c.source?' · source : '+esc(c.source):'') + ' · ' + dateFr(c.created_at) + '</div>'
        + '<div class="li-act"><button class="ok" data-pub="' + c.id + '">Publier</button>'
        + '<button class="no" data-rej="' + c.id + '">Rejeter</button></div>'
        + '</div>'
      ).join("");
      box.querySelectorAll("[data-pub]").forEach(b => b.onclick = () => publierContrib(b.getAttribute("data-pub"), data));
      box.querySelectorAll("[data-rej]").forEach(b => b.onclick = () => rejeterContrib(b.getAttribute("data-rej")));
    } catch (e) {
      box.innerHTML = "<p class='empty' style='color:#f87171'>Erreur : " + esc(String(e && e.message || e)) + "</p>";
    }
  }
  async function publierContrib(id, liste) {
    const c = liste.find(x => x.id === id);
    if (!c) return;
    const ent = await entrepriseId();
    const { error } = await (await db()).from("posts").insert({
      entreprise_id: ent, rubrique: c.rubrique||"social", texte: c.texte,
      image_url: c.image_url, image_chemin: c.image_chemin,
      auteur: c.auteur, source: c.source || null, statut: "publie"
    });
    if (error) { status("Erreur : " + error.message,"err"); return; }
    await (await db()).from("nibo_contributions").update({ statut:"valide" }).eq("id",id);
    status("Contribution publiée !","ok"); chargerContrib();
  }
  async function rejeterContrib(id) {
    await (await db()).from("nibo_contributions").update({ statut:"rejete" }).eq("id",id);
    status("Contribution rejetée.","ok"); chargerContrib();
  }

  refreshAuth();
})();
