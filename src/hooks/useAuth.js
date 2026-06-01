import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";

const adminRoles = new Set(["owner", "admin"]);
const adminVerificationRequests = new Map();

function isActiveAdmin(data) {
  return data?.active === true && adminRoles.has(data?.role);
}

async function verifyAdmin(uid) {
  if (!adminVerificationRequests.has(uid)) {
    const request = getDoc(doc(db, "admins", uid))
      .then((adminSnapshot) => {
        const adminData = adminSnapshot.exists() ? adminSnapshot.data() : null;

        return {
          exists: adminSnapshot.exists(),
          data: adminData,
          isAdmin: isActiveAdmin(adminData)
        };
      })
      .finally(() => {
        adminVerificationRequests.delete(uid);
      });

    adminVerificationRequests.set(uid, request);
  }

  return adminVerificationRequests.get(uid);
}

function authErrorMessage(error, uid) {
  if (error.code === "permission-denied") {
    return `Firestore denied reading admins/${uid}. Deploy the dashboard Firestore rules and confirm this app points to the project that contains the admin document.`;
  }

  return error.message;
}

export function useAuth() {
  const [state, setState] = useState({
    user: null,
    isAdmin: false,
    admin: null,
    loading: true,
    error: null
  });
  const verificationRunRef = useRef(0);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const verificationRun = verificationRunRef.current + 1;
      verificationRunRef.current = verificationRun;

      if (!user) {
        if (active) {
          setState({
            user: null,
            isAdmin: false,
            admin: null,
            loading: false,
            error: null
          });
        }
        return;
      }

      try {
        const adminVerification = await verifyAdmin(user.uid);

        if (!active || verificationRunRef.current !== verificationRun) {
          return;
        }

        setState({
          user,
          isAdmin: adminVerification.isAdmin,
          admin: adminVerification.data,
          loading: false,
          error: adminVerification.exists && !adminVerification.isAdmin
            ? "Your admin record exists, but it is not active or has an unsupported role."
            : null
        });
      } catch (error) {
        if (!active || verificationRunRef.current !== verificationRun) {
          return;
        }

        setState({
          user,
          isAdmin: false,
          admin: null,
          loading: false,
          error: authErrorMessage(error, user.uid)
        });
      }
    });

    return () => {
      active = false;
      verificationRunRef.current += 1;
      unsubscribe();
    };
  }, []);

  return state;
}
