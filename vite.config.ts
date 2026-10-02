import { defineConfig } from "vite-plus";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "electrobun-dev-content-security-policy",
      transformIndexHtml(html, context) {
        if (!context.server) return html;
        return html.replace(
          /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/,
          "$1default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:*$2",
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src/renderer"),
      "electrobun/view": path.resolve(process.cwd(), ".hutch/devkit/api/browser/index.ts"),
      "bun:sqlite": path.resolve(process.cwd(), "scripts/bun-sqlite-vitest.ts"),
    },
  },
  test: {
    include: [
      "**/*.{test,spec}.{js,ts,jsx,tsx}",
      "../shared/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "../domain/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "../main/**/*.{test,spec}.{js,ts,jsx,tsx}",
    ],
    environment: "happy-dom",
  },
  server: {
    strictPort: true,
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
