import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Iniciar sesión · Monedero electrónico UAM',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    // PLACEHOLDER: sustituye a la pestaña de Mercado Pago. Quitar al conectar el pago real.
    path: 'mercadopago-simulado',
    title: 'Mercado Pago (simulación)',
    loadComponent: () =>
      import('./pages/mercadopago-simulado/mercadopago-simulado').then((m) => m.MercadoPagoSimulado),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout').then((m) => m.Layout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio · Monedero electrónico UAM',
        loadComponent: () => import('./pages/inicio/inicio').then((m) => m.Inicio),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
