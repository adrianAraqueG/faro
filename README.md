# FARO

Sistema personal de ejecución: frentes, tareas con sus verificables, decisiones con el PO y revisión semanal. Vive en tu PC de desarrollo.

## Arrancar

```bash
pnpm install
pnpm start      # compila la interfaz y sirve todo en http://localhost:4317
pnpm dev        # desarrollo: servidor de datos + Vite con recarga en caliente
pnpm test       # pruebas del servidor
```

## Leer un Markdown desde el teléfono por Wi-Fi

En **Utilidades → Lector de markdown**, pega el texto o abre un `.md` y pulsa **Leer en el teléfono**. Escanea el QR o copia el enlace. Ambos dispositivos deben estar en la misma red y el computador debe mantener FARO encendido.

- Se comparte una copia del texto pegado, sin acceso a rutas del disco ni a la base de FARO. No se sube a un servicio externo.
- **Actualizar texto compartido** envía la versión actual al mismo enlace. En el teléfono, **Actualizar contenido** carga esa versión. Abrir otro texto no cambia por sí solo lo que ya compartiste.
- **Revocar enlace** impide nuevas consultas. El enlace también vence a las 24 horas desde su última actualización o al reiniciar el servidor. El texto ya cargado en una pestaña permanece legible aunque se pierda conexión; no se promete lectura offline después de cerrar o recargar la pestaña.
- Si aparecen varias direcciones, selecciona la de tu Wi-Fi. Si no conecta, comprueba que no sea una red de invitados con aislamiento y que Windows permita Node.js en redes privadas. El firewall no se modifica automáticamente.
- El lector usa por defecto el puerto `4318` en las interfaces de red (`FARO_READER_PORT` permite cambiarlo; si cambias `FARO_PORT`, el valor por defecto es ese puerto + 1). La API principal continúa en `127.0.0.1:4317`; el puerto de Wi-Fi solo permite leer documentos mediante un token aleatorio y servir la interfaz de lectura. Quien tenga el enlace puede leer el texto durante su vigencia.
- En desarrollo (`pnpm dev`), ejecuta `pnpm build` para actualizar la interfaz que sirve el puerto móvil; Vite sigue usando recarga en caliente para la interfaz del computador.

## Reuniones

En **Utilidades → Reuniones** escribes libremente mientras estás en una reunión. A diferencia del lector, cada reunión se **guarda en el historial** (dentro de `faro.json`, así que entra en los respaldos y se sincroniza). «Pasar tareas a frentes» con ayuda de la IA es por ahora un botón de prueba: avisa que aún no está desarrollado.

## Datos

Los datos viven en un único `faro.json`, no en el navegador. El servidor local es el único que lo escribe.

| | |
|---|---|
| Carpeta de datos | `~/.faro` (cambia con `FARO_DATA_DIR`) |
| Puerto | `4317` (cambia con `FARO_PORT`) |
| Copias de respaldo | `<carpeta de datos>/backups/`, rotativas (30) |

- Antes de migrar o importar se guarda una copia automática.
- Si editas `faro.json` a mano con FARO encendido, la interfaz lo detecta y se actualiza sola.
- Si `faro.json` está corrupto el servidor **no arranca** (no sobrescribe nada); restaura una copia de `backups/`.
- «Exportar» e «Importar» siguen disponibles; importar acepta respaldos v2, v3 y v4.

## Agentes de IA

Cualquier agente (Claude, Codex u otro) puede consultar y registrar decisiones por el endpoint local, sin plugins:

```bash
curl "http://localhost:4317/api/agent/decisions?repository=erp-api"
```

La pestaña **Guía** de FARO explica cómo configurar un repositorio nuevo (con tu estado de configuración, plantillas, un ejemplo y las convenciones). En **Repositorios** cada repositorio tiene un botón «Instrucciones para agentes» que copia un texto listo para pegar en el `AGENTS.md` del repo. Los agentes proponen; las decisiones se resuelven en FARO. Si FARO está apagado, el texto indica al agente avisar y anotar la decisión pendiente en `docs/<frente>/progreso.md`. Detalle en [docs/diseno-conexion.md](docs/diseno-conexion.md).

## Plantillas y ejemplo

| Carpeta | Contenido |
|---|---|
| `templates/` | `AGENTS.md` para un repo nuevo y `docs/_frente/` con `index.md`, `plan.md` y `progreso.md` |
| `examples/erp-api/` | Un repositorio ya configurado: `AGENTS.md`, `CLAUDE.md` y `docs/erp-en-efactura/` |
| `docs/convenciones.md`, `docs/solucion-problemas.md` | Se muestran dentro de FARO, en la pestaña Guía |

## Diseño

Cómo se conecta FARO con los repositorios y los agentes de IA: [docs/diseno-conexion.md](docs/diseno-conexion.md).

## Propuesta: vista del dueño

FARO como herramienta de gestión para líderes: un dueño que ve, en solo lectura, el día, los frentes y el historial de cada empleado. Está documentada en [docs/vista-dueno.md](docs/vista-dueno.md) y hay una demo (sin datos reales) en la pestaña **Mi equipo (demo)**.
