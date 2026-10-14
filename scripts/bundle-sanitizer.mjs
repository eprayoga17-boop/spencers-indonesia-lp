// Bundles sanitize-html (CommonJS) and its ESM-only parser (htmlparser2) into one ESM file,
// src/vendor/sanitize-html.js. Vercel's function loader cannot require() ES modules, so the
// app imports this bundle instead of the package. Runs after every npm install (postinstall).
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({
  entryPoints: [path.join(ROOT, 'node_modules', 'sanitize-html', 'index.js')],
  outfile: path.join(ROOT, 'src', 'vendor', 'sanitize-html.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  legalComments: 'inline',
  // CommonJS code inside the bundle may require() Node built-ins.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
});
console.log('src/vendor/sanitize-html.js bundled');
