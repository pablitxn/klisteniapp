import { ACESFilmicToneMapping, PCFShadowMap } from 'three'

/** Keep captured previews and the live viewer in the same rendering pipeline. */
export const anatomyRendererOptions = {
  antialias: true,
  alpha: false,
  toneMapping: ACESFilmicToneMapping,
  toneMappingExposure: 1.05,
} as const

export const anatomyShadows = { type: PCFShadowMap }
