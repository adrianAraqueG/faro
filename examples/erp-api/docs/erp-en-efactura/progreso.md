# Progreso: ERP en Efactura en erp-api

## Retomar aquí

- **Estoy en:** pago parcial de facturas de proveedor (verificable 2 del plan).
- **Siguiente paso:** cubrir con pruebas el redondeo cuando el pago deja un saldo de 1 centavo.
- **Ojo con:** `saldo.ts` ya se usa desde `pagos.service.ts`; no recalcular el saldo en ningún otro lugar.
- **Rama / archivos tocados:** `feat/cartera-pago-parcial` · `src/modules/cartera-por-pagar/{pagos.service.ts,saldo.ts}`

## Pendiente de registrar en FARO

Pendiente de registrar en FARO: ¿Un anticipo se aplica a la factura más antigua o a la que elija el usuario? | supuesto: a la más antigua | frente: erp-en-efactura | tarea: Cartera por pagar

## Bitácora

### 2026-11-03 · codex
- Hecho: pago parcial actualiza el saldo; endpoint `POST /cartera/pagos`; pruebas unitarias del cálculo.
- Supuestos tomados: DEC-0001 (anulación con pago parcial: no se permite hasta definir el tratamiento del pago)
- Queda: redondeo en saldos de 1 centavo; documentar el contrato en `docs/api/contrato.md`.

### 2026-11-02 · claude
- Hecho: registro de facturas de proveedor con impuestos; migración de la tabla `facturas_proveedor`.
- Supuestos tomados: ninguno.
- Queda: pagos.
