import { createDefaultPersonalData, type YogaPractice } from '@klisteniapp/scene-schema'

export const personalKey = 'klisteniapp.personal.v2'
export const progressKey = 'klisteniapp.progress.v1'
export const practice: YogaPractice = {
  id: 'visitor-qa-practice', name: 'Pausa ficticia QA', intention: 'Escenario de demostración',
  steps: [
    { id: 'qa-one', asanaId: 'tadasana', durationSeconds: 5, side: 'both' },
    { id: 'qa-two', asanaId: 'sukhasana', durationSeconds: 5, side: 'both' },
    { id: 'qa-three', asanaId: 'savasana', durationSeconds: 5, side: 'both' },
  ],
}
export function visitorData() {
  const data = createDefaultPersonalData('Visitante ficticio QA', 'UTC')
  data.settings.yoga = { practices: [practice], logs: [] }
  data.settings.health!.profile = { heightCm: 178, context: 'Datos ficticios para revisión de UI' }
  return data
}
export const healthImport = {
  format: 'klisteniapp.health', version: 1, exportedAt: '2026-10-01T12:00:00Z', timeZone: 'UTC',
  records: {
    measurements: [{ id: 'qa-watch-body', date: '2026-10-01', recordedAt: '2026-10-01T09:00:00Z', source: { kind: 'samsung-health', device: 'Reloj ficticio QA', externalId: 'qa-source-body' }, weightKg: 79.2, waistCm: 93 }],
    sleep: [], activity: [], nutrition: [], supplements: [],
  },
}
