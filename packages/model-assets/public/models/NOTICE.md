<a id="anatomía-3d-de-klisteni-créditos-y-licencia"></a>

# Klisteni 3D anatomy: credits and license

Based on **BodyParts 3D**, The Database Center for Life Science, and **Z-Anatomy**,
Gauthier Kervyn and contributors. FBX distributed by **Lluís Vinent Juanico** through
Z-Anatomy application. Klisteni adaptation under **Creative Commons
Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.

- [License summary/conditions](https://creativecommons.org/licenses/by-sa/4.0/).
- [Included full license](./LICENSE-anatomy.txt).
- [Z-Anatomy models/authors](https://github.com/Z-Anatomy/Models-of-human-anatomy).
- [Original attribution/component notices](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt).
- [Pinned FBX repository](https://github.com/LluisV/Z-Anatomy/tree/6c7f9016bd5899ac8edafd31b9900c151df42ed6).
- [Distribution license](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/LICENSE).

<a id="fuentes-fijadas"></a>

## Pinned sources

Revision `6c7f9016bd5899ac8edafd31b9900c151df42ed6`, three registered-coordinate systems:

- [MuscularSystem100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/MuscularSystem100.fbx).
- [SkeletalSystem100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/SkeletalSystem100.fbx).
- [Regions of human body100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/Regions%20of%20human%20body100.fbx).

<a id="atribución-conservada"></a>

## Retained attribution

Original historical Z-Anatomy notices preserved:

> BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan

> Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0

[Official BodyParts3D archive](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)
records February27,2025 CC BY4.0 update and requested original credit:
“BodyParts3D, © The Database Center for Life Science licensed under CC Attribution
4.0 International”. This does not remove ShareAlike from used Z-Anatomy modifications;
adaptation remains CC BY-SA4.0.

<a id="adaptación-y-alcance"></a>

## Adaptation and scope

<a id="variantes-corporales-de-visualización"></a>

### Display body variants

**Hombre** reference geometry below;**Mujer** illustrative parametric source adaptation,
smooth shoulder-waist-pelvis field across skin-muscles-bones-joints,external chest
contour skin-only,same normalized height. No organs/independent female data/clinical
female atlas. Parameters graphics choices,not population/user measurements.
`packages/anatomy-viewer/src/anatomy-variants.ts` reproducible adaptation;original
GLB/Blender unchanged,supports recomputed adapted surface. GIF-WebP-thumbnails same
renderer,manifest variant/sources/hashes,credits/CC BY-SA4.0 retained. Visual choice
not exercise prescription/health data.

<a id="geometría-base"></a>

### Base geometry

Female variant additionally replaces source male genital skin details with two
neutral pelvic surfaces triangulated from original outer boundaries.
anatomy-variant-surface.ts retains/document boundaries,labels illustrative/not
female organs. Coordinate-face preservation below describes base.

Educational adaptation [anatomy.glb](./anatomy.glb),[provenance/optimization manifest](./anatomy-manifest.json)
source SHA-256/coordinates/counts/changes:

- Selected structures;removed markers/auxiliary/fascia/bursae/sheaths/auditory ossicles.
- Original outer skin faces retained,internal Skin-in closures removed.
- FBX→GLB/common global1.80m/floor origin/glTF vertical,graphical not user height.
- Adaptive muscle-bone decimation,undecimated external surface.
- Tissue colors/tendon face distinction/educational grouping.

Same atlas skin-muscles-bones,no independent scale-to-other-body.[Joint landmarks](./rig-landmarks.json)
separately selected illustrative motion references. Browser shared skin weights/
coincident-edge subdivisions preserve reference positions,no gap filling/new body.
Axillary local deformation without welding source gaps. Educational W scapula/head-
palm surface supports,not contact simulation/clinical validation.

Excluded independent noncommercial kidney/inner-ear models cited by source;no
Wikipedia definitions/machine translations. Anatomy license independent code.
Skin regions not histological layers. Original TARO MRI2mm spacing plus medical-
illustrator segmentation/reconstruction,**not current2mm accuracy guarantee**.
[Mitsuhashi et al., BodyParts3D: 3D structure database for anatomical concepts, DOI10.1093/nar/gkn613](https://pmc.ncbi.nlm.nih.gov/articles/PMC2686534/).

Detail aids shape/location;app poses/deformations/colors educational,not validated
biomechanics/activation/clinical assessment/user dimensions/original-author endorsement.
Original notice updated October3,2026;English editorial translation October13,2026.
