import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCgIZMG7n0feKatCNr_b1plf4tOzzKHnac",
  authDomain: "kongopay-19815.firebaseapp.com",
  projectId: "kongopay-19815",
  storageBucket: "kongopay-19815.firebasestorage.app",
  messagingSenderId: "1043431316190",
  appId: "1:1043431316190:web:ae101c7c8169516b39c04f",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
