/** Tipos de pago que se pueden realizar desde la app. */
export type TipoPago = 'monedero' | 'curso' | 'tramite' | 'otro';

/**
 * Coordinación o área de servicio que recibe el pago. Sirve para identificar
 * cada pago y aplicarlo al presupuesto que le corresponde.
 */
export interface Area {
  id: string;
  nombre: string;
  /** Clave presupuestal / centro de costos. */
  clave: string;
}

/** Opción elegible dentro de un tipo de pago (un curso, un trámite). */
export interface OpcionPago {
  id: string;
  nombre: string;
  detalle?: string;
  areaId: string;
  /** `null` = el usuario captura el monto. */
  monto: number | null;
}

export interface TipoPagoInfo {
  tipo: TipoPago;
  /** Prefijo del folio: ME-2026-000001, EC-2026-000002, ... */
  prefijo: string;
  titulo: string;
  /** Texto del encabezado del diálogo. */
  accion: string;
  descripcion: string;
  icono: string;
  montoMin: number;
  montoMax: number;
  referencia?: { etiqueta: string; placeholder: string; obligatoria: boolean };
}

/** Comprobante de un pago aprobado. */
export interface Pago {
  id: number;
  folio: string;
  tipo: TipoPago;
  concepto: string;
  areaId: string;
  areaNombre: string;
  areaClave: string;
  referencia: string;
  /** Cuenta que recibe el abono cuando es de otra persona de la comunidad. */
  cuenta?: string;
  monto: number;
  /** Marca de tiempo en ms. */
  fecha: number;
  /** Folio del pago en Mercado Pago. */
  mpPagoId: string;
}
