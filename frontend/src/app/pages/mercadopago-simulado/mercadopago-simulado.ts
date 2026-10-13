import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MercadoPagoService, ResultadoPago } from '../../core/mercadopago.service';

/**
 * PLACEHOLDER de desarrollo: hace las veces de la pestaña de Mercado Pago
 * (Checkout Pro) para poder probar los tres resultados. Se elimina cuando
 * se conecte el Mercado Pago real.
 */
@Component({
  selector: 'app-mercadopago-simulado',
  imports: [CurrencyPipe],
  templateUrl: './mercadopago-simulado.html',
  styleUrl: './mercadopago-simulado.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MercadoPagoSimulado {
  private readonly mp = inject(MercadoPagoService);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly preferenceId = this.params.get('pref') ?? '';
  protected readonly monto = Number(this.params.get('monto') ?? 0);
  protected readonly titulo = this.params.get('titulo') ?? 'Pago';
  protected readonly area = this.params.get('area') ?? '';
  protected readonly referencia = this.params.get('referencia') ?? '';
  protected readonly valido = this.preferenceId !== '' && this.monto > 0;

  protected readonly procesando = signal(false);
  protected readonly enviado = signal<ResultadoPago['estado'] | null>(null);

  protected pagar(): void {
    this.procesando.set(true);
    // Simula el tiempo que tarda el procesamiento del pago.
    setTimeout(() => {
      const folio = 'MP-' + Math.floor(1e9 + Math.random() * 9e9);
      this.terminar({ estado: 'aprobado', pagoId: folio });
    }, 1500);
  }

  protected rechazar(): void {
    this.terminar({
      estado: 'rechazado',
      motivo: 'Tu banco rechazó el pago. Prueba con otro medio de pago. No se realizó ningún cargo.',
    });
  }

  protected cancelar(): void {
    this.terminar({ estado: 'cancelado' });
  }

  private terminar(resultado: ResultadoPago): void {
    this.mp.publicarResultadoSimulado(this.preferenceId, resultado);
    this.procesando.set(false);
    this.enviado.set(resultado.estado);
    // Se abrió con window.open desde la app, por lo que el navegador permite cerrarla.
    setTimeout(() => window.close(), 1200);
  }
}
