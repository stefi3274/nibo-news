/* Nibo News — formulaire "Proposer une information" */
(function () {
  // Récupère la connexion, en attendant si nécessaire
  async function db() {
    return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null);
  }

  const $ = id => document.getElementById(id);
  const msg = (t, k) => { const e = $("msg"); if(!e) return; e.textContent = t; e.className = "f-msg on " + (k||""); };

  // Compteur de caractères (indépendant de la connexion)
  const ta = $("cTexte");
  if (ta) ta.addEventListener("input", () => { const c = $("cCompteur"); if (c) c.textContent = ta.value.length; });

  const btn = $("cEnvoyer");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const nom = ($("cNom").value||"").trim();
    const contact = ($("cContact").value||"").trim();
    const texte = ($("cTexte").value||"").trim();
    const rubrique = $("cRubrique").value;
    const source = ($("cSource").value||"").trim();

    if (nom.length < 2) { msg("Indique ton nom.", "err"); return; }
    if (!contact) { msg("Indique un moyen de te recontacter.", "err"); return; }
    if (texte.length < 20) { msg("Développe un peu ton information (20 caractères minimum).", "err"); return; }

    if (typeof DB === "undefined" || !DB) { msg("Service indisponible pour le moment. Écris-nous par email.", "err"); return; }

    msg("Envoi en cours…");
    btn.disabled = true;

    const ent = await entrepriseId();
    if (!ent) { msg("Erreur de configuration. Écris-nous par email.", "err"); btn.disabled = false; return; }

    const { error } = await (await db()).from("nibo_contributions").insert({
      entreprise_id: ent,
      auteur: nom,
      contact: contact,
      rubrique: rubrique,
      texte: texte,
      source: source || null,
      statut: "a_verifier"
    });

    btn.disabled = false;
    if (error) { msg("Erreur : " + error.message, "err"); return; }

    msg("Merci ! Ta proposition a bien été reçue. Nous la vérifions avant publication.", "ok");
    $("cNom").value = ""; $("cContact").value = ""; $("cTexte").value = "";
    $("cSource").value = ""; $("cCompteur").textContent = "0";
  });
})();
