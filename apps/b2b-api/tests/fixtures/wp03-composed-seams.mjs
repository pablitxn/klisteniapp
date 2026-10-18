// Explicit pre-integration export and production-callback injection for pinned
// WP02/WP04 validation. No assertions or repository-owned dependency files change.
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
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context)
    if (process.env.WP03_PRODUCTION_SCHEDULE === '1' && url.endsWith('/tests/wp02/fixture.ts')) {
      return {
        ...loaded,
        source:
          "import { createPlanningSchedule } from '../../src/schedule/planning.ts';\n" +
          String(loaded.source).replace(
            'schedule = syntheticSchedule,',
            'schedule = createPlanningSchedule(),',
          ),
      }
    }
    // This optional run tests the exact owner-requested internal timestamp
    // amendment. Results are labelled proposed, never native pinned acceptance.
    if (process.env.WP03_END_TIME_PROPOSAL === '1' && url.endsWith('/src/planning/index.ts'))
      return {
        ...loaded,
        source: String(loaded.source).replace(
          '      ...state,',
          '      ...state,\n      effectiveAt: new Date(this.now()).toISOString(),',
        ),
      }
    return loaded
  },
})
