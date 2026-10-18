import type { ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'

type RecordData = ProductOutput<'consentedHealth'>['categories'][number]['records'][number]
const labels: Record<string, string> = {
  weightKg: 'Peso (kg)',
  bodyFatPercent: 'Grasa corporal (%)',
  skeletalMuscleKg: 'Músculo esquelético (kg)',
  fatMassKg: 'Masa grasa (kg)',
  bodyWaterPercent: 'Agua corporal (%)',
  waistCm: 'Cintura (cm)',
  hipsCm: 'Cadera (cm)',
  chestCm: 'Pecho (cm)',
  neckCm: 'Cuello (cm)',
  leftArmCm: 'Brazo izquierdo (cm)',
  rightArmCm: 'Brazo derecho (cm)',
  leftThighCm: 'Muslo izquierdo (cm)',
  rightThighCm: 'Muslo derecho (cm)',
  leftCalfCm: 'Pantorrilla izquierda (cm)',
  rightCalfCm: 'Pantorrilla derecha (cm)',
  durationMinutes: 'Duración del sueño (min)',
  startAt: 'Inicio del sueño',
  endAt: 'Fin del sueño',
  deepMinutes: 'Sueño profundo (min)',
  remMinutes: 'Sueño REM (min)',
  awakeMinutes: 'Tiempo despierto (min)',
  score: 'Puntaje registrado por el origen',
  steps: 'Pasos',
  activeMinutes: 'Actividad (min)',
  activeEnergyKcal: 'Energía activa (kcal)',
  restingHeartRateBpm: 'Frecuencia cardíaca en reposo (latidos/min)',
  averageHeartRateBpm: 'Frecuencia cardíaca media (latidos/min)',
  maxHeartRateBpm: 'Frecuencia cardíaca máxima (latidos/min)',
  activityLabel: 'Actividad',
  meal: 'Comida',
  energyKcal: 'Energía (kcal)',
  proteinG: 'Proteínas (g)',
  carbsG: 'Carbohidratos (g)',
  fatG: 'Grasas (g)',
  fiberG: 'Fibra (g)',
  name: 'Suplemento',
  taken: 'Tomado',
  recordedAt: 'Registrado el',
  modifiedAt: 'Modificado el',
  timeZone: 'Zona horaria',
  notes: 'Notas',
}
const sources: Record<string, string> = {
  manual: 'Manual',
  'samsung-health': 'Samsung Health (origen declarado)',
  'health-connect': 'Health Connect (origen declarado)',
}

/** Present recorded scalars with their original units, without estimates,
 * aggregation, thresholds, diagnoses or equal-effect claims. */
export function healthRecordFields(record: RecordData): { label: string; value: string }[] {
  const fields = Object.entries(record).flatMap(([key, value]) => {
    if (!(key in labels) || value === null || typeof value === 'object') return []
    return [
      {
        label: labels[key],
        value: typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value),
      },
    ]
  })
  if (typeof record.dose === 'number' && typeof record.unit === 'string')
    fields.push({ label: 'Dosis registrada', value: `${record.dose} ${record.unit}` })
  fields.push({ label: 'Origen declarado', value: sources[record.source.kind] })
  if (record.source.device)
    fields.push({ label: 'Dispositivo declarado', value: record.source.device })
  return fields
}
