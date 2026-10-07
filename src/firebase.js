import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRt8le7T7R3x5cxpUCBGez-wu7I12Czn8",
  authDomain: "retro-recuerdos.firebaseapp.com",
  projectId: "retro-recuerdos",
  storageBucket: "retro-recuerdos.firebasestorage.app",
  messagingSenderId: "838431100157",
  appId: "1:838431100157:web:60a1bddad097c25b418294",
  measurementId: "G-RTMZ9JLCTF"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);