const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const output = path.join(root, "public");
const allowedExtensions = new Set([
  ".css",
  ".gif",
  ".html",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".otf",
  ".png",
  ".svg",
  ".ttf",
  ".webmanifest",
  ".webp",
  ".woff",
  ".woff2",
]);

if (!fs.existsSync(path.join(root, "index.html"))) {
  throw new Error("index.html ausente na raiz do projeto");
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

let copiedFiles = 0;
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (entry.name === "prepare-public.cjs") continue;
  if (!allowedExtensions.has(path.extname(entry.name).toLowerCase())) continue;
  fs.copyFileSync(path.join(root, entry.name), path.join(output, entry.name));
  copiedFiles += 1;
}

for (const directory of ["EF", "EM"]) {
  const source = path.join(root, directory);
  if (!fs.existsSync(source)) continue;
  fs.cpSync(source, path.join(output, directory), { recursive: true });
}

console.log(`Saída estática preparada: ${copiedFiles} arquivos de interface e pastas de materiais.`);
