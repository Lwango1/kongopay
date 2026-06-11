import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { apiFetch } from '../services/api';

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdminStatus = async (firebaseUser: FirebaseAuthTypes.User | null) => {
    if (!firebaseUser) {
      setIsAdmin(false);
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      setIsAdmin(!!data.isAdmin);
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      await checkAdminStatus(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await auth().signInWithEmailAndPassword(email, password);
    await checkAdminStatus(cred.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const cred = await auth().createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    await checkAdminStatus(cred.user);
  };

  const logout = async () => {
    await auth().signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
