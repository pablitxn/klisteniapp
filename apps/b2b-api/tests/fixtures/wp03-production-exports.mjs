// Validation-only public export resolution. No load hooks or source rewriting.
import { registerHooks } from 'node:module'
registerHooks({
  resolve(specifier, context, nextResolve) {
    const name = ['sessions', 'schedule', 'alternatives'].find(
      (name) => specifier === `@klisteniapp/b2b-domain/${name}`,
    )
    if (name)
      return {
        url: new URL(`../../../../packages/b2b-domain/src/${name}.ts`, import.meta.url).href,
        shortCircuit: true,
      }
    return nextResolve(specifier, context)
  },
})
