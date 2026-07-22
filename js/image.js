/* Nibo News — génération d'images (carré 1:1 et story 9:16)
   Redessine le post sur un canvas aux dimensions réseaux sociaux. */
(function () {
  const COULEURS = {
    politique:"#c0392b", sport:"#27ae60", social:"#e67e22",
    economie:"#2980b9", international:"#16a5a5", potins:"#d6438b"
  };
  const NOMS = {
    politique:"Politique", sport:"Sport", social:"Social",
    economie:"Économie", international:"International", potins:"Potins"
  };
  const FOND = "#1a1a1f";
  const FOND_2 = "#24242c";
  const BLANC = "#f4f4f7";
  const DOUX = "#9a9aa8";
  const POURPRE = "#a45ee8";

  const FORMATS = {
    carre: { w:1080, h:1080, nom:"carre" },
    story: { w:1080, h:1920, nom:"story" }
  };

  // Mélange une couleur avec le fond (pour les dégradés)
  function melange(hex, ratio) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const fr = 26, fg = 26, fb = 31;
    return "rgb(" + Math.round(r*ratio + fr*(1-ratio)) + "," +
                    Math.round(g*ratio + fg*(1-ratio)) + "," +
                    Math.round(b*ratio + fb*(1-ratio)) + ")";
  }

  // Découpe le texte en lignes qui tiennent dans la largeur
  function lignes(ctx, texte, maxW) {
    const mots = texte.split(/\s+/);
    const out = [];
    let ligne = "";
    for (const mot of mots) {
      const test = ligne ? ligne + " " + mot : mot;
      if (ctx.measureText(test).width > maxW && ligne) { out.push(ligne); ligne = mot; }
      else ligne = test;
    }
    if (ligne) out.push(ligne);
    return out;
  }

  // Charge l'image de fond si présente
  function chargerImage(url) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);   // on continue sans image si échec
      img.src = url;
    });
  }

  // Dessine le visuel complet
  async function dessiner(post, format) {
    const F = FORMATS[format] || FORMATS.carre;
    const cv = document.createElement("canvas");
    cv.width = F.w; cv.height = F.h;
    const ctx = cv.getContext("2d");
    const coul = COULEURS[post.rubrique] || POURPRE;
    const story = (format === "story");

    // --- Fond ---
    ctx.fillStyle = FOND;
    ctx.fillRect(0,0,F.w,F.h);

    const imgFond = await chargerImage(post.image_url);
    if (imgFond) {
      // Couvrir tout le cadre en gardant les proportions
      const ir = imgFond.width / imgFond.height, cr = F.w / F.h;
      let dw, dh, dx, dy;
      if (ir > cr) { dh = F.h; dw = dh * ir; dx = (F.w - dw)/2; dy = 0; }
      else { dw = F.w; dh = dw / ir; dx = 0; dy = (F.h - dh)/2; }
      ctx.drawImage(imgFond, dx, dy, dw, dh);
      // Voile sombre pour la lisibilité
      const v = ctx.createLinearGradient(0,0,0,F.h);
      v.addColorStop(0,"rgba(16,16,22,.80)");
      v.addColorStop(1,"rgba(16,16,22,.93)");
      ctx.fillStyle = v; ctx.fillRect(0,0,F.w,F.h);
    } else {
      // Dégradé aux couleurs de la rubrique
      const g = ctx.createLinearGradient(0,0,F.w*0.8,F.h);
      g.addColorStop(0, melange(coul,0.20));
      g.addColorStop(0.55, FOND_2);
      g.addColorStop(1, FOND);
      ctx.fillStyle = g; ctx.fillRect(0,0,F.w,F.h);
    }

    // --- Barre de rubrique en haut ---
    ctx.fillStyle = coul;
    ctx.fillRect(0,0,F.w,story?14:12);

    const marge = story ? 96 : 88;
    const hautDepart = story ? 300 : 150;

    // --- En-tête : pastille + rubrique + logo ---
    const yHead = hautDepart;
    ctx.beginPath();
    ctx.arc(marge+9, yHead-8, 9, 0, Math.PI*2);
    ctx.fillStyle = coul; ctx.fill();

    ctx.font = "700 " + (story?30:28) + "px Inter, system-ui, sans-serif";
    ctx.fillStyle = coul;
    ctx.textAlign = "left";
    const rubTxt = (NOMS[post.rubrique] || post.rubrique || "").toUpperCase();
    ctx.letterSpacing = "3px";
    ctx.fillText(rubTxt, marge + 32, yHead);
    ctx.letterSpacing = "0px";

    // Logo Nibo News à droite
    ctx.textAlign = "right";
    ctx.font = "600 " + (story?32:30) + "px Georgia, serif";
    ctx.fillStyle = DOUX;
    const wNibo = ctx.measureText("Nibo").width;
    ctx.fillStyle = POURPRE;
    ctx.fillText("News", F.w - marge, yHead);
    const wNews = ctx.measureText("News").width;
    ctx.fillStyle = DOUX;
    ctx.fillText("Nibo", F.w - marge - wNews, yHead);

    // --- Texte principal ---
    ctx.textAlign = "left";
    const maxW = F.w - marge*2;
    const texte = post.texte || "";
    // Taille adaptée à la longueur
    let taille = story ? 74 : 66;
    if (texte.length > 160) taille = story ? 60 : 54;
    if (texte.length > 260) taille = story ? 50 : 44;
    ctx.font = "500 " + taille + "px Georgia, serif";
    let lns = lignes(ctx, texte, maxW);
    // Si trop de lignes, réduire
    const maxLignes = story ? 12 : 8;
    while (lns.length > maxLignes && taille > 30) {
      taille -= 4;
      ctx.font = "500 " + taille + "px Georgia, serif";
      lns = lignes(ctx, texte, maxW);
    }
    const interligne = taille * 1.38;
    const blocH = lns.length * interligne;
    // Centrer verticalement dans l'espace disponible
    const zoneHaut = yHead + (story?90:70);
    const zoneBas = F.h - (story?260:180);
    let y = zoneHaut + Math.max(0, ((zoneBas - zoneHaut) - blocH) / 2) + taille;

    ctx.fillStyle = BLANC;
    lns.forEach(l => { ctx.fillText(l, marge, y); y += interligne; });

    // --- Pied : filet + date + filigrane ---
    const yPied = F.h - (story?150:110);
    ctx.strokeStyle = melange(coul, 0.45);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(marge, yPied - 44);
    ctx.lineTo(F.w - marge, yPied - 44);
    ctx.stroke();

    ctx.font = "400 " + (story?28:26) + "px Inter, system-ui, sans-serif";
    ctx.fillStyle = DOUX;
    ctx.textAlign = "left";
    const d = post.created_at ? new Date(post.created_at) : new Date();
    ctx.fillText(d.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}), marge, yPied);

    ctx.textAlign = "right";
    ctx.font = "600 " + (story?30:28) + "px Georgia, serif";
    const wN2 = ctx.measureText("News").width;
    ctx.fillStyle = POURPRE;
    ctx.fillText("News", F.w - marge, yPied);
    ctx.fillStyle = DOUX;
    ctx.fillText("Nibo", F.w - marge - wN2, yPied);

    return cv;
  }

  // Télécharge le canvas en image
  function telecharger(cv, nom) {
    cv.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nom + ".png";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  // API publique
  window.NiboImage = {
    async generer(post, format) {
      const cv = await dessiner(post, format);
      const slug = (post.texte||"post").slice(0,28).replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase();
      telecharger(cv, "nibonews-" + (slug||"post") + "-" + format);
      return true;
    },
    async apercu(post, format) {
      return await dessiner(post, format);
    }
  };
})();
