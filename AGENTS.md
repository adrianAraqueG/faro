# FARO

Sistema personal de ejecución: frentes, tareas con verificables, decisiones con el PO y revisión semanal. Interfaz React + Vite + Tailwind + shadcn/ui; servidor de datos en Node (`server/*.mjs`).

> Este es el único punto de entrada para agentes de IA. Si tu herramienta lee otro nombre, crea ese archivo con una línea que apunte aquí (Claude Code: `CLAUDE.md` con `@AGENTS.md`).

## Comandos

- Instalar: `pnpm install`
- Desarrollo: `pnpm dev` (servidor + Vite)
- Pruebas del servidor: `pnpm test`
- Lint: `pnpm lint`
- Tipos y build: `pnpm build`

Antes de dar un trabajo por terminado, ejecuta `pnpm lint` y `pnpm build` (y `pnpm test` si tocaste `server/`).

## Reglas

### 1. Respeta el estilo existente

- **Si modificas un archivo**, imita su organización y escritura: orden de imports, nombres, comillas, comentarios, forma de los componentes. No reformatees ni reorganices lo que no estás tocando.
- **Si creas un archivo nuevo**, antes busca uno parecido en el proyecto y úsalo de referencia:
  - Vista nueva → mira otra en `src/views/` (p. ej. `Decisiones.tsx`).
  - Componente de dominio → mira `src/components/faro/`.
  - Lógica de servidor → mira `server/`.
- Los comentarios están en español y explican el *porqué*, no el qué. Mantén ese idioma y ese tono.

### 2. No dupliques: busca antes de crear

Antes de escribir un helper, constante, catálogo o componente, **búscalo** (`Grep`) en estos lugares. Si existe, úsalo; si casi sirve, amplíalo en su sitio; solo si no existe, créalo **ahí** y no inline en la vista.

| Necesitas… | Va / está en |
|---|---|
| Tipos del dominio, catálogos (`STATUSES`, `SCOPES`, `PRIORITIES`…), `slugify`, `iso`, `uid`, `normText`, consultas del árbol de tareas (`childrenOf`, `pathOf`, `progress`…), estado global (`useFaro`) | `src/lib/faro.ts` |
| Unir clases CSS | `cn()` de `src/lib/utils.ts` |
| Formato de fechas y números (`longDate`, `shortDate`, `dateTime`, `num`…) | `src/lib/format.ts` |
| Llamadas al servidor (`api`, `getAgentInstructions`, `publishReader`…) | `src/lib/api.ts` |
| Preferencias de interfaz en `localStorage` | `src/lib/persisted.ts` y `src/lib/menu.ts` |
| Diálogos de confirmación / avisos | `src/lib/dialogs.tsx` |
| Piezas de página (`PageHeader`, `Section`, `Field`, badges por tono) | `src/components/faro/bits.tsx` |
| Primitivas de UI (botón, input, diálogo, tabs…) | `src/components/ui/` (shadcn; no las reescribas, compón sobre ellas) |
| Hooks reutilizables | `src/hooks/` |
| Utilidades solo del servidor | `server/` (módulos `.mjs` existentes) |

Si una función o constante se usa (o se va a usar) en **dos o más** archivos, debe vivir en uno de los lugares de arriba, no copiada.

### 3. Estilos: usa los tokens, no valores sueltos

El diseño está definido en `src/index.css` (variables CSS) y `tailwind.config.js` (los expone como clases). Esas dos son la fuente de verdad.

- **Colores:** solo clases semánticas (`bg-card`, `text-muted-foreground`, `border-border`, y los de FARO: `ink`, `rail`, `beam`, `ok`, `warn`, `danger`, `tide` con su `-soft`). Prohibido hex, `rgb()`, `hsl()` literal o colores crudos de Tailwind (`bg-red-500`, `text-gray-600`). Si falta un color, créalo como variable en `index.css` y regístralo en `tailwind.config.js`.
- **Tipografía:** `font-display` para títulos, `font-sans` para texto, `font-mono` para etiquetas y códigos. La etiqueta pequeña en mayúsculas es la clase `.eyebrow`; las cifras alineadas, `.tnum`.
- **Bordes redondeados:** solo `rounded-sm/md/lg` (derivan de `--radius`). Nada de `rounded-[3px]`.
- **Tamaños de texto:** escala propia en `tailwind.config.js`: `text-micro` (11px), `text-caption` (12), `text-small` (13), `text-body` (15), `text-lead` (17), además de los de Tailwind (`text-sm`, `text-2xl`…). Nada de `text-[15px]`. Si usas una clase nueva de tamaño, regístrala también en `extendTailwindMerge` de `src/lib/utils.ts`, o `cn()` la descartará.
- **Patrones repetidos** (pestañas, rayado, brillo) ya son clases en `index.css` (`.tabs-line`, `.tab-pill`, `.hatch`, `.beam-glow`). Si un patrón de clases se repite 3+ veces, conviértelo en componente o clase ahí, no lo pegues otra vez.
- No uses `style={{ }}` salvo para valores dinámicos que Tailwind no pueda expresar.
- Respeta modo oscuro (`darkMode: class`) y `prefers-reduced-motion`: no animes con duraciones fijas fuera de las animaciones definidas en `tailwind.config.js`.

### 4. Alcance y tamaño

- Haz solo lo que se pidió. Un cambio pequeño no justifica refactorizar archivos vecinos.
- Si un archivo ya es largo (`src/lib/faro.ts`, `Outline.tsx`, `Guia.tsx`), no sigas agregándole: extrae lo nuevo a un módulo propio y deja el original apuntando a él.
- Ninguna vista ni componente llama a `fetch` directamente: toda llamada a `/api/...` es una función en `src/lib/api.ts`. Si necesitas una nueva, agrégala ahí.

### 5. Textos de interfaz

- Todo texto visible al usuario va en **español** y con el tono del resto de la app (directo, sin jerga).
- Fechas y números se formatean con `src/lib/format.ts`, que usa el idioma del navegador. No fuerces un locale (`es-CO`, `en-US`…) en ninguna llamada a `toLocale*` ni `Intl`.
- Los identificadores de código (variables, tipos, claves de objetos) siguen el estilo del archivo; no mezcles idiomas dentro de un mismo archivo.

### 6. Al terminar

- Si añadiste un helper, catálogo o componente compartido, agrégalo a la tabla de la regla 2 en este archivo.
- Si cambiaste un token de diseño, actualízalo en `index.css` **y** `tailwind.config.js` en el mismo cambio.
