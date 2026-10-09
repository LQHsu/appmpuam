import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = this.fb.nonNullable.group({
    numeroEconomico: ['', [Validators.required, Validators.maxLength(20)]],
    nip: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
  });

  protected readonly mostrarNip = signal(false);
  protected readonly cargando = signal(false);
  protected readonly alerta = signal<{ tipo: 'error' | 'success'; mensaje: string } | null>(null);

  protected get numeroEconomico() {
    return this.form.controls.numeroEconomico;
  }

  protected get nip() {
    return this.form.controls.nip;
  }

  protected alternarNip(): void {
    this.mostrarNip.update((v) => !v);
  }

  /** Solo dígitos y máximo 5 en el NIP. */
  protected limpiarNip(event: Event): void {
    const input = event.target as HTMLInputElement;
    const limpio = input.value.replace(/\D/g, '').slice(0, 5);
    if (limpio !== input.value) {
      input.value = limpio;
      this.nip.setValue(limpio);
    }
  }

  protected async acceder(): Promise<void> {
    this.alerta.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.cargando.set(true);
    try {
      const { numeroEconomico, nip } = this.form.getRawValue();
      const resultado = await this.auth.login(numeroEconomico.trim(), nip);

      if (resultado.ok) {
        this.alerta.set({ tipo: 'success', mensaje: 'Acceso concedido. Redirigiendo...' });
        setTimeout(() => this.router.navigateByUrl('/inicio'), 600);
      } else {
        this.alerta.set({
          tipo: 'error',
          mensaje: resultado.mensaje ?? 'Número económico o NIP incorrectos.',
        });
      }
    } catch {
      this.alerta.set({
        tipo: 'error',
        mensaje: 'No se pudo conectar al servidor. Verifica tu conexión e intenta de nuevo.',
      });
    } finally {
      this.cargando.set(false);
    }
  }
}
