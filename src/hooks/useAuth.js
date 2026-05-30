import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";

export function useAuth() {
  const [state, setState] = useState({
    user: null,
    isAdmin: false,
    loading: true,
    error: null
  });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({
          user: null,
          isAdmin: false,
          loading: false,
          error: null
        });
        return;
      }

      try {
        const adminSnapshot = await getDoc(doc(db, "admins", user.uid));
        setState({
          user,
          isAdmin: adminSnapshot.exists(),
          loading: false,
          error: null
        });
      } catch (error) {
        setState({
          user,
          isAdmin: false,
          loading: false,
          error: error.message
        });
      }
    });
  }, []);

  return state;
}
