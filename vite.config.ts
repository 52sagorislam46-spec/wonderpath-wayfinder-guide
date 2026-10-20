// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      // Offline app-shell worker. It is NOT registered directly: the push workers
      // (OneSignal / Firebase) own scope "/" and pull it in via importScripts("/sw.js").
      VitePWA({
        strategies: "generateSW",
        filename: "sw.js",
        registerType: "autoUpdate",
        injectRegister: null,
        manifest: false,
        devOptions: { enabled: false },
        outDir: "dist/client",
        workbox: {
          globDirectory: "dist/client",
          globIgnores: ["**/*SW*.js", "**/*-sw.js", "fly-push-ack.js", "sw.js", "workbox-*.js"],
          swDest: "dist/client/sw.js",
          globPatterns: ["**/*.{js,css,ico,png,svg,woff2,webmanifest}"],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          navigateFallback: null,
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
              handler: "NetworkFirst",
              options: {
                cacheName: "fly-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 30 },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/"),
              handler: "CacheFirst",
              options: { cacheName: "fly-assets", expiration: { maxEntries: 300 } },
            },
            {
              urlPattern: ({ url }) => url.hostname === "res.cloudinary.com",
              handler: "StaleWhileRevalidate",
              options: { cacheName: "fly-media", expiration: { maxEntries: 200 } },
            },
          ],
        },
      }),
    ],
  },
});
