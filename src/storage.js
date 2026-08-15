import { db, auth } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");
  return uid;
}

function refFor(key, shared) {
  if (shared) return doc(db, "public", key);
  const uid = requireUid();
  return doc(db, "users", uid, "kv", key);
}

export const storage = {
  async get(key, shared = false) {
    const ref = refFor(key, shared);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const err = new Error(`Key not found: ${key}`);
      err.code = "not-found";
      throw err;
    }
    return { key, value: snap.data().value, shared };
  },

  async set(key, value, shared = false) {
    const ref = refFor(key, shared);
    await setDoc(ref, { value, updatedAt: Date.now() });
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    const ref = refFor(key, shared);
    await deleteDoc(ref);
    return { key, deleted: true, shared };
  },

  async list(prefix = "", shared = false) {
    const colRef = shared ? collection(db, "public") : collection(db, "users", requireUid(), "kv");
    const snap = await getDocs(colRef);
    const keys = snap.docs.map((d) => d.id).filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared };
  },
};
