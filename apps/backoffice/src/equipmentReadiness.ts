import type { Machine, Unit } from '@klisteniapp/b2b-contracts'

export type PublicationBlocker = {
  reason: string
  destination: 'equipment' | 'website'
}

/** Mirrors the public route prerequisites; a unit's public flag alone is insufficient. */
export function unitPublicationBlockers(
  unit: Unit,
  machine: Machine | undefined,
  websitePublished: boolean,
): PublicationBlocker[] {
  const blockers: PublicationBlocker[] = []
  if (unit.archived)
    blockers.push({ reason: 'Restaurar la unidad retirada.', destination: 'equipment' })
  if (!unit.public)
    blockers.push({
      reason: 'Revisar la unidad y habilitar su ficha pública.',
      destination: 'equipment',
    })
  if (machine?.status !== 'published')
    blockers.push({ reason: 'Revisar y publicar el modelo de máquina.', destination: 'equipment' })
  if (!websitePublished)
    blockers.push({ reason: 'Revisar y publicar el website del gimnasio.', destination: 'website' })
  return blockers
}

export function qrOriginReadiness(origin: string): { ready: boolean; message: string } {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return {
      ready: false,
      message:
        'No pudimos identificar el origen de estos QR. Abrí el backoffice desde la dirección HTTPS de la instancia B2B.',
    }
  }
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    host === '0.0.0.0' ||
    host === '[::]'
  )
    return {
      ready: false,
      message:
        'Este origen es local: al escanearlo, el teléfono buscará la ficha en el propio teléfono. Abrí el backoffice desde la dirección HTTPS accesible del gimnasio antes de imprimir las etiquetas definitivas.',
    }
  if (url.protocol !== 'https:')
    return {
      ready: false,
      message:
        'Estas etiquetas usan una dirección sin HTTPS. Abrí el backoffice desde la dirección HTTPS accesible del gimnasio antes de imprimir las etiquetas definitivas.',
    }
  return {
    ready: true,
    message:
      'El origen usa HTTPS. Comprobá desde el teléfono que esta dirección sea accesible y que cada QR abra la unidad correcta antes de pegarlo.',
  }
}
