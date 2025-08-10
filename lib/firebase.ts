// lib/firebase.ts
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyCCegv_JUppcYs09gNyh0IWpK8Oeq0R9zI",
  authDomain: "irbd-c468b.firebaseapp.com",
  projectId: "irbd-c468b",
  storageBucket: "irbd-c468b.firebasestorage.app",
  messagingSenderId: "590440161238",
  appId: "1:590440161238:web:1a11936a786450d56a8e77"
}

const app = initializeApp(firebaseConfig)

const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app) // <--- ¡ESTO FALTABA!

export { auth, db, storage } // <--- exportar storage también
