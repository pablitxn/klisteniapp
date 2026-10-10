# Shared visual resources

`public/models` and `public/previews` are the single source of runtime assets for both products. Add `sharedModelAssetsPlugin()` from `@klisteniapp/model-assets/vite` to each Vite application: development serves these files and production builds copy them into their own output directory. Neither deployment needs another application's origin.

The default URLs remain `/models/...` and `/previews/...`. A caller hosted below a path can pass `createAssetResolver(base)` to the shared viewer. Keep model provenance, notices and license files alongside the assets.

The versioned resource manifest distinguishes the anatomical atlas from the procedural low row bar. There are currently no dedicated gym machine GLBs. A future equipment resource may supply its own `modelPath`, version, provenance and notice; registering equipment does not register a movement for arbitrary exercise IDs.

The anatomy and derived previews retain their existing CC BY-SA 4.0 attribution. Code in this package remains MIT. Capture scripts generate previews here and hash the extracted rendering code as well as compatibility adapters; regenerate through those scripts after source changes.

The extraction retains the original exercise and yoga captures with an [auditable source and artifact receipt](provenance/README.md); their original capture dates and hashes stay intact. The 24 body-region previews were captured again with the shared implementation.
