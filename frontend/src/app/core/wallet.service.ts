import { Injectable, computed, signal } from '@angular/core';

export interface Movimiento {
  id: number;
  tipo: 'abono' | 'consumo';
  concepto: string;
  /** Siempre positivo; el signo lo da `tipo`. */
  monto: number;
  /** Marca de tiempo en ms. */
  fecha: number;
}

export const ABONO_MINIMO = 10;
export const ABONO_MAXIMO = 5000;

const STORAGE_KEY = 'appmp.monedero';
const DIA = 24 * 60 * 60 * 1000;

/**
 * Monedero SOLO FRONT: el saldo se calcula a partir de los movimientos
 * simulados. Cuando exista backend, `abonar()` y la carga inicial pasan a
 * ser llamadas HTTP y el resto de la app no cambia.
 */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly _movimientos = signal<Movimiento[]>(this.cargar());

  /** Del más reciente al más antiguo. */
  readonly movimientos = computed(() => [...this._movimientos()].sort((a, b) => b.fecha - a.fecha));

  readonly saldo = computed(() => this.redondear(this.suma('abono') - this.suma('consumo')));
  readonly totalAbonado = computed(() => this.redondear(this.suma('abono')));
  readonly totalConsumido = computed(() => this.redondear(this.suma('consumo')));

  /** Registra un abono simulado y devuelve el nuevo saldo. */
  abonar(monto: number, concepto = 'Abono a monedero'): number {
    const valor = this.redondear(monto);
    if (!(valor >= ABONO_MINIMO && valor <= ABONO_MAXIMO)) {
      throw new RangeError(`El abono debe estar entre ${ABONO_MINIMO} y ${ABONO_MAXIMO}.`);
    }
    this._movimientos.update((lista) => [
      ...lista,
      {
        id: Math.max(0, ...lista.map((m) => m.id)) + 1,
        tipo: 'abono',
        concepto,
        monto: valor,
        fecha: Date.now(),
      },
    ]);
    this.guardar();
    return this.saldo();
  }

  /** Vuelve a los datos de ejemplo (se usa al cerrar sesión). */
  reiniciar(): void {
    this._movimientos.set(this.semilla());
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private suma(tipo: Movimiento['tipo']): number {
    return this._movimientos()
      .filter((m) => m.tipo === tipo)
      .reduce((total, m) => total + m.monto, 0);
  }

  private redondear(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Datos de ejemplo: terminan en un saldo de $250.50. */
  private semilla(): Movimiento[] {
    const ahora = Date.now();
    return [
      { id: 1, tipo: 'abono', concepto: 'Abono a monedero', monto: 500, fecha: ahora - 6 * DIA },
      { id: 2, tipo: 'consumo', concepto: 'Consumo', monto: 45, fecha: ahora - 5 * DIA },
      { id: 3, tipo: 'consumo', concepto: 'Consumo', monto: 62.5, fecha: ahora - 3 * DIA },
      { id: 4, tipo: 'consumo', concepto: 'Consumo', monto: 42, fecha: ahora - 2 * DIA },
      { id: 5, tipo: 'consumo', concepto: 'Consumo', monto: 100, fecha: ahora - 1 * DIA },
    ];
  }

  private cargar(): Movimiento[] {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Movimiento[];
    } catch {
      /* almacenamiento no disponible o dato corrupto */
    }
    return this.semilla();
  }

  private guardar(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this._movimientos()));
    } catch {
      /* almacenamiento no disponible */
    }
  }
}
