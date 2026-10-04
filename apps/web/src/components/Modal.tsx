import { useTranslation } from 'react-i18next'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import Icon from './Icon'
export default function Modal({
  title,
  children,
  onClose,
  wide = false,
  suspended = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  suspended?: boolean
}) {
  const { t } = useTranslation('core')

  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const headingId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!suspended) {
      if (!opener.current && document.activeElement instanceof HTMLElement) opener.current = document.activeElement
      dialog?.showModal()
    }
    return () => {
      dialog?.close()
      if (opener.current?.isConnected) opener.current.focus()
    }
  }, [suspended])
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id={headingId}>{title}</h2>
          <button className="icon-button" aria-label={t("Cerrar")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
