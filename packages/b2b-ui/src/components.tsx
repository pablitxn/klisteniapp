import { cloneElement, isValidElement, useId, type CSSProperties, type ReactNode } from 'react'

export function Notice({ children, error = false }: { children?: ReactNode; error?: boolean }) {
  return children ? (
    <div className={`notice ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}>
      {children}
    </div>
  ) : null
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span aria-hidden="true">↗</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  const generatedId = useId()
  const control = isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
    ? children
    : null
  const id = control?.props.id ?? generatedId
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control
        ? cloneElement(control, { id, ...(hint ? { 'aria-describedby': `${id}-hint` } : {}) })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  )
}
export function BrandMark({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <span className="brand">
      <span className="brand-symbol" aria-hidden="true">
        {logoUrl ? <img src={logoUrl} alt="" /> : '↗'}
      </span>
      <span>{name}</span>
    </span>
  )
}
export function Shell({
  name = 'Tu gimnasio',
  logoUrl,
  color,
  eyebrow,
  navigation,
  children,
  actions,
}: {
  name?: string
  logoUrl?: string | null
  color?: string
  eyebrow: string
  navigation?: ReactNode
  children: ReactNode
  actions?: ReactNode
}) {
  const style =
    color && /^#[0-9a-f]{6}$/i.test(color) ? ({ '--brand': color } as CSSProperties) : undefined
  return (
    <div className="site-shell" style={style}>
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <header className="site-header">
        <a className="brand-link" href="/app">
          <BrandMark name={name} logoUrl={logoUrl} />
        </a>
        <div className="header-actions">{actions}</div>
      </header>
      <div className="workspace">
        {navigation && (
          <aside className="side-nav">
            <p className="eyebrow">{eyebrow}</p>
            {navigation}
            <div className="sidebar-note">
              Un paso a la vez.
              <br />
              <strong>El progreso es tuyo.</strong>
            </div>
          </aside>
        )}
        <main id="main" className="main-content">
          {children}
        </main>
      </div>
      <footer className="site-footer">
        {name}
        <span>Tu espacio para moverte mejor.</span>
      </footer>
    </div>
  )
}
