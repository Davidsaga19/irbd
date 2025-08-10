'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

function validarCedulaParte(parte: string, minLen: number, maxLen: number) {
  // Validar que la parte tenga solo números y esté en el rango de longitud
  return new RegExp(`^[0-9]{${minLen},${maxLen}}$`).test(parte);
}

export default function RegistroPage() {
  const [nombre, setNombre] = useState('');
  const [segundoNombre, setSegundoNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('cedula'); // 'cedula' o 'pasaporte'

  // Para cédula dividida
  const [cedulaParte1, setCedulaParte1] = useState('');
  const [cedulaParte2, setCedulaParte2] = useState('');
  const [cedulaParte3, setCedulaParte3] = useState('');

  // Para pasaporte
  const [documento, setDocumento] = useState('');

  const [rol, setRol] = useState('estudiante'); // 'estudiante' o 'profesor'
  const [salon, setSalon] = useState('');
  const [grado, setGrado] = useState('');
  const [acudiente, setAcudiente] = useState('');
  const [telefonoAcudiente, setTelefonoAcudiente] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState('/placeholder-profile.png');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoPerfil(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar campos obligatorios
    if (!nombre || !apellido || !correo || !contrasena) {
      setMensaje('Por favor, completa todos los campos obligatorios.');
      return;
    }

    // Validar documento
    if (tipoDocumento === 'cedula') {
      if (
        !validarCedulaParte(cedulaParte1, 1, 3) ||
        !validarCedulaParte(cedulaParte2, 3, 5) ||
        !validarCedulaParte(cedulaParte3, 3, 5)
      ) {
        setMensaje('Por favor, ingresa una cédula válida en sus tres partes.');
        return;
      }
    } else if (tipoDocumento === 'pasaporte') {
      if (!documento.trim()) {
        setMensaje('Por favor, ingresa el número de pasaporte.');
        return;
      }
    }

    // Si es estudiante, validar campos extra
    if (rol === 'estudiante' && (!salon || !grado || !acudiente || !telefonoAcudiente)) {
      setMensaje('Por favor, completa todos los campos para estudiantes.');
      return;
    }

    setCargando(true);
    setMensaje('');

    try {
      // Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, correo, contrasena);
      const user = userCredential.user;

      let fotoPerfilUrl = '';
      if (fotoPerfil) {
        const storageRef = ref(storage, `fotos-perfil/${user.uid}-${fotoPerfil.name}`);
        const uploadTask = await uploadBytes(storageRef, fotoPerfil);
        fotoPerfilUrl = await getDownloadURL(uploadTask.ref);
      }

      // Construir documento con formato correcto
      const numeroDocumento =
        tipoDocumento === 'cedula'
          ? `${cedulaParte1}-${cedulaParte2}-${cedulaParte3}`
          : documento;

      // Preparar datos a guardar
      const userData: any = {
        nombre,
        segundoNombre: segundoNombre || null,
        apellido,
        tipoDocumento,
        numeroDocumento,
        rol: rol === 'profesor' ? 'pendiente' : 'estudiante',
        correo,
        fotoPerfilUrl,
        fechaRegistro: new Date(),
      };

      if (rol === 'estudiante') {
        userData.salon = salon;
        userData.grado = grado;
        userData.acudiente = acudiente;
        userData.telefonoAcudiente = telefonoAcudiente;
      }

      // Guardar en Firestore
      await setDoc(doc(db, 'usuarios', user.uid), userData);

      setMensaje('¡Registro exitoso! Redirigiendo al inicio de sesión...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Error al registrar usuario:', error);
      if (error.code === 'auth/email-already-in-use') {
        setMensaje('El correo electrónico ya está en uso.');
      } else if (error.code === 'auth/weak-password') {
        setMensaje('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setMensaje('Error al registrar. Intenta de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-950">
      <Card className="w-full max-w-md p-6">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Crear una cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegistro} className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <Label htmlFor="foto-perfil" className="cursor-pointer">
                <div className="relative h-24 w-24 rounded-full border-2 border-indigo-500 overflow-hidden">
                  <Image
                    src={fotoPreview}
                    alt="Vista previa de foto de perfil"
                    fill
                    className="object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                    <p className="text-white text-xs text-center font-medium">Subir Foto</p>
                  </div>
                </div>
              </Label>
              <Input
                id="foto-perfil"
                type="file"
                className="hidden"
                onChange={handleFotoChange}
                accept="image/*"
              />
            </div>

            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
              <Input
                type="text"
                placeholder="Segundo nombre (opcional)"
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

              <div>
                <Label>Tipo de documento</Label>
                <select
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="cedula">Cédula</option>
                  <option value="pasaporte">Pasaporte</option>
                </select>
              </div>

              {/* Inputs divididos para cédula o input simple para pasaporte */}
              {tipoDocumento === 'cedula' ? (
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Parte 1"
                    maxLength={3}
                    value={cedulaParte1}
                    onChange={(e) => setCedulaParte1(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-20 text-center"
                  />
                  <span className="self-center">-</span>
                  <Input
                    type="text"
                    placeholder="Parte 2"
                    maxLength={5}
                    value={cedulaParte2}
                    onChange={(e) => setCedulaParte2(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-24 text-center"
                  />
                  <span className="self-center">-</span>
                  <Input
                    type="text"
                    placeholder="Parte 3"
                    maxLength={5}
                    value={cedulaParte3}
                    onChange={(e) => setCedulaParte3(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-24 text-center"
                  />
                </div>
              ) : (
                <Input
                  type="text"
                  placeholder="Número de pasaporte"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  required
                />
              )}

              <div>
                <Label>Rol</Label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="estudiante">Estudiante</option>
                  <option value="profesor">Profesor</option>
                </select>
              </div>

              {rol === 'estudiante' && (
                <>
                  <Input
                    type="text"
                    placeholder="Salón"
                    value={salon}
                    onChange={(e) => setSalon(e.target.value)}
                    required
                  />
                  <Input
                    type="text"
                    placeholder="Grado"
                    value={grado}
                    onChange={(e) => setGrado(e.target.value)}
                    required
                  />
                  <Input
                    type="text"
                    placeholder="Nombre del acudiente"
                    value={acudiente}
                    onChange={(e) => setAcudiente(e.target.value)}
                    required
                  />
                  <Input
                    type="tel"
                    placeholder="Teléfono del acudiente"
                    value={telefonoAcudiente}
                    onChange={(e) => setTelefonoAcudiente(e.target.value)}
                    required
                  />
                </>
              )}

              <Input
                type="email"
                placeholder="Correo electrónico"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Contraseña (mínimo 6 caracteres)"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={cargando}>
              {cargando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrarse
            </Button>

            <p className="text-sm text-center">
              ¿Ya tienes una cuenta?{' '}
              <a href="/login" className="text-indigo-600 hover:underline">
                Inicia sesión
              </a>
            </p>

            {mensaje && (
              <p className={`text-sm text-center ${mensaje.includes('éxito') ? 'text-green-600' : 'text-red-600'}`}>
                {mensaje}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
