# Modelo corporal global

En **Ajustes → Apariencia → Modelo corporal**, elegir **Mujer** o **Hombre** cambia la representación en toda la app: rutina, catálogo, demostraciones 3D, entrenamiento y atlas, incluidos sus pósteres, animaciones WebP, GIFs generados y miniaturas de regiones. Las instrucciones, referencias bibliográficas y programación de ejercicio se conservan: esta preferencia visual no informa sexo, identidad ni datos de salud.

## Persistencia y compatibilidad

- Campo validado: `PersonalSettings.anatomicalModel`, enum `female | male`. Se resuelve `male` cuando falta en datos antiguos, sin insertar un valor por defecto durante el parseo.
- Cuenta: usa el guardado existente de ajustes con revisión, API y PostgreSQL. Un segundo dispositivo carga el valor de esa cuenta. Un conflicto 409 no sobrescribe silenciosamente la revisión del servidor.
- Uso local/demo: se guarda en los datos personales del navegador y se incluye en exportaciones/importaciones. No requiere cuenta.
- Cerrar sesión recupera la preferencia local. Entrar con otra cuenta usa sus propios ajustes; no hereda la elección de la cuenta anterior.
- Un cliente o backup antiguo que omite el campo conserva la elección existente. Un valor desconocido se rechaza. No requiere migración SQL porque los ajustes ya se guardan como JSON validado.
- `selectAnatomicalModel` es el punto común para consumidores; no deben leer directamente almacenamiento del navegador ni inferirlo del perfil de salud.

## Geometría y alcance

`packages/anatomy-viewer/src/anatomy-variants.ts` contiene parámetros reproducibles de hombros, cintura, pelvis y contorno externo de pecho. El campo común modifica piel, músculos, huesos y referencias de articulación de forma coherente; sólo el contorno de pecho es propio de la superficie cutánea. Se mantiene la altura normalizada. Las normales se adaptan conservando los bordes de la fuente, y los apoyos posteriores, palmas y torso anterior se calibran desde la superficie seleccionada.

La variante **Mujer es una adaptación ilustrativa de la fuente existente**, no una segunda adquisición anatómica ni un atlas femenino clínicamente validado. Los parámetros no son promedios poblacionales. El GLB y el Blender originales se conservan intactos; cada preparación crea y libera su propia geometría. La procedencia se muestra en los ajustes y en el desplegable de precisión del visor, y se conserva en `public/models/NOTICE.md`.

En la piel de la variante femenina, `anatomy-variant-surface.ts` sustituye los detalles genitales masculinos de origen por dos superficies neutras que conservan los bordes externos originales. Se identifican como superficies pélvicas ilustrativas y no como órganos femeninos. Esta simplificación no afecta los músculos del catálogo ni la vista ósea.

Los nombres y colores musculares describen el mismo catálogo educativo en ambas variantes. No se añaden órganos, diagnósticos ni recomendaciones específicas por seleccionar un cuerpo. Los documentos y enlaces de terceros mantienen su contenido original; las grabaciones estáticas del README son ejemplos de la versión capturada, no vistas ligadas a una cuenta.

## Generación de medios

La regeneración y revisión completa de derivados están diferidas hasta estabilizar los modelos 3D, según el [roadmap](roadmap-implementacion.md). Conservar los archivos actuales; los comandos siguientes corresponden al trabajo posterior de contenido.

```sh
# 37 ejercicios × 2 variantes, pósteres, WebP y GIFs.
pnpm previews:generate --gif

# Iteración de una combinación específica.
pnpm previews:generate --model female --exercise squat --gif

# 12 miniaturas musculares × 2 variantes.
pnpm body-previews:generate

# Comprueba ejercicios, regiones corporales y yoga: fuentes y archivos generados.
pnpm previews:check
```

Los medios base mantienen `/previews/{id}…` y `/previews/body/{muscle}.webp`. Los femeninos usan `/previews/female/{id}…` y `/previews/female/body/{muscle}.webp`. El manifiesto de ejercicios registra cada combinación en `variants.{male|female}.exercises`; las miniaturas tienen manifiestos por variante. Los hashes incluyen el código de morfología, rig y renderer para detectar capturas obsoletas. No se debe editar un hash para saltarse una regeneración.

Los pósteres siguen siendo imágenes ligeras. Las animaciones se activan sólo cuando corresponde y respetan movimiento reducido, visibilidad de pestaña y viewport. Si un archivo falla, se muestra un fallback; cambiar de variante permite cargar su propio archivo sin reutilizar el fallo anterior.

## Verificación

Las pruebas incluyen datos antiguos, copias, rechazo de valores inválidos, aislamiento de cuentas, sincronización entre dos navegadores contra API/PostgreSQL, conflictos de revisión y cambios globales en las superficies de la app. La geometría se comprueba contra el GLB real: estructuras seleccionables, originales sin mutar, poses finitas y apoyos de cabeza/manos/pies/rodillas/torso durante los ciclos de ambas variantes.

Además de los checks automatizados, revisar piel, músculos y huesos de frente, perfil y espalda; probar sentadilla, flexiones, apoyos boca abajo, supinos y remos. Los tests de geometría no certifican fidelidad clínica ni sustituyen esa revisión visual. Los cambios de esta funcionalidad requieren regenerar las capturas antes de publicar.
