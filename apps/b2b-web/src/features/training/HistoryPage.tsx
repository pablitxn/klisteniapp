import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import { Notice } from '@klisteniapp/b2b-ui'
import { ExecutionHistory } from './ExecutionHistory'

export function HistoryPage({
  orgId,
  branchNames,
}: {
  orgId: string
  branchNames: Record<string, string>
}) {
  const client = useAccountClient()
  const history = useLoad((signal) => client.withSignal(signal).executions.history(), orgId)
  function download() {
    if (!history.data) return
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(history.data, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = href
    link.download = 'mi-historial.json'
    link.click()
    URL.revokeObjectURL(href)
  }
  return (
    <>
      <h1>Mi historial en la marca</h1>
      <p>Conservás tus registros de sedes anteriores mientras mantengas acceso a la marca.</p>
      <Notice error>{history.error}</Notice>
      {history.loading && <p role="status">Cargando historial…</p>}
      {history.data && (
        <>
          <button className="button" onClick={download}>
            Exportar mi historial
          </button>
          <ExecutionHistory executions={history.data.executions} branchNames={branchNames} />
        </>
      )}
    </>
  )
}
