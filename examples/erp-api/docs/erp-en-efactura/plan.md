# Plan: ERP en Efactura en erp-api

## Objetivo

Que cartera por pagar registre facturas de proveedor, aplique pagos parciales y anticipos y mantenga el saldo
correcto, con un contrato de API que el frontend pueda consumir.

## Fuera de alcance

- Conciliación bancaria.
- Retenciones e información exógena (es otro frente).

## Tareas y verificables

### Cartera por pagar

1. Registrar una factura de proveedor con sus impuestos
2. Pago parcial actualiza el saldo correctamente
3. Un pago mayor al saldo se rechaza con un error claro
4. Anticipo a proveedor se aplica a una factura
5. Anular una factura con pago parcial
6. Contrato de API de cartera por pagar documentado en `docs/api/contrato.md`

## Supuestos vigentes

- `DEC-0001` — anulación de una factura con pago parcial (el verificable 5 depende de esto)
- `DEC-0003` — aplicación automática de anticipos (el verificable 4 depende de esto)

## Riesgos y dependencias

- El verificable 5 toca dinero y contabilidad: no consolidar la regla hasta que el PO responda `DEC-0001`.
- El cálculo de saldo debe quedar en un solo lugar (`saldo.ts`) para que el frontend no lo duplique.
