import { expect, type Page } from '@playwright/test'
import type { WorkoutDocument } from '../../../../b2b-web/src/features/training/storage/workoutStore'
import type { WorkoutRecoveryPointer } from '../../../../b2b-web/src/features/training/storage/recoverySelection'

/** Hold an actual CAS write or existing-selection validation transaction.
 * Native keepalive reads preserve transaction activity; no DTO/write is fabricated.
 * Abort still reaches the actual transaction immediately. */
export async function holdNativeWorkoutTransaction(
  page: Page,
  id: string,
  store: 'workouts-v2' | 'selected-workout-v1' = 'workouts-v2',
) {
  await page.evaluate(
    ({ id, store }) => {
      type Hold = {
        held: boolean
        released: boolean
        aborted: boolean
        restore: () => void
      }
      const scope = window as Window & { __wp12NativeHold?: Hold }
      scope.__wp12NativeHold?.restore()
      const get = IDBObjectStore.prototype.get
      const descriptor = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onsuccess')!
      const selected = new WeakMap<IDBRequest, { store: IDBObjectStore; key: IDBValidKey }>()
      let used = false
      const hold: Hold = {
        held: false,
        released: false,
        aborted: false,
        restore: () => {
          hold.released = true
          IDBObjectStore.prototype.get = get
          Object.defineProperty(IDBRequest.prototype, 'onsuccess', descriptor)
        },
      }
      scope.__wp12NativeHold = hold
      IDBObjectStore.prototype.get = function (key: IDBValidKey | IDBKeyRange) {
        const request = Reflect.apply(get, this, [key]) as IDBRequest
        if (
          !used &&
          this.name === store &&
          this.transaction.mode === (store === 'workouts-v2' ? 'readwrite' : 'readonly') &&
          typeof key === 'string' &&
          (store === 'selected-workout-v1' || key.includes(id))
        ) {
          used = true
          selected.set(request, { store: this, key })
        }
        return request
      }
      Object.defineProperty(IDBRequest.prototype, 'onsuccess', {
        ...descriptor,
        set(handler: ((this: IDBRequest, event: Event) => unknown) | null) {
          const target = this as IDBRequest
          descriptor.set!.call(
            target,
            handler &&
              function (this: IDBRequest, event: Event) {
                const actual = selected.get(target)
                if (!actual) return handler.call(this, event)
                hold.held = true
                actual.store.transaction.addEventListener('abort', () => {
                  hold.aborted = true
                })
                const keepAlive = () => {
                  if (hold.aborted) return
                  const pending = Reflect.apply(get, actual.store, [actual.key]) as IDBRequest
                  pending.onsuccess = () => {
                    if (hold.aborted) return
                    if (hold.released) handler.call(target, event)
                    else keepAlive()
                  }
                }
                keepAlive()
              },
          )
        },
      })
    },
    { id, store },
  )
}

export async function nativeHoldState(page: Page) {
  return page.evaluate(() => {
    const hold = (
      window as Window & {
        __wp12NativeHold?: { held: boolean; released: boolean; aborted: boolean }
      }
    ).__wp12NativeHold
    return hold && { held: hold.held, released: hold.released, aborted: hold.aborted }
  })
}

export async function releaseNativeHold(page: Page) {
  await page.evaluate(() => {
    const hold = (window as Window & { __wp12NativeHold?: { released: boolean } }).__wp12NativeHold
    if (!hold) throw new Error('No actual native hold was armed')
    hold.released = true
  })
}

export async function restoreNativeHold(page: Page) {
  if (page.isClosed()) return
  await page.evaluate(() => {
    ;(window as Window & { __wp12NativeHold?: { restore: () => void } }).__wp12NativeHold?.restore()
  })
}

export async function nativeWorkoutQuotaFault(page: Page, enabled: boolean) {
  if (page.isClosed()) return
  await page.evaluate((enabled) => {
    const scope = window as Window & { __wp12RestoreQuota?: () => void }
    scope.__wp12RestoreQuota?.()
    delete scope.__wp12RestoreQuota
    if (!enabled) return
    const original = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
      if (args[1] === 'readwrite' && String(args[0]).includes('workouts-v2'))
        throw new DOMException('WP12 synthetic quota fault', 'QuotaExceededError')
      return Reflect.apply(original, this, args)
    }
    scope.__wp12RestoreQuota = () => {
      IDBDatabase.prototype.transaction = original
    }
  }, enabled)
}

export async function readNativeWorkout(page: Page, id: string) {
  const stored = await page.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('klisteni.b2b.workouts')
      request.onupgradeneeded = () => {
        request.transaction?.abort()
        reject(new Error('Expected the actual application database to exist'))
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<{
        documents: WorkoutDocument[]
        pointers: WorkoutRecoveryPointer[]
      }>((resolve, reject) => {
        const transaction = database.transaction(['workouts-v2', 'selected-workout-v1'])
        const documents = transaction.objectStore('workouts-v2').getAll()
        const pointers = transaction.objectStore('selected-workout-v1').getAll()
        transaction.oncomplete = () =>
          resolve({
            documents: (documents.result as WorkoutDocument[]).filter((d) => d.id === id),
            pointers: (pointers.result as WorkoutRecoveryPointer[]).filter((p) => p.id === id),
          })
        transaction.onabort = () => reject(transaction.error)
        transaction.onerror = () => reject(transaction.error)
      })
    } finally {
      database.close()
    }
  }, id)
  expect(stored.documents).toHaveLength(1)
  return { document: stored.documents[0]!, pointers: stored.pointers }
}
