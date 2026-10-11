import { WebsiteInputSchema, type WebsiteInput } from '@klisteniapp/b2b-contracts'
import { readEditorDraft, type DraftStorage, type EditorDraft } from './editorDraftStorage.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Empty required labels are valid while editing; persisted publication still uses the strict schema. */
export function normalizeWebsiteDraft(value: unknown): WebsiteInput | null {
  if (!isRecord(value) || !Array.isArray(value.activities) || !Array.isArray(value.openingHours))
    return null
  const unfinished = (text: unknown) =>
    typeof text === 'string' && !text.trim() ? 'Pendiente' : text
  const validation = {
    ...value,
    activities: value.activities.map((item: unknown) =>
      isRecord(item) ? { ...item, name: unfinished(item.name) } : item,
    ),
    openingHours: value.openingHours.map((item: unknown) =>
      isRecord(item)
        ? { ...item, days: unfinished(item.days), hours: unfinished(item.hours) }
        : item,
    ),
    floorPlan: isRecord(value.floorPlan)
      ? { ...value.floorPlan, title: unfinished(value.floorPlan.title) }
      : value.floorPlan,
  }
  const parsed = WebsiteInputSchema.safeParse(validation)
  if (!parsed.success) return null
  return {
    ...parsed.data,
    activities: parsed.data.activities.map((item, index) => ({
      ...item,
      name: (value.activities as Array<{ name: string }>)[index].name,
    })),
    openingHours: parsed.data.openingHours.map((item, index) => ({
      ...item,
      days: (value.openingHours as Array<{ days: string }>)[index].days,
      hours: (value.openingHours as Array<{ hours: string }>)[index].hours,
    })),
    floorPlan:
      parsed.data.floorPlan && isRecord(value.floorPlan)
        ? { ...parsed.data.floorPlan, title: value.floorPlan.title as string }
        : null,
  }
}

export function readWebsiteCopy(
  storage: DraftStorage,
  key: string,
  legacyKey: string | null,
): EditorDraft<WebsiteInput> | null {
  try {
    const stored = storage.getItem(key)
    if (stored !== null) {
      const copy = readEditorDraft(
        storage,
        key,
        (value): value is WebsiteInput => normalizeWebsiteDraft(value) !== null,
      )
      const normalized = copy && normalizeWebsiteDraft(copy.value)
      return copy && normalized ? { ...copy, value: normalized } : null
    }
    const legacy = legacyKey ? storage.getItem(legacyKey) : null
    if (!legacy || legacy.length > 2_000_000) return null
    const value = normalizeWebsiteDraft(JSON.parse(legacy))
    // Older copies did not retain their source revision. They always require comparison.
    return value ? { version: 1, revision: null, value } : null
  } catch {
    return null
  }
}

/** A delayed save can clear only the exact local copy it sent, never a newer edit. */
export function discardSavedWebsiteCopy(
  storage: DraftStorage,
  key: string,
  sent: EditorDraft<WebsiteInput>,
) {
  if (storage.getItem(key) === JSON.stringify(sent)) storage.removeItem(key)
}
