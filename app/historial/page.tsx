'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  getDoc,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, FileText, User as UserIcon } from 'lucide-react';

// Interfaz para definir la estructura de una amonestación
interface Amonestacion {
  id: string;
  motivo: string;
  fecha: Date;
  profesorNombre: string;
}

export default function HistorialPage() {
  const [usuarioFirebase, setUsuarioFirebase] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);
  const [amonestaciones, setAmonestaciones] = useState<Amonestacion[]>([]);
  const [mensaje, setMensaje] = useState('');

  const router = useRouter();

  // Lógica para cerrar sesión
  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  // Escuchar el estado de autenticación y cargar los datos
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuarioFirebase(user);
        
        // Consultar el rol del usuario para asegurar que es un estudiante
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (!userDoc.exists() || userDoc.data()?.rol !== 'estudiante') {
          router.push('/login');
          return;
        }

        // Crear una consulta para obtener solo las amonestaciones del estudiante actual
        const q = query(
          collection(db, 'amonestaciones'),
          where('estudianteId', '==', user.uid),
        );

        // Suscribirse a los cambios en tiempo real de las amonestaciones
        const unsubscribeAmonestaciones = onSnapshot(q, (snapshot) => {
          const amonestacionesList: Amonestacion[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              motivo: data.motivo,
              fecha: data.fecha.toDate(),
              profesorNombre: data.profesorNombre,
            };
          }).sort((a, b) => b.fecha.getTime() - a.fecha.getTime()); // Ordenar por fecha descendente
          setAmonestaciones(amonestacionesList);
          setCargando(false);
        }, (err) => {
          console.error('Error al obtener amonestaciones:', err);
          setMensaje('Error al cargar las amonestaciones.');
          setCargando(false);
        });

        return () => unsubscribeAmonestaciones();
      } else {
        router.push('/login');
      }
      setCargando(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2 text-gray-700 dark:text-gray-300">Cargando historial...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-gray-100 dark:bg-gray-950">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-6 w-6 mr-2" />
            <CardTitle className="text-2xl font-bold">Historial de Amonestaciones</CardTitle>
          </div>
          <div className="flex space-x-2">
            <Button variant="ghost" onClick={() => router.push('/perfil')}>
              <UserIcon className="h-5 w-5 mr-2" />
              Perfil
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-5 w-5 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mensaje && <p className={`text-sm text-center font-medium ${mensaje.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{mensaje}</p>}

          {amonestaciones.length > 0 ? (
            <div className="space-y-4">
              {amonestaciones.map((amonestacion) => (
                <Card key={amonestacion.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-lg">{amonestacion.motivo}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        <span className="font-medium">Fecha:</span> {amonestacion.fecha.toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Registrada por:</span> {amonestacion.profesorNombre}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 text-sm">No tienes amonestaciones registradas.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}