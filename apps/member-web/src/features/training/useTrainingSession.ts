import { useEffect, useRef, useState } from 'react'
import type { Assignment, ExecutionInput } from '@klisteniapp/b2b-contracts'
import { ApiError, errorMessage } from '@klisteniapp/b2b-client'
import { useAccountClient } from '@klisteniapp/b2b-react'
import {
  changeDraftSet,
  createSessionDraft,
  discardConfirmedSession,
  isDefinitiveRejection,
  prepareExecution,
  recoverSessionDraft,
  sessionDraftKey,
} from './sessionDraft'
import type { DraftSet, SessionDraft } from './sessionDraft'

const STORAGE_ERROR =
  'No pudimos guardar el borrador en este dispositivo. Mantené esta pantalla abierta hasta confirmar el envío.'

export function useTrainingSession(
  assignment: Assignment,
  orgId: string,
  userId: string,
  onSaved: () => void,
) {
  const client = useAccountClient()
  const key = sessionDraftKey(orgId, userId, assignment.id, assignment.branchId)
  const [initial] = useState(() => {
    try {
      return recoverSessionDraft(localStorage, key, assignment, () => crypto.randomUUID())
    } catch {
      // Accessing localStorage itself can throw when browser storage is disabled.
      return { draft: createSessionDraft(assignment, crypto.randomUUID()), recovered: false }
    }
  })
  const [draft, setDraft] = useState(initial.draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState('')
  const sending = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  function persist(value: SessionDraft) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      setStorageError('')
    } catch {
      setStorageError(STORAGE_ERROR)
    }
  }

  useEffect(() => {
    persist(draft)
  }, [draft, key])

  function changeSet(index: number, patch: Partial<DraftSet>) {
    setDraft((current) => changeDraftSet(current, index, patch))
  }

  function changeNotes(notes: string) {
    setDraft((current) => (current.pending ? current : { ...current, notes }))
  }

  async function save(status: ExecutionInput['status']) {
    if (sending.current) return
    const result = prepareExecution(draft, assignment, status, new Date().toISOString())
    if (!result.ok) {
      setError(result.error)
      return
    }

    const pendingDraft = { ...draft, pending: result.payload }
    // Persist before starting the request so a reload can retry the exact payload.
    persist(pendingDraft)
    setDraft(pendingDraft)
    sending.current = true
    setBusy(true)
    setError('')
    try {
      await client.executions.create(orgId, result.payload)
      try {
        discardConfirmedSession(localStorage, key, result.payload.id)
      } catch {
        /* Confirmed server history is authoritative. */
      }
      if (mounted.current) onSaved()
    } catch (error) {
      if (!mounted.current) return
      setError(errorMessage(error))
      if (error instanceof ApiError && isDefinitiveRejection(error.status)) {
        setDraft((current) => ({ ...current, pending: undefined }))
      }
    } finally {
      sending.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return {
    draft,
    recovered: initial.recovered,
    busy,
    error,
    storageError,
    changeSet,
    changeNotes,
    save,
  }
}
