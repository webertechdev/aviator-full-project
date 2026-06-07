import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) setProfile(snap.data());
      } else { setUser(null); setProfile(null); }
      setLoading(false);
    });
  }, []);

  async function register({ fullName, email, password, phone, country, startDemo }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const DEMO_BALANCE = 50000;
    const userData = {
      uid: cred.user.uid, fullName, email, phone, country,
      balance: 0,
      demoBalance: DEMO_BALANCE,
      mode: startDemo ? "demo" : "real",
      role: "user", chatEnabled: false,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", cred.user.uid), userData);
    setProfile(userData);
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (snap.exists()) setProfile(snap.data());
  }

  async function logout() { await signOut(auth); }
  async function resetPassword(email) { await sendPasswordResetEmail(auth, email); }

  async function refreshProfile() {
    if (!user) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) setProfile(snap.data());
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, register, login, logout, resetPassword, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
