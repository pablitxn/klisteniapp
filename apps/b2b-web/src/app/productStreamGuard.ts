/** Stable request gate for a workspace lifetime. Temporary disconnection keeps
 * owner-local editors mounted while aborting all authorized network work. */
export class ProductStreamGuard {
  private controller: AbortController | null = null
  activate() {
    if (!this.controller || this.controller.signal.aborted) this.controller = new AbortController()
  }
  suspend() {
    this.controller?.abort()
    this.controller = null
  }
  requestSignal() {
    if (!this.controller || this.controller.signal.aborted)
      throw new DOMException('Esperá a que se valide la conexión con tu gimnasio.', 'AbortError')
    return this.controller.signal
  }
}
