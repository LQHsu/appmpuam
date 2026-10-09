import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MercadoPagoService, ResultadoPago } from '../../../core/mercadopago.service';
import { ABONO_MAXIMO, ABONO_MINIMO, WalletService } from '../../../core/wallet.service';

type Fase = 'confirmar' | 'redirigiendo' | 'esperando' | 'exito' | 'error';

/** Segundos de gracia entre que se cierra la pestaña de Mercado Pago y se da el pago por no completado. */
const GRACIA_PESTANA_MS = 2000;

/**
 * Abono al monedero con Mercado Pago:
 * confirmar -> redirigiendo -> esperando (pestaña de Mercado Pago) -> éxito | error.
 */
@Component({
  selector: 'app-abono-dialog',
  imports: [CurrencyPipe],
  templateUrl: './abono-dialog.html',
  styleUrl: './abono-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbonoDialog {
  private readonly mp = inject(MercadoPagoService);
  private readonly wallet = inject(WalletService);
  private readonly injector = inject(Injector);

  readonly saldoActual = input.required<number>();
  readonly cerrar = output<void>();

  protected readonly minimo = ABONO_MINIMO;
  protected readonly maximo = ABONO_MAXIMO;
  protected readonly sugeridos = [50, 100, 200, 500];

  protected readonly fase = signal<Fase>('confirmar');
  protected readonly monto = signal<number | null>(null);
  protected readonly pagoId = signal('');
  protected readonly saldoFinal = signal(0);
  protected readonly falla = signal({ titulo: '', mensaje: '' });

  protected readonly valido = computed(() => {
    const m = this.monto();
    return m !== null && Number.isFinite(m) && m >= ABONO_MINIMO && m <= ABONO_MAXIMO;
  });
  protected readonly saldoNuevo = computed(() =>
    this.valido() ? Math.round((this.saldoActual() + this.monto()!) * 100) / 100 : null,
  );
  protected readonly error = computed(() => {
    const m = this.monto();
    if (m === null || this.valido()) return '';
    return `Ingresa un monto entre $${ABONO_MINIMO} y $${ABONO_MAXIMO}.`;
  });
  /** No se puede cerrar con Esc/fondo mientras hay un pago en curso. */
  protected readonly cerrable = computed(() => ['confirmar', 'exito', 'error'].includes(this.fase()));

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private pestana: Window | null = null;
  private abortador?: AbortController;
  private vigilante?: ReturnType<typeof setInterval>;
  private gracia?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => this.campo()?.nativeElement.focus());
    inject(DestroyRef).onDestroy(() => this.limpiar());
  }

  protected elegir(valor: number): void {
    this.monto.set(valor);
  }

  protected escribir(event: Event): void {
    const texto = (event.target as HTMLInputElement).value;
    this.monto.set(texto === '' ? null : Number(texto));
  }

  /** Paso 1: el usuario confirma y pasa a Mercado Pago. */
  protected async pagar(): Promise<void> {
    if (!this.valido()) return;
    const monto = this.monto()!;

    // La pestaña se abre en el mismo clic; si se abriera después de esperar al
    // servidor, el navegador la bloquearía como ventana emergente.
    const pestana = window.open('about:blank', '_blank');
    if (!pestana) {
      this.fallar(
        'Pestaña bloqueada',
        'El navegador bloqueó la pestaña de Mercado Pago. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.',
      );
      return;
    }
    this.pestana = pestana;
    this.abortador = new AbortController();
    const { signal: señal } = this.abortador;
    this.fase.set('redirigiendo');

    try {
      // Paso 2: pantalla "Redirigiendo a Mercado Pago…"
      const preferencia = await this.mp.crearPreferencia(monto);
      if (señal.aborted) {
        this.cerrarPestana();
        return;
      }
      pestana.location.href = preferencia.initPoint;

      // Paso 3: pantalla "Completa el pago en la pestaña de Mercado Pago"
      this.fase.set('esperando');
      this.vigilarPestana(pestana);
      const resultado = await this.mp.esperarResultado(preferencia.preferenceId, señal);
      this.resolver(resultado, monto);
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      this.cerrarPestana();
      this.fallar('No se pudo iniciar el pago', 'Ocurrió un problema al conectar con Mercado Pago. No se realizó ningún cargo.');
    }
  }

  /** Vuelve a mostrar la pestaña de Mercado Pago si el usuario la perdió de vista. */
  protected enfocarPestana(): void {
    if (this.pestana && !this.pestana.closed) this.pestana.focus();
  }

  protected cancelarPago(): void {
    this.cerrarPestana();
    this.limpiar();
    this.cerrar.emit();
  }

  protected reintentar(): void {
    this.limpiar();
    this.fase.set('confirmar');
    afterNextRender(() => this.campo()?.nativeElement.focus(), { injector: this.injector });
  }

  private resolver(resultado: ResultadoPago, monto: number): void {
    this.limpiarVigilante();
    switch (resultado.estado) {
      case 'aprobado':
        this.cerrarPestana();
        this.pagoId.set(resultado.pagoId ?? '');
        this.saldoFinal.set(this.wallet.abonar(monto, 'Abono con Mercado Pago'));
        this.fase.set('exito');
        break;
      case 'rechazado':
        this.cerrarPestana();
        this.fallar(
          'Pago rechazado',
          resultado.motivo ?? 'Mercado Pago no pudo procesar el pago. No se realizó ningún cargo.',
        );
        break;
      case 'expirado':
        this.cerrarPestana();
        this.fallar('Tiempo agotado', 'No recibimos la confirmación del pago a tiempo. Si se hizo algún cargo, se reflejará en tu saldo en unos minutos.');
        break;
      default:
        this.cerrarPestana();
        this.fallar('Pago cancelado', 'Cancelaste el pago en Mercado Pago. No se realizó ningún cargo.');
    }
  }

  private fallar(titulo: string, mensaje: string): void {
    this.limpiar();
    this.falla.set({ titulo, mensaje });
    this.fase.set('error');
  }

  /** Si cierran la pestaña sin terminar, se considera cancelado (con un margen por si el resultado ya viene en camino). */
  private vigilarPestana(pestana: Window): void {
    this.vigilante = setInterval(() => {
      if (!pestana.closed || this.gracia) return;
      this.gracia = setTimeout(() => {
        if (this.fase() !== 'esperando') return;
        this.abortador?.abort();
        this.fallar('Pestaña cerrada', 'Cerraste la pestaña de Mercado Pago antes de terminar. No se realizó ningún cargo.');
      }, GRACIA_PESTANA_MS);
    }, 800);
  }

  private cerrarPestana(): void {
    if (this.pestana && !this.pestana.closed) this.pestana.close();
    this.pestana = null;
  }

  private limpiarVigilante(): void {
    clearInterval(this.vigilante);
    clearTimeout(this.gracia);
    this.vigilante = undefined;
    this.gracia = undefined;
  }

  private limpiar(): void {
    this.limpiarVigilante();
    this.abortador?.abort();
    this.abortador = undefined;
  }

  protected intentarCerrar(): void {
    if (this.cerrable()) this.cerrar.emit();
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.intentarCerrar();
  }
}
