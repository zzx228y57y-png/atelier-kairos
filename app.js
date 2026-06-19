/* Atelier Kairos — moteur de contenu éditable
   Lit theme.json (couleurs + polices) et content.json (textes + images)
   et les applique aux pages. Si un fichier ou une clé manque, on garde
   simplement le contenu par défaut déjà présent dans le HTML. */

(function () {
  // En mode édition (page /admin dans un cadre), c'est l'éditeur qui pilote
  // l'affichage : on n'applique pas les fichiers ici pour éviter les conflits.
  try {
    if (new URLSearchParams(location.search).get("edit") === "1" && window.parent !== window) {
      document.documentElement.setAttribute("data-edit-mode", "1");
      return;
    }
  } catch (e) {}

  const bust = "?v=" + Date.now(); // évite le cache lors des mises à jour

  // ---------- THÈME (couleurs + polices) ----------
  function appliquerTheme(theme) {
    if (!theme) return;
    const root = document.documentElement.style;
    const map = {
      couleur_terracotta: "--terracotta",
      couleur_sable: "--sable",
      couleur_beige_rose: "--beige-rose",
      couleur_coquillage: "--coquillage",
      couleur_cacao: "--cacao",
      couleur_flamant: "--flamant",
      couleur_ocean: "--ocean",
      couleur_sauge: "--sauge"
    };
    Object.keys(map).forEach(function (k) {
      if (theme[k]) root.setProperty(map[k], theme[k]);
    });
    // dérivé : terracotta foncé pour les survols
    if (theme.couleur_terracotta) {
      root.setProperty("--terracotta-fonce", assombrir(theme.couleur_terracotta, 0.12));
    }

    // Forme des boutons
    var formes = { pilule: "50px", arrondi: "12px", carre: "4px" };
    if (theme.bouton_forme) root.setProperty("--btn-radius", formes[theme.bouton_forme] || "50px");

    // Polices
    const titres = theme.police_titres;
    const textes = theme.police_textes;
    if (titres || textes) {
      chargerPolices(titres, textes);
      if (titres) root.setProperty("--titre", "'" + titres + "', Georgia, serif");
      if (textes) root.setProperty("--corps", "'" + textes + "', -apple-system, BlinkMacSystemFont, sans-serif");
    }
  }

  function chargerPolices(titres, textes) {
    const familles = [];
    if (titres) familles.push(titres.replace(/ /g, "+") + ":ital,wght@0,400;0,500;0,600;1,500");
    if (textes && textes !== titres) familles.push(textes.replace(/ /g, "+") + ":wght@300;400;700");
    if (!familles.length) return;
    const href = "https://fonts.googleapis.com/css2?family=" + familles.join("&family=") + "&display=swap";
    let lien = document.getElementById("police-dynamique");
    if (!lien) {
      lien = document.createElement("link");
      lien.id = "police-dynamique";
      lien.rel = "stylesheet";
      document.head.appendChild(lien);
    }
    lien.href = href;
  }

  function assombrir(hex, amt) {
    try {
      const c = hex.replace("#", "");
      const r = Math.max(0, Math.round(parseInt(c.substr(0, 2), 16) * (1 - amt)));
      const g = Math.max(0, Math.round(parseInt(c.substr(2, 2), 16) * (1 - amt)));
      const b = Math.max(0, Math.round(parseInt(c.substr(4, 2), 16) * (1 - amt)));
      return "#" + [r, g, b].map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    } catch (e) { return hex; }
  }

  // ---------- CONTENU (textes + images) ----------
  function appliquerContenu(contenu) {
    if (!contenu) return;
    // Textes : <element data-edit="cle"> (autorise un peu de mise en forme)
    document.querySelectorAll("[data-edit]").forEach(function (el) {
      const v = contenu[el.getAttribute("data-edit")];
      if (typeof v === "string" && v.length) el.innerHTML = v;
    });
    // Images de fond : <element data-edit-bg="cle">
    document.querySelectorAll("[data-edit-bg]").forEach(function (el) {
      const v = contenu[el.getAttribute("data-edit-bg")];
      if (typeof v === "string" && v.length) el.style.backgroundImage = "url('" + v + "')";
    });
    // Images <img data-edit-src="cle">
    document.querySelectorAll("[data-edit-src]").forEach(function (el) {
      const v = contenu[el.getAttribute("data-edit-src")];
      if (typeof v === "string" && v.length) el.setAttribute("src", v);
    });
    // Liens <a data-edit-href="cle">
    document.querySelectorAll("[data-edit-href]").forEach(function (el) {
      const v = contenu[el.getAttribute("data-edit-href")];
      if (typeof v === "string" && v.length) el.setAttribute("href", v);
    });
  }

  function charger(url) {
    return fetch(url + bust).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  // ---------- OVERRIDES par élément (système type Squarespace) ----------
  // overrides.json : { "index.html": { "<sélecteur CSS>": {h:"texte", s:{...styles}, src, bg} } }
  function pageName() {
    var p = location.pathname.replace(/\/+$/, "");
    var b = p.substring(p.lastIndexOf("/") + 1);
    if (!b) return "index.html";
    if (b.indexOf(".") === -1) b += ".html"; // Cloudflare sert des URL « propres » (/atelier => atelier.html)
    return b;
  }
  function appliquerOverrides(ov) {
    if (!ov) return;
    var page = ov[pageName()];
    if (!page) return;
    Object.keys(page).forEach(function (sel) {
      var el;
      try { el = document.querySelector(sel); } catch (e) { return; }
      if (!el) return;
      var o = page[sel];
      if (typeof o.h === "string") el.innerHTML = o.h;
      if (o.src) el.setAttribute("src", o.src);
      if (o.bg) el.style.backgroundImage = "url('" + o.bg + "')";
      if (o.s) Object.keys(o.s).forEach(function (k) { try { el.style[k] = o.s[k]; } catch (e) {} });
    });
  }

  // ---------- BLOCS LIBRES (composés dans le builder, position libre + responsive) ----------
  // blocks.json : { "atelier.html": { free:true, h:<px>, blocks:[ {t,x,y,w,h,z,bg,html} ] },
  //                 "index.html": { zones:[ {id,pos,h,blocks:[...]} ] } }
  function kxBlockEl(b) {
    var el = document.createElement("div");
    el.className = "kx-block " + (b.t || "texte");
    el.style.left = (b.x || 0) + "%";
    el.style.top = (b.y || 0) + "px";
    el.style.width = (b.w || 30) + "%";
    el.style.height = (b.h || 80) + "px";
    if (b.z) el.style.zIndex = b.z;
    if (b.bg) el.style.background = b.bg;
    var inner = document.createElement("div");
    inner.className = "inner";
    if (b.is) inner.style.cssText = b.is;
    inner.innerHTML = b.html || "";
    el.appendChild(inner);
    return el;
  }
  function kxCanvas(sec) {
    var cv = document.createElement("div");
    cv.className = "kx-canvas";
    cv.style.height = (sec.h || 800) + "px";
    (sec.blocks || []).slice().sort(function (a, b) { return (a.y || 0) - (b.y || 0); })
      .forEach(function (b) { cv.appendChild(kxBlockEl(b)); });
    return cv;
  }
  function sectionAnchors() {
    return [].slice.call(document.body.children).filter(function (el) {
      return el.matches && el.matches("section, .hero, .page-hero, .cta-band");
    });
  }
  function renderBlocks(data) {
    if (!data) return;
    var page = data[pageName()];
    if (!page) return;
    // Page entièrement libre
    if (page.free) {
      var host = document.getElementById("kx-page");
      if (host) { host.innerHTML = ""; host.appendChild(kxCanvas(page)); }
      return;
    }
    // Zones insérées dans une page existante
    if (page.zones && page.zones.length) {
      [].slice.call(document.querySelectorAll(".kx-zone")).forEach(function (z) { z.remove(); });
      var anchors = sectionAnchors();
      page.zones.forEach(function (z) {
        var zone = document.createElement("div"); zone.className = "kx-zone"; zone.appendChild(kxCanvas(z));
        var pos = z.pos | 0;
        if (pos <= 0) { if (anchors[0]) anchors[0].parentNode.insertBefore(zone, anchors[0]); else document.body.appendChild(zone); }
        else if (pos >= anchors.length) { var last = anchors[anchors.length - 1]; if (last) last.parentNode.insertBefore(zone, last.nextSibling); else document.body.appendChild(zone); }
        else { var ref = anchors[pos]; ref.parentNode.insertBefore(zone, ref); }
      });
    }
  }

  function appliquerTout() {
    charger("content.json").then(appliquerContenu).then(function () {
      charger("overrides.json").then(appliquerOverrides);
      charger("blocks.json").then(function (bl) { if (bl) try { renderBlocks(bl); } catch (e) {} });
    });
  }

  // Applique le thème le plus tôt possible, puis le contenu + overrides
  charger("theme.json").then(appliquerTheme);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", appliquerTout);
  } else {
    appliquerTout();
  }
})();
