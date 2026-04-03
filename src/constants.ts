import { Checkpoint, GameData, GameSession } from './types';
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export const DEFAULT_CHECKPOINTS: Checkpoint[] = [
  {
    id: '1',
    name: "Wielkie Drzewo",
    hint: "Szukaj tam, gdzie liście szumią najgłośniej i dają najwięcej cienia.",
    task: "Zróbcie 5 pajacyków razem!",
    requirePhoto: false,
    qrNumber: 1
  },
  {
    id: '2',
    name: "Ławka w Ogrodzie",
    hint: "Miejsce, gdzie można usiąść i odpocząć po długim biegu.",
    task: "Znajdźcie coś czerwonego i zróbcie temu zdjęcie!",
    requirePhoto: true,
    qrNumber: 2
  }
];

export const STORAGE_KEY = 'easter_egg_hunt_config';
export const GAME_ID_KEY = 'easter_egg_hunt_id';
export const PARENT_ID_KEY = 'easter_egg_hunt_parent_id';

export const generateGameId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const getParentId = () => {
  let id = localStorage.getItem(PARENT_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
    localStorage.setItem(PARENT_ID_KEY, id);
  }
  return id;
};

export const saveGameToFirebase = async (gameId: string, checkpoints: Checkpoint[]) => {
  const path = `games/${gameId}`;
  try {
    const parentId = getParentId();
    const gameRef = doc(db, 'games', gameId);
    await setDoc(gameRef, {
      id: gameId,
      parentId,
      checkpoints,
      createdAt: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const loadUserGamesFromFirebase = async (): Promise<GameData[]> => {
  const path = `games`;
  try {
    const parentId = getParentId();
    const gamesRef = collection(db, 'games');
    const q = query(gamesRef, where('parentId', '==', parentId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as GameData);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const loadGameFromFirebase = async (gameId: string): Promise<Checkpoint[] | null> => {
  const path = `games/${gameId}`;
  try {
    const gameRef = doc(db, 'games', gameId);
    const snap = await getDoc(gameRef);
    if (snap.exists()) {
      return (snap.data() as GameData).checkpoints;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const saveSessionToFirebase = async (session: GameSession) => {
  const path = `sessions/${session.id}`;
  try {
    const sessionRef = doc(db, 'sessions', session.id);
    await setDoc(sessionRef, session);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const loadSessionsFromFirebase = async (gameId: string): Promise<GameSession[]> => {
  const path = `sessions`;
  try {
    const sessionsRef = collection(db, 'sessions');
    const q = query(
      sessionsRef, 
      where('gameId', '==', gameId),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as GameSession);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};
