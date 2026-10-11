import { lazy } from 'react'

export const MovementViewer = lazy(() =>
  import('@klisteniapp/anatomy-viewer/movement').then((module) => ({
    default: module.MovementViewer,
  })),
)
export const EquipmentModelViewer = lazy(() =>
  import('@klisteniapp/anatomy-viewer/equipment').then((module) => ({
    default: module.EquipmentModelViewer,
  })),
)
