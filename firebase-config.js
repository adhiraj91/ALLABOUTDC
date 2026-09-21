// ─────────────────────────────────────────────────────────────
// Paste the config object from:
// Firebase Console → Project settings → Your apps → Web app → SDK setup
// It looks exactly like the object below, just with real values.
// This file is safe to be public — Firebase web config is not a secret.
// Your data is protected by firestore.rules instead.
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: "AIzaSyConZ8aWljto-wZsqbgGgJ8APWrfTp6vuQ",
  authDomain: "allaboutdc-fb17e.firebaseapp.com",
  projectId: "allaboutdc-fb17e",
  storageBucket: "allaboutdc-fb17e.firebasestorage.app",
  messagingSenderId: "331608633518",
  appId: "1:331608633518:web:d170d4a586e62f1c1ffd3f",
  measurementId: "G-Z8N2CP4WV1"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
