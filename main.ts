// Entry point for the gta6-cover-art-01 submission.
//
// What it does, in order: empties the output directory (without ever
// deleting the directory itself), copies the app and its screenshots in,
// builds dossier.json from what landed there, and checks the two things
// the grader needs most actually arrived.
//
// The output directory is /output by default. Local runs can point it
// elsewhere with MAKEFUN_OUTPUT_DIR.
//
// One hard rule drives the emptying step: /output is a mount point in the
// grading sandbox, so removing the directory itself fails with EBUSY and
// kills the run. Only its children are deleted, one by one.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

/** Deletes every child of `dir`, leaving `dir` itself in place. */
function emptyDirContents(dir) {
  mkdirSync(dir, { recursive: true });
  for (const child of readdirSync(dir)) {
    rmSync(join(dir, child), { recursive: true, force: true });
  }
}

/** Throws unless `rel` exists under the output directory. */
function requireInOutput(rel, why) {
  const target = join(outputDir, rel);
  if (!existsSync(target)) {
    throw new Error(`main.ts: ${rel} is missing from the output (${why})`);
  }
  return target;
}

emptyDirContents(outputDir);
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

requireInOutput(join('app', 'index.html'), 'the app entry point was not copied');
requireInOutput('screenshots', 'the screenshots were not copied');

console.log(`wrote ${outputDir}/dossier.json (${dossier.length} bytes)`);
