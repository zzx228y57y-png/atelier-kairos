/**
 * GET /media/<nom> — sert une photo stockee dans Cloudflare R2.
 */
export async function onRequestGet(context) {
  const { env, params } = context;
  const r2 = env.CMS_MEDIA;
  const key = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");
  if (!r2 || !key) return new Response("Introuvable", { status: 404 });
  const obj = await r2.get(key);
  if (!obj) return new Response("Introuvable", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }
  return new Response(obj.body, { headers });
}
