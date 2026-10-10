# Anatomy viewer

Reusable React/Three components and the existing rig, morphology, surface calibration and renderer. This package has no application store, authentication or translation singleton. Consumers supply the model preference and asset resolver; the B2C application keeps its existing preference adapters and URLs.

- `MovementViewer`: complete orthographic movement viewer with playback control, model preference, muscle highlighting, reduced-motion support and a media/text fallback.
- `ExercisePreview`: static or active animated preview for a known authored movement.
- `EquipmentModelViewer`: optional static GLB with a loading/error alternative, orbit controls and fitted bounds. The model loads only after an explicit click; it never creates an exercise animation from the equipment.
- `ExerciseStage`, `AnatomicalModel`, `AnatomyStudio`: lower-level R3F components used by the B2C viewer and deterministic capture entrypoints. Model components require an explicit `assetResolver`.
- `getMovementDefinition`: resolves only catalog movements with authored motion and camera configuration. Unknown machine exercise IDs return no movement; the neutral `anatomy` pose remains available only to low-level inspection.

Use `sharedModelAssetsPlugin()` from `@klisteniapp/model-assets/vite` in the consuming application's Vite configuration. Assets and their provenance live in that package. The manifest version describes this educational movement library; it does not certify exercise technique or measured muscle activation.
