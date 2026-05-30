import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";

export function useFirestoreCollection(queryRef, deps = []) {
  const [state, setState] = useState({
    data: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    setState((current) => ({
      ...current,
      loading: true,
      error: null
    }));

    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        setState({
          data: snapshot.docs.map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data()
          })),
          loading: false,
          error: null
        });
      },
      (error) => {
        setState({
          data: [],
          loading: false,
          error: error.message
        });
      }
    );

    return unsubscribe;
  }, deps);

  return state;
}
