# erp-api

> Instrucciones para agentes de IA (Claude, Codex u otros). Este archivo es el único punto de entrada: si tu
> herramienta lee otro nombre, crea ese archivo con una sola línea que apunte aquí (en Claude Code, `CLAUDE.md`
> con el contenido `@AGENTS.md`).

## Qué es este repositorio

API REST del ERP de facturación electrónica (Efactura): facturas de venta y de proveedor, pagos, cartera y
contabilidad. La consumen el frontend del ERP y los procesos de integración.

## Comandos

- Instalar dependencias: `npm install`
- Ejecutar pruebas: `npm test`
- Levantar en local: `npm run dev`

## Convenciones

- Un módulo por carpeta en `src/modules/<modulo>/` (rutas, servicio, repositorio, pruebas junto al código).
- Los importes se manejan en enteros (centavos); nunca `float`.
- Todo endpoint nuevo actualiza `docs/api/contrato.md`, porque lo lee el equipo de frontend.
- Commits pequeños y en español: `cartera: pago parcial actualiza el saldo`.

## Documentación de desarrollo (`docs/`)

Cada frente de negocio en el que trabaja este repositorio tiene su carpeta `docs/<slug-del-frente>/`:

- `index.md`: qué es el frente aquí y dónde está el código.
- `plan.md`: qué hay que implementar y en qué orden.
- `progreso.md`: bitácora para retomar trabajo o cambiar de agente.

Al empezar a trabajar en un frente lee `index.md` y `progreso.md` (sección «Retomar aquí»). Al terminar la sesión
reescribe «Retomar aquí» y añade una entrada a la bitácora. Si la carpeta no existe, créala copiando las plantillas
de FARO (`templates/docs/_frente/`) y rellena `index.md`.

Las **decisiones de negocio no se documentan aquí**: viven en FARO y en estos archivos solo se mencionan por su código.

<!-- faro:inicio · bloque generado por FARO (GET /api/agent/instructions). Para actualizarlo, reemplaza todo hasta faro:fin. -->
## FARO: decisiones y supuestos

FARO es la fuente de verdad de las decisiones de negocio y corre en http://localhost:4317.
Repositorio en FARO: `erp-api`. Frentes vinculados: `erp-en-efactura` (docs/erp-en-efactura/).

### Antes de desarrollar
1. Consulta lo vigente: `GET http://localhost:4317/api/agent/decisions?repository=erp-api&front=<slug-del-frente>`
   - Respeta los supuestos con `state: "en_supuesto"`.
   - Si una decisión trae `requiresReview`, el PO cambió el supuesto: corrige primero ese código.
2. Lee `docs/<slug-del-frente>/index.md` y `progreso.md` si existen.
   Los slugs válidos salen de `GET http://localhost:4317/api/agent/context?repository=erp-api`.

### Al asumir algo de negocio
Si una regla de negocio no está definida y avanzas con un supuesto provisional, regístralo:

`POST http://localhost:4317/api/agent/decisions` con `Content-Type: application/json`:

```json
{
  "repository": "erp-api",
  "front": "erp-en-efactura",
  "task": "<tarea del frente, opcional>",
  "question": "¿Puede anularse una factura con pago parcial?",
  "context": "<opcional: qué caso originó la duda, qué opciones ves y qué pasa si no se responde>",
  "assumption": "No permitir anulación hasta definir el tratamiento del pago",
  "impact": "alto",
  "origin": "<tu nombre: claude, codex...>",
  "key": "<texto estable que identifique esta duda>"
}
```

- 201 = registrada: usa el `code` devuelto (p. ej. `DEC-0007`). 200 con `duplicate: true` = ya existía.
- 422 = ambigua o desconocida: elige una entrada de `options` y reintenta; si ninguna aplica, pregunta al usuario.
- `front` es obligatorio si el repositorio trabaja en varios frentes (o en ninguno todavía); `task` es opcional.
- `impact` es qué tan grave sería equivocarse (dinero, contabilidad, datos, permisos = alto).
- `context` es opcional pero ayuda al PO a responder: qué caso originó la duda, qué opciones ves y qué pasaría si no se resuelve.
- Sin `assumption` la decisión queda abierta (bloquea); con `assumption` queda en supuesto.
- No resuelvas decisiones: las resuelve el usuario en FARO, con el PO.
- El cuerpo debe ir en **UTF-8**; si no, FARO responde 400 en vez de guardar acentos rotos. En Windows guarda el JSON en un archivo UTF-8 y usa `curl.exe --data-binary @archivo.json`; con PowerShell 5.1 envía bytes UTF-8 (`-Body ([Text.Encoding]::UTF8.GetBytes($json))`).

### En el código y los docs
- Menciona la decisión solo por su código (`DEC-0007`); nunca copies su estado.
- `docs/<slug>/progreso.md` es tu bitácora de desarrollo (retomar trabajo, cambiar de agente); no afirmes ahí qué está verificado.

### Si FARO está apagado (conexión rechazada)
Avisa al usuario de inmediato. Anota en `docs/<slug>/progreso.md` una línea
`Pendiente de registrar en FARO: <pregunta> | supuesto: <supuesto>` y continúa; el usuario la registrará.
Si se desarrolla a mano, la decisión también se registra a mano en FARO.
<!-- faro:fin -->
