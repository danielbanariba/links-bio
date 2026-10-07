// Resolves a relative "./foo.js" specifier to "./foo.ts" when the .js file
// does not exist on disk but a sibling .ts file does. Astro/Vite's bundler
// resolver already does this at build time (TS "moduleResolution: bundler"),
// but plain `node --test` has no such step, so db.ts's internal `./thumb.js`
// style imports would otherwise fail to resolve outside the Astro build.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && specifier.endsWith('.js')) {
    const parentURL = context.parentURL;
    if (parentURL) {
      const candidate = new URL(specifier.replace(/\.js$/, '.ts'), parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(pathToFileURL(fileURLToPath(candidate)).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
