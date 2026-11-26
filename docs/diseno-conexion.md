# Conexión de FARO con repositorios y agentes

Estado: diseño acordado e implementado (fases 1 a 5). FARO vive en la PC de desarrollo y es la **fuente de verdad** de decisiones, tareas y verificables. Los repositorios guardan documentación de desarrollo, no el estado de FARO.

## Vocabulario

| Término | Qué es | En los datos (`faro.json`) |
|---|---|---|
| **Frente** | Una gran área de trabajo: `Contabilidad`, `ERP en Efactura`, `General` | `fronts` |
| **Tarea** | Un trabajo dentro de un frente (antes «capacidad») | `tasks` |
| **Verificable** | Resultado pequeño y comprobable de una tarea (antes «entregable») | `verifiables` |
| **Repositorio** | Dónde vive el código (antes «proyecto») | `projects` |
| **Decisión** | Duda de negocio con su supuesto y estado, `DEC-0001` | `decisions` |

Jerarquía: **Frente → Tarea → Verificable**. Una tarea sin verificables es un pendiente simple (`done`). **General** es el frente de las tareas sueltas; siempre existe.

Los nombres de la API de agentes siguen el vocabulario nuevo (`repository`, `front`, `task`); `project` y `capability` se aceptan como alias.

## Principios

1. **FARO es la fuente de verdad** de decisiones, tareas, verificables y su estado.
2. **Los docs del repo son de desarrollo.** `progreso.md` sirve para retomar trabajo y cambiar entre agentes. No afirma qué está verificado.
3. **Los agentes proponen, la persona resuelve.** Un agente registra y consulta decisiones; resolverlas ocurre en FARO, en la conversación con el PO.
4. **Agnóstico al agente.** El contrato es un endpoint HTTP local más texto plano en `AGENTS.md`. Sin skills ni plugins específicos.
5. **Sin segunda fuente.** Los docs mencionan decisiones solo por su código (`DEC-0007`), nunca copian el estado.

## Persistencia

- Un único `faro.json` en una carpeta de datos fuera del código (`FARO_DATA_DIR`, por defecto `~/.faro`).
- Un servidor local es el único que lee y escribe el archivo. El navegador no guarda datos.
- Escritura atómica (archivo temporal y renombrado) y copias de respaldo rotativas. No hay historial con git.
- Control de concurrencia por revisión: si el dato cambió (otra pestaña, un agente, edición manual), el cliente se recarga en vez de pisarlo.
- El esquema lleva versión y una cadena de migraciones. Antes de migrar se hace una copia.
- Si una pestaña abierta tiene una interfaz de una versión anterior al esquema del servidor, muestra «FARO se actualizó» y pide recargar, en vez de romperse.

## Frente, repositorio y su cruce

- **Frente** = área de trabajo. **Repositorio** = dónde vive el código. Son ejes independientes.
- Cada frente tiene un `slug` estable (nombre de carpeta). Renombrar el frente en pantalla no cambia el `slug`.
- En cada repositorio, `docs/<slug-del-frente>/` contiene `index.md`, el plan, `progreso.md`, etc. Esa carpeta materializa el vínculo repositorio × frente.
- FARO guarda el **vínculo** (repositorio, frente). Se crea la primera vez que se registra algo de ese par (un verificable con repositorio o una decisión) o a mano desde «Repositorios». No se puede desvincular mientras haya verificables o decisiones que lo usen.
- Cada decisión pertenece a un **frente** y, opcionalmente, a una **tarea** de ese frente; aparte lleva los repositorios afectados (uno principal). Cada verificable puede tener su repositorio.
- FARO no lee los `.md` de los repos por ahora; solo enlaza a `docs/<slug>/`.

## Esquema (v5)

Evolución: v3 añadió `projects`, `links`, `counters.decision`, el `slug` de los frentes y el `code` de las decisiones; v4, el ciclo de vida de las decisiones y la marca `needsReview`; v5, el vocabulario actual.

- **Frente:** `{ id, name, slug }`.
- **Tarea:** `{ id, frontId, name, done }`.
- **Verificable:** `{ id, taskId, title, scope, state, priority, evidence, decisionId, checks, projectId, needsReview, … }`.
- **Decisión:** `{ id, code, question, context, assumption, impact, state, outcome, resolution, frontId, taskId, projectIds[], log[], origin?, key? }`.
- **Migración v4 → v5:** `caps` → `tasks`, `tasks` → `verifiables` (`capId` → `taskId`); las decisiones toman su `frontId` de su antigua capacidad, o pasan a «General» si no tenían; aparece el frente «General». Una instalación sin uso (solo los datos por defecto) estrena los frentes `General`, `Contabilidad` y `ERP en Efactura`; si ya hay algo, no se tocan los frentes existentes.

## Ciclo de vida de la decisión

Tres estados: **abierta** (duda sin supuesto), **en supuesto** (el código ya depende de él) y **resuelta**. Al resolver desde «en supuesto» se elige el resultado:

- **Confirma el supuesto:** solo se cierra.
- **Cambia el supuesto:** los verificables ligados quedan marcados «requiere revisión» hasta que se revisan.

Cada decisión guarda un registro de cambios de estado con fecha.

- Una decisión **bloquea el trabajo solo si está «abierta»** (sin supuesto). Con un supuesto vigente, los verificables ligados avanzan y se muestran como «avanza con supuesto».
- Al **cambiar** el supuesto se marcan `needsReview` los verificables ligados en estado `curso`, `tecnico`, `po` o `aceptado`. Los `lista` y `bloqueado` no se marcan porque aún no se construyeron sobre el supuesto.
- Los verificables marcados muestran «requiere revisión» en «Frentes» (y en la barra lateral) y siguen marcados hasta pulsar «Marcar revisado».
- Reabrir una decisión no quita las marcas de revisión ya puestas.

## Endpoint local

JSON sobre HTTP en `http://localhost:4317` (solo `127.0.0.1`, sin token por ahora). Los agentes **proponen y consultan**; resolver decisiones es de la persona, en la interfaz.

| Método y ruta | Para qué |
|---|---|
| `GET /api/agent/context[?repository=]` | Frentes (con `slug`, `docs/<slug>/` y sus tareas), repositorios y sus frentes vinculados |
| `GET /api/agent/decisions[?repository=&front=&state=]` | Consulta. Por defecto lo **vigente**: abiertas, en supuesto y las cambiadas por el PO que aún tienen verificables por revisar (`requiresReview`). `state`: `vigentes` (por defecto), `todas`, `abierta`, `en_supuesto`, `resuelta` |
| `POST /api/agent/decisions` | Registra una decisión |
| `GET /api/agent/instructions[?repository=]` | Texto en markdown para pegar en `AGENTS.md`, con el repositorio y sus frentes rellenados |

Registro (`POST`): `repository` (obligatorio), `question` (obligatorio), `context` (opcional: por qué surge la duda, opciones, qué pasa si no se responde), `front`, `task`, `assumption`, `impact` (`alto | medio | bajo`, por defecto `medio`), `other_repositories[]`, `origin` (quién la registra) y `key` (identificador estable de la duda).

- **Frente y tarea.** El frente se indica o se infiere cuando el repositorio está vinculado a uno solo. Si hay ambigüedad (varios frentes, o ninguno todavía) o el nombre no existe, la respuesta es **422** con `options` (frente y `frontSlug`) y un `hint`; el agente elige una o pregunta al usuario. La tarea es opcional, pero si se indica debe existir en ese frente (si no, 422 con las tareas del frente). Los agentes no crean repositorios, frentes ni tareas.
- **Estado inicial.** Con `assumption` queda «en supuesto»; sin ella, «abierta» (bloquea).
- **Anti-duplicados.** La misma `key` devuelve la decisión existente (200, `duplicate: true`) sin escribir. Sin `key`, se compara la pregunta normalizada contra las abiertas del mismo repositorio principal. Una decisión ya resuelta no cuenta: repetir la pregunta crea una nueva.
- **Vínculos.** El vínculo repositorio × frente se crea al registrar.
- **Codificación.** El cuerpo debe ser UTF-8 estricto. Si no (p. ej. `Invoke-RestMethod` con un string en PowerShell 5.1), responde **400** con el modo de enviarlo bien, en vez de guardar acentos corruptos.
- **Códigos:** 201 registrada · 200 duplicada o consulta · 400 petición inválida · 422 ambigua o desconocida (con `options`).
- Cada decisión registrada guarda `origin` y `key` y una entrada de log «Registrada por <origin>».

## Reglas para el agente (`AGENTS.md`, con botón «copiar instrucciones» en FARO)

1. Antes de desarrollar: consultar las decisiones del repositorio y frente, y leer `docs/<slug>/index.md` y `progreso.md`.
2. Al asumir algo: registrarlo en FARO y dejar solo su código en los docs.
3. Si FARO está apagado: avisar al usuario de inmediato y anotar en `progreso.md` «pendiente de registrar en FARO», para no perderlo al cambiar de agente.
4. Si se desarrolla a mano, la decisión se registra a mano en FARO.

## Fases

1. **Servidor y JSON v3.** FARO sirve la interfaz y guarda en el JSON, con migración desde v2. ✅
2. **Repositorios, vínculos y ciclo de vida.** Vista «Repositorios» (con sus frentes y lo pendiente por frente), filtros por estado, frente y repositorio en «Dudas y decisiones», marca «requiere revisión». ✅
3. **Endpoint, contexto e instrucciones.** `GET context/decisions/instructions`, `POST decisions`, botón «Instrucciones para agentes» por repositorio y origen visible en cada decisión. ✅
4. **Guía y plantillas.** Pestaña **Guía** en FARO (setup con estado real, ejemplo de repositorio conectado, convenciones y solución de problemas), plantillas en `templates/` y ejemplo en `examples/erp-api/`. El bloque de FARO en `AGENTS.md` va entre marcadores `faro:inicio` y `faro:fin` para poder reemplazarlo. ✅
5. **Frente → Tarea → Verificable.** Pantalla «Frentes» con desplegables y un único botón «Añadir» (frente o tarea; los verificables se crean dentro de la tarea), frente «General» para tareas sueltas, y «Proyectos» pasa a llamarse «Repositorios». ✅
