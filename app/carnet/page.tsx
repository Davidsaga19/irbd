'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, QrCode, Search, User as UserIcon, LogOut, ArrowLeft, Trash2, Edit, Barcode } from 'lucide-react';
import Image from 'next/image';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/library';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Interfaz para definir la estructura de un estudiante
interface EstudianteData {
  id: string;
  nombre: string;
  correo: string;
  fotoPerfilUrl?: string;
  rol: 'estudiante';
}

// Interfaz para definir la estructura de una amonestación
interface Amonestacion {
  id: string;
  motivo: string;
  fecha: Date;
  profesorId: string;
  profesorNombre: string;
  estudianteId: string;
}

export default function CarnetPage() {
  const [usuarioFirebase, setUsuarioFirebase] = useState<User | null>(null);
  const [perfilProfesor, setPerfilProfesor] = useState<{ nombre: string } | null>(null);
  const [estudiante, setEstudiante] = useState<EstudianteData | null>(null);
  const [amonestaciones, setAmonestaciones] = useState<Amonestacion[]>([]);
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [cargandoScanner, setCargandoScanner] = useState(false);
  const [cargandoAmonestacion, setCargandoAmonestacion] = useState(false);
  const [scannerActivo, setScannerActivo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [codigoEscaneado, setCodigoEscaneado] = useState('');
  const [amonestacionEditando, setAmonestacionEditando] = useState<Amonestacion | null>(null);

  // NUEVO: Estados para el diálogo de confirmación
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [amonestacionAEliminar, setAmonestacionAEliminar] = useState<string | null>(null);

  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  // Lógica para cerrar sesión
  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  // Escuchar el estado de autenticación y cargar el perfil del profesor
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuarioFirebase(user);
        const docRef = doc(db, 'usuarios', user.uid);
const docSnap = await getDoc(docRef);

if (docSnap.exists() && docSnap.data()?.rol === 'profesor') {
  setPerfilProfesor({ nombre: docSnap.data()?.nombre || '' });
} else {
  router.push('/perfil');
}

      } else {
        router.push('/login');
      }
      setCargando(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Manejar el scanner de código de barra
  useEffect(() => {
    if (!scannerActivo || !videoRef.current) return;

    const codeReader = new BrowserMultiFormatReader();
    const videoElement = videoRef.current;
    let controls: IScannerControls;

    const startScanner = async () => {
      setCargandoScanner(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        videoElement.srcObject = stream;
        controls = await codeReader.decodeFromVideoElement(videoElement, (result, err) => {
          if (result) {
            setCodigoEscaneado(result.getText());
            stopScanner();
          }
          if (err) {
            // console.error(err); // Es normal que arroje errores mientras busca el código
          }
        });
        scannerControlsRef.current = controls;
        setCargandoScanner(false);
      } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        setMensaje('Error: No se pudo acceder a la cámara. Revisa los permisos.');
        setCargandoScanner(false);
      }
    };

    const stopScanner = () => {
      if (scannerControlsRef.current) {
        scannerControlsRef.current.stop();
        scannerControlsRef.current = null;
      }
      setScannerActivo(false);
      if (videoElement.srcObject) {
        (videoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [scannerActivo]);

  // Buscar estudiante por cédula (numeroDocumento)
  const buscarEstudiantePorCedula = async (cedula: string) => {
    setEstudiante(null);
    setAmonestaciones([]);
    setMensaje('');
    setCargandoAmonestacion(true);
    try {
      const q = query(
        collection(db, 'usuarios'),
        where('numeroDocumento', '==', cedula),
        where('rol', '==', 'estudiante')
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        setEstudiante({
          id: docSnap.id,
          ...docSnap.data(),
        } as EstudianteData);
        setMensaje('');
      } else {
        setEstudiante(null);
        setMensaje('No se encontró un estudiante con esa cédula.');
      }
    } catch (error) {
      console.error('Error al buscar estudiante por cédula:', error);
      setMensaje('Error al buscar estudiante.');
    } finally {
      setCargandoAmonestacion(false);
    }
  };

  // Escuchar código escaneado y buscar estudiante
  useEffect(() => {
    if (codigoEscaneado) {
      buscarEstudiantePorCedula(codigoEscaneado);
    }
  }, [codigoEscaneado]);

  // Obtener amonestaciones del estudiante seleccionado
  useEffect(() => {
    if (!estudiante) return;

    const q = query(
      collection(db, 'amonestaciones'),
      where('estudianteId', '==', estudiante.id),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const amonestacionesList: Amonestacion[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          motivo: data.motivo,
          fecha: data.fecha.toDate(),
          profesorId: data.profesorId,
          profesorNombre: data.profesorNombre,
          estudianteId: data.estudianteId,
        };
      }).sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
      setAmonestaciones(amonestacionesList);
    }, (err) => {
      console.error('Error al obtener amonestaciones:', err);
      setMensaje('Error al cargar las amonestaciones.');
    });

    return () => unsubscribe();
  }, [estudiante]);

  const handleAmonestar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estudiante || !perfilProfesor || !usuarioFirebase) return;

    setCargandoAmonestacion(true);
    try {
      if (amonestacionEditando) {
        // Editar amonestación existente
        const amonestacionRef = doc(db, 'amonestaciones', amonestacionEditando.id);
        await updateDoc(amonestacionRef, { motivo });
        setMensaje('Amonestación actualizada correctamente.');
        setAmonestacionEditando(null);
      } else {
        // Crear nueva amonestación
        await addDoc(collection(db, 'amonestaciones'), {
          motivo,
          fecha: Timestamp.now(),
          estudianteId: estudiante.id,
          estudianteNombre: estudiante.nombre,
          profesorId: usuarioFirebase.uid,
          profesorNombre: perfilProfesor.nombre,
        });
        setMensaje('Amonestación registrada correctamente.');
      }
      setMotivo('');
    } catch (error) {
      console.error('Error al registrar/editar amonestación:', error);
      setMensaje('Error al registrar la amonestación. Inténtalo de nuevo.');
    } finally {
      setCargandoAmonestacion(false);
    }
  };

  // Función para mostrar el diálogo de confirmación
  const confirmarEliminar = (id: string) => {
    setAmonestacionAEliminar(id);
    setDialogoAbierto(true);
  };

  // Función de eliminación real
  const handleEliminar = async () => {
    if (!amonestacionAEliminar) return;

    try {
      const amonestacionRef = doc(db, 'amonestaciones', amonestacionAEliminar);
      await deleteDoc(amonestacionRef);
      setMensaje('Amonestación eliminada.');
    } catch (error) {
      console.error('Error al eliminar amonestación:', error);
      setMensaje('Error al eliminar la amonestación.');
    } finally {
      setAmonestacionAEliminar(null);
      setDialogoAbierto(false);
    }
  };

  const editarAmonestacion = (amonestacion: Amonestacion) => {
    setMotivo(amonestacion.motivo);
    setAmonestacionEditando(amonestacion);
  };

  const handleManualSearch = async () => {
    const manualId = (document.getElementById('manual-search') as HTMLInputElement).value;
    if (manualId) {
      buscarEstudiantePorCedula(manualId);
    }
  };

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2 text-gray-700 dark:text-gray-300">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-gray-100 dark:bg-gray-950">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5 mr-2" />
              Volver
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-5 w-5 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
          <CardTitle className="text-2xl font-bold text-center mt-4">Escáner de Carnet</CardTitle>
          <CardDescription className="text-center">
            Usa la cámara para escanear el código de barra o busca por cédula.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-full max-w-md">
              {!scannerActivo ? (
                <Button onClick={() => setScannerActivo(true)} className="w-full">
                  <Barcode className="mr-2 h-4 w-4" />
                  Activar Escáner de Código de Barra
                </Button>
              ) : (
                <>
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
                    {cargandoScanner ? (
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    ) : (
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                    )}
                  </div>
                  <Button onClick={() => setScannerActivo(false)} className="w-full mt-4" variant="destructive">
                    Detener Escáner
                  </Button>
                </>
              )}
            </div>

            <div className="flex w-full max-w-md items-center space-x-2">
              <Input
                id="manual-search"
                type="text"
                placeholder="Buscar por cédula de estudiante"
                defaultValue={codigoEscaneado}
              />
              <Button type="button" onClick={handleManualSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {mensaje && <p className={`text-sm text-center ${mensaje.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{mensaje}</p>}
          </div>

          {estudiante && (
            <Card className="mt-4">
              <CardHeader className="flex flex-row items-center space-x-4">
                <div className="relative h-16 w-16 rounded-full overflow-hidden">
                  <Image
                    src={estudiante.fotoPerfilUrl || `https://placehold.co/64x64/e2e8f0/64748b?text=${estudiante.nombre.charAt(0).toUpperCase()}`}
                    alt="Foto de Perfil"
                    layout="fill"
                    objectFit="cover"
                  />
                </div>
                <div>
                  <CardTitle>{estudiante.nombre}</CardTitle>
                  <CardDescription>ID: {estudiante.id}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleAmonestar} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="motivo">Motivo de la amonestación</Label>
                    <Textarea
                      id="motivo"
                      placeholder="Escribe el motivo..."
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      required
                      disabled={cargandoAmonestacion}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={cargandoAmonestacion}>
                    {cargandoAmonestacion ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : amonestacionEditando ? (
                      'Actualizar Amonestación'
                    ) : (
                      'Registrar Amonestación'
                    )}
                  </Button>
                </form>

                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Amonestaciones del estudiante</h3>
                  {amonestaciones.length > 0 ? (
                    <div className="space-y-2">
                      {amonestaciones.map((amonestacion) => (
                        <div key={amonestacion.id} className="flex justify-between items-center p-3 border rounded-md">
                          <div className="text-sm">
                            <p className="font-medium">{amonestacion.motivo}</p>
                            <p className="text-xs text-gray-500">
                              Fecha: {amonestacion.fecha.toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            {usuarioFirebase?.uid === amonestacion.profesorId && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => editarAmonestacion(amonestacion)}
                                >
                                  <Edit className="h-4 w-4 text-gray-500 hover:text-indigo-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => confirmarEliminar(amonestacion.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 text-sm">No hay amonestaciones para este estudiante.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* NUEVO: Diálogo de confirmación para eliminar */}
      <AlertDialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la amonestación del estudiante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminar}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
