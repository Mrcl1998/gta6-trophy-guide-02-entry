// Leonida Platinum — GTA VI trophy guide & tracker (gta6-trophy-guide-02).
// Hands the guide in: copies app/ and screenshots/ from this repository to
// $MAKEFUN_OUTPUT_DIR (default /output) and writes /output/dossier.json with
// buildDossier from vendor/makefun-frontend.ts. Node 22, stdlib only, no build step.
// The output directory itself is never removed or recreated: it is created when
// missing, and otherwise only its contents are emptied, so a run is safe to
// repeat and its bytes are identical across runs (sorted copy order, no times).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function emptyDirContents(dir: string): void {
  for (const entry of readdirSync(dir).sort()) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function copyTreeSorted(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src).sort()) {
    cpSync(join(src, entry), join(dest, entry), { recursive: true });
  }
}

function main(): void {
  if (existsSync(outDir)) {
    emptyDirContents(outDir);
  } else {
    mkdirSync(outDir, { recursive: true });
  }
  copyTreeSorted(join(repoRoot, 'app'), join(outDir, 'app'));
  copyTreeSorted(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 48 * 1024 * 1024,
    app_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log('wrote ' + outDir + '/dossier.json (' + dossier.length + ' bytes)');
}

main();
