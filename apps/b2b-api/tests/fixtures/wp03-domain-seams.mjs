// Pre-integration validation only. The owner-requested two export entries are
// resolved directly without modifying any shared package manifest or barrel.
import { registerHooks } from 'node:module'
registerHooks({
  resolve(specifier, context, nextResolve) {
    const name =
      specifier === '@klisteniapp/b2b-domain/schedule'
        ? 'schedule'
        : specifier === '@klisteniapp/b2b-domain/sessions'
          ? 'sessions'
          : null
    if (name)
      return {
        url: new URL(`../../../../packages/b2b-domain/src/${name}.ts`, import.meta.url).href,
        shortCircuit: true,
      }
    return nextResolve(specifier, context)
  },
})
