# Anatomía 3D de Klisteni: créditos y licencia

Anatomía basada en **BodyParts3D**, The Database Center for Life Science, y **Z-Anatomy**, Gauthier Kervyn y colaboradores. Los FBX fueron distribuidos por **Lluís Vinent Juanico** en su aplicación Z-Anatomy. La adaptación anatómica de Klisteni se distribuye bajo **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.

- [Resumen y condiciones de CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- [Texto completo de la licencia, incluido con estos archivos](./LICENSE-anatomy.txt).
- [Z-Anatomy: modelos, autores y créditos](https://github.com/Z-Anatomy/Models-of-human-anatomy).
- [Avisos originales de atribución y componentes](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt).
- [Repositorio de la distribución FBX](https://github.com/LluisV/Z-Anatomy/tree/6c7f9016bd5899ac8edafd31b9900c151df42ed6).
- [Licencia de esa distribución](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/LICENSE).

## Fuentes fijadas

Revisión de origen: `6c7f9016bd5899ac8edafd31b9900c151df42ed6`. Los tres sistemas proceden de la misma revisión y comparten coordenadas:

- [MuscularSystem100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/MuscularSystem100.fbx).
- [SkeletalSystem100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/SkeletalSystem100.fbx).
- [Regions of human body100.fbx](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/Regions%20of%20human%20body100.fbx).

## Atribución conservada

Los créditos de Z-Anatomy incluyen estos avisos históricos:

> BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan

> Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0

El [archivo oficial de BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) informa de una actualización a CC BY 4.0 el 27 de febrero de 2025, y solicita el crédito “BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International”. Esa actualización no elimina ShareAlike de las modificaciones de Z-Anatomy usadas aquí: la adaptación se mantiene bajo CC BY-SA 4.0.

## Adaptación y alcance

Klisteni adapta estas fuentes para una visualización educativa en la web. El archivo [anatomy.glb](./anatomy.glb) está acompañado de un [manifiesto de procedencia y optimización](./anatomy-manifest.json) con los SHA-256 de las descargas, coordenadas, recuentos y cambios. La adaptación comprende:

- Selección de estructuras; retirada de marcadores, geometría auxiliar, fascias, bursas, vainas y huesecillos auditivos.
- Conservación de las caras exteriores originales de la superficie corporal y retirada de sus caras internas de cierre `Skin-in`.
- Conversión FBX a GLB y transformación global común de los tres sistemas: altura de visualización de 1,80 m, suelo en el origen y eje vertical de glTF. La altura es una normalización gráfica, no la talla de la persona usuaria.
- Reducción adaptativa de polígonos en músculos y huesos; conservación de la superficie exterior sin decimación.
- Colores de visualización de tejidos, conservando la distinción de caras de tendón, y organización por grupos educativos.

La superficie exterior procede del mismo atlas que músculos y huesos. No hay ajuste de partes a otro cuerpo mediante escalas independientes. El [archivo de referencias articulares](./rig-landmarks.json) identifica por separado los puntos seleccionados para el movimiento ilustrativo.

Al preparar el modelo en el navegador se comparten pesos de animación entre regiones de piel y se subdividen caras en encuentros coincidentes de borde, conservando las posiciones de referencia. No se rellenan huecos ni se crea una superficie corporal nueva. Los bordes axilares identificados comparten una deformación local sin soldar las pequeñas separaciones de la fuente. El rig añade movimiento educativo de las escápulas para la W y referencias de apoyo calculadas desde la superficie para cabeza y palmas; no representa una simulación de contacto o una validación clínica.

El subconjunto no incorpora los modelos independientes de riñón u oído interno que los créditos de Z-Anatomy identifican con licencias no comerciales. No se incorporan las definiciones ni las traducciones automáticas de Wikipedia distribuidas por el proyecto. La licencia de los datos anatómicos es independiente de la licencia del código de la aplicación.

La superficie muestra regiones corporales; no es una representación histológica de las capas de la piel. El artículo original describe una base TARO de resonancia magnética con intervalos de 2 mm y posteriores segmentaciones y reconstrucciones por ilustradores médicos. Ese espaciado **no es una garantía de precisión de 2 mm del modelo actual**. [Mitsuhashi et al., *BodyParts3D: 3D structure database for anatomical concepts*, DOI 10.1093/nar/gkn613](https://pmc.ncbi.nlm.nih.gov/articles/PMC2686534/).

El detalle anatómico permite estudiar forma y ubicación. Las poses, deformaciones y colores de ejercicio son recursos didácticos de Klisteni: no constituyen una simulación biomecánica validada, una medición de activación muscular ni una evaluación clínica. El modelo no representa las dimensiones de la persona usuaria. No se implica aprobación de Klisteni por los autores originales.

Aviso actualizado el 3 de octubre de 2026.
