import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as pathResolve } from 'node:path';

const root = pathResolve(fileURLToPath(new URL('..', import.meta.url)));
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@last-orbit/')) {
    return { url: pathToFileURL(pathResolve(root, 'modules', specifier.slice('@last-orbit/'.length))).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
