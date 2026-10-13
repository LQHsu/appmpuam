import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PagosService } from '../core/pagos.service';
import { WalletService } from '../core/wallet.service';

/** Estructura de las páginas con sesión: navbar + contenido. */
@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout {
  private readonly auth = inject(AuthService);
  private readonly wallet = inject(WalletService);
  private readonly pagos = inject(PagosService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly usuario = this.auth.usuario;
  protected readonly menuAbierto = signal(false);

  protected alternarMenu(): void {
    this.menuAbierto.update((v) => !v);
  }

  protected cerrarSesion(): void {
    this.menuAbierto.set(false);
    this.auth.logout();
    this.wallet.reiniciar();
    this.pagos.reiniciar();
    this.router.navigateByUrl('/login');
  }

  @HostListener('document:click', ['$event'])
  protected clicFuera(event: Event): void {
    if (this.menuAbierto() && !this.host.nativeElement.querySelector('.usuario-menu')?.contains(event.target as Node)) {
      this.menuAbierto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.menuAbierto.set(false);
  }
}
