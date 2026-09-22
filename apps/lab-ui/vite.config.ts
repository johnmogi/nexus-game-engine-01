import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const exportsRoot = path.join(root, "exports");
const configDir = path.join(root, "config");
const graphicsRoot = path.join(root, "graphics");
const publicDir = path.resolve(__dirname, "public");

/** Ship config/*.rules.json at the site root (dev middleware + production static). */
function copyRulesToPublic() {
  mkdirSync(publicDir, { recursive: true });
  for (const name of readdirSync(configDir)) {
    if (!name.endsWith(".rules.json")) continue;
    copyFileSync(path.join(configDir, name), path.join(publicDir, name));
  }
}

function contentTypeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".md") return "text/markdown; charset=utf-8";
  return "application/octet-stream";
}

function copyGraphicsTree(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const name = entry.name;
    if (name === "_source" || name.startsWith("call_")) continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (entry.isDirectory()) {
      copyGraphicsTree(from, to);
      continue;
    }
    if (!entry.isFile()) continue;
    copyFileSync(from, to);
  }
}

/** Serve /graphics from repo graphics/ in dev; copy into dist on build. */
function graphicsPlugin(): Plugin {
  return {
    name: "nexus-graphics",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathName = decodeURIComponent(req.url?.split("?")[0] ?? "");
        if (!pathName.startsWith("/graphics/") && pathName !== "/graphics") {
          next();
          return;
        }
        const rel = pathName === "/graphics" ? "" : pathName.slice("/graphics/".length);
        if (rel.includes("..")) {
          res.statusCode = 400;
          res.end("bad path");
          return;
        }
        const file = path.join(graphicsRoot, rel);
        if (!existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        res.setHeader("content-type", contentTypeFor(file));
        res.setHeader("cache-control", "no-cache");
        res.end(readFileSync(file));
      });
    },
    writeBundle(output) {
      const outDir = output.dir ?? path.resolve(__dirname, "dist");
      const dest = path.join(outDir, "graphics");
      if (!existsSync(graphicsRoot)) return;
      copyGraphicsTree(graphicsRoot, dest);
    },
  };
}

function nexusLabPlugin(): Plugin {
  return {
    name: "nexus-lab-fs",
    buildStart() {
      copyRulesToPublic();
    },
    configureServer(server) {
      copyRulesToPublic();
      server.middlewares.use(async (req, res, next) => {
        const pathName = req.url?.split("?")[0] ?? "";
        const rulesMatch = pathName.match(/^\/(l[0-9]+\.rules\.json)$/);
        if (rulesMatch && req.method === "GET") {
          const file = path.join(configDir, rulesMatch[1]);
          res.setHeader("content-type", "application/json");
          res.end(readFileSync(file, "utf8"));
          return;
        }
        if (req.url?.split("?")[0] === "/__nexus_export" && req.method === "POST") {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            dirName: string;
            files: Record<string, string>;
          };
          if (!body.dirName || body.dirName.includes("..") || path.isAbsolute(body.dirName)) {
            res.statusCode = 400;
            res.end("bad dir");
            return;
          }
          const dest = path.join(exportsRoot, body.dirName);
          mkdirSync(dest, { recursive: true });
          for (const [name, text] of Object.entries(body.files ?? {})) {
            if (name.includes("..") || name.includes("/") || name.includes("\\")) continue;
            writeFileSync(path.join(dest, name), text, "utf8");
          }
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true, dest: dest.replaceAll("\\", "/") }));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), graphicsPlugin(), nexusLabPlugin()],
  publicDir: "public",
  resolve: {
    alias: {
      "@nexus/game-core": path.resolve(__dirname, "../../packages/game-core/src/index.ts"),
      "@nexus/sim": path.resolve(__dirname, "../../packages/sim/src/index.ts"),
    },
  },
  server: { port: 5173, strictPort: false, host: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
