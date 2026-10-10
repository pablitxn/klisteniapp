# Modelos anatómicos: procedencia, licencia y alcance

Investigación realizada el 3 de octubre de 2026. Este documento registra las fuentes comprobadas y el criterio para incorporar un cuerpo anatómico detallado a Klisteni. Se verificaron páginas de origen, metadatos, el inventario importado y el informe del exportador. El manifiesto y el inventario generado acompañan a los archivos; la documentación de la fuente por sí sola no certifica el contenido de un GLB.

## Fuente elegida

Desde el 5 de octubre de 2026, la preferencia global **Modelo corporal** permite representar esa fuente como **Hombre** (base conservada) o **Mujer** (adaptación paramétrica ilustrativa). El código reproducible de la adaptación está en `packages/anatomy-viewer/src/anatomy-variants.ts`: aplica un campo continuo a capas y referencias articulares, conserva altura/suelo y recalibra los apoyos. El contorno del pecho se modifica sólo en la superficie de piel. No se incorporó una fuente independiente de anatomía femenina ni se validó un atlas femenino clínico. Los nombres de estructuras, músculos implicados y ejercicios conservan su significado educativo.

El GLB y el Blender base permanecen intactos. Por tanto, las afirmaciones siguientes sobre conservación de coordenadas describen **la base**; las capturas de la variante femenina documentan una modificación derivada. Ambas variantes y sus capturas conservan los créditos/licencia del atlas; la preferencia visual no informa sexo, identidad ni datos médicos de la cuenta. Véase también `docs/body-model-variants.md` para persistencia, generación y verificación.

La fuente elegida contiene las **mallas musculares, óseas y de superficie corporal de Z-Anatomy**, derivadas de BodyParts3D. Los tres archivos comparten coordenadas; permiten alternar entre cuerpo exterior y anatomía conservando la relación espacial de la fuente. El repositorio oficial describe el origen y los autores; la aplicación de Lluís Vinent ofrece los sistemas como archivos FBX separados. [Z-Anatomy, proyecto de modelos](https://github.com/Z-Anatomy/Models-of-human-anatomy), [Z-Anatomy, aplicación y exportaciones](https://github.com/LluisV/Z-Anatomy/tree/PC-Version).

El commit de la rama `PC-Version` fijado para la importación es `6c7f9016bd5899ac8edafd31b9900c151df42ed6`. El manifiesto registra SHA-256 de cada descarga, comprobados contra los tres archivos usados, para que una actualización de la rama no cambie silenciosamente el modelo. Los tamaños siguientes son los mostrados por GitHub, no el peso del asset optimizado.

| Recurso | Tamaño anunciado | Uso |
| --- | --- | --- |
| [MuscularSystem100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/MuscularSystem100.fbx) | 35,6 MB | Músculos y estructuras asociadas; filtrar por inventario, no asumir que todo objeto es tejido muscular. |
| [SkeletalSystem100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/SkeletalSystem100.fbx) | 39,4 MB | Referencias óseas de postura y ubicación. |
| [Regions of human body100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/Regions%20of%20human%20body100.fbx) | 4,23 MB | Territorios de la superficie corporal nativa, registrados con los dos sistemas anteriores. |
| [Collections — Muscles.csv](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Muscles.csv) | Metadatos | Nombres y distribución de estructuras en diez capas. |
| [Collections — Group-Muscles.csv](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Group-Muscles.csv) | Metadatos | Relación entre un músculo compuesto y sus cabezas o porciones. |
| [Collections — Bones.csv](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Bones.csv) | Metadatos | Capas de estructuras óseas. |
| [Collections — Skin.csv](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Skin.csv) | Metadatos | Regiones superficiales del cuerpo, uñas y otros elementos exteriores. |

Descargas directas, fijadas a la misma revisión:

- [FBX muscular, raw](https://raw.githubusercontent.com/LluisV/Z-Anatomy/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/MuscularSystem100.fbx)
- [FBX esquelético, raw](https://raw.githubusercontent.com/LluisV/Z-Anatomy/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/SkeletalSystem100.fbx)
- [FBX de superficie corporal, raw](https://raw.githubusercontent.com/LluisV/Z-Anatomy/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/Regions%20of%20human%20body100.fbx)

La inspección local de los tres FBX produjo 686 objetos de malla musculares, 1952 esqueléticos y 301 de superficie. **Son objetos importados, no cantidades de músculos, huesos ni estructuras exportadas**: incluyen marcadores, subdivisiones, duplicados conceptuales y geometría auxiliar. El informe está en `.cache/anatomy/source-inspection.json`; el [manifiesto del GLB](../packages/model-assets/public/models/anatomy-manifest.json) registra el subconjunto realmente conservado y los SHA-256 de las descargas.

La superficie contiene territorios como región pectoral, deltoidea y posterior del muslo, con materiales exteriores `Skin-*`, caras de cierre `Skin-in` y uñas. Es una superficie anatómica segmentada; sus diez capas de organización **no representan diez capas histológicas de piel**. La conversión conserva el registro nativo mediante la misma transformación global para todos los sistemas. No se sustituye esta superficie por un cuerpo de otro catálogo ajustado a ojo, ni se interpreta una coincidencia visual como validación clínica.

El pipeline de [Blender](../scripts/blender/build_anatomy.py) convierte esos datos a [anatomy.glb](../packages/model-assets/public/models/anatomy.glb) y guarda la escena editable en `assets/blender/anatomy.blend`. Normaliza globalmente la altura a 1,80 m sin estirar extremidades por separado. Retira cierres internos `Skin-in` y conserva las caras exteriores sin decimación; reduce polígonos interiores mediante controles muestrales de distancia. Esos controles comparan algunos vértices de la fuente con el resultado, en una sola dirección: **no son una cota de error global ni una validación anatómica**. El inventario de exclusiones y resultados por malla está en `assets/blender/optimization-report.json`.

El GLB exportado contiene 500 290 triángulos. La preparación del visor conserva ese archivo y las posiciones de sus vértices; en memoria subdivide caras en encuentros coincidentes de tipo T para que las regiones superficiales compartan bordes al deformarse. La subdivisión modifica la conectividad, no rellena huecos ni inventa una superficie nueva. También comparte pesos en bordes axilares documentados, donde la fuente presenta separaciones de aproximadamente 0,15–2,19 mm. Esas distancias describen discontinuidades locales del atlas normalizado, **no precisión anatómica**; las posiciones y las separaciones originales no se sueldan ni se corrigen a ojo.

BodyParts3D también ofrece los datos originales y tablas de relaciones `IS-A` y `PART-OF`, con nombres de órganos y sus identificadores. Es una alternativa para reconstruir un subconjunto directamente desde la fuente sin las modificaciones de Z-Anatomy. La página de descargas publica archivos OBJ y tablas que permiten enlazar mallas con conceptos anatómicos. [Archivo oficial de BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html).

## Publicar el fuente de Blender sin residuos del editor

Blender puede conservar bytes de una ruta anterior después del terminador NUL de los campos del explorador de archivos. Asignar `//` o una cadena vacía limpia el texto visible, pero no necesariamente toda la capacidad del campo. El generador usa [public_metadata.py](../scripts/blender/public_metadata.py) para sobrescribir primero las capacidades completas de directorio y nombre de archivo con un relleno neutro, y luego dejar los valores públicos. Revisa ambos modos del explorador y conserva su modo original.

La comprobación estructural siguiente descomprime el `.blend`, lee su SDNA y revisa la capacidad completa de esos campos, incluidos los bytes posteriores al NUL. Requiere Python 3 y `zstd` en `PATH` para archivos comprimidos con zstd. Un resultado correcto contiene `passed: true`; un formato desconocido o bytes residuales distintos del relleno permitido hacen fallar el comando. Es una comprobación específica de los campos del explorador, complementaria a la auditoría de indicadores privados.

```sh
python3 scripts/blender/audit_file_browser_buffers.py assets/blender/anatomy.blend
python3 -m unittest discover -s scripts/blender -p 'test_*.py'
```

Para limpiar un fuente existente, generar una copia nueva con Blender nativo:

```sh
audit_dir="$(mktemp -d)"
blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
  --python scripts/blender/sanitize_anatomy.py -- \
  --input assets/blender/anatomy.blend \
  --output "$audit_dir/anatomy.blend" --report "$audit_dir/preservation.json"
python3 scripts/blender/audit_file_browser_buffers.py "$audit_dir/anatomy.blend"
```

El sanitizador conserva el archivo de entrada, reabre la copia y compara fingerprints de los arrays completos de malla, atributos, pesos, transformaciones, materiales, propiedades de procedencia y ajustes seleccionados de escena/vista. No muestrea geometría ni vuelve a exportar el GLB. Rechaza animaciones, rigs y otros contenidos que este verificador del atlas estático no cubre; tampoco afirma revisar exhaustivamente todos los ajustes anidados de render, herramientas o interfaz. La reconstrucción matemática de los movimientos de la aplicación permanece separada del fuente estático.

Antes de reemplazar el fuente, exigir `preserved: true`, `inputUnchanged: true`, `changedCategories: []` y `fileBrowserBuffers.passed: true` en el reporte, además de una auditoría con la política externa del operador. Ante cualquier fallo, conservar el original y revisar la copia; no ignorar el error ni modificar un hash esperado para aceptarla. La limpieza de metadatos no modifica las atribuciones, las licencias ni el catálogo.

## Licencias comprobadas

| Capa de procedencia | Condición publicada | Aplicación a Klisteni |
| --- | --- | --- |
| BodyParts3D, descarga oficial actual | CC BY 4.0 International; página actualizada el 27 de febrero de 2025 | Las nuevas descargas directas del archivo se acompañan de la atribución que solicita DBCLS. |
| Z-Anatomy, modificaciones y modelos distribuidos por el proyecto | CC BY-SA 4.0 International | Las adaptaciones de esas mallas deben conservar crédito, indicación de cambios y licencia compatible con ShareAlike. |
| Material adicional citado por Z-Anatomy | Incluye licencias específicas, algunas no comerciales | Excluir los modelos ajenos al subconjunto musculoesquelético y comprobar el inventario de objetos exportados. |

Fuentes: [licencia actual de BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), [licencia y créditos de Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt), [licencia de la distribución FBX](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/LICENSE).

Hay una diferencia documental importante: Z-Anatomy conserva el crédito histórico **CC BY-SA 2.1 Japan** de BodyParts3D; el archivo oficial de BodyParts3D ahora publica **CC BY 4.0**. El cambio de la fuente original no convierte automáticamente las modificaciones de Z-Anatomy en CC BY. Para el derivado que parte de los FBX de Z-Anatomy, se mantiene **CC BY-SA 4.0**, además de la cadena de atribución histórica.

La licencia CC BY-SA permite compartir y adaptar, incluso comercialmente, con atribución, aviso de modificaciones y ShareAlike para el material adaptado. No permite añadir restricciones que impidan ejercer esos derechos. La licencia del modelo debe mostrarse por separado de la licencia del código escrito para Klisteni: no se debe etiquetar el GLB como MIT por estar en un repositorio cuyo código use MIT. [Resumen oficial CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), [texto legal](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en).

### Exclusiones de este subconjunto

El archivo de créditos de Z-Anatomy menciona específicamente un oído interno de University of Dundee bajo **CC BY-NC-SA 4.0** y un riñón de Lissie Cowley bajo **CC BY-NC 4.0**, además de referencias cerebrales y nervios craneales con otras condiciones. No se incorporan esos modelos a esta mejora del aparato musculoesquelético. [Créditos de los modelos](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt).

Como evidencia de organización, `Kidney.l` y `Kidney.r` aparecen en [Collections — Viscera.csv](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Viscera.csv). La inspección binaria importada encontró seis huesecillos del oído en el sistema esquelético (`Incus`, `Malleus`, `Stapes`, izquierdo y derecho), aunque la búsqueda inicial del CSV no los detectó. Se excluyen por no aportar a esta visualización y para evitar una atribución incierta del subconjunto auditivo; **no se afirma que esos seis objetos sean necesariamente el modelo de oído interno con licencia no comercial**. El pabellón exterior del oído pertenece a la superficie corporal. El importador debe publicar nombres incluidos y excluidos; si apareciera una estructura de procedencia distinta, se excluye del GLB hasta identificarla.

No se importan en bloque definiciones ni traducciones: Z-Anatomy identifica textos basados en Wikipedia y advierte sobre traducciones automáticas. Los textos educativos de la aplicación se mantienen como contenido propio, con sus referencias de ejercicio.

### Crédito para acompañar el asset derivado

El aviso público está en [NOTICE.md](../packages/model-assets/public/models/NOTICE.md), con la [licencia completa](../packages/model-assets/public/models/LICENSE-anatomy.txt). El crédito breve para la interfaz es:

> Anatomía 3D basada en BodyParts3D, The Database Center for Life Science, y en Z-Anatomy, Gauthier Kervyn y colaboradores. Exportación FBX distribuida por Lluís Vinent. Subconjunto y adaptación para Klisteni bajo CC BY-SA 4.0. Cambios: selección de estructuras, conversión de formato y optimizaciones descritas en el manifiesto del asset.

Los enlaces de origen y licencia deben acompañar ese crédito. Para preservar los avisos publicados por Z-Anatomy se conservan también:

> BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan

> Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0

Si se usa una descarga directa actual de BodyParts3D, su página solicita: “BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International”. [Atribución del archivo oficial](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html).

## Mapa anatómico para los doce grupos actuales

Esta tabla propone el vínculo entre nombres encontrados en los CSV y los IDs educativos ya usados por la app. Las porciones y lados deben conservar sus nombres específicos en los metadatos del asset, aunque compartan un color de grupo. Los sufijos `.l` y `.r` representan lados izquierdo y derecho en estas tablas. [Grupos originales](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Group-Muscles.csv), [estructuras y capas](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Layers/Collections%20-%20Muscles.csv).

| ID de Klisteni | Estructuras que agrupar | Distinción a conservar |
| --- | --- | --- |
| `pectorals` | Cabezas clavicular y esternocostal y porción abdominal del pectoral mayor | El pectoral menor queda independiente; no es equivalente funcional al mayor. |
| `deltoids` | Porciones clavicular, acromial y espinal del deltoides | Anterior, media y posterior tienen funciones distintas; colorear todo el grupo es una simplificación. |
| `triceps` | Cabezas larga, lateral y medial del tríceps braquial | Conservar las tres cabezas y su lateralidad. |
| `lats` | Dorsal ancho | No incluir redondo mayor por proximidad. |
| `biceps` | Cabezas larga y corta del bíceps braquial | No confundir con bíceps femoral ni con braquial. |
| `upper-back` | Porciones ascendente, transversa y descendente del trapecio; romboides mayor y menor | El manguito rotador no pertenece a esta agrupación. |
| `abdominals` | Recto abdominal y transverso abdominal | Son capas diferentes; el transverso no es una placa superficial. |
| `obliques` | Oblicuo abdominal externo e interno | No incluir músculos oblicuos de ojos, cuello o dedos por coincidencia de nombre. |
| `glutes` | Glúteo mayor, medio y menor | Medio y menor quedan parcialmente cubiertos por otras estructuras. |
| `quadriceps` | Recto femoral y vastos lateral, medial e intermedio | El vasto intermedio queda profundo; no se debe mover a la superficie para hacerlo visible. |
| `hamstrings` | Semitendinoso, semimembranoso y cabezas del bíceps femoral | Grupo didáctico de cara posterior del muslo; conservar la identidad de cada cabeza. |
| `calves` | Cabezas medial y lateral del gastrocnemio y sóleo | El tendón calcáneo puede mostrarse, pero no debe etiquetarse como tejido contráctil. |

No conviene clasificar por coincidencias amplias como `biceps`, `oblique` o `gluteal`: las tablas contienen músculos homónimos de otras regiones y bursas con nombres musculares. La selección debe usar una lista explícita o patrones específicos comprobados. Los demás músculos pueden permanecer visibles con un color neutro para que el cuerpo no pierda continuidad; “sin destacar” no significa que estén inactivos.

## Fidelidad visual y movimiento

BodyParts3D documenta un modelo de varón adulto. El artículo de Mitsuhashi y colaboradores describe una base TARO construida a partir de imágenes de resonancia de un voluntario, con intervalos de 2 mm. Después se añadieron segmentaciones y se reconstruyeron detalles y contornos mediante edición 3D por ilustradores médicos que consultaron textos, atlas y modelos anatómicos. **Los 2 mm describen el espaciado de las imágenes originales: no son una precisión medida ni una tolerancia garantizada de BodyParts3D, Z-Anatomy o del GLB de Klisteni.** [Descripción oficial](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html), [Mitsuhashi et al., *BodyParts3D: 3D structure database for anatomical concepts*, Nucleic Acids Research 37, D782–D785, DOI 10.1093/nar/gkn613](https://pmc.ncbi.nlm.nih.gov/articles/PMC2686534/).

La fuente constituye una referencia anatómica detallada, con posteriores modificaciones de Z-Anatomy; no representa a la persona usuaria ni todas las variaciones humanas. Conserva decisiones de modelado, territorios conceptuales y estructuras auxiliares. Preservar sus coordenadas evita introducir un nuevo desajuste entre sistemas, pero no demuestra exactitud absoluta del atlas ni revisión clínica de esta aplicación.

Incorporar estas mallas mejora forma, ubicación y separación de estructuras. Animarlas exige trabajo adicional: articulaciones coherentes, pesos de deformación, continuidad de tendones y control de penetraciones. Un FBX anatómico no demuestra por sí mismo que contenga un rig adecuado para flexiones o sentadillas. La inspección del importador determina si hay armatures, skinning y clips aprovechables.

La animación de Klisteni incluye escápulas independientes con retracción durante la W. Sus referencias de apoyo de cabeza y palmas, además de hombros y pelvis, se derivan de la superficie del GLB con márgenes de separación visual. Son decisiones de una animación ilustrativa: no validan un ritmo escapulohumeral, contactos físicos, longitudes musculotendinosas, fuerzas, cargas articulares ni calidad técnica de un usuario. Los colores siguen representando grupos implicados según el catálogo, no mediciones de activación.

El recorrido de verificación debe cubrir postura de referencia, capas superficial y profunda, lateralidad, selección de cada grupo y los extremos de cada ejercicio. Las capturas deben incluir frente, espalda y perfil. En móvil, la geometría optimizada debe conservar contornos e inserciones visuales importantes y mantener respuesta al tacto; el porcentaje de reducción se documenta junto al archivo exportado.

## Referencia visual de Elsevier

[Complete Anatomy](https://www.elsevier.com/products/complete-anatomy) sirve como referencia de claridad, navegación por capas y nivel de detalle deseado. Su página describe modelos propios y funciones de una plataforma comercial; no publica allí una licencia para extraer y redistribuir sus mallas. Esta implementación usa las fuentes abiertas identificadas arriba y no incorpora assets ni capturas extraídas de Complete Anatomy. No se afirma equivalencia de alcance o revisión clínica con ese producto.
