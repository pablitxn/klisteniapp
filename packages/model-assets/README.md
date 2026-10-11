# Shared visual resources

`public/models` and `public/previews` are the single source of runtime assets for both products. Add `sharedModelAssetsPlugin()` from `@klisteniapp/model-assets/vite` to each Vite application: development serves these files and production builds copy them into their own output directory. Neither deployment needs another application's origin.

The default URLs remain `/models/...` and `/previews/...`. A caller hosted below a path can pass `createAssetResolver(base)` to the shared viewer. Keep model provenance, notices and license files alongside the assets.

The versioned resource manifest distinguishes the anatomical atlas from the procedural low row bar. There are currently no dedicated gym machine GLBs. A future equipment resource may supply its own `modelPath`, version, provenance and notice; registering equipment does not register a movement for arbitrary exercise IDs.

Before uploading a locally authored machine, run
`pnpm equipment:check /path/machine.glb --poster /path/machine.png` from the root.
It uses the API's static GLB profile and records SHA-256 hashes; scale, framing,
provenance and educational review remain human checks. See the
[Mac/Blender handoff](../../docs/development-macos.md) and
[roadmap](../../docs/roadmap-implementacion.md).

The anatomy and derived previews retain their existing CC BY-SA 4.0 attribution. Code in this package remains MIT. Capture scripts generate previews here and hash the extracted rendering code as well as compatibility adapters; regenerate through those scripts after source changes.

The extraction recorded original exercise and yoga captures in an
[auditable source and artifact receipt](provenance/README.md). That receipt is
historical evidence; current per-item manifests record later captures. The
October 11 delivery preserves the completed partial regeneration, including all
24 body-region previews, and the remaining older yoga derivatives. Complete
regeneration and review are deferred until the Blender work is ready; do not
rewrite dates or hashes to imply that the whole collection is current. The
[release evidence](../../docs/b2b-release.md) records the exact scope and limitations.
