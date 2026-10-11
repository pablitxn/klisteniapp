import type { Media } from '@klisteniapp/b2b-contracts'

export const CLIP_CRITERIA = [
  {
    id: 'movement',
    label: 'Movimiento y apoyos',
    hint: 'Compará trayectoria, contactos, fases y correspondencia con las instrucciones del ejercicio.',
  },
  {
    id: 'fidelity',
    label: 'Fidelidad visual',
    hint: 'Revisá anatomía, manos, equipo, oclusiones y cambios inconsistentes entre fotogramas.',
  },
  {
    id: 'readability',
    label: 'Claridad para aprender',
    hint: 'Revisá encuadre, ritmo, iluminación y si se distinguen los detalles relevantes.',
  },
  {
    id: 'accessibility',
    label: 'Alternativa al audio',
    hint: 'Comprobá instrucciones escritas o subtítulos y si la información se entiende sin sonido.',
  },
] as const

export const CLIP_RATINGS = {
  pending: 'Sin revisar',
  clear: 'Sin diferencias problemáticas observadas',
  concerns: 'Requiere correcciones o revisión',
  unsuitable: 'No utilizable',
} as const

export const CLIP_OUTCOMES = {
  pending: 'Sin conclusión todavía',
  reference: 'Preferir el clip de referencia',
  candidate: 'Proponer el generado para revisión editorial',
  neither: 'No usar ninguno de estos clips',
  inconclusive: 'No hay evidencia suficiente para elegir',
} as const

type CriterionId = (typeof CLIP_CRITERIA)[number]['id']
export type ClipRating = keyof typeof CLIP_RATINGS
export type ClipOutcome = keyof typeof CLIP_OUTCOMES
export type ClipReviewDraft = {
  version: 1
  referenceId: string
  generatedId: string
  exercise: string
  reviewer: string
  referenceSource: string
  referencePermission: string
  generatedProcess: string
  generatedPermission: string
  permissionsConfirmed: boolean
  criteria: Record<CriterionId, { rating: ClipRating; notes: string }>
  outcome: ClipOutcome
  summary: string
}

export function emptyClipReview(): ClipReviewDraft {
  return {
    version: 1,
    referenceId: '',
    generatedId: '',
    exercise: '',
    reviewer: '',
    referenceSource: '',
    referencePermission: '',
    generatedProcess: '',
    generatedPermission: '',
    permissionsConfirmed: false,
    criteria: {
      movement: { rating: 'pending', notes: '' },
      fidelity: { rating: 'pending', notes: '' },
      readability: { rating: 'pending', notes: '' },
      accessibility: { rating: 'pending', notes: '' },
    },
    outcome: 'pending',
    summary: '',
  }
}

export function clipReviewKey(
  accountId: string,
  orgId: string,
  branchId?: string,
  role?: string,
): string {
  if (branchId)
    return `klisteni.b2b.clip-review.v2.${encodeURIComponent(JSON.stringify([accountId, orgId, branchId, role]))}`
  return `klisteni.b2b.clip-review.v1.${encodeURIComponent(JSON.stringify([accountId, orgId]))}`
}

/** Existing observations survive selection changes, but judgments and rights must be reviewed again. */
export function selectReviewClip(
  draft: ClipReviewDraft,
  field: 'referenceId' | 'generatedId',
  id: string,
): ClipReviewDraft {
  const criteria = { ...draft.criteria }
  for (const { id: criterion } of CLIP_CRITERIA)
    criteria[criterion] = { ...criteria[criterion], rating: 'pending' }
  return {
    ...draft,
    [field]: id,
    criteria,
    permissionsConfirmed: false,
    outcome: 'pending',
    ...(field === 'referenceId'
      ? { referenceSource: '', referencePermission: '' }
      : { generatedProcess: '', generatedPermission: '' }),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isClipReview(value: unknown): value is ClipReviewDraft {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.permissionsConfirmed !== 'boolean' ||
    typeof value.outcome !== 'string' ||
    !Object.hasOwn(CLIP_OUTCOMES, value.outcome) ||
    !isRecord(value.criteria)
  )
    return false
  for (const key of [
    'referenceId',
    'generatedId',
    'exercise',
    'reviewer',
    'referenceSource',
    'referencePermission',
    'generatedProcess',
    'generatedPermission',
    'summary',
  ]) {
    if (typeof value[key] !== 'string' || value[key].length > 2000) return false
  }
  for (const { id } of CLIP_CRITERIA) {
    const criterion = value.criteria[id]
    if (
      !isRecord(criterion) ||
      typeof criterion.rating !== 'string' ||
      !Object.hasOwn(CLIP_RATINGS, criterion.rating) ||
      typeof criterion.notes !== 'string' ||
      criterion.notes.length > 2000
    )
      return false
  }
  return true
}

export function readClipReview(
  storage: Pick<Storage, 'getItem'>,
  key: string,
): ClipReviewDraft | null {
  try {
    const raw = storage.getItem(key)
    if (!raw || raw.length > 50_000) return null
    const value: unknown = JSON.parse(raw)
    return isClipReview(value) ? value : null
  } catch {
    return null
  }
}

function videoRecord(media: Media) {
  return {
    id: media.id,
    label: media.label,
    sha256: media.sha256,
    bytes: media.bytes,
    mime: media.mime,
    attribution: media.attribution,
    createdAt: media.createdAt,
  }
}

/** A comparison can reference only videos from the caller's authorized library. */
export function prepareClipReview(
  draft: ClipReviewDraft,
  library: Media[],
  context: { orgId: string; accountId: string; exportedAt: string },
) {
  if (!isClipReview(draft))
    return { ok: false as const, error: 'La evaluación guardada tiene un formato inválido.' }
  const reference = library.find(
    (media) => media.id === draft.referenceId && media.kind === 'video',
  )
  const generated = library.find(
    (media) => media.id === draft.generatedId && media.kind === 'video',
  )
  if (!reference || !generated)
    return {
      ok: false as const,
      error: 'Elegí dos videos disponibles en la biblioteca de este gimnasio.',
    }
  if (reference.id === generated.id || reference.sha256 === generated.sha256)
    return {
      ok: false as const,
      error: 'Elegí dos clips con contenido diferente para poder compararlos.',
    }
  if (!draft.exercise.trim() || !draft.reviewer.trim())
    return {
      ok: false as const,
      error: 'Indicá el ejercicio y la persona que realizó la revisión.',
    }
  if (
    ![
      draft.referenceSource,
      draft.referencePermission,
      draft.generatedProcess,
      draft.generatedPermission,
    ].every((value) => value.trim()) ||
    !draft.permissionsConfirmed
  )
    return {
      ok: false as const,
      error: 'Documentá la procedencia y el permiso de uso de ambos clips, y confirmá su revisión.',
    }
  if (
    CLIP_CRITERIA.some(
      ({ id }) => draft.criteria[id].rating === 'pending' || !draft.criteria[id].notes.trim(),
    )
  )
    return {
      ok: false as const,
      error:
        'Completá cada criterio con su resultado y observaciones; incluí marcas de tiempo cuando ayuden a reproducir el hallazgo.',
    }
  if (draft.outcome === 'pending' || !draft.summary.trim())
    return {
      ok: false as const,
      error: 'Agregá una conclusión y explicá qué evidencia sostiene la elección.',
    }
  return {
    ok: true as const,
    document: {
      schemaVersion: 1,
      type: 'klisteni-clip-comparison',
      organizationId: context.orgId,
      reviewerAccountId: context.accountId,
      exportedAt: context.exportedAt,
      publicationStatus: 'unchanged',
      review: draft,
      reference: videoRecord(reference),
      generated: videoRecord(generated),
    },
  }
}
