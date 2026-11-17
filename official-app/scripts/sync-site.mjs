import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, '..', '..');
const webDir = path.resolve(appDir, '..', 'www');

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });
const excluded = new Set(['.git', 'android', 'official-app', 'node_modules', 'apk-artifact', 'apk-download', 'build']);
for (const entry of await readdir(repoRoot, { withFileTypes: true })) {
  if (excluded.has(entry.name)) continue;
  await cp(path.join(repoRoot, entry.name), path.join(webDir, entry.name), { recursive: true });
}
console.log(`SEDX completo copiado para ${webDir}`);
