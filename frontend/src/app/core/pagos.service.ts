import { Injectable, computed, inject, signal } from '@angular/core';
import { CatalogoPagosService } from './catalogo-pagos.service';
import { Area, Pago, TipoPago } from './pagos.model';

export interface NuevoPago {
  tipo: TipoPago;
  concepto: string;
  area: Area;
  referencia: string;
  cuenta?: string;
  monto: number;
  mpPagoId: string;
}

export interface ResumenArea {
  areaId: string;
  nombre: string;
  clave: string;
  cantidad: number;
  total: number;
}

const STORAGE_KEY = 'appmp.pagos';
const DIA = 24 * 60 * 60 * 1000;

/**
 * Historial de pagos SOLO FRONT. Cada pago queda identificado con su tipo,
 * concepto y la coordinación o área que lo recibe, para poder aplicarlo a su
 * presupuesto. Con backend, `registrar()` lo hace el servidor (webhook de
 * Mercado Pago) y la lista viene de GET /api/pagos.
 */
@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly catalogo = inject(CatalogoPagosService);
  private readonly _pagos = signal<Pago[]>(this.cargar());

  /** Del más reciente al más antiguo. */
  readonly pagos = computed(() => [...this._pagos()].sort((a, b) => b.fecha - a.fecha));

  readonly totalPagado = computed(() => this.redondear(this._pagos().reduce((t, p) => t + p.monto, 0)));

  /** Cuánto se ha pagado a cada coordinación o área. */
  readonly resumenPorArea = computed<ResumenArea[]>(() => {
    const mapa = new Map<string, ResumenArea>();
    for (const p of this._pagos()) {
      const actual = mapa.get(p.areaId) ?? {
        areaId: p.areaId,
        nombre: p.areaNombre,
        clave: p.areaClave,
        cantidad: 0,
        total: 0,
      };
      actual.cantidad += 1;
      actual.total = this.redondear(actual.total + p.monto);
      mapa.set(p.areaId, actual);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  });

  registrar(datos: NuevoPago): Pago {
    const id = Math.max(0, ...this._pagos().map((p) => p.id)) + 1;
    const pago: Pago = {
      id,
      folio: this.folio(datos.tipo, id),
      tipo: datos.tipo,
      concepto: datos.concepto,
      areaId: datos.area.id,
      areaNombre: datos.area.nombre,
      areaClave: datos.area.clave,
      referencia: datos.referencia,
      cuenta: datos.cuenta,
      monto: this.redondear(datos.monto),
      fecha: Date.now(),
      mpPagoId: datos.mpPagoId,
    };
    this._pagos.update((lista) => [...lista, pago]);
    this.guardar();
    return pago;
  }

  /** Vuelve a los datos de ejemplo (se usa al cerrar sesión). */
  reiniciar(): void {
    this._pagos.set(this.semilla());
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private folio(tipo: TipoPago, id: number): string {
    const prefijo = this.catalogo.info(tipo).prefijo;
    return `${prefijo}-${new Date().getFullYear()}-${String(id).padStart(6, '0')}`;
  }

  private redondear(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private semilla(): Pago[] {
    const ahora = Date.now();
    const anio = new Date().getFullYear();
    const monedero = this.catalogo.area('monedero')!;
    const educacion = this.catalogo.area('educacion-continua')!;
    return [
      {
        id: 1,
        folio: `ME-${anio}-000001`,
        tipo: 'monedero',
        concepto: 'Abono a monedero electrónico',
        areaId: monedero.id,
        areaNombre: monedero.nombre,
        areaClave: monedero.clave,
        referencia: '',
        monto: 500,
        fecha: ahora - 6 * DIA,
        mpPagoId: 'MP-1000000001',
      },
      {
        id: 2,
        folio: `EC-${anio}-000002`,
        tipo: 'curso',
        concepto: 'Análisis de datos con hojas de cálculo',
        areaId: educacion.id,
        areaNombre: educacion.nombre,
        areaClave: educacion.clave,
        referencia: '12345',
        monto: 1800,
        fecha: ahora - 12 * DIA,
        mpPagoId: 'MP-1000000002',
      },
    ];
  }

  private cargar(): Pago[] {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Pago[];
    } catch {
      /* almacenamiento no disponible o dato corrupto */
    }
    return this.semilla();
  }

  private guardar(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this._pagos()));
    } catch {
      /* almacenamiento no disponible */
    }
  }
}
