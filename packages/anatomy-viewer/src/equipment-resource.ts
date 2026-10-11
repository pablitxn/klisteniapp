/** Static GLB resources are opt-in; equipment IDs never select anatomical motion. */
export function isEquipmentModelUrl(value: string, format?: 'glb') {
  try {
    const url = new URL(value, 'https://assets.example.test')
    // Authenticated media APIs may use extensionless URLs. The caller supplies
    // a known format after validating metadata; the renderer has no API knowledge.
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password &&
      (format === 'glb' || /\.glb$/i.test(url.pathname))
  } catch { return false }
}
