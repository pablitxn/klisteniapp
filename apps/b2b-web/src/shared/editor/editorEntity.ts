/** A list refresh can still contain the previous row immediately after a save. */
export function latestEditorEntity<T extends { id: string; revision: number }>(
  saved: T,
  items: T[],
): T {
  const listed = items.find((item) => item.id === saved.id)
  return listed && listed.revision > saved.revision ? listed : saved
}
