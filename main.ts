// Hands the entry in: copies app/ and screenshots/ from this repository into
// the output directory and writes dossier.json there, built by buildDossier
// from vendor/makefun-app.ts. The output directory is /output, or
// MAKEFUN_OUTPUT_DIR when that is set (outside the grader).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

// Clear only the CONTENTS of the output directory, never the directory
// itself: in the grader sandbox /output is a mounted volume, and removing
// the mount point throws EBUSY ("Device or resource busy").
mkdirSync(outputDir, { recursive: true });
for (const entry of readdirSync(outputDir)) {
  rmSync(join(outputDir, entry), { recursive: true, force: true });
}
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
if (!existsSync(join(outputDir, 'app', 'index.html'))) {
  throw new Error('main.ts: app/index.html was not copied to the output');
}
if (!existsSync(join(outputDir, 'screenshots'))) {
  throw new Error('main.ts: screenshots/ was not copied to the output');
}
console.log(`wrote ${outputDir}/dossier.json (${dossier.length} bytes)`);
