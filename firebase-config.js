// Firebase project configuration
// -------------------------------------------------------------------------
// Get these values from: Firebase Console -> Project settings -> General
// -> "Your apps" -> Web app -> SDK setup and configuration -> Config.
//
// These client-side keys are safe to expose publicly (that's how Firebase
// web apps work) — actual access control is enforced by your Firestore
// Security Rules and Authentication settings, not by hiding this file.
// -------------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAla_DIUPqhfMPIJQkMLpBIl_evaBbCtZM",
  authDomain: "smartscore-43fa8.firebaseapp.com",
  projectId: "smartscore-43fa8",
  storageBucket: "smartscore-43fa8.firebasestorage.app",
  messagingSenderId: "466358767899",
  appId: "1:466358767899:web:441d3ccd5e31eda083c3be"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
