// The static demo imports this module instead of the network analytics client.
// No listeners, storage, timers, scripts or requests are initialized.
const snapshot = { choice: 'pending', reason: 'config', enabled: false } as const
export const analytics = {
  subscribe(listener: () => void) { void listener; return () => undefined },
  getSnapshot: () => snapshot,
  accept: () => undefined,
  reject: () => undefined,
  setPrivacyPage(value: boolean) { void value },
}
