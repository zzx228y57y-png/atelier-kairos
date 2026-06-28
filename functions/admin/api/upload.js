/**
 * POST /admin/api/upload  (protege par Cloudflare Access — sous /admin/)
 * Enregistre une photo directement dans Cloudflare R2.
 * Body JSON : { name, dataBase64, contentType }  ->  { ok, url: "/media/<nom>", name }
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const r2 = env.CMS_MEDIA;
  if (!r2) return json({ ok: false, error: "Stockage R2 non configure (liaison CMS_MEDIA manquante)." }, 500);
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: "Donnees invalides." }, 400); }
  const safe = String(body.name || "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe || !body.dataBase64) return json({ ok: false, error: "Image manquante." }, 400);
  let bytes;
  try {
    const bin = atob(body.dataBase64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (e) { return json({ ok: false, error: "Image illisible." }, 400); }
  const ct = body.contentType || "image/jpeg";
  try {
    await r2.put(safe, bytes, { httpMetadata: { contentType: ct, cacheControl: "public, max-age=31536000, immutable" } });
  } catch (e) { return json({ ok: false, error: "Echec de l'enregistrement : " + (e.message || e) }, 500); }
  return json({ ok: true, url: "/media/" + safe, name: safe });
}
