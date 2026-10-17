// Validation only: resolve pending public exports to actual pinned production
// source. No load hook, fixture/DTO/SQL/assertion replacement or synthetic adapter.
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = process.env.WP02_VALIDATION_ROOT;
if (!root) throw new Error('WP02_VALIDATION_ROOT must identify the pinned composed repository.');
registerHooks({
  resolve(specifier, context, nextResolve) {
    const name = ['sessions', 'schedule', 'alternatives'].find((name) => specifier === `@klisteniapp/b2b-domain/${name}`);
    if (name) return { url: pathToFileURL(resolve(root, `packages/b2b-domain/src/${name}.ts`)).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
