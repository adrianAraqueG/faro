## Cómo se organiza el trabajo en FARO

Tres niveles, de mayor a menor:

| Nivel | Qué es | Ejemplo |
|---|---|---|
| **Frente** | Una gran área de trabajo | `Contabilidad`, `ERP en Efactura`, `General` |
| **Tarea** | Un trabajo dentro de un frente | `Cartera por pagar` |
| **Verificable** | Un resultado pequeño y comprobable de una tarea | `Pago parcial actualiza el saldo` |

- **`General`** es el frente de las tareas sueltas: pendientes que no son de desarrollo, o que no pertenecen a un frente en particular. Siempre existe y no se puede eliminar.
- Una **tarea sin verificables** es un pendiente simple: se marca como hecha y ya. Si quieres comprobar resultados concretos, añádele verificables.
- Todo se añade desde el botón **Añadir** de la pestaña *Frentes*, que pregunta si quieres un frente o una tarea. Los verificables se crean dentro de la tarea.
- Un **repositorio** es donde vive el código (`erp-api`). No es un nivel de la jerarquía: se cruza con los frentes (ver más abajo).

## Quién guarda qué

Para no tener dos verdades, cada cosa vive en un solo sitio:

| Dónde | Qué guarda |
|---|---|
| **FARO** | Decisiones y su estado, tareas, verificables y si están verificados o aceptados. Es la única fuente de verdad |
| **El repositorio** (`docs/`) | Cómo se desarrolla: plan, bitácora y dónde está el código. Las decisiones se mencionan solo por su código (`DEC-0007`) |

## La carpeta `docs/` de cada repositorio

Cada frente en el que trabaja un repositorio tiene su carpeta **`docs/<slug-del-frente>/`**. El *slug* es el que FARO muestra junto al frente (en la pestaña *Frentes*) y no cambia aunque renombres el frente. La carpeta existe porque el repositorio trabaja en ese frente: es la forma de materializar el cruce repositorio × frente.

| Archivo | Para qué | Quién lo escribe y cómo |
|---|---|---|
| `index.md` | Qué es el frente en este repositorio, sus tareas y dónde está el código | Tú o el agente, al crear la carpeta; se edita poco |
| `plan.md` | Qué hay que implementar y en qué orden | Tú o el agente; una lista numerada de verificables por tarea, **sin casillas de avance** |
| `progreso.md` | Bitácora para retomar trabajo o cambiar de agente | El agente al terminar cada sesión. «Retomar aquí» se **reescribe**; la bitácora solo se **añade** (lo más reciente arriba) |

**No va en `docs/`:** el estado de las decisiones, ni afirmaciones de que algo está «verificado» o «aceptado». Eso solo se dice en FARO.

## Nombres

- **Repositorio:** el mismo nombre en FARO y en `AGENTS.md` (`erp-api`). Es lo que los agentes envían como `repository`.
- **Frente:** el nombre de negocio (`ERP en Efactura`); su carpeta usa el slug (`erp-en-efactura`).
- **Tarea:** lo que se hace dentro del frente (`Cartera por pagar`).
- **Decisión:** código global y secuencial (`DEC-0001`, `DEC-0002`…), asignado por FARO. Es lo único que se escribe en el código y en los docs. Pertenece a un frente y, si quieres, a una tarea de ese frente.

## Decisiones y supuestos

- **Abierta:** hay una duda y no hay supuesto con el que avanzar. **Bloquea** el trabajo ligado.
- **En supuesto:** se avanza con un supuesto provisional. El trabajo continúa.
- **Resuelta:** el PO respondió. Si estaba en supuesto, se elige si **confirma** (solo se cierra) o **cambia** el supuesto; al cambiarlo, los verificables ya construidos quedan marcados «requiere revisión».
- **En FARO**, la lista de *Dudas y decisiones* muestra un resumen de cada decisión (pregunta, supuesto, estado, dominio). Al hacer clic se abre su ficha: ahí se editan la pregunta, el contexto, el supuesto, el impacto y el dominio, y están el historial, las tareas afectadas, reabrir y eliminar.
- **Los agentes proponen, tú resuelves.** Un agente registra y consulta; resolver ocurre en FARO, en la conversación con el PO.
- **`context`** (opcional) explica la pregunta: qué caso la originó, qué opciones se ven y qué pasa si no se resuelve. Quien la lee (tú o el PO) no tiene que reconstruirlo.
- **`impact`** es lo grave que sería equivocarse: dinero, contabilidad, integridad de datos o permisos = `alto`.
- **`key`** es un texto estable que identifica la duda; evita duplicados si el agente reintenta.
- **En el código**, marca el lugar con el código, sin explicar el estado: `// DEC-0001`.

## Repositorios y frentes (N:N)

- Un repositorio puede trabajar en varios frentes, y un frente puede estar en varios repositorios.
- No se declara de antemano: el vínculo nace al registrar algo del par, o a mano en *Repositorios* > *Vincular un frente*.
- Si un repositorio tiene varios frentes (o ninguno todavía), el agente debe indicar el **frente** al registrar; si falta, FARO responde con las opciones. La **tarea** es opcional.

## Verificables

- Un **resultado pequeño y comprobable**, no un módulo entero («Pago parcial actualiza el saldo»).
- Se marcan como verificados **solo en FARO**, con sus 5 criterios.
- «Verificado» no significa «aceptado por negocio».

## Archivos de instrucciones para agentes

- **`AGENTS.md`** es el único punto de entrada, para cualquier agente.
- Si una herramienta lee otro nombre, ese archivo tiene una sola línea que apunta a `AGENTS.md`. En Claude Code: `CLAUDE.md` con `@AGENTS.md`.
- El bloque de FARO va entre `<!-- faro:inicio -->` y `<!-- faro:fin -->`. Para actualizarlo, copia de nuevo las instrucciones desde *Repositorios* y **reemplaza el bloque entero**; no lo edites a mano.

## Plataforma y codificación

- Las peticiones al endpoint van en **UTF-8**; si no, FARO responde 400 en vez de guardar acentos rotos.
- En Windows usa `curl.exe` (no `curl`, que en PowerShell es un alias) con `--data-binary "@archivo.json"`.
- Los nombres anteriores del endpoint (`project`, `capability`) siguen funcionando, pero los agentes deben usar `repository`, `front` y `task`.

## Si FARO está apagado

El agente **avisa de inmediato** y anota en `docs/<slug>/progreso.md` una línea `Pendiente de registrar en FARO: <pregunta> | supuesto: <supuesto>`. Tú la registras cuando FARO vuelva y borras la línea. Si desarrollas a mano, registras tus dudas y supuestos tú mismo en *Dudas y decisiones* > *Registrar duda*.
