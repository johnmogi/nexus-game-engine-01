import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rulesFile = path.join(root, "config/l0.rules.json");
const exportsRoot = path.join(root, "exports");

function nexusLabPlugin(): Plugin {
  return {
    name: "nexus-lab-fs",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathName = req.url?.split("?")[0] ?? "";
        const rulesMatch = pathName.match(/^\/(l[0-9]+\.rules\.json)$/);
        if (rulesMatch && req.method === "GET") {
          const file = path.join(root, "config", rulesMatch[1]);
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
  plugins: [react(), nexusLabPlugin()],
  resolve: {
    alias: {
      "@nexus/game-core": path.resolve(__dirname, "../../packages/game-core/src/index.ts"),
      "@nexus/sim": path.resolve(__dirname, "../../packages/sim/src/index.ts"),
    },
  },
  server: { port: 5173, strictPort: true },
});
