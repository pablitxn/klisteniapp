import { HttpError } from '../errors.ts';

/** Keep provider/internal selection codes out of the frozen v2 wire enum. */
export function unavailableSelection(stepId: string | null = null): HttpError {
  const message =
    'This exercise option is no longer available. Choose a currently available option; your recorded work is retained.';
  return new HttpError(409, 'INVALID_INPUT', message, [
    {
      code: 'unavailable',
      path: ['content', 'selectedSegments'],
      stepId,
      message,
    },
  ]);
}
