/**
 * POST /admin/api/save  (protege par Cloudflare Access — sous /admin/)
 * Enregistre le contenu du site dans Cloudflare KV (instantane).
 * Cree aussi une sauvegarde datee durable dans R2 (rien ne disparait).
 */
const KEYS = ["content", "theme", "overrides", "pages", "blocks"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const kv = env.CMS_KV;
  if (!kv) return json({ ok: false, error: "Stockage KV non configure (liaison CMS_KV manquante)." }, 500);
  const email = request.headers.get("Cf-Access-Authenticated-User-Email") || "";
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: "Donnees invalides." }, 400); }
  const saved = [];
  for (const k of KEYS) {
    if (body[k] && typeof body[k] === "object") {
      await kv.put(k, JSON.stringify(body[k]));
      saved.push(k);
    }
  }
  if (!saved.length) return json({ ok: false, error: "Rien a enregistrer." }, 400);
  let backup = null;
  try {
    const r2 = env.CMS_MEDIA;
    if (r2) {
      const snap = {};
      for (const k of KEYS) { const v = await kv.get(k); if (v != null) { try { snap[k] = JSON.parse(v); } catch (e) {} } }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      backup = "backups/" + stamp + ".json";
      await r2.put(backup, JSON.stringify({ at: new Date().toISOString(), by: email, data: snap }), { httpMetadata: { contentType: "application/json" } });
    }
  } catch (e) {}
  return json({ ok: true, saved, backup, by: email || null, at: new Date().toISOString() });
}
