import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Fondo } from './shared/fondo/fondo';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Fondo],
  template: `
    <app-fondo />
    <router-outlet />
  `,
})
export class App {}
