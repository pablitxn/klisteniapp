import { errorMessage } from '@klisteniapp/b2b-client'
import { Notice } from '@klisteniapp/b2b-ui'
import { useCallback, useEffect, useRef, useState } from 'react'
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const running = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const clear = useCallback(() => {
    setError('')
    setMessage('')
  }, [])
  const run = useCallback(
    async (action: () => Promise<void>, success = 'Cambios guardados.') => {
      // A ref closes the gap before React renders disabled buttons.
      if (!mounted.current || running.current) return false
      running.current = true
      setBusy(true)
      clear()
      try {
        await action()
        if (!mounted.current) return false
        setMessage(success)
        return true
      } catch (error) {
        if (mounted.current) setError(errorMessage(error))
        return false
      } finally {
        running.current = false
        if (mounted.current) setBusy(false)
      }
    },
    [clear],
  )
  return {
    busy,
    error,
    message,
    run,
    clear,
    notices: (
      <>
        <Notice error>{error}</Notice>
        <Notice>{message}</Notice>
      </>
    ),
  }
}
