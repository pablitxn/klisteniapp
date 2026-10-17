import { ApiError, type ProductV2Client } from '@klisteniapp/b2b-client'
import type { ProductInput } from '@klisteniapp/b2b-contracts/product-v2'

/** A replay response can precede another trainer's accepted edit. Always read the current head. */
export async function saveRoutineAndReadCurrent(
  client: ProductV2Client,
  input: ProductInput<'saveRoutine'>,
) {
  const accepted = await client.call('saveRoutine', input)
  const current = await client.call('routine', { id: accepted.id })
  if (current.revision < accepted.revision)
    throw new ApiError('No pudimos confirmar la versión actual.', 502, 'INVALID_RESPONSE')
  return { accepted, current }
}
export async function saveGoalAndReadCurrent(
  client: ProductV2Client,
  input: ProductInput<'saveGoal'>,
) {
  const accepted = await client.call('saveGoal', input)
  const goals = await client.call('goals', { memberId: input.memberId })
  const current = goals.find((goal) => goal.id === accepted.id)
  if (!current || current.revision < accepted.revision)
    throw new ApiError('No pudimos confirmar la versión actual.', 502, 'INVALID_RESPONSE')
  return { accepted, current }
}
