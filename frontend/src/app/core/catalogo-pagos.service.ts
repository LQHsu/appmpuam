import { Injectable } from '@angular/core';
import { Area, OpcionPago, TipoPago, TipoPagoInfo } from './pagos.model';

/**
 * Catálogos de pagos SOLO FRONT / DE EJEMPLO: los nombres, montos y claves
 * presupuestales son datos de muestra. Cuando exista backend, estas listas
 * vienen de GET /api/catalogos/{areas,cursos,tramites} y el resto no cambia.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoPagosService {
  readonly areas: Area[] = [
    { id: 'monedero', nombre: 'Monedero electrónico', clave: 'CP-001' },
    { id: 'educacion-continua', nombre: 'Coordinación de Educación Continua', clave: 'CP-010' },
    { id: 'servicios-escolares', nombre: 'Coordinación de Servicios Escolares', clave: 'CP-020' },
    { id: 'extension', nombre: 'Coordinación de Extensión Universitaria', clave: 'CP-030' },
    { id: 'biblioteca', nombre: 'Biblioteca', clave: 'CP-040' },
    { id: 'idiomas', nombre: 'Coordinación de Idiomas', clave: 'CP-050' },
  ];

  /** Instancias a las que se puede hacer "otro pago" (todas menos el monedero). */
  readonly areasDestino = this.areas.filter((a) => a.id !== 'monedero');

  readonly tipos: TipoPagoInfo[] = [
    {
      tipo: 'monedero',
      prefijo: 'ME',
      titulo: 'Abono a monedero electrónico',
      accion: 'Realizar abono a monedero',
      descripcion: 'Abona saldo a tu cuenta de dinero electrónico o a la de otra persona de la comunidad.',
      icono: 'wallet2',
      montoMin: 10,
      montoMax: 5000,
    },
    {
      tipo: 'curso',
      prefijo: 'EC',
      titulo: 'Cursos de Educación Continua',
      accion: 'Pagar curso de Educación Continua',
      descripcion: 'Paga tu inscripción a cursos, talleres y diplomados.',
      icono: 'mortarboard',
      montoMin: 100,
      montoMax: 50000,
      referencia: {
        etiqueta: 'Participante (número económico o matrícula)',
        placeholder: 'Ej. 12345',
        obligatoria: true,
      },
    },
    {
      tipo: 'tramite',
      prefijo: 'TT',
      titulo: 'Trámite de título y similares',
      accion: 'Pagar trámite',
      descripcion: 'Pagos de trámites con montos considerables, como titulación o grado.',
      icono: 'award',
      montoMin: 100,
      montoMax: 50000,
      referencia: {
        etiqueta: 'Número de trámite o expediente',
        placeholder: 'Ej. TIT-2026-0456',
        obligatoria: true,
      },
    },
    {
      tipo: 'otro',
      prefijo: 'OP',
      titulo: 'Otro pago a la Unidad',
      accion: 'Realizar otro pago',
      descripcion: 'Paga a cualquier instancia o coordinación de la Unidad.',
      icono: 'building',
      montoMin: 10,
      montoMax: 50000,
      referencia: {
        etiqueta: 'Referencia (opcional)',
        placeholder: 'Ej. folio o número de recibo',
        obligatoria: false,
      },
    },
  ];

  readonly cursos: OpcionPago[] = [
    { id: 'curso-redaccion', nombre: 'Taller de redacción académica', detalle: '20 h · Presencial', areaId: 'educacion-continua', monto: 1200 },
    { id: 'curso-datos', nombre: 'Análisis de datos con hojas de cálculo', detalle: '30 h · En línea', areaId: 'educacion-continua', monto: 1800 },
    { id: 'curso-proyectos', nombre: 'Diplomado en gestión de proyectos', detalle: '120 h · Mixto', areaId: 'educacion-continua', monto: 6500 },
  ];

  readonly tramites: OpcionPago[] = [
    { id: 'tramite-titulo', nombre: 'Trámite de título profesional', detalle: 'Licenciatura', areaId: 'servicios-escolares', monto: 3500 },
    { id: 'tramite-grado', nombre: 'Trámite de grado', detalle: 'Posgrado', areaId: 'servicios-escolares', monto: 4800 },
    { id: 'tramite-otro', nombre: 'Otro trámite similar', detalle: 'Captura el monto indicado por la oficina', areaId: 'servicios-escolares', monto: null },
  ];

  info(tipo: TipoPago): TipoPagoInfo {
    return this.tipos.find((t) => t.tipo === tipo)!;
  }

  area(id: string): Area | undefined {
    return this.areas.find((a) => a.id === id);
  }

  opciones(tipo: TipoPago): OpcionPago[] {
    return tipo === 'curso' ? this.cursos : tipo === 'tramite' ? this.tramites : [];
  }
}
