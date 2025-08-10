'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Menu, LogOut, Loader2, BookText, QrCode, Shield } from 'lucide-react';
import Image from 'next/image';

interface PerfilData {
  nombre: string;
  segundoNombre?: string;
  apellido: string;
  tipoDocumento: 'cedula' | 'pasaporte';
  numeroDocumento: string;
  correo: string;
  fotoPerfilUrl?: string;
  rol: 'estudiante' | 'profesor' | 'admin' | 'pendiente';
  grado?: string;
  salon?: string;
  acudiente?: string;
  telefonoAcudiente?: string;
}

export default function PerfilPage() {
  const [usuarioFirebase, setUsuarioFirebase] = useState<User | null>(null);
  const [perfilData, setPerfilData] = useState<PerfilData | null>(null);

  // Campos del formulario
  const [nombre, setNombre] = useState('');
  const [segundoNombre, setSegundoNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState<'cedula' | 'pasaporte'>('cedula');

  // Para cédula dividida en partes
  const [cedulaParte1, setCedulaParte1] = useState('');
  const [cedulaParte2, setCedulaParte2] = useState('');
  const [cedulaParte3, setCedulaParte3] = useState('');

  // Para pasaporte
  const [numeroDocumento, setNumeroDocumento] = useState('');

  const [grado, setGrado] = useState('');
  const [salon, setSalon] = useState('');
  const [acudiente, setAcudiente] = useState('');
  const [telefonoAcudiente, setTelefonoAcudiente] = useState('');

  const [fotoArchivo, setFotoArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoForm, setCargandoForm] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuarioFirebase(user);
        await fetchPerfilData(user.uid);
      } else {
        router.push('/login');
      }
      setCargando(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchPerfilData = async (uid: string) => {
    try {
      const docRef = doc(db, 'usuarios', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as PerfilData;
        setPerfilData(data);

        setNombre(data.nombre || '');
        setSegundoNombre(data.segundoNombre || '');
        setApellido(data.apellido || '');
        setTipoDocumento(data.tipoDocumento || 'cedula');

        if (data.tipoDocumento === 'cedula' && data.numeroDocumento) {
          // Separar en partes la cédula, asumiendo formato "xxx-xxxx-xxxx"
          const partes = data.numeroDocumento.split('-');
          setCedulaParte1(partes[0] || '');
          setCedulaParte2(partes[1] || '');
          setCedulaParte3(partes[2] || '');
          setNumeroDocumento('');
        } else {
          setNumeroDocumento(data.numeroDocumento || '');
          setCedulaParte1('');
          setCedulaParte2('');
          setCedulaParte3('');
        }

        setGrado(data.grado || '');
        setSalon(data.salon || '');
        setAcudiente(data.acudiente || '');
        setTelefonoAcudiente(data.telefonoAcudiente || '');

      } else {
        setMensaje('Error: No se encontró tu perfil. Contacta a un administrador.');
      }
    } catch (error) {
      setMensaje('Error al cargar los datos del perfil.');
    }
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFotoArchivo(e.target.files[0]);
    }
  };

  const handleActualizarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioFirebase) return;

    setMensaje('');
    setCargandoForm(true);

    if (tipoDocumento === 'cedula') {
      if (
        cedulaParte1.length < 1 || cedulaParte1.length > 3 ||
        cedulaParte2.length < 3 || cedulaParte2.length > 5 ||
        cedulaParte3.length < 3 || cedulaParte3.length > 5
      ) {
        setMensaje('Cada parte de la cédula debe tener una longitud válida.');
        setCargandoForm(false);
        return;
      }
    } else if (tipoDocumento === 'pasaporte') {
      if (!numeroDocumento.trim()) {
        setMensaje('Debe ingresar el número de pasaporte.');
        setCargandoForm(false);
        return;
      }
    }

    try {
      let nuevaFotoUrl = perfilData?.fotoPerfilUrl;

      if (fotoArchivo) {
        const storageRef = ref(storage, `fotos-perfil/${usuarioFirebase.uid}`);
        const snapshot = await uploadBytes(storageRef, fotoArchivo);
        nuevaFotoUrl = await getDownloadURL(snapshot.ref);
      }

      const userDocRef = doc(db, 'usuarios', usuarioFirebase.uid);

      const numeroDocParaGuardar =
        tipoDocumento === 'cedula'
          ? `${cedulaParte1}-${cedulaParte2}-${cedulaParte3}`
          : numeroDocumento;

      await updateDoc(userDocRef, {
        nombre,
        segundoNombre,
        apellido,
        tipoDocumento,
        numeroDocumento: numeroDocParaGuardar,
        grado: perfilData?.rol === 'estudiante' ? grado : undefined,
        salon: perfilData?.rol === 'estudiante' ? salon : undefined,
        acudiente: perfilData?.rol === 'estudiante' ? acudiente : undefined,
        telefonoAcudiente: perfilData?.rol === 'estudiante' ? telefonoAcudiente : undefined,
        fotoPerfilUrl: nuevaFotoUrl,
      });

      setPerfilData((prev) =>
        prev
          ? {
              ...prev,
              nombre,
              segundoNombre,
              apellido,
              tipoDocumento,
              numeroDocumento: numeroDocParaGuardar,
              grado,
              salon,
              acudiente,
              telefonoAcudiente,
              fotoPerfilUrl: nuevaFotoUrl,
            }
          : null
      );

      setMensaje('Perfil actualizado correctamente.');
      setFotoArchivo(null);
    } catch {
      setMensaje('Error al actualizar el perfil. Inténtalo de nuevo.');
    } finally {
      setCargandoForm(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch {
      // Log error silently
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
    <div className="relative flex min-h-screen flex-col items-center p-4 sm:p-8 bg-gray-100 dark:bg-gray-950">
      <Button variant="ghost" size="icon" className="absolute left-4 top-4 z-10" onClick={() => setMenuAbierto(!menuAbierto)}>
        <Menu className="h-6 w-6 text-gray-900 dark:text-gray-50" />
      </Button>
      {menuAbierto && (
        <div className="absolute left-0 top-0 z-20 flex h-full w-64 flex-col gap-2 bg-white p-4 shadow-xl dark:bg-gray-800">
          <Button variant="ghost" className="justify-start" onClick={() => router.push('/historial')}>
            <BookText className="mr-2 h-4 w-4" />
            Historial
          </Button>

          {perfilData?.rol === 'profesor' && (
            <Button variant="ghost" className="justify-start" onClick={() => router.push('/carnet')}>
              <QrCode className="mr-2 h-4 w-4" />
              Escanear Carnet
            </Button>
          )}
          {perfilData?.rol === 'admin' && (
            <Button variant="ghost" className="justify-start" onClick={() => router.push('/admin')}>
              <Shield className="mr-2 h-4 w-4" />
              Panel Admin
            </Button>
          )}

          <Button variant="ghost" className="justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      )}

      <Card className="w-full max-w-lg mt-16 sm:mt-8">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Mi Perfil</CardTitle>
          <CardDescription>Actualiza tu información personal y foto de perfil.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleActualizarPerfil}>
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-32 w-32 rounded-full overflow-hidden">
                <Image
                  src={perfilData?.fotoPerfilUrl || `https://placehold.co/128x128/e2e8f0/64748b?text=${perfilData?.nombre?.charAt(0).toUpperCase() || 'P'}`}
                  alt="Foto de Perfil"
                  width={128}
                  height={128}
                  className="ring-2 ring-gray-200 dark:ring-gray-700"
                />
              </div>
              <Label htmlFor="profile-pic-upload" className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-500">
                Subir/cambiar foto
              </Label>
              <Input id="profile-pic-upload" type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
            </div>

            <div className="space-y-4">
              <div className="flex space-x-4">
                <Input
                  type="text"
                  placeholder="Nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
                <Input
                  type="text"
                  placeholder="Segundo nombre"
                  value={segundoNombre}
                  onChange={(e) => setSegundoNombre(e.target.value)}
                />
                <Input
                  type="text"
                  placeholder="Apellido"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Tipo de documento</Label>
                <select
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value as 'cedula' | 'pasaporte')}
                  className="w-full rounded border border-gray-300 p-2"
                >
                  <option value="cedula">Cédula</option>
                  <option value="pasaporte">Pasaporte</option>
                </select>
              </div>

              {tipoDocumento === 'cedula' ? (
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Parte 1"
                    value={cedulaParte1}
                    maxLength={3}
                    onChange={(e) => setCedulaParte1(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-20 text-center"
                  />
                  <span className="self-center">-</span>
                  <Input
                    type="text"
                    placeholder="Parte 2"
                    value={cedulaParte2}
                    maxLength={5}
                    onChange={(e) => setCedulaParte2(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-24 text-center"
                  />
                  <span className="self-center">-</span>
                  <Input
                    type="text"
                    placeholder="Parte 3"
                    value={cedulaParte3}
                    maxLength={5}
                    onChange={(e) => setCedulaParte3(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-24 text-center"
                  />
                </div>
              ) : (
                <Input
                  type="text"
                  placeholder="Número de documento"
                  value={numeroDocumento}
                  onChange={(e) => setNumeroDocumento(e.target.value)}
                  required
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input id="correo" type="email" value={perfilData?.correo || ''} disabled />
              </div>

              {perfilData?.rol === 'estudiante' && (
                <>
                  <Input
                    type="text"
                    placeholder="Grado"
                    value={grado}
                    onChange={(e) => setGrado(e.target.value)}
                  />
                  <Input
                    type="text"
                    placeholder="Salón"
                    value={salon}
                    onChange={(e) => setSalon(e.target.value)}
                  />
                  <Input
                    type="text"
                    placeholder="Nombre del acudiente"
                    value={acudiente}
                    onChange={(e) => setAcudiente(e.target.value)}
                  />
                  <Input
                    type="tel"
                    placeholder="Teléfono del acudiente"
                    value={telefonoAcudiente}
                    onChange={(e) => setTelefonoAcudiente(e.target.value)}
                  />
                </>
              )}
            </div>

            {mensaje && (
              <p className={`text-sm font-medium ${mensaje.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                {mensaje}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={cargandoForm}>
              {cargandoForm ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </form>

          <Button variant="outline" className="w-full mt-4" onClick={handleLogout}>
            Cerrar Sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


