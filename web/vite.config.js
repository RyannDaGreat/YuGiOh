import adapterNode from "@sveltejs/adapter-node";
import adapterStatic from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * One codebase, two hosts, chosen at build time by VITE_STATIC (see $lib/host.js):
 *
 *   vite build                -> adapter-node: a Node server with /api routes; the
 *                                engine runs server-side against real files.
 *   VITE_STATIC=1 vite build  -> adapter-static: a pure SPA for GitHub Pages under
 *                                /YuGiOh/; the engine runs IN the browser against
 *                                the browser's own filesystem and the baked card
 *                                bundle in static/carddata.
 *
 * Nothing in src/ or the pages branches on this — only $lib/api.js and $lib/boot.js.
 */
const STATIC = process.env.VITE_STATIC === "1";

/** GitHub Pages serves a project site under /<repo>/; a custom domain would make this "". */
const STATIC_BASE = process.env.VITE_BASE ?? "/YuGiOh";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
      },
      adapter: STATIC
        ? // GitHub Pages serves 404.html for any unknown path, which is exactly how an
          // SPA wants deep links like /duel/<id> handled: the shell loads, the client
          // router takes over. bin/build-static.sh also copies it to index.html so the
          // site root answers 200.
          adapterStatic({ fallback: "404.html", strict: false })
        : adapterNode(),
      paths: STATIC ? { base: STATIC_BASE } : {},
    }),
  ],
  // The duel engine (../src) lives outside this package; the server bundle
  // imports it relatively, and the WASM core stays external (loaded from node_modules).
  ssr: { external: ["ocgcore-wasm"] },
  server: { fs: { allow: [".."] } },
  // The ocgcore-wasm glue uses top-level await; the static bundle must target
  // engines that have it (every browser with WebAssembly does).
  build: { target: "esnext" },
  optimizeDeps: { exclude: ["ocgcore-wasm"] },
});
