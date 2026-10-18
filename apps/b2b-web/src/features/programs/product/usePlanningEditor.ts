import { createClientId } from '@klisteniapp/b2b-client'
import { ApiError } from '@klisteniapp/b2b-client'
import type { ProductIssue } from '@klisteniapp/b2b-contracts/product-v2'
import { useRef, useState } from 'react'
import { useEditorDraft } from '../../../shared/editor/useEditorDraft'
import {
  isWorkingCopy,
  mutationAttempt,
  type PlanningMutation,
  type WorkingCopy,
} from './programmingModel'

export function usePlanningEditor<T>({
  orgId,
  family,
  id,
  content,
  revision,
  validate,
}: {
  orgId: string
  family: string
  id?: string
  content: T
  revision: number
  validate: (value: unknown) => value is T
}) {
  const inFlight = useRef(false)
  const creationId = useRef(createClientId())
  const local = useEditorDraft(
    orgId,
    'program',
    `product-v2/${family}/${id ?? 'new'}`,
    { id: id ?? creationId.current, content, attempt: null } as WorkingCopy<T>,
    revision,
    isWorkingCopy(validate),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [issues, setIssues] = useState<ProductIssue[]>([])
  const [conflict, setConflict] = useState(false)
  function change(content: T) {
    local.change({ ...local.value, content })
    setIssues([])
    setMessage('')
  }
  async function run(
    endpoint: PlanningMutation | null,
    input: unknown,
    task: (operationId: string) => Promise<void>,
  ) {
    if (inFlight.current || local.pending) return
    inFlight.current = true
    setBusy(true)
    setError('')
    setMessage('')
    setIssues([])
    try {
      const attempt = endpoint ? mutationAttempt(endpoint, input, local.value.attempt) : null
      if (attempt) local.change({ ...local.value, attempt })
      await task(attempt?.operationId ?? '')
    } catch (error) {
      if (!local.isCurrent()) return
      setError(error instanceof Error ? error.message : 'No pudimos completar la solicitud.')
      if (error instanceof ApiError) {
        setIssues(error.issues ?? [])
        if (error.code === 'REVISION_CONFLICT') setConflict(true)
      }
    } finally {
      inFlight.current = false
      if (local.isCurrent()) setBusy(false)
    }
  }
  return {
    local,
    busy,
    error,
    message,
    issues,
    conflict,
    setConflict,
    setIssues,
    setMessage,
    change,
    run,
  }
}
