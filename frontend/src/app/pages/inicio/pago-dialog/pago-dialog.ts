import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { CatalogoPagosService } from '../../../core/catalogo-pagos.service';
import { MercadoPagoService, ResultadoPago } from '../../../core/mercadopago.service';
import { Area, Pago, TipoPago } from '../../../core/pagos.model';
import { PagosService } from '../../../core/pagos.service';
import { WalletService } from '../../../core/wallet.service';

type Fase = 'confirmar' | 'redirigiendo' | 'esperando' | 'exito' | 'error';

/** Lo que se está pagando; se congela al pulsar "Pagar" para que la pantalla de espera no dependa del formulario. */
interface PagoPendiente {
  tipo: TipoPago;
  concepto: string;
  area: Area;
  referencia: string;
  cuenta?: string;
  monto: number;
  aMiMonedero: boolean;
}

/** Segundos de gracia entre que se cierra la pestaña de Mercado Pago y se da el pago por no completado. */
const GRACIA_PESTANA_MS = 2000;

const pesos = (n: number) => '$' + n.toLocaleString('es-MX');

/**
 * Pago con Mercado Pago (abono a monedero, curso, trámite u otro pago):
 * confirmar -> redirigiendo -> esperando (pestaña de Mercado Pago) -> éxito | error.
 * Cada pago queda identificado con la coordinación o área que lo recibe.
 */
@Component({
  selector: 'app-pago-dialog',
  imports: [CurrencyPipe],
  templateUrl: './pago-dialog.html',
  styleUrl: './pago-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagoDialog implements OnInit {
  private readonly mp = inject(MercadoPagoService);
  private readonly wallet = inject(WalletService);
  private readonly pagos = inject(PagosService);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  protected readonly catalogo = inject(CatalogoPagosService);

  readonly tipo = input.required<TipoPago>();
  readonly saldoActual = input.required<number>();
  readonly cerrar = output<void>();

  protected readonly info = computed(() => this.catalogo.info(this.tipo()));
  protected readonly opciones = computed(() => this.catalogo.opciones(this.tipo()));
  protected readonly sugeridos = [50, 100, 200, 500];

  // ── Formulario ──
  protected readonly destino = signal<'propia' | 'otra'>('propia');
  protected readonly cuenta = signal('');
  protected readonly opcionId = signal('');
  protected readonly areaId = signal('');
  protected readonly concepto = signal('');
  protected readonly referencia = signal('');
  protected readonly montoLibre = signal<number | null>(null);
  protected readonly intentado = signal(false);

  protected readonly opcion = computed(() => this.opciones().find((o) => o.id === this.opcionId()));
  protected readonly usaMontoLibre = computed(() => {
    const t = this.tipo();
    return t === 'monedero' || t === 'otro' || (t === 'tramite' && this.opcion()?.monto === null);
  });
  protected readonly monto = computed<number | null>(() =>
    this.usaMontoLibre() ? this.montoLibre() : (this.opcion()?.monto ?? null),
  );

  protected readonly area = computed<Area | undefined>(() => {
    switch (this.tipo()) {
      case 'monedero':
        return this.catalogo.area('monedero');
      case 'otro':
        return this.catalogo.area(this.areaId());
      default: {
        const o = this.opcion();
        return o ? this.catalogo.area(o.areaId) : undefined;
      }
    }
  });

  protected readonly conceptoFinal = computed(() => {
    switch (this.tipo()) {
      case 'monedero':
        return this.destino() === 'otra' && this.cuenta().trim()
          ? `Abono a monedero electrónico (cuenta ${this.cuenta().trim()})`
          : 'Abono a monedero electrónico';
      case 'otro':
        return this.concepto().trim();
      default:
        return this.opcion()?.nombre ?? '';
    }
  });

  protected readonly errores = computed<Record<string, string>>(() => {
    const e: Record<string, string> = {};
    const info = this.info();
    const tipo = this.tipo();

    if (tipo === 'monedero' && this.destino() === 'otra') {
      const c = this.cuenta().trim();
      if (c.length < 4 || c.length > 20) {
        e['cuenta'] = 'Ingresa el número económico o la matrícula de la cuenta (4 a 20 caracteres).';
      }
    }
    if ((tipo === 'curso' || tipo === 'tramite') && !this.opcion()) {
      e['opcion'] = 'Selecciona una opción.';
    }
    if (tipo === 'otro') {
      if (!this.area()) e['area'] = 'Selecciona la instancia que recibe el pago.';
      if (this.concepto().trim().length < 3) e['concepto'] = 'Describe el concepto del pago (mínimo 3 caracteres).';
    }
    if (this.usaMontoLibre()) {
      const m = this.montoLibre();
      if (m === null || !Number.isFinite(m) || m < info.montoMin || m > info.montoMax) {
        e['monto'] = `Ingresa un monto entre ${pesos(info.montoMin)} y ${pesos(info.montoMax)}.`;
      }
    }
    if (info.referencia?.obligatoria && this.referencia().trim().length < 3) {
      e['referencia'] = `${info.referencia.etiqueta}: este dato es obligatorio.`;
    }
    return e;
  });
  protected readonly valido = computed(() => Object.keys(this.errores()).length === 0);

  protected readonly aMiMonedero = computed(() => this.tipo() === 'monedero' && this.destino() === 'propia');
  protected readonly saldoNuevo = computed(() => {
    const m = this.monto();
    return this.aMiMonedero() && m !== null && !this.errores()['monto']
      ? Math.round((this.saldoActual() + m) * 100) / 100
      : null;
  });

  // ── Flujo de pago ──
  protected readonly fase = signal<Fase>('confirmar');
  protected readonly pendiente = signal<PagoPendiente | null>(null);
  protected readonly comprobante = signal<Pago | null>(null);
  protected readonly saldoFinal = signal(0);
  protected readonly falla = signal({ titulo: '', mensaje: '' });
  /** No se puede cerrar con Esc/fondo mientras hay un pago en curso. */
  protected readonly cerrable = computed(() => ['confirmar', 'exito', 'error'].includes(this.fase()));

  protected readonly fechaComprobante = computed(() => {
    const p = this.comprobante();
    return p
      ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short', hour12: false }).format(p.fecha)
      : '';
  });

  private readonly primero = viewChild<ElementRef<HTMLElement>>('primero');
  private pestana: Window | null = null;
  private abortador?: AbortController;
  private vigilante?: ReturnType<typeof setInterval>;
  private gracia?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => this.primero()?.nativeElement.focus());
    inject(DestroyRef).onDestroy(() => this.limpiar());
  }

  ngOnInit(): void {
    // En cursos, el participante es por defecto quien tiene la sesión iniciada.
    if (this.tipo() === 'curso') this.referencia.set(this.auth.usuario()?.numeroEconomico ?? '');
  }

  // ── Eventos del formulario ──
  protected alTexto(campo: 'cuenta' | 'concepto' | 'referencia', event: Event): void {
    this[campo].set((event.target as HTMLInputElement).value);
  }

  protected alMonto(event: Event): void {
    const texto = (event.target as HTMLInputElement).value;
    this.montoLibre.set(texto === '' ? null : Number(texto));
  }

  protected alElegir(campo: 'opcionId' | 'areaId', event: Event): void {
    this[campo].set((event.target as HTMLSelectElement).value);
  }

  /** Muestra el error de un campo: siempre tras intentar pagar; el monto también mientras se escribe. */
  protected err(campo: string): string {
    const mensaje = this.errores()[campo];
    if (!mensaje) return '';
    if (this.intentado()) return mensaje;
    return campo === 'monto' && this.montoLibre() !== null ? mensaje : '';
  }

  // ── Paso 1: confirmar y pasar a Mercado Pago ──
  protected async pagar(): Promise<void> {
    this.intentado.set(true);
    const area = this.area();
    const monto = this.monto();
    if (!this.valido() || !area || monto === null) return;

    const pendiente: PagoPendiente = {
      tipo: this.tipo(),
      concepto: this.conceptoFinal(),
      area,
      referencia: this.referencia().trim(),
      cuenta: this.tipo() === 'monedero' && this.destino() === 'otra' ? this.cuenta().trim() : undefined,
      monto: Math.round(monto * 100) / 100,
      aMiMonedero: this.aMiMonedero(),
    };

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
    this.pendiente.set(pendiente);
    this.pestana = pestana;
    this.abortador = new AbortController();
    const { signal: señal } = this.abortador;
    this.fase.set('redirigiendo');

    try {
      // Paso 2: pantalla "Redirigiendo a Mercado Pago…"
      const preferencia = await this.mp.crearPreferencia({
        monto: pendiente.monto,
        titulo: pendiente.concepto,
        area: `${pendiente.area.nombre} (${pendiente.area.clave})`,
        referencia: pendiente.referencia,
      });
      if (señal.aborted) {
        this.cerrarPestana();
        return;
      }
      pestana.location.href = preferencia.initPoint;

      // Paso 3: pantalla "Completa el pago en la pestaña de Mercado Pago"
      this.fase.set('esperando');
      this.vigilarPestana(pestana);
      const resultado = await this.mp.esperarResultado(preferencia.preferenceId, señal);
      this.resolver(resultado, pendiente);
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
    this.intentado.set(false);
    this.fase.set('confirmar');
    afterNextRender(() => this.primero()?.nativeElement.focus(), { injector: this.injector });
  }

  private resolver(resultado: ResultadoPago, p: PagoPendiente): void {
    this.limpiarVigilante();
    this.cerrarPestana();
    switch (resultado.estado) {
      case 'aprobado':
        this.comprobante.set(
          this.pagos.registrar({
            tipo: p.tipo,
            concepto: p.concepto,
            area: p.area,
            referencia: p.referencia,
            cuenta: p.cuenta,
            monto: p.monto,
            mpPagoId: resultado.pagoId ?? '',
          }),
        );
        if (p.aMiMonedero) this.saldoFinal.set(this.wallet.abonar(p.monto, 'Abono con Mercado Pago'));
        this.fase.set('exito');
        break;
      case 'rechazado':
        this.fallar(
          'Pago rechazado',
          resultado.motivo ?? 'Mercado Pago no pudo procesar el pago. No se realizó ningún cargo.',
        );
        break;
      case 'expirado':
        this.fallar(
          'Tiempo agotado',
          'No recibimos la confirmación del pago a tiempo. Si se hizo algún cargo, se reflejará en tus pagos en unos minutos.',
        );
        break;
      default:
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
