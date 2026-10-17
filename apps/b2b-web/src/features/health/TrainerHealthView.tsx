import { canReadTrainerHealth, type HealthAccess } from './healthAccess.ts'
import { healthCategoryLabels } from './healthState.ts'
import { healthRecordFields } from './healthRecord.ts'
import { useHealthController } from './useHealthController.ts'
import './health.css'

export function TrainerHealthView({
  context,
  memberId,
  memberName,
  branchName,
}: {
  context: HealthAccess
  memberId: string
  memberName: string
  branchName: string
}) {
  const { controller, state } = useHealthController(context, memberId)
  const allowed = canReadTrainerHealth(context)
  return (
    <section className="health-feature" aria-label="Salud compartida con entrenadores">
      <h2>Salud compartida: {memberName}</h2>
      <p>
        Sede: {branchName}. Solo se muestran categorías autorizadas actualmente. Vista en línea, sin
        guardado para uso sin conexión ni exportación.
      </p>
      <p>
        Son registros aportados por la persona. Esta vista no ofrece diagnósticos ni conclusiones
        médicas.
      </p>
      {!allowed ? (
        <p role="status">
          Se requiere acceso vigente de entrenador en esta sede y consentimiento de la persona.
        </p>
      ) : (
        <>
          {state.status === 'loading' && <p role="status">Validando acceso y consentimiento…</p>}
          {state.message && (
            <p role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>
          )}
          <button
            className="button"
            disabled={state.status === 'loading'}
            onClick={() => void controller.loadTrainer(memberId)}
          >
            Validar y mostrar datos
          </button>
          {state.trainer && (
            <>
              <p className="small muted">
                Consentimiento vigente: revisión {state.trainer.consentRevision}. Última validación:{' '}
                {state.trainer.viewedAt}.
              </p>
              {state.trainer.categories.map(({ category, records }) => (
                <article className="card health-panel" key={category}>
                  <h3>{healthCategoryLabels[category]}</h3>
                  {!records.length && <p>No hay registros en esta categoría autorizada.</p>}
                  {records.map((record) => (
                    <details key={record.id}>
                      <summary>Registro del {record.date}</summary>
                      <dl className="health-record">
                        {healthRecordFields(record).map(({ label, value }) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ))}
                </article>
              ))}
            </>
          )}
        </>
      )}
    </section>
  )
}
