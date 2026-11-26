# Vista del dueño (propuesta)

> **Estado:** idea documentada y con una **demo visual** (pestaña «Mi equipo (demo)»). No está implementada: la demo usa datos de ejemplo y no se conecta con `faro.json` ni con el servidor.

## Contexto y objetivo

Hoy FARO es un sistema **personal** de ejecución: una persona, sus frentes, sus tareas y su día. Esta propuesta amplía su alcance a **dueños de empresa que además son líderes** y necesitan saber qué hace cada uno de sus empleados, sobre todo cuando el trabajo de estos no es repetitivo sino de **gestión** (no se puede medir con un contador de tareas iguales, hay que ver en qué frentes se mueven y cómo).

FARO pasaría de «mi herramienta» a un **sistema de gestión** donde cada empleado lleva su propio trabajo y el dueño lo observa.

## Actores

| Actor | Qué hace | Qué ve |
|---|---|---|
| **Empleado** | Es el FARO actual: planea su día, gestiona frentes, tareas y verificables, cierra el día | Sus propias pantallas (Hoy, Frentes, Decisiones, Semana…) |
| **Dueño** *(nuevo)* | Observa. No gestiona el trabajo de nadie | Todo lo del empleado en **solo lectura**, más **una pantalla adicional**: «Mi equipo» |

## Nueva pantalla: «Mi equipo»

Una cuadrícula de **tarjetas, una por empleado**. Cada tarjeta muestra exactamente tres cosas:

1. **Foto** del empleado.
2. **Nombre**.
3. **Frentes activos**.

Al abrir una tarjeta el dueño entra al detalle del empleado, con tres secciones:

| Sección | Contenido | Equivale en FARO a |
|---|---|---|
| **Plan del día** | Qué planeó hoy, separado en principal y secundario | *Hoy → Qué vamos a hacer* |
| **Frentes y tareas** | Cada frente con su avance y sus tareas (y estado de cada una) | *Frentes* |
| **Historial diario** | Lo logrado cada día y la nota que dejó para el siguiente | *Hoy → Qué logramos* + nota |

El dueño puede revisar tanto las tareas **semanales como las diarias**, y todo el historial de cada empleado.

## Regla principal: solo lectura

El dueño **no puede modificar nada**: ni frentes, ni tareas, ni planes, ni estados, ni notas. Toda la vista del empleado se muestra sin controles de edición (sin «Añadir», sin marcar tareas, sin mover, sin eliminar).

Esto es una decisión de producto, no solo de interfaz: cuando se implemente, **el servidor debe rechazar escrituras del dueño**, no basta con ocultar botones.

## Qué NO es

- No es un reemplazo del trabajo del empleado ni una forma de asignarle tareas (ver «Preguntas abiertas»).
- No mide productividad con puntajes ni rankings. Muestra el trabajo tal como lo registra cada quien.
- No cambia la experiencia del empleado: sigue usando FARO como hoy.

## La demo

| | |
|---|---|
| Dónde | Barra lateral → **Mi equipo (demo)** (`#equipo`). Solo escritorio; usa un ancho máx. de 1560 px |
| Código | [src/views/Equipo.tsx](../src/views/Equipo.tsx) (un archivo) y su registro en `src/App.tsx` |
| Datos | Cuatro empleados de ejemplo definidos en el propio archivo. Fotos: retratos de stock (randomuser.me) guardados en `public/demo/`; sin foto se muestran las iniciales |
| Conexión | Ninguna. No lee ni escribe `faro.json`, no llama al servidor |
| Cómo quitarla | Borrar `Equipo.tsx`, `public/demo/` y las líneas de `App.tsx` que la mencionan (incluido el ancho condicional) |

La demo incluye un empleado sin frentes (estado vacío) y tareas bloqueadas, para ver cómo se ve un equipo real, no solo el caso feliz.

## Qué implicaría hacerla real

Hoy `faro.json` es de **una sola persona** y el servidor corre en su PC. La feature exige cambios de fondo; se listan para dimensionarla, no como diseño cerrado:

1. **Varios usuarios.** Identidad y rol (empleado / dueño) en el modelo de datos. Hoy no existe el concepto de usuario.
2. **Datos por empleado.** Los frentes, tareas y días pasan a pertenecer a un usuario.
3. **Dónde viven los datos.** Hoy: un servidor local por PC. Para que el dueño vea a otros hace falta un servidor central o sincronización. Es la decisión de mayor impacto.
4. **Permisos en el servidor.** Rol dueño = solo `GET`; el resto, rechazado.
5. **Fotos.** Dónde se guardan y quién las sube.
6. **Qué comparte cada empleado con el dueño** (ver preguntas abiertas).

## Preguntas abiertas

- **Privacidad:** ¿el dueño ve *todo* lo del empleado, incluidas decisiones y notas personales, o solo lo que el empleado marca como visible? Un «General» con pendientes personales es el caso incómodo.
- **¿El empleado sabe cuándo lo miran?** Afecta la confianza en la herramienta.
- **Asignar trabajo:** ¿el dueño podrá algún día crear un frente para un empleado? Esta propuesta dice que no; conviene confirmarlo.
- **Más de un dueño / jerarquías:** ¿líderes intermedios que ven a su equipo?
- **«Frente activo»:** definir el criterio (¿tiene tareas en curso? ¿se tocó esta semana?).
- **Datos del plan de la semana:** la pestaña *Semana* (riesgos, siguiente) ¿también es visible para el dueño?
- **Repositorios y agentes de IA:** ¿se muestran al dueño o son solo del empleado?
- **Despliegue:** ¿se mantiene el modelo «vive en tu PC» para el empleado y se sincroniza, o pasa a ser un servicio?
