// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import sanity from "@sanity/astro";
import { loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HOME_ONLY } from "./src/lib/launch.ts";

const env = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "");

// Without a real project ID the Studio route still compiles; it just cannot connect.
// Fill PUBLIC_SANITY_PROJECT_ID in .env (see .env.example) to activate /admin and live content.
const projectId = env.PUBLIC_SANITY_PROJECT_ID || "placeholder";
const dataset = env.PUBLIC_SANITY_DATASET || "production";

// Dev only. `astro dev` never runs functions/, so this serves GET /api/instagram through the same
// core the Pages Function uses. With INSTAGRAM_ACCESS_TOKEN in .env it calls Meta; without it, it
// serves tests/fixtures/instagram-media.json so the live grid can be driven locally.
function instagramDevRoute() {
  return {
    name: "instagram-dev-route",
    hooks: {
      "astro:server:setup": (/** @type {{ server: import("vite").ViteDevServer }} */ { server }) => {
        server.middlewares.use(
          "/api/instagram",
          /**
           * @param {import("node:http").IncomingMessage} req
           * @param {import("node:http").ServerResponse} res
           */
          async (req, res) => {
            /**
             * @param {number} status
             * @param {unknown} body
             */
            const send = (status, body) => {
              res.statusCode = status;
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify(body));
            };
            if (req.method !== "GET") return send(405, { ok: false, error: "method" });
            try {
              const ig = await server.ssrLoadModule("/src/lib/instagram.ts");
              const handle = "pomib.browstudio";
              const token = (env.INSTAGRAM_ACCESS_TOKEN ?? "").trim();
              if (token) {
                const posts = await ig.loadPosts({ token, limit: 4, handle, fetch });
                return send(200, { ok: true, posts, handle, refresh: "manual" });
              }
              const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/instagram-media.json"), "utf8"));
              return send(200, { ok: true, posts: ig.normalizePosts(fixture, 4, handle), handle, refresh: "fixture" });
            } catch (err) {
              console.error("[instagram dev route]", err);
              return send(502, { ok: false, error: "upstream" });
            }
          },
        );
      },
    },
  };
}

export default defineConfig({
  site: "https://pomibbrowstudio.com",
  output: "static",
  trailingSlash: "never",
  integrations: [
    sanity({
      projectId,
      dataset,
      useCdn: false,
      apiVersion: "2025-06-01",
      studioBasePath: "/admin",
    }),
    react(),
    // Under the home-only launch gate the sitemap lists the home page alone.
    // Form result pages (/thanks, /not-sent) are noindex and stay out of it too.
    sitemap({
      filter: (page) =>
        !page.includes("/admin") &&
        !["/thanks", "/not-sent", "/404"].includes(new URL(page).pathname) &&
        (!HOME_ONLY || new URL(page).pathname === "/"),
    }),
    instagramDevRoute(),
  ],
  image: {
    // Original gallery images are large phone shots; cap the largest generated size.
    responsiveStyles: true,
  },
  server: { port: 4400 },
  devToolbar: { enabled: false },
});
