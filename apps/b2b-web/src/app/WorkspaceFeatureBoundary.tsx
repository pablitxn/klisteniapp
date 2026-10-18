import { Component, Suspense, type ReactNode } from 'react'

type FeatureProps = { name: string; children: ReactNode }

class FeatureErrorBoundary extends Component<FeatureProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed)
      return (
        <section role="alert">
          <p>No pudimos mostrar {this.props.name}.</p>
          <p>Podés elegir otra sección desde la navegación.</p>
        </section>
      )
    return this.props.children
  }
}

export function WorkspaceFeatureBoundary({
  contextKey,
  name,
  children,
}: FeatureProps & { contextKey: string }) {
  return (
    <FeatureErrorBoundary key={JSON.stringify([contextKey, name])} name={name}>
      <Suspense fallback={<p role="status">Cargando {name}…</p>}>{children}</Suspense>
    </FeatureErrorBoundary>
  )
}
