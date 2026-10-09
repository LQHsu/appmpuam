import { Injectable } from '@angular/core';

export interface PreferenciaPago {
  preferenceId: string;
  /** URL de Mercado Pago (Checkout Pro) a la que se manda al usuario. */
  initPoint: string;
}

export interface ResultadoPago {
  estado: 'aprobado' | 'rechazado' | 'cancelado' | 'expirado';
  /** Id del pago en Mercado Pago (solo si fue aprobado). */
  pagoId?: string;
  motivo?: string;
}

const CANAL = 'appmp-mercadopago';
const TIEMPO_MAXIMO_ESPERA = 10 * 60 * 1000;

/**
 * Integración con Mercado Pago (Checkout Pro) SOLO FRONT / PLACEHOLDER.
 *
 * Flujo real previsto:
 *   1. `crearPreferencia()`  -> POST al backend, que crea la preferencia en
 *      Mercado Pago (con external_reference y notification_url) y devuelve `init_point`.
 *   2. El front abre `init_point` en una pestaña nueva.
 *   3. `esperarResultado()`  -> consulta (polling) al backend el estado del pago,
 *      que el backend confirma con el webhook de Mercado Pago. Nunca se debe
 *      confiar en el estado que llegue por la URL de retorno.
 *
 * Aquí el paso 1 y 3 están simulados: la pestaña simulada
 * (`/mercadopago-simulado`) avisa el resultado por BroadcastChannel.
 * Al conectar el backend, reemplaza el cuerpo de estos dos métodos y elimina
 * `publicarResultadoSimulado()` y la página simulada.
 */
@Injectable({ providedIn: 'root' })
export class MercadoPagoService {
  async crearPreferencia(monto: number): Promise<PreferenciaPago> {
    // TODO: POST /api/pagos/preferencias { monto } -> { preferenceId, initPoint }
    await new Promise((resolve) => setTimeout(resolve, 1600));

    const preferenceId = crypto.randomUUID();
    const url = new URL('/mercadopago-simulado', window.location.origin);
    url.searchParams.set('pref', preferenceId);
    url.searchParams.set('monto', String(monto));
    return { preferenceId, initPoint: url.toString() };
  }

  /** Resuelve cuando se conoce el resultado. Rechaza con AbortError si se cancela la espera. */
  esperarResultado(preferenceId: string, señal: AbortSignal): Promise<ResultadoPago> {
    // TODO: polling a GET /api/pagos/preferencias/:preferenceId hasta estado final.
    return new Promise((resolve, reject) => {
      const canal = new BroadcastChannel(CANAL);
      const terminar = () => {
        clearTimeout(limite);
        canal.close();
        señal.removeEventListener('abort', alAbortar);
      };
      const alAbortar = () => {
        terminar();
        reject(new DOMException('Espera cancelada', 'AbortError'));
      };
      const limite = setTimeout(() => {
        terminar();
        resolve({ estado: 'expirado' });
      }, TIEMPO_MAXIMO_ESPERA);

      canal.onmessage = (e: MessageEvent<{ preferenceId: string; resultado: ResultadoPago }>) => {
        if (e.data?.preferenceId !== preferenceId) return;
        terminar();
        resolve(e.data.resultado);
      };

      if (señal.aborted) return alAbortar();
      señal.addEventListener('abort', alAbortar);
    });
  }

  /** SOLO SIMULACIÓN: lo usa la página simulada para avisar el resultado a la otra pestaña. */
  publicarResultadoSimulado(preferenceId: string, resultado: ResultadoPago): void {
    const canal = new BroadcastChannel(CANAL);
    canal.postMessage({ preferenceId, resultado });
    canal.close();
  }
}
