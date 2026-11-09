// Vercel's uploader skips any folder named "node_modules", but Expo's web
// export puts font files under dist/assets/node_modules/. Move them to
// dist/assets/nm/ — public/vercel.json rewrites the original URLs there.
import { existsSync, renameSync } from 'node:fs';

const from = 'dist/assets/node_modules';
const to = 'dist/assets/nm';
if (existsSync(from)) {
  renameSync(from, to);
  console.log(`moved ${from} -> ${to}`);
}
