'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; // Importamos 'auth' y 'db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correo || !contrasena) {
      setMensaje('Por favor, completa todos los campos.');
      return;
    }

    setCargando(true);
    setMensaje('');

    try {
      // 1. Iniciar sesión con Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, correo, contrasena);
      const user = userCredential.user;

      // 2. Obtener el rol del usuario de Firestore
      const userDocRef = doc(db, 'usuarios', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const rol = userData.rol;

        setMensaje('Inicio de sesión exitoso. Redirigiendo...');

        // 3. Redirigir al usuario según su rol
        setTimeout(() => {
          if (rol === 'admin') {
            router.push('/admin');
          } else if (rol === 'profesor') {
            router.push('/carnet');
          } else if (rol === 'estudiante') {
            router.push('/historial');
          } else if (rol === 'pendiente') {
            // Usuario con rol 'pendiente' debe esperar a ser aprobado
            setMensaje('Tu cuenta está pendiente de aprobación.');
            router.push('/login'); // O redirigir a una página de "espera"
          } else {
            // Rol desconocido, redirigir a una página por defecto o a una de error
            router.push('/perfil');
          }
        }, 1500);

      } else {
        // No se encontró el documento en Firestore
        setMensaje('Error: No se encontró el perfil de usuario.');
        // Opcional: Cerrar la sesión si el documento no existe
        auth.signOut();
      }

    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      if (error.code === 'auth/invalid-credential') {
        setMensaje('Correo electrónico o contraseña incorrectos.');
      } else {
        setMensaje('Error al iniciar sesión. Intenta de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-950">
      <Card className="w-full max-w-md p-6">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Iniciar Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="Correo electrónico"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Contraseña"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={cargando}>
            <Loader2
            className={`h-4 w-4 mr-2 transition-opacity ${cargando ? 'opacity-100 animate-spin' : 'opacity-0'}`}
              />
            Iniciar sesión
            </Button>
            <p className="text-sm text-center">
              ¿No tienes una cuenta?{' '}
              <a href="/registro" className="text-indigo-600 hover:underline">
                Regístrate
              </a>
            </p>
            {mensaje && (
              <p className={`text-sm text-center min-h-[1.5rem] ${mensaje.includes('exitoso') ? 'text-green-600' : 'text-red-600'}`}>
              {mensaje}
              </p>

            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
