<a id="modelos-anatómicos-procedencia-licencia-y-alcance"></a>

# Anatomical models: provenance, license and scope

Research October 3, 2026. Source pages/metadata/import inventory/exporter report
verified for detailed body incorporation. Manifest/generated inventory accompany
assets; source docs alone never certify GLB contents.

<a id="fuente-elegida"></a>

## Selected source

Since October5, Modelo corporal selects Hombre (retained base)/Mujer (illustrative
parametric). `packages/anatomy-viewer/src/anatomy-variants.ts` continuous layer-joint
field, same height-floor/recalibrated supports; chest contour skin-only. No separate
female source/clinical female atlas. Names/muscles/exercises educational meaning retained.
Base GLB/Blender intact; coordinate-preservation claims below **base** only, female
captures derived change. Credits/license retained; visual preference not sex/identity/
account medical data. [Body variants](body-model-variants.md).

**Z-Anatomy muscle/bone/body-surface meshes**, derived BodyParts 3D, shared coordinates.
Official provenance/authors, Lluís Vinent application separate FBX.
[Model project](https://github.com/Z-Anatomy/Models-of-human-anatomy),
[application/exports](https://github.com/LluisV/Z-Anatomy/tree/PC-Version).
Pinned PC-Version `6c7f9016bd5899ac8edafd31b9900c151df42ed6`, SHA-256 checked against
three used downloads, no silent moving-branch change. GitHub advertised sizes, not optimized asset:

| Resource | Published size | Use |
| --- | --- | --- |
| [MuscularSystem100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/MuscularSystem100.fbx) | 35.6 MB | Muscles/associated structures: filter inventory, not all objects muscular tissue. |
| [SkeletalSystem100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/SkeletalSystem100.fbx) | 39.4 MB | Bone posture/location references. |
| [Regions of human body100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/Regions%20of%20human%20body100.fbx) | 4.23 MB | Native body-surface territories registered to both other systems. |
| [Collections — Muscles.csv](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Muscles.csv) | Metadata | Names/distribution across ten layers. |
| [Collections — Group-Muscles.csv](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Group-Muscles.csv) | Metadata | Compound muscle to heads/portions. |
| [Collections — Bones.csv](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Bones.csv) | Metadata | Bone layers. |
| [Collections — Skin.csv](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Skin.csv) | Metadata | Surface regions/nails/other outer elements. |

Same-revision raw:

- [Muscular FBX](https://raw.githubusercontent.com/LluisV/Z-Anatomy/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/MuscularSystem100.fbx).
- [Skeletal FBX](https://raw.githubusercontent.com/LluisV/Z-Anatomy/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/SkeletalSystem100.fbx).
- [Body-surface FBX](https://raw.githubusercontent.com/LluisV/Z-Anatomy/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/Regions%20of%20human%20body100.fbx).

Imported mesh objects686 muscle/1952 skeletal/301 surface, **not counts of muscles,
bones/exported structures**: markers/subdivisions/conceptual duplicates/auxiliary
geometry. `.cache/anatomy/source-inspection.json`; [GLB manifest](../packages/model-assets/public/models/anatomy-manifest.json)
retained subset/download hashes. Surface pectoral-deltoid-posterior-thigh regions,
Skin-* exterior/Skin-in caps/nails. Ten organizational layers **not ten histological
skin layers**. Common global transformation preserves native registration; no
visually fitted foreign body/clinical validation by visual coincidence.

[Blender pipeline](../scripts/blender/build_anatomy.py)→[GLB](../packages/model-assets/public/models/anatomy.glb),
`assets/blender/anatomy.blend`; global1.80m, no independently stretched limbs.
Remove Skin-in/preserve undecimated exterior/adaptive interior reductions with
one-way sampled vertex distances, **not global-error bound/anatomical validation**.
`assets/blender/optimization-report.json` exclusions/per-mesh results.

GLB 500,290 triangles. Viewer preserves source file/reference vertices; in-memory
T-junction subdivisions share skin edges under deformation, connectivity changes,
no gaps filled/new surface. Axillary weights shared for source gaps~0.15–2.19mm,
local normalized-atlas discontinuities, **not anatomical accuracy**, no welded/visual repair.

BodyParts 3D original OBJ/IS-A/PART-OF/organ names-IDs alternative direct subset
without Z-Anatomy changes. [Official downloads](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html).

<a id="publicar-el-fuente-de-blender-sin-residuos-del-editor"></a>

## Publish Blender source without editor residues

File-browser fields may retain prior-path bytes after NUL. Visible // or empty text
may leave capacity uncleared. [public_metadata.py](../scripts/blender/public_metadata.py)
overwrites full directory/filename capacities with neutral filler, then public
values; both browser modes/original mode retained.

Structural check decompresses .blend/SDNA/full capacities incl post-NUL, Python3/
zstd PATH for zstd compression. passed: true; unknown format/unexpected residues
fail. Specific buffer check complements private-indicator audit.

```sh
python3 scripts/blender/audit_file_browser_buffers.py assets/blender/anatomy.blend
python3 -m unittest discover -s scripts/blender -p 'test_*.py'
```

Clean existing source into new native-Blender copy:

```sh
audit_dir="$(mktemp -d)"
blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
  --python scripts/blender/sanitize_anatomy.py -- \
  --input assets/blender/anatomy.blend \
  --output "$audit_dir/anatomy.blend" --report "$audit_dir/preservation.json"
python3 scripts/blender/audit_file_browser_buffers.py "$audit_dir/anatomy.blend"
```

Sanitizer preserves input/reopens output/fingerprints full mesh arrays/attributes/
weights/transforms/materials/provenance/selected scene-view settings; no geometry
sampling/GLB reexport. Rejects animation/rigs/unsupported non-static contents,
not exhaustive nested render/tool/UI settings. App movement math separate.
Before replacement require preserved: true/inputUnchanged: true/changedCategories:[]/
fileBrowserBuffers.passed: true plus operator external-policy audit. Failure retain
original/review copy, no ignored error/expected-hash change. No attribution/license/catalog mutation.

<a id="licencias-comprobadas"></a>

## Verified licenses

| Provenance layer | Published condition | Application |
| --- | --- | --- |
| Current direct BodyParts 3D | CC BY4.0, updated February27,2025 | DBCLS requested attribution for new direct downloads |
| Z-Anatomy modifications/models | CC BY-SA4.0 | Credits/change notice/ShareAlike-compatible adaptation |
| Other Z-Anatomy-cited materials | Specific licenses, some noncommercial | Exclude outside musculoskeletal subset/check exported inventory |

[BodyParts3D license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html),
[Z-Anatomy credits](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt),
[FBX license](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/LICENSE).
Historic CC BY-SA2.1 Japan credit differs from current source CC BY4.0; original
update does not relicense Z-Anatomy modifications. This FBX derivative **CC BY-SA4.0**/
historic attribution chain. Share/adapt/commercial under attribution/change notice/
ShareAlike, no additional rights restrictions. GLB not MIT simply because code is.
[Summary](https://creativecommons.org/licenses/by-sa/4.0/), [legal text](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en).

<a id="exclusiones-de-este-subconjunto"></a>

### Subset exclusions

Credits list University of Dundee inner ear **CC BY-NC-SA4.0**, Lissie Cowley kidney
**CC BY-NC4.0**, brain/cranial references with other terms; excluded musculoskeletal
improvement. [Credits](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt).
Kidney.l/r in [Viscera.csv](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Viscera.csv).
Binary inspection found six Incus/Malleus/Stapes left-right, missed initial CSV
search; excluded as irrelevant/uncertain attribution, **not necessarily those
noncommercial inner-ear models**. Outer ear part of skin. Publish inclusion/
exclusion names; foreign-provenance structure excluded until identified. No bulk
Wikipedia definitions/machine translations; app educational prose own/referenced.

<a id="crédito-para-acompañar-el-asset-derivado"></a>

### Credit accompanying derived asset

[Public NOTICE](../packages/model-assets/public/models/NOTICE.md)/[full license](../packages/model-assets/public/models/LICENSE-anatomy.txt).
Original localized UI-credit quotation preserved verbatim:

> Anatomía 3D basada en BodyParts3D, The Database Center for Life Science, y en Z-Anatomy, Gauthier Kervyn y colaboradores. Exportación FBX distribuida por Lluís Vinent. Subconjunto y adaptación para Klisteni bajo CC BY-SA 4.0. Cambios: selección de estructuras, conversión de formato y optimizaciones descritas en el manifiesto del asset.

Source/license links accompany credit. Original notices retained:

> BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan

> Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0

Current direct BodyParts3D requested quotation: “BodyParts3D, © The Database Center
for Life Science licensed under CC Attribution 4.0 International”.
[Official attribution](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html).

<a id="mapa-anatómico-para-los-doce-grupos-actuales"></a>

## Anatomical map for twelve current groups

CSV names→existing educational IDs. Portion/side names retained even shared color;
.l/.r left/right. [Original groups](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Group-Muscles.csv),
[structures/layers](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Muscles.csv).

| Klisteni ID | Grouped structures | Retained distinction |
| --- | --- | --- |
| pectorals | Clavicular/sternocostal/abdominal pectoralis major | Minor separate/not functional equivalent |
| deltoids | Clavicular/acromial/spinal portions | Anterior-middle-posterior roles differ; shared color simplified |
| triceps | Long/lateral/medial brachial heads | Three heads/sides |
| lats | Latissimus dorsi | No nearby teres major |
| biceps | Long/short brachial heads | Not femoral biceps/brachialis |
| upper-back | Ascending/transverse/descending trapezius/major-minor rhomboids | No rotator cuff |
| abdominals | Rectus/transversus abdominis | Distinct layers/transverse not superficial plate |
| obliques | External/internal abdominal | No eye-neck-finger homonyms |
| glutes | Maximus/medius/minimus | Medius/minimus partly covered |
| quadriceps | Rectus femoris/lateral-medial-intermediate vasti | Intermedius deep,not moved outward for visibility |
| hamstrings | Semitendinosus/semimembranosus/biceps femoris heads | Educational posterior thigh/each head identity |
| calves | Medial-lateral gastrocnemius/soleus | Calcaneal tendon visible,not contractile tissue |

No broad biceps/oblique/gluteal matching: homonyms/bursae. Explicit verified
allowlist/specific patterns. Other muscles neutral preserve body continuity;
unhighlighted not inactive.

<a id="fidelidad-visual-y-movimiento"></a>

## Visual fidelity and movement

Adult male source. Mitsuhashi TARO volunteer MRI2mm intervals,later segmentation/
medical-illustrator3D reconstructions referencing texts-atlases-models. **2mm source
spacing,not measured accuracy/guaranteed tolerance of BodyParts3D/Z-Anatomy/Klisteni.**
[Official description](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html),
[Mitsuhashi et al., BodyParts3D: 3D structure database for anatomical concepts, NAR37,D782–D785,DOI10.1093/nar/gkn613](https://pmc.ncbi.nlm.nih.gov/articles/PMC2686534/).
Detailed reference/later modifications,not user/all variation. Source modeling/
conceptual territories/auxiliary structures retained. Coordinates prevent new
misregistration,not absolute accuracy/app clinical review.

Animation needs coherent joints/deformation weights/tendon continuity/penetration
control; anatomical FBX alone no suitable squat-push-up rig. Import inspection
armatures/skinning/usable clips. Independent scapula/W retraction; GLB head-palm/
shoulder-pelvis supports/visual clearance. Illustrative,not scapulohumeral rhythm/
physical contacts/musculotendon lengths/forces-joint loads/user technique validation.
Colors catalog roles,not measured activation. Verify reference pose/superficial-deep/
sides/group selection/extremes/front-back-side captures. Mobile optimized contours/
insertions/touch response/reduction percentage documented.

<a id="referencia-visual-de-elsevier"></a>

## Elsevier visual reference

[Complete Anatomy](https://www.elsevier.com/products/complete-anatomy) clarity/layers/
detail reference,commercial proprietary model,no redistribution permission shown.
Implementation open sources above,no extracted assets/screenshots/no clinical-scope equivalence.
