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

  // ---------- SECTIONS (nouveau modèle : sections → colonnes → blocs) ----------
  // pages.json : { "index.html": { place:"bottom"|"top", sections:[ Section ] } }
  // Section = { id, bg, pad, width, cols:[ { span, blocks:[ Block ] } ] }
  function kxEsc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function kxYt(u) { var m = (u || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{6,})/); return m ? m[1] : null; }
  function kxVimeo(u) { var m = (u || "").match(/vimeo\.com\/(?:video\/)?(\d+)/); return m ? m[1] : null; }
  function kxBlockHTML(b) {
    var p = b || {}, t = p.type;
    function al(x) { return x ? ("text-align:" + x + ";") : ""; }
    if (t === "heading") { var lvl = (p.level === "h1" ? "h1" : p.level === "h3" ? "h3" : p.level === "h4" ? "h4" : "h2"); var st = al(p.align) + (p.color ? ("color:" + p.color + ";") : "") + (p.size ? ("font-size:" + p.size + ";") : ""); return "<" + lvl + ' class="kx2-h" style="' + st + '">' + (p.html || "Titre") + "</" + lvl + ">"; }
    if (t === "text") { return '<div class="kx2-rt" style="' + al(p.align) + '">' + (p.html || "<p>Votre texte</p>") + "</div>"; }
    if (t === "image") { var ist = (p.radius ? ("border-radius:" + p.radius + ";") : "") + (p.fit ? ("object-fit:" + p.fit + ";") : "") + (p.ratio ? ("aspect-ratio:" + p.ratio + ";object-fit:cover;") : ""); var img = '<img src="' + kxEsc(p.src || "") + '" alt="' + kxEsc(p.alt || "") + '" style="' + ist + '">'; return p.href ? ('<a href="' + kxEsc(p.href) + '">' + img + "</a>") : img; }
    if (t === "button") { var cls = "btn" + (p.style === "light" ? " btn--light" : p.style === "ghost" ? " btn--ghost" : ""); return '<div class="kx2-btnwrap" style="' + al(p.align || "left") + '"><a class="' + cls + '" href="' + kxEsc(p.href || "#") + '">' + kxEsc(p.label || "Bouton") + "</a></div>"; }
    if (t === "video") { var u = p.url || "", src = ""; var y = kxYt(u), v = kxVimeo(u); if (y) src = "https://www.youtube.com/embed/" + y; else if (v) src = "https://player.vimeo.com/video/" + v; else src = u; return src ? ('<div class="kx2-video"><iframe src="' + kxEsc(src) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>') : ""; }
    if (t === "gallery") { var imgs = p.images || []; return '<div class="kx2-gallery" style="grid-template-columns:repeat(' + (p.cols || 3) + ',1fr)">' + imgs.map(function (g) { return '<img src="' + kxEsc(g.src || "") + '" alt="' + kxEsc(g.alt || "") + '">'; }).join("") + "</div>"; }
    if (t === "quote") { return '<blockquote class="kx2-quote">' + (p.html || "Citation") + (p.author ? ("<cite>" + kxEsc(p.author) + "</cite>") : "") + "</blockquote>"; }
    if (t === "list") { var items = p.items || []; return '<ul class="kx2-list">' + items.map(function (it) { return "<li><span class=\"kx2-ic\">" + kxEsc(it.icon || "✦") + "</span><span>" + (it.text || "") + "</span></li>"; }).join("") + "</ul>"; }
    if (t === "spacer") { return '<div class="kx2-spacer" style="height:' + (p.h || 40) + 'px"></div>'; }
    if (t === "divider") { return '<hr class="kx2-hr">'; }
    if (t === "map") { return '<div class="kx2-map"><iframe src="https://www.google.com/maps?q=' + encodeURIComponent(p.query || "France") + '&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>'; }
    if (t === "embed") { return '<div class="kx2-embed">' + (p.html || "") + "</div>"; }
    return "";
  }
  function kxSectionEl(s) {
    var sec = document.createElement("section");
    sec.className = "kx2-sec kx2-pad-" + (s.pad || "lg");
    var bg = s.bg;
    if (bg) {
      if (typeof bg === "object" && bg.img) { sec.style.backgroundImage = "url('" + bg.img + "')"; sec.classList.add("kx2-bgimg"); if (bg.overlay != null) sec.style.setProperty("--kx2-ov", bg.overlay); }
      else { sec.style.background = bg; }
    }
    var inner = document.createElement("div"); inner.className = "kx2-inner kx2-w-" + (s.width || "normal");
    var grid = document.createElement("div"); grid.className = "kx2-grid";
    (s.cols || [{ span: 12, blocks: [] }]).forEach(function (c) {
      var col = document.createElement("div"); col.className = "kx2-col"; col.style.gridColumn = "span " + (c.span || 12);
      (c.blocks || []).forEach(function (b) { var w = document.createElement("div"); w.className = "kx2-blk kx2-" + (b.type || "text"); w.innerHTML = kxBlockHTML(b); col.appendChild(w); });
      grid.appendChild(col);
    });
    inner.appendChild(grid); sec.appendChild(inner); return sec;
  }
  // Édition en place : on réordonne / insère / masque des sections sur la vraie page.
  // pages.json : { "page.html": { layout:[{orig:i}|{ins:"id"}], inserts:{id:Section}, hidden:[sel] } }
  function origSections() {
    return [].slice.call(document.body.children).filter(function (el) {
      if (!el.tagName) return false;
      var t = el.tagName;
      if (t === "HEADER" || t === "FOOTER" || t === "SCRIPT" || t === "STYLE" || t === "LINK") return false;
      if (el.classList && (el.classList.contains("site-header") || el.classList.contains("site-footer"))) return false;
      return true;
    });
  }
  function applyLayout(pg) {
    if (!pg) return;
    var orig = origSections();
    (pg.hidden || []).forEach(function (sel) { try { [].slice.call(document.querySelectorAll(sel)).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); } catch (e) {} });
    if (pg.layout && pg.layout.length) {
      // Layout identité (sections d'origine dans le même ordre, sans insertion) : on ne reconstruit
      // RIEN — on garde le DOM original pour préserver les animations d'apparition au défilement.
      var hasInsert = pg.layout.some(function (s) { return s.ins != null; });
      var identity = !hasInsert && pg.layout.length === orig.length && pg.layout.every(function (s, i) { return s.orig === i; });
      if (identity) return;
      orig.forEach(function (el, i) { el.setAttribute("data-kxorig", i); });
      var footer = document.querySelector("footer.site-footer") || document.querySelector("footer");
      var parent = footer ? footer.parentNode : document.body;
      var used = {}, frag = document.createDocumentFragment();
      pg.layout.forEach(function (slot) {
        if (slot.orig != null) {
          var node = orig[slot.orig];
          if (!node) return;
          if (used[slot.orig]) node = node.cloneNode(true);
          used[slot.orig] = 1;
          frag.appendChild(node);
        } else if (slot.ins != null) {
          var sec = pg.inserts && pg.inserts[slot.ins];
          if (sec) { try { frag.appendChild(kxSectionEl(sec)); } catch (e) {} }
        }
      });
      orig.forEach(function (el, i) { if (!used[i] && el.parentNode) el.parentNode.removeChild(el); });
      if (footer) parent.insertBefore(frag, footer); else document.body.appendChild(frag);
      // Les sections reconstruites ne sont plus observées par l'animation → on les rend visibles.
      try { [].slice.call(document.querySelectorAll(".reveal")).forEach(function (el) { el.classList.add("in"); }); } catch (e) {}
    }
  }
  function renderPages(data) { if (data) try { applyLayout(data[pageName()]); } catch (e) {} }

  function appliquerTout() {
    charger("content.json").then(appliquerContenu).then(function () {
      charger("blocks.json").then(function (bl) { if (bl) try { renderBlocks(bl); } catch (e) {} });
      // On applique le ré-agencement des sections (pages.json) AVANT les overrides :
      // les sélecteurs des overrides sont calculés par l'éditeur sur la page ré-agencée,
      // donc le rendu public doit ré-agencer d'abord, puis appliquer les retouches.
      return charger("pages.json").then(function (pg) { if (pg) try { renderPages(pg); } catch (e) {} });
    }).then(function () {
      charger("overrides.json").then(appliquerOverrides);
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
