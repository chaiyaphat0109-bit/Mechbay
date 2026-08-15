import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqVqFN82xbLlTvzyYTSsn08W5azON0Ssdc",
  authDomain: "mech-bay-129fb.firebaseapp.com",
  projectId: "mech-bay-129fb",
  storageBucket: "mech-bay-129fb.firebasestorage.app",
  messagingSenderId: "1011647613642",
  appId: "1:1011647613642:web:5d1d7649ea1c0e7b7ac233",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
