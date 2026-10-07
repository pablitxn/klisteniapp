import { YogaDataSchema, YogaLogSchema, YogaPracticeSchema, createEmptyYogaData, type PersonalData, type YogaData, type YogaLog, type YogaPractice } from '@klisteniapp/scene-schema'

export function yogaState(data: PersonalData | null) {
  const yoga = data?.settings.yoga ?? createEmptyYogaData()
  return { yogaPractices: yoga.practices, yogaLogs: yoga.logs }
}

/** Both builds share validation; a failed durable write must keep the editor open. */
export function createYogaActions(
  read: () => YogaData,
  commit: (yoga: YogaData, removalOnly: boolean) => Promise<boolean>,
  invalid: (message: string) => void,
) {
  async function change(update: (current: YogaData) => YogaData, removalOnly = false): Promise<boolean> {
    let yoga: YogaData
    try { yoga = YogaDataSchema.parse(update(read())) }
    catch { invalid('Revisá la práctica, sus tiempos y los pasos que completaste.'); return false }
    return commit(yoga, removalOnly)
  }
  return {
    saveYogaPractice: (practice: YogaPractice) => change(current => {
      const parsed = YogaPracticeSchema.parse(practice)
      const found = current.practices.some(item => item.id === parsed.id)
      return { ...current, practices: found ? current.practices.map(item => item.id === parsed.id ? parsed : item) : [...current.practices, parsed] }
    }),
    deleteYogaPractice: (id: string) => change(current => ({ ...current, practices: current.practices.filter(item => item.id !== id) }), true),
    addYogaLog: (log: YogaLog) => change(current => {
      const parsed = YogaLogSchema.parse(log)
      const existing = current.logs.find(item => item.id === parsed.id)
      // Repeated saves are idempotent; historical snapshots cannot be rewritten.
      if (existing && JSON.stringify(existing) !== JSON.stringify(parsed)) throw new Error('Registro incompatible')
      return { ...current, logs: existing ? current.logs : [...current.logs, parsed] }
    }),
    deleteYogaLog: (id: string) => change(current => ({ ...current, logs: current.logs.filter(item => item.id !== id) }), true),
  }
}
