## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| «Conexión rechazada» al llamar a FARO | FARO está apagado: `pnpm start`. El agente debe avisarte y anotar `Pendiente de registrar en FARO: …` en `progreso.md`; regístralo tú cuando vuelva |
| `422` con `options` | Repositorio, frente o tarea ambiguos o desconocidos. El agente elige una opción; si no existe, créalo en FARO (*Repositorios* o *Frentes*) |
| `400` «no es UTF-8» | El cliente mandó los acentos en otra codificación (típico en PowerShell 5.1). Usa `curl.exe --data-binary "@archivo.json"` con el JSON guardado en UTF-8 |
| `200` con `duplicate: true` | Ya estaba registrada (misma `key`, o misma pregunta abierta en el mismo repositorio). Usa el `code` devuelto |
| La decisión no aparece en FARO | Espera unos segundos (la pantalla se actualiza sola). Si sigue sin aparecer, prueba la conexión en el paso 4 de *Setup* y revisa que el agente recibió un `201` |
| El agente no consulta FARO | Comprueba que lee `AGENTS.md` (y que existe `CLAUDE.md` si usas Claude Code) y que el bloque de FARO está completo entre los marcadores |
| Cambiaste el puerto (`FARO_PORT`) | Copia de nuevo las instrucciones y reemplaza el bloque entre los marcadores en cada repo |
| «El puerto 4317 ya está en uso» | Ya hay un FARO corriendo, o define otro `FARO_PORT` |
| «FARO no está encendido» en la interfaz | El servidor local no responde; inícialo con `pnpm start` y pulsa *Reintentar* |
| El repositorio sale sin frentes en las instrucciones | Aún no está vinculado: *Repositorios* > *Vincular un frente*, y vuelve a copiar las instrucciones |

## Lo que no conviene hacer

- Copiar el **estado** de una decisión al repo: se desactualiza. Solo el código.
- Marcar algo como «verificado» en `progreso.md` o `plan.md`: eso solo vive en FARO.
- Editar `~/.faro/faro.json` a mano con FARO encendido sin necesidad (se detecta y recarga, pero un guardado simultáneo puede pisarlo).
- Dejar que un agente resuelva decisiones: los agentes proponen, la persona resuelve.
