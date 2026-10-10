/** Session-local copies are isolated by account, organization, editor and entity.
 * The source revision travels with the copy so recovery never silently rebases it.
 */
export type EditorDraft<T> = { version: 1; revision: number | null; value: T }
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function editorDraftKey(accountId: string, orgId: string, kind: 'exercise' | 'program', entityId: string) {
  return `klisteni.b2b.editor-copy.v1.${encodeURIComponent(JSON.stringify([accountId, orgId, kind, entityId]))}`
}
export function readEditorDraft<T>(storage: DraftStorage, key: string, validate: (value: unknown) => value is T): EditorDraft<T> | null {
  try {
    const raw = storage.getItem(key)
    if (!raw || raw.length > 2_000_000) return null
    const draft: unknown = JSON.parse(raw)
    if (!draft || typeof draft !== 'object') return null
    const candidate = draft as Partial<EditorDraft<unknown>>
    if (candidate.version !== 1 || !(candidate.revision === null || typeof candidate.revision === 'number' && Number.isSafeInteger(candidate.revision) && candidate.revision >= 0) || !validate(candidate.value)) return null
    return { version: 1, revision: candidate.revision, value: candidate.value }
  } catch { return null }
}
export function writeEditorDraft<T>(storage: DraftStorage, key: string, value: T, revision: number | null) {
  storage.setItem(key, JSON.stringify({ version: 1, revision, value } satisfies EditorDraft<T>))
}
