/* Offline app shell (generated /sw.js) — published site only, never in preview. */
(function () {
  var h = self.location.hostname;
  var preview = /^(id-preview--|preview--)/.test(h) || /(^|\.)(lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(h) || h === "localhost";
  if (!preview) { try { importScripts("/sw.js"); } catch (e) {} }
})();

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
importScripts("/fly-push-ack.js");

/* Same background acknowledgement as the Firebase worker. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    const payload = event.data ? event.data.json() : {};
    data = payload.data || (payload.custom && payload.custom.a) || payload || {};
  } catch (e) {
    data = {};
  }
  if (typeof self.flyAck === "function") event.waitUntil(self.flyAck(data));
});
