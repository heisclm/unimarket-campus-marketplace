'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type UserRole = 'student' | 'vendor' | 'admin' | null;

interface AuthContextType {
  user: User | null;
  role: UserRole;
  userData: any | null;
  loading: boolean;
  setRole: (role: UserRole) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  userData: null,
  loading: true,
  setRole: async () => {},
  refreshUserData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRoleState] = useState<UserRole>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        setRoleState(data.role as UserRole);
        setUserData(data);
      } else {
        setRoleState(null);
        setUserData(null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setRoleState(null);
      setUserData(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        await fetchUserData(firebaseUser.uid);
        setUser(firebaseUser);
      } else {
        setUser(null);
        setRoleState(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.uid);
    }
  };

  const setRole = async (newRole: UserRole) => {
    if (!user || !newRole) return;
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const initialData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: newRole,
        walletBalance: 0,
        isVerified: false,
        createdAt: serverTimestamp(),
      };
      await setDoc(userDocRef, initialData);
      setRoleState(newRole);
      setUserData(initialData);
    } catch (error) {
      console.error("Error setting user role:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, userData, loading, setRole, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}
