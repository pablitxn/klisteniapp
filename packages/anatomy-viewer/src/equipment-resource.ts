/** Static GLB resources are opt-in; equipment IDs never select anatomical motion. */
export function isEquipmentModelUrl(value: string) {
  try {
    const url = new URL(value, 'https://assets.example.test')
    return ['https:', 'http:'].includes(url.protocol) && /\.glb$/i.test(url.pathname)
  } catch { return false }
}
