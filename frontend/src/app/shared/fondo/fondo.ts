import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

interface IconoFlotante {
  icono: string;
  left: number;
  duracion: number;
  retraso: number;
  tamano: number;
}

interface Burbuja {
  tamano: number;
  left: number;
  duracion: number;
  retraso: number;
}

/** Fondo de cuaderno con alternativa de agua animada (botón discreto abajo a la izquierda). */
@Component({
  selector: 'app-fondo',
  templateUrl: './fondo.html',
  styleUrl: './fondo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fondo {
  protected readonly agua = signal(false);

  protected readonly iconos: IconoFlotante[] = [
    { icono: 'cup-hot', left: 8, duracion: 14, retraso: 0, tamano: 1.4 },
    { icono: 'egg-fried', left: 20, duracion: 10, retraso: 2, tamano: 1 },
    { icono: 'cup-straw', left: 35, duracion: 16, retraso: 5, tamano: 1.6 },
    { icono: 'basket2', left: 50, duracion: 11, retraso: 1, tamano: 1.1 },
    { icono: 'cup-hot-fill', left: 63, duracion: 13, retraso: 3.5, tamano: 0.9 },
    { icono: 'bag-heart', left: 75, duracion: 9, retraso: 6, tamano: 1.3 },
    { icono: 'egg-fried', left: 88, duracion: 12, retraso: 1.5, tamano: 1 },
    { icono: 'cup-straw', left: 14, duracion: 17, retraso: 8, tamano: 0.85 },
    { icono: 'basket2-fill', left: 42, duracion: 10, retraso: 4, tamano: 1.5 },
    { icono: 'cup-hot', left: 57, duracion: 15, retraso: 7, tamano: 1.2 },
  ];

  protected readonly burbujas: Burbuja[] = [
    { tamano: 12, left: 5, duracion: 11, retraso: 0.5 },
    { tamano: 8, left: 30, duracion: 8, retraso: 3 },
    { tamano: 16, left: 65, duracion: 14, retraso: 1 },
    { tamano: 6, left: 82, duracion: 9, retraso: 5 },
  ];

  protected alternar(): void {
    this.agua.update((v) => !v);
  }
}
