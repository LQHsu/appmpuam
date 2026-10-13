import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { WalletService } from '../../core/wallet.service';
import { CatalogoPagosService } from '../../core/catalogo-pagos.service';
import { TipoPago } from '../../core/pagos.model';
import { PagosService } from '../../core/pagos.service';
import { PagoDialog } from './pago-dialog/pago-dialog';

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const formatoHora = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const formatoMovimiento = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

@Component({
  selector: 'app-inicio',
  imports: [CurrencyPipe, PagoDialog],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  private readonly auth = inject(AuthService);
  protected readonly wallet = inject(WalletService);
  protected readonly pagos = inject(PagosService);
  protected readonly catalogo = inject(CatalogoPagosService);

  protected readonly usuario = this.auth.usuario;

  protected readonly ahora = signal(new Date());
  protected readonly fecha = computed(() => {
    const texto = formatoFecha.format(this.ahora());
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });
  protected readonly hora = computed(() => formatoHora.format(this.ahora()));

  protected readonly movimientos = computed(() =>
    this.wallet.movimientos().map((m) => ({ ...m, fechaTexto: formatoMovimiento.format(m.fecha) })),
  );

  protected readonly pagosVista = computed(() =>
    this.pagos.pagos().map((p) => ({
      ...p,
      fechaTexto: formatoMovimiento.format(p.fecha),
      icono: this.catalogo.info(p.tipo).icono,
    })),
  );

  protected readonly pestana = signal<'movimientos' | 'pagos'>('movimientos');
  /** Tipo de pago cuyo diálogo está abierto (null = cerrado). */
  protected readonly tipoAbierto = signal<TipoPago | null>(null);

  constructor() {
    const reloj = setInterval(() => this.ahora.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }

  protected abrir(tipo: TipoPago): void {
    this.tipoAbierto.set(tipo);
  }

  protected cerrarPago(): void {
    this.tipoAbierto.set(null);
  }
}
