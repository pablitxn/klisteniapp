import type { PoolClient } from 'pg';
import { exercises as baseExercises } from '@klisteniapp/catalog-base';
import { ExerciseInputSchema, MachineInputSchema } from '@klisteniapp/b2b-contracts';

/** Immutable initial snapshots: shared package data are copied, never read from B2C. */
export async function seedBaseCatalog(db: PoolClient) {
  for (const base of baseExercises) {
    const data = ExerciseInputSchema.parse({ name: base.name, description: base.description, instructions: [...base.setup, ...base.steps, ...base.cues], equipment: base.equipment, muscles: base.primaryMuscles, pattern: base.pattern, animationId: base.id, assets: [{ id: `base-${base.id}-poster-v1`, kind: 'image', label: base.name, url: `/previews/${base.id}-poster.webp`, attribution: 'Klisteni exercise preview; see /models/NOTICE.md for anatomical model attribution.' }] });
    await db.query("INSERT INTO b2b_exercise(id,data,status,version) VALUES($1,$2,'published',1) ON CONFLICT(id) DO NOTHING", [base.id, data]);
  }
  const models = [
    { id: 'base-cable-station-v1', name: 'Estación de poleas', type: 'cable', manufacturer: 'Genérico', model: 'Biblioteca v1', instructions: 'Ajustá el anclaje y seleccioná la carga con la máquina detenida.' },
    { id: 'base-chest-press-v1', name: 'Press de pecho guiado', type: 'chest-press', manufacturer: 'Genérico', model: 'Biblioteca v1', instructions: 'Identificá los ajustes y topes de seguridad con un instructor antes de usar el equipo.' },
    { id: 'base-leg-press-v1', name: 'Prensa de piernas', type: 'leg-press', manufacturer: 'Genérico', model: 'Biblioteca v1', instructions: 'Ajustá el respaldo y los topes según las indicaciones del instructor.' },
  ];
  for (const { id, ...data } of models) await db.query("INSERT INTO b2b_machine(id,data,status) VALUES($1,$2,'published') ON CONFLICT(id) DO NOTHING", [id, MachineInputSchema.parse(data)]);
  // Editorial templates require local human review; no unsupported animation or model is invented.
  const templates = [
    { id: 'template-cable-row-v1', name: 'Remo en polea sentado', machineId: 'base-cable-station-v1', pattern: 'Tracción horizontal', muscles: ['lats', 'biceps'], instructions: ['Revisá con el instructor la altura del anclaje, el agarre y la posición del asiento.', 'Con el tronco estable, acercá el agarre al torso en un recorrido cómodo.', 'Regresá con control sin soltar la carga.'] },
    { id: 'template-cable-pulldown-v1', name: 'Jalón en polea', machineId: 'base-cable-station-v1', pattern: 'Tracción vertical', muscles: ['lats', 'biceps'], instructions: ['Comprobá con el instructor que la estación y el agarre admitan el movimiento.', 'Llevá el agarre hacia la zona superior del torso sin balancearte.', 'Volvé con control siguiendo el recorrido indicado por el instructor.'] },
    { id: 'template-cable-curl-v1', name: 'Curl en polea', machineId: 'base-cable-station-v1', pattern: 'Flexión de codo', muscles: ['biceps'], instructions: ['Ajustá el anclaje bajo y el agarre con la máquina detenida.', 'Flexioná los codos manteniendo el tronco estable.', 'Descendé con control hasta la posición acordada con tu instructor.'] },
    { id: 'template-leg-press-v1', name: 'Prensa de piernas', machineId: 'base-leg-press-v1', pattern: 'Empuje de piernas', muscles: ['quadriceps', 'glutes'], instructions: ['Revisá asiento, topes y posición de los pies con el instructor.', 'Empujá la plataforma sin perder el apoyo del tronco.', 'Regresá con control dentro del recorrido indicado para vos.'] },
    { id: 'template-leg-press-calf-v1', name: 'Elevación de talones en prensa', machineId: 'base-leg-press-v1', pattern: 'Flexión plantar', muscles: ['calves'], instructions: ['Confirmá con el instructor que el modelo permita este uso y cómo asegurar los topes.', 'Realizá la elevación de talones manteniendo un apoyo estable.', 'Descendé lentamente dentro del recorrido autorizado.'] },
    { id: 'template-chest-press-v1', name: 'Press de pecho guiado', machineId: 'base-chest-press-v1', pattern: 'Empuje horizontal', muscles: ['pectorals', 'triceps'], instructions: ['Ajustá asiento y agarres según tu cuerpo con asistencia del instructor.', 'Empujá manteniendo el tronco apoyado y las muñecas alineadas.', 'Volvé sin golpes al recorrido inicial indicado.'] },
  ];
  for (const { id, ...template } of templates) {
    const data = ExerciseInputSchema.parse({ ...template, description: 'Plantilla editorial de referencia: adaptar al equipo real y revisar antes de publicar.', equipment: 'machine', compatibleMachineIds: [template.machineId] });
    await db.query("INSERT INTO b2b_exercise(id,data,status,version) VALUES($1,$2,'draft',1) ON CONFLICT(id) DO NOTHING", [id, data]);
  }
}
