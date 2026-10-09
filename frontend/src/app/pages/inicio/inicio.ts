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
import { AbonoDialog } from './abono-dialog/abono-dialog';

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
  imports: [CurrencyPipe, AbonoDialog],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  private readonly auth = inject(AuthService);
  protected readonly wallet = inject(WalletService);

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

  protected readonly dialogoAbierto = signal(false);

  constructor() {
    const reloj = setInterval(() => this.ahora.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }

  protected abrirAbono(): void {
    this.dialogoAbierto.set(true);
  }

  protected cerrarAbono(): void {
    this.dialogoAbierto.set(false);
  }
}
