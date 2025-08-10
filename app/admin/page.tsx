'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  DocumentData,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, Trash2, CheckCircle, Clock, User as UserIcon, FileText } from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AppUser extends DocumentData {
  id: string;
  nombre: string;
  correo: string;
  rol: 'admin' | 'profesor' | 'estudiante' | 'pendiente';
  fotoPerfilUrl?: string;
  fechaRegistro: Date;
}

interface Amonestacion extends DocumentData {
  id: string;
  motivo: string;
  estudianteId: string;
  estudianteNombre: string;
  profesorId: string;
  profesorNombre: string;
  fecha: Date;
}

export default function AdminPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);
  const [usuariosPendientes, setUsuariosPendientes] = useState<AppUser[]>([]);
  const [usuariosActivos, setUsuariosActivos] = useState<AppUser[]>([]);
  const [amonestaciones, setAmonestaciones] = useState<Amonestacion[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [activeTab, setActiveTab] = useState<'pendientes' | 'activos' | 'amonestaciones'>('pendientes');

  const router = useRouter();

  // Escuchar el estado de autenticación y cargar los datos
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthUser(user);

        // Verificar el rol del usuario
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (!userDoc.exists() || userDoc.data()?.rol !== 'admin') {
          router.push('/login');
          return;
        }

        // Suscribirse a los cambios en la colección de usuarios
        const qUsuarios = query(collection(db, 'usuarios'));
        const unsubscribeUsuarios = onSnapshot(qUsuarios, (snapshot) => {
          const pendientes: AppUser[] = [];
          const activos: AppUser[] = [];
          snapshot.docs.forEach((d) => {
            const userData = { id: d.id, ...d.data() } as AppUser;
            if (userData.rol === 'pendiente') {
              pendientes.push(userData);
            } else {
              activos.push(userData);
            }
          });
          setUsuariosPendientes(pendientes);
          setUsuariosActivos(activos);
          setCargando(false);
        }, (err) => {
          console.error('Error al obtener usuarios:', err);
          setMensaje('Error al cargar la lista de usuarios.');
          setCargando(false);
        });

        // Suscribirse a los cambios en la colección de amonestaciones
        const qAmonestaciones = query(collection(db, 'amonestaciones'));
        const unsubscribeAmonestaciones = onSnapshot(qAmonestaciones, (snapshot) => {
          const amonestacionesList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            fecha: doc.data().fecha.toDate()
          })) as Amonestacion[];
          setAmonestaciones(amonestacionesList.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())); // Ordenar por fecha descendente
        }, (err) => {
          console.error('Error al obtener amonestaciones:', err);
          setMensaje('Error al cargar las amonestaciones.');
        });

        return () => {
          unsubscribeUsuarios();
          unsubscribeAmonestaciones();
        };
      } else {
        router.push('/login');
      }
      setCargando(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Manejar el cambio de rol de un usuario
  const handleUpdateRole = async (userId: string, newRole: 'profesor' | 'estudiante' | 'admin') => {
    try {
      await updateDoc(doc(db, 'usuarios', userId), { rol: newRole });
      setMensaje(`Rol de usuario actualizado a ${newRole} con éxito.`);
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      setMensaje('Error al actualizar el rol.');
      setTimeout(() => setMensaje(''), 3000);
    }
  };

  // Manejar la eliminación de un usuario
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar a ${userName}? Esta acción es irreversible.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'usuarios', userId));
      // Nota: Para una eliminación completa, también deberías eliminar las amonestaciones asociadas y la foto de perfil.
      // Aquí, por simplicidad, solo se elimina el documento de usuario.
      setMensaje('Usuario eliminado con éxito.');
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      setMensaje('Error al eliminar el usuario.');
      setTimeout(() => setMensaje(''), 3000);
    }
  };
  
  // Lógica para cerrar sesión
  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  if (cargando) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2 text-gray-700 dark:text-gray-300">Cargando panel de administrador...</span>
    </div>
  );
}


return (
    <div className="flex min-h-screen flex-col p-4 sm:p-8 bg-gray-100 dark:bg-gray-950">
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center">
            <CardTitle className="text-3xl font-bold">Panel de Administrador</CardTitle>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="h-5 w-5 mr-2" />
            Cerrar Sesión
          </Button>
        </CardHeader>
        <CardContent>
          {mensaje && <p className={`text-sm text-center font-medium mb-4 ${mensaje.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{mensaje}</p>}
          
          <div className="flex space-x-2 border-b-2 mb-4">
            <Button variant={activeTab === 'pendientes' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('pendientes')}>
              <Clock className="h-4 w-4 mr-2" />
              Pendientes ({usuariosPendientes.length})
            </Button>
            <Button variant={activeTab === 'activos' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('activos')}>
              <UserIcon className="h-4 w-4 mr-2" />
              Usuarios Activos ({usuariosActivos.length})
            </Button>
            <Button variant={activeTab === 'amonestaciones' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('amonestaciones')}>
              <FileText className="h-4 w-4 mr-2" />
              Amonestaciones ({amonestaciones.length})
            </Button>
          </div>

          {activeTab === 'pendientes' && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Usuarios Pendientes de Aprobación</CardTitle>
                <CardDescription>
                  Revisa y asigna un rol a los usuarios nuevos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Foto</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Correo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuariosPendientes.length > 0 ? (
                      usuariosPendientes.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Image
                              src={user.fotoPerfilUrl || '/placeholder-profile.png'}
                              alt={user.nombre}
                              width={40}
                              height={40}
                              className="rounded-full object-cover"
                            />
                          </TableCell>
                          <TableCell>{user.nombre}</TableCell>
                          <TableCell>{user.correo}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button variant="outline" onClick={() => handleUpdateRole(user.id, 'profesor')}>
                                Aprobar como Profesor
                              </Button>
                              <Button variant="outline" onClick={() => handleUpdateRole(user.id, 'estudiante')}>
                                Aprobar como Estudiante
                              </Button>
                              <Button variant="destructive" size="icon" onClick={() => handleDeleteUser(user.id, user.nombre)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500">
                          No hay usuarios pendientes.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {activeTab === 'activos' && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Usuarios Activos</CardTitle>
                <CardDescription>
                  Lista de todos los usuarios registrados y sus roles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Foto</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Correo</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuariosActivos.length > 0 ? (
                      usuariosActivos.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Image
                              src={user.fotoPerfilUrl || '/placeholder-profile.png'}
                              alt={user.nombre}
                              width={40}
                              height={40}
                              className="rounded-full object-cover"
                            />
                          </TableCell>
                          <TableCell>{user.nombre}</TableCell>
                          <TableCell>{user.correo}</TableCell>
                          <TableCell>{user.rol}</TableCell>
                          <TableCell>
                            <Button variant="destructive" size="icon" onClick={() => handleDeleteUser(user.id, user.nombre)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500">
                          No hay usuarios activos.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          
          {activeTab === 'amonestaciones' && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Historial de Amonestaciones</CardTitle>
                <CardDescription>
                  Registro completo de todas las amonestaciones emitidas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Profesor</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amonestaciones.length > 0 ? (
                      amonestaciones.map((amonestacion) => (
                        <TableRow key={amonestacion.id}>
                          <TableCell>{amonestacion.estudianteNombre}</TableCell>
                          <TableCell>{amonestacion.profesorNombre}</TableCell>
                          <TableCell>{amonestacion.motivo}</TableCell>
                          <TableCell>{amonestacion.fecha.toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500">
                          No hay amonestaciones registradas.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
