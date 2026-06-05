import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().role === "admin") {
          setAdmin({ ...user, profile: snap.data() });
        } else {
          await signOut(auth);
          setAdmin(null);
        }
      } else {
        setAdmin(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists() || snap.data().role !== "admin") {
      await signOut(auth);
      throw new Error("Not an admin account");
    }
  }

  async function logout() { await signOut(auth); }

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout }}>
      {!loading && children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() { return useContext(AdminAuthContext); }
