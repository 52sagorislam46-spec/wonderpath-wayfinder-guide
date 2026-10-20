/**
 * Offline support wrapper — the only place that registers a worker for offline use.
 * The push workers (Firebase / OneSignal) import the generated /sw.js, so we
 * just make sure one of them is active on the published site.
 */
function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (window.top !== window.self) return true;
  const h = window.location.hostname;
  if (/^(id-preview--|preview--)/.test(h)) return true;
  if (/(^|\.)(lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(h)) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

export async function setupOffline(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    if (isRefusedContext()) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs
          .filter((r) => (r.active?.scriptURL ?? "").endsWith("/sw.js"))
          .map((r) => r.unregister()),
      );
      return;
    }
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return; // a push worker already controls the app and includes offline caching
    await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch {
    /* offline support is best-effort */
  }
}
