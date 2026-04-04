import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAixW6eSeqm1gZUCFFZkBXK9D3cMukr-2o",
  authDomain: "gen-lang-client-0141156119.firebaseapp.com",
  projectId: "gen-lang-client-0141156119",
  storageBucket: "gen-lang-client-0141156119.firebasestorage.app",
  messagingSenderId: "1044937503450",
  appId: "1:1044937503450:web:2257cc201df9e3b4e12be3",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-12c665fc-af67-43b9-82df-7aae5ed763e9");
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
