// Browser-local shared reads: also deduplicate overlapping transition/StrictMode mounts.
const entries = new Map<string, { expires: number; promise: Promise<any> }>();
export function clearRuntimeCache(scope: "all" | "data" = "all") {
  if (scope === "all") { entries.clear(); return; }
  for (const key of entries.keys()) {
    const [url] = JSON.parse(key) as [string,string];
    if (url.startsWith("/api/view-data/") || url.startsWith("/api/data/") || url.startsWith("/api/expression-data") || url === "/api/views?runtime=1") entries.delete(key);
  }
}
export function runtimeJSON(url: string, email = "", maxAge = 60000): Promise<any> {
  const key = JSON.stringify([url, email]);
  const cached = entries.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const entry = { expires: Infinity, promise: Promise.resolve() as Promise<any> };
  entry.promise = fetch(url, {headers: {"x-nocode-preview-email": email}}).then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "โหลดข้อมูลไม่ได้ กรุณาลองใหม่");
    entry.expires = Date.now() + maxAge;
    return data;
  }).catch(error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
  if (entries.size >= 100) entries.delete(entries.keys().next().value!);
  entries.set(key, entry);
  return entry.promise;
}
if (typeof window !== "undefined") window.addEventListener("nocode:metadata", () => clearRuntimeCache());
