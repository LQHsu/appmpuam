import { Injectable, computed, signal } from '@angular/core';

export interface Usuario {
  numeroEconomico: string;
  nombre: string;
  correo: string;
  departamento: string;
}

export interface ResultadoLogin {
  ok: boolean;
  mensaje?: string;
}

const STORAGE_KEY = 'appmp.sesion';

/**
 * Servicio de sesión SOLO FRONT: simula la autenticación con datos de
 * ejemplo. Cuando exista el backend, reemplazar el cuerpo de `login()`
 * por la llamada HTTP y conservar la misma firma.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _usuario = signal<Usuario | null>(this.leerSesion());

  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);

  async login(numeroEconomico: string, nip: string): Promise<ResultadoLogin> {
    await new Promise((resolve) => setTimeout(resolve, 900));

    // Mock: el NIP 00000 simula credenciales inválidas para probar el error.
    if (nip === '00000') {
      return { ok: false, mensaje: 'Número económico o NIP incorrectos. Intenta de nuevo.' };
    }

    const usuario: Usuario = {
      numeroEconomico,
      nombre: 'Nombre del Usuario',
      correo: 'usuario@correo.xoc.uam.mx',
      departamento: 'Departamento / Área',
    };
    this._usuario.set(usuario);
    this.guardarSesion(usuario);
    return { ok: true };
  }

  logout(): void {
    this._usuario.set(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private leerSesion(): Usuario | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Usuario) : null;
    } catch {
      return null;
    }
  }

  private guardarSesion(usuario: Usuario): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
    } catch {
      /* almacenamiento no disponible */
    }
  }
}
