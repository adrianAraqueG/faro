# ERP en Efactura en erp-api

## Qué es este frente en este repositorio

El ERP de Efactura es el producto principal. `erp-api` implementa su backend: aquí viven las reglas de
facturación, pagos y cartera. El frontend consume esta API y no calcula saldos por su cuenta.

## Tareas

- **Facturación y gestión de pagos** — facturas de venta y su cobro.
- **Cartera por pagar** — facturas de proveedor, pagos (parciales o totales), anticipos y anulaciones.

## Dónde está el código

- `src/modules/facturas/` — facturas de venta
- `src/modules/cartera-por-pagar/` — facturas de proveedor, pagos y anticipos
- `src/modules/cartera-por-pagar/saldo.ts` — única fuente del cálculo de saldo

## Documentos

- [plan.md](plan.md) — qué hay que implementar y en qué orden
- [progreso.md](progreso.md) — bitácora para retomar el trabajo o cambiar de agente

## Decisiones que condicionan este frente

- `DEC-0001` — anulación de una factura con pago parcial
- `DEC-0003` — aplicación automática de anticipos a proveedores

Estado vigente: `GET /api/agent/decisions?repository=erp-api&front=erp-en-efactura`
