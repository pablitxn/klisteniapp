# Instrucciones para agentes

## Base de conocimiento compartida

Para tareas que necesiten contexto del proyecto —identidad, arquitectura,
estado, fuentes, responsables, decisiones o preguntas abiertas— consulta la base
Atlas aunque el pedido no la mencione. Resuelve `KB_ROOT` desde la raíz Git de
este proyecto usando el mount real de `sysadmin-workspace`; en el layout actual
está en `../sysadmin-workspace`. Verifica que `KB_ROOT` sea la raíz Git de ese
repo y que existan `AGENTS.md`, `atlas/AGENTS.md` y `atlas/catalog/`. Si cambia
el layout, usa el mount declarado y accesible de la sesión; no adivines rutas de
host.

Lee esas instrucciones y la skill pertinente antes de responder o trabajar:

- Para contexto, navegación, fuentes, relaciones, responsables o estado de un
  proyecto, abre `KB_ROOT/.agents/skills/atlas-navigate/SKILL.md`.
- Para una actualización o reconciliación solicitada de la base, abre además
  `KB_ROOT/.agents/skills/atlas-maintain/SKILL.md` y sigue su intake existente.

Si las skills no aparecen en el catálogo nativo, abre y lee esos archivos de
forma explícita; el puntero no incorpora automáticamente su contenido. Que el
repo esté montado junto a este proyecto no garantiza registro nativo. Si falta
acceso, informa el límite sin crear mounts, instalar plugins ni copiar skills.
El alcance de una skill es una instrucción, no un permiso: manda la
autorización concreta del usuario y el acceso disponible. Una solicitud para
actualizar Atlas no autoriza por sí sola cambios en este repo, otros repos,
Notion o runtime.
