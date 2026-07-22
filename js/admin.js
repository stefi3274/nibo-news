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
      if (t === "posts" && window.DB) chargerPosts();
      if (t === "contrib" && window.DB) chargerContrib();
    });
  });

  // Compteur de caractères (indépendant de Supabase)
  const ta = $("postTexte");
  if (ta) ta.addEventListener("input", () => { const c=$("compteur"); if(c) c.textContent = ta.value.length; });

  if (!PRET || !DB) { const s = $("setupNote"); if (s) s.style.display = "block"; return; }

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
    const { data } = await DB.auth.getSession();
    if (data.session) { $("loginCard").style.display="none"; $("panel").style.display="block"; }
    else { $("loginCard").style.display="block"; $("panel").style.display="none"; }
  }
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const st = $("loginMsg"); st.textContent="Connexion…"; st.className="msg on";
    const { error } = await DB.auth.signInWithPassword({ email:$("admEmail").value.trim(), password:$("admPass").value });
    if (error) { st.textContent="Email ou mot de passe incorrect."; st.className="msg on err"; return; }
    st.className="msg"; refreshAuth();
  });
  $("logoutBtn").addEventListener("click", async () => { await DB.auth.signOut(); refreshAuth(); });

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
      const up = await DB.storage.from(BUCKET).upload(image_chemin, imgFile);
      if (up.error) { status("Échec image : " + up.error.message,"err"); return; }
      image_url = DB.storage.from(BUCKET).getPublicUrl(image_chemin).data.publicUrl;
    }

    const { error } = await DB.from("posts").insert({
      entreprise_id: ent, rubrique: rub, texte: texte,
      image_url, image_chemin,
      auteur: $("postAuteur").value.trim() || "Nibo News", statut: "publie"
    });
    if (error) { status("Erreur : " + error.message,"err"); return; }
    status("Post publié !","ok");
    $("postTexte").value=""; $("compteur").textContent="0"; $("postAuteur").value="";
    imgFile=null; $("imgTxt").textContent="Clique pour ajouter une image de fond"; drop.classList.remove("has");
  });

  // Mes posts
  async function chargerPosts() {
    const box = $("postsList"); box.innerHTML = "<p class='empty'>Chargement…</p>";
    const { data, error } = await DB.from("posts").select("*").order("created_at",{ascending:false});
    if (error || !data.length) { box.innerHTML = "<p class='empty'>Aucun post pour l'instant.</p>"; return; }
    box.innerHTML = data.map(p =>
      '<div class="liste-item r-' + p.rubrique + '" style="border-left-color:var(--' + p.rubrique + ')">'
      + '<div class="li-rub" style="color:var(--' + p.rubrique + ')">' + esc(RUBS[p.rubrique]||p.rubrique) + '</div>'
      + '<div class="li-texte">' + esc(p.texte) + '</div>'
      + '<div class="li-meta">' + dateFr(p.created_at) + ' · ♥ ' + p.likes + (p.image_url?' · image':'') + '</div>'
      + '<div class="li-act"><button class="no" data-del="' + p.id + '">Supprimer</button></div>'
      + '</div>'
    ).join("");
    box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => supprimerPost(b.getAttribute("data-del")));
  }
  async function supprimerPost(id) {
    if (!confirm("Supprimer ce post ?")) return;
    const { data:p } = await DB.from("posts").select("image_chemin").eq("id",id).maybeSingle();
    if (p && p.image_chemin) await DB.storage.from(BUCKET).remove([p.image_chemin]);
    await DB.from("posts").delete().eq("id",id);
    status("Post supprimé.","ok"); chargerPosts();
  }

  // Contributions
  async function chargerContrib() {
    const box = $("contribList"); box.innerHTML = "<p class='empty'>Chargement…</p>";
    const { data, error } = await DB.from("nibo_contributions").select("*").eq("statut","a_verifier").order("created_at",{ascending:false});
    if (error || !data.length) { box.innerHTML = "<p class='empty'>Aucune contribution à vérifier.</p>"; return; }
    box.innerHTML = data.map(c =>
      '<div class="liste-item r-' + (c.rubrique||'politique') + '" style="border-left-color:var(--' + (c.rubrique||'politique') + ')">'
      + '<div class="li-rub" style="color:var(--' + (c.rubrique||'politique') + ')">' + esc(RUBS[c.rubrique]||c.rubrique||'—') + '</div>'
      + '<div class="li-texte">' + esc(c.texte) + '</div>'
      + '<div class="li-meta">Par ' + esc(c.auteur) + (c.contact?' · '+esc(c.contact):'') + ' · ' + dateFr(c.created_at) + '</div>'
      + '<div class="li-act"><button class="ok" data-pub="' + c.id + '">Publier</button>'
      + '<button class="no" data-rej="' + c.id + '">Rejeter</button></div>'
      + '</div>'
    ).join("");
    box.querySelectorAll("[data-pub]").forEach(b => b.onclick = () => publierContrib(b.getAttribute("data-pub"), data));
    box.querySelectorAll("[data-rej]").forEach(b => b.onclick = () => rejeterContrib(b.getAttribute("data-rej")));
  }
  async function publierContrib(id, liste) {
    const c = liste.find(x => x.id === id);
    if (!c) return;
    const ent = await entrepriseId();
    const { error } = await DB.from("posts").insert({
      entreprise_id: ent, rubrique: c.rubrique||"social", texte: c.texte,
      image_url: c.image_url, image_chemin: c.image_chemin,
      auteur: c.auteur, statut: "publie"
    });
    if (error) { status("Erreur : " + error.message,"err"); return; }
    await DB.from("nibo_contributions").update({ statut:"valide" }).eq("id",id);
    status("Contribution publiée !","ok"); chargerContrib();
  }
  async function rejeterContrib(id) {
    await DB.from("nibo_contributions").update({ statut:"rejete" }).eq("id",id);
    status("Contribution rejetée.","ok"); chargerContrib();
  }

  refreshAuth();
})();
