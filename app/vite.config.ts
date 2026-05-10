import { defineConfig } from "vite";
import { readFileSync } from "fs";
import { resolve } from "path";

// Build into ../docs so GitHub Pages can serve from /docs on main.
export default defineConfig({
  base: "./",
  build: {
    outDir: resolve(__dirname, "../docs"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      input: {
        // Multi-page Vite — each entry HTML produces its own bundle. URLs
        // mirror the directory layout: app/demo/index.html → /demo/.
        main:             resolve(__dirname, "index.html"),
        demo:             resolve(__dirname, "demo/index.html"),
        docs_policies:    resolve(__dirname, "docs/policies/index.html"),
        docs_governance:  resolve(__dirname, "docs/governance/index.html"),
        sponsors:         resolve(__dirname, "sponsors/index.html"),
      },
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    include: ["buffer"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  plugins: [
    {
      // Dev-only: serve the gitignored ./.dev-key.json (sibling of vite.config)
      // so the testProvider can use it. This file lives OUTSIDE public/ so it
      // can never be copied to a production build.
      name: "multihook-dev-key",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use("/.dev-key.json", (_req, res) => {
          try {
            const path = resolve(__dirname, ".dev-key.json");
            const body = readFileSync(path);
            res.setHeader("content-type", "application/json");
            res.end(body);
          } catch {
            res.statusCode = 404;
            res.end("");
          }
        });
      },
    },
  ],
});
