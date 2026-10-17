// Validation-only simulation of the pending INTEGRATION export; production uses the package export map.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@klisteniapp/scene-schema/health-import') {
      return {
        url: new URL('../../../../../packages/scene-schema/src/health-import.ts', import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
