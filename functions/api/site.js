/**
 * GET /api/site — contenu du site depuis Cloudflare KV (lecture en direct).
 * Repli sur les fichiers statiques tant que KV n'est pas amorce.
 */
const KEYS = ["content", "theme", "overrides", "pages", "blocks"];

export async function onRequestGet(context) {
  const { env, request } = context;
  const kv = env.CMS_KV;
  const out = {};
  for (const k of KEYS) {
    let val = null;
    if (kv) {
      try {
        const raw = await kv.get(k);
        if (raw != null) val = JSON.parse(raw);
      } catch (e) {}
    }
    if (val == null) {
      try {
        const r = await fetch(new URL("/" + k + ".json", request.url).toString());
        if (r.ok) val = await r.json();
      } catch (e) {}
    }
    out[k] = val == null ? {} : val;
  }
  return new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
