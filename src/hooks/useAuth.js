import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";

const adminRoles = new Set(["owner", "admin"]);

function isActiveAdmin(data) {
  return data?.active === true && adminRoles.has(data?.role);
}

export function useAuth() {
  const [state, setState] = useState({
    user: null,
    isAdmin: false,
    admin: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({
          user: null,
          isAdmin: false,
          admin: null,
          loading: false,
          error: null
        });
        return;
      }

      try {
        const adminSnapshot = await getDoc(doc(db, "admins", user.uid));
        const adminData = adminSnapshot.exists() ? adminSnapshot.data() : null;
        const isAdmin = isActiveAdmin(adminData);

        setState({
          user,
          isAdmin,
          admin: adminData,
          loading: false,
          error: adminSnapshot.exists() && !isAdmin
            ? "Your admin record exists, but it is not active or has an unsupported role."
            : null
        });
      } catch (error) {
        setState({
          user,
          isAdmin: false,
          admin: null,
          loading: false,
          error: error.code === "permission-denied"
            ? `Firestore denied reading admins/${user.uid}. Deploy the dashboard Firestore rules and confirm this app points to the project that contains the admin document.`
            : error.message
        });
      }
    });
  }, []);

  return state;
}
