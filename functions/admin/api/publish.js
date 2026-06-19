/**
 * Moteur de publication — Cloudflare Pages Function
 * Endpoint : POST /admin/api/publish  (protégé par Cloudflare Access)
 *
 * Reçoit le contenu mis à jour depuis l'éditeur /admin et l'enregistre
 * dans le dépôt GitHub via l'API GitHub, avec une clé stockée en secret
 * côté Cloudflare (GITHUB_TOKEN). L'utilisateur n'a jamais à gérer GitHub.
 *
 * Body JSON attendu :
 * {
 *   "content": { ... },           // contenu de content.json (objet)
 *   "theme":   { ... },           // contenu de theme.json (objet)
 *   "images":  [                  // facultatif : nouvelles photos
 *     { "name": "portrait.jpg", "data": "<base64 sans préfixe>" }
 *   ]
 * }
 */

const GH_API = "https://api.github.com";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function ghGetSha(owner, repo, branch, path, token) {
  const r = await fetch(
    `${GH_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "atelier-kairos-cms",
      },
    }
  );
  if (r.status === 200) {
    const j = await r.json();
    return j.sha;
  }
  if (r.status === 404) return null; // fichier inexistant => création
  throw new Error(`Lecture ${path} : ${r.status} ${await r.text()}`);
}

// Encode une chaîne UTF-8 en base64 (compatible Workers)
function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

async function ghPut(owner, repo, branch, path, base64Content, message, token, email) {
  const sha = await ghGetSha(owner, repo, branch, path, token);
  const body = {
    message: message + (email ? ` (par ${email})` : ""),
    content: base64Content,
    branch,
  };
  if (sha) body.sha = sha;
  const r = await fetch(
    `${GH_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "atelier-kairos-cms",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(`Écriture ${path} : ${r.status} ${await r.text()}`);
  }
  return true;
}

// Crée une sauvegarde versionnée (Release GitHub) avec zip du code source complet
async function ghCreateRelease(owner, repo, branch, token, email) {
  let n = 1;
  try {
    const lr = await fetch(`${GH_API}/repos/${owner}/${repo}/releases?per_page=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "atelier-kairos-cms" },
    });
    if (lr.ok) { const arr = await lr.json(); n = arr.length + 1; }
  } catch (e) {}
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  const stamp = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "-" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds());
  const tag = "v" + n + "-" + stamp;
  const r = await fetch(`${GH_API}/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "atelier-kairos-cms", "content-type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      target_commitish: branch,
      name: "Version " + n + " — " + d.toISOString().replace("T", " ").slice(0, 16) + " UTC",
      body: "Sauvegarde automatique du code source complet" + (email ? " (publié par " + email + ")" : "") + ".\n\nTéléchargez « Source code (zip) » ci-dessous pour récupérer le site entier de cette version.",
    }),
  });
  if (r.status !== 200 && r.status !== 201) throw new Error("release " + r.status);
  return tag;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const token = env.GITHUB_TOKEN;
  const owner = env.REPO_OWNER || "zzx228y57y-png";
  const repo = env.REPO_NAME || "atelier-kairos";
  const branch = env.BRANCH || "main";

  if (!token) {
    return json({ ok: false, error: "Clé GitHub manquante (GITHUB_TOKEN non configurée côté Cloudflare)." }, 500);
  }

  // Défense en profondeur : exiger l'en-tête d'authentification Cloudflare Access
  const email = request.headers.get("Cf-Access-Authenticated-User-Email") || "";

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ ok: false, error: "Données invalides." }, 400);
  }

  try {
    const results = [];

    if (payload.content && typeof payload.content === "object") {
      const c = toBase64Utf8(JSON.stringify(payload.content, null, 2) + "\n");
      await ghPut(owner, repo, branch, "content.json", c, "Mise à jour du contenu via l'éditeur", token, email);
      results.push("content.json");
    }

    if (payload.theme && typeof payload.theme === "object") {
      const t = toBase64Utf8(JSON.stringify(payload.theme, null, 2) + "\n");
      await ghPut(owner, repo, branch, "theme.json", t, "Mise à jour du thème via l'éditeur", token, email);
      results.push("theme.json");
    }

    if (payload.overrides && typeof payload.overrides === "object") {
      const o = toBase64Utf8(JSON.stringify(payload.overrides, null, 2) + "\n");
      await ghPut(owner, repo, branch, "overrides.json", o, "Mise à jour de la mise en forme via l'éditeur", token, email);
      results.push("overrides.json");
    }

    if (payload.blocks && typeof payload.blocks === "object") {
      const bl = toBase64Utf8(JSON.stringify(payload.blocks, null, 2) + "\n");
      await ghPut(owner, repo, branch, "blocks.json", bl, "Mise à jour des blocs via l'éditeur", token, email);
      results.push("blocks.json");
    }

    if (Array.isArray(payload.images)) {
      for (const img of payload.images) {
        if (!img || !img.name || !img.data) continue;
        const safe = String(img.name).replace(/[^a-zA-Z0-9._-]/g, "_");
        await ghPut(owner, repo, branch, `images/${safe}`, img.data, `Ajout de la photo ${safe}`, token, email);
        results.push(`images/${safe}`);
      }
    }

    if (!results.length) {
      return json({ ok: false, error: "Rien à publier." }, 400);
    }

    // Sauvegarde versionnée — ne doit jamais empêcher la publication
    let backup = null;
    try { backup = await ghCreateRelease(owner, repo, branch, token, email); } catch (e) {}

    return json({ ok: true, published: results, backup: backup, by: email || null });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 500);
  }
}
