// ===== js/firebase-config.js =====
// Firebase configuration — замените на свои данные из Firebase Console
// https://console.firebase.google.com/

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCLW6_Pg2YGLvLhgXhjiuOXZHtp8WQ5WB4",
  authDomain: "bmx-app-fa365.firebaseapp.com",
  databaseURL: "https://bmx-app-fa365-default-rtdb.firebaseio.com",
  projectId: "bmx-app-fa365",
  storageBucket: "bmx-app-fa365.firebasestorage.app",
  messagingSenderId: "894492468686",
  appId: "1:894492468686:web:3c95e9d72224e2a389f79f"
};

// ===== Инициализация Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, push, update, remove, onValue, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db = getDatabase(firebaseApp);

// ===== PARTICIPANTS =====
export const ParticipantsDB = {

  async getAll() {
    const snap = await get(ref(db, 'participants'));
    if (!snap.exists()) return {};
    return snap.val();
  },

  async add(data) {
    const newRef = push(ref(db, 'participants'));
    const payload = {
      ...data,
      id: newRef.key,
      createdAt: serverTimestamp()
    };
    await set(newRef, payload);
    return newRef.key;
  },

  async update(id, data) {
    await update(ref(db, `participants/${id}`), { ...data, updatedAt: serverTimestamp() });
  },

  async delete(id) {
    await remove(ref(db, `participants/${id}`));
  },

  // Подписка на изменения — для real-time sync с мобильным
  subscribe(callback) {
    const unsubscribe = onValue(ref(db, 'participants'), snap => {
      callback(snap.exists() ? snap.val() : {});
    });
    return unsubscribe;
  },

  async findByNumber(number) {
    const all = await this.getAll();
    return Object.values(all).find(p => p.uniqueNumber === number) || null;
  }
};

// ===== RACES (ЗАЕЗДЫ) =====
export const RacesDB = {

  async getAll() {
    const snap = await get(ref(db, 'races'));
    if (!snap.exists()) return {};
    return snap.val();
  },

  async get(id) {
    const snap = await get(ref(db, `races/${id}`));
    return snap.exists() ? snap.val() : null;
  },

  async create(data) {
    const newRef = push(ref(db, 'races'));
    const payload = {
      ...data,
      id: newRef.key,
      status: 'planned',       // planned | active | finished
      createdAt: serverTimestamp()
    };
    await set(newRef, payload);
    return newRef.key;
  },

  async update(id, data) {
    await update(ref(db, `races/${id}`), { ...data, updatedAt: serverTimestamp() });
  },

  async delete(id) {
    await remove(ref(db, `races/${id}`));
  },

  // Обновить результаты конкретного участника в заезде
  async updateParticipantResult(raceId, slot, resultData) {
    await update(ref(db, `races/${raceId}/participants/${slot}`), {
      ...resultData,
      updatedAt: serverTimestamp()
    });
  },

  subscribe(callback) {
    const unsubscribe = onValue(ref(db, 'races'), snap => {
      callback(snap.exists() ? snap.val() : {});
    });
    return unsubscribe;
  },

  subscribeOne(id, callback) {
    const unsubscribe = onValue(ref(db, `races/${id}`), snap => {
      callback(snap.exists() ? snap.val() : null);
    });
    return unsubscribe;
  }
};

// ===== EVENTS (СОРЕВНОВАНИЯ) =====
export const EventsDB = {

  async getAll() {
    const snap = await get(ref(db, 'events'));
    if (!snap.exists()) return {};
    return snap.val();
  },

  async get(id) {
    const snap = await get(ref(db, `events/${id}`));
    return snap.exists() ? snap.val() : null;
  },

  async create(data) {
    const newRef = push(ref(db, 'events'));
    await set(newRef, { ...data, id: newRef.key, createdAt: serverTimestamp() });
    return newRef.key;
  },

  async update(id, data) {
    await update(ref(db, `events/${id}`), { ...data, updatedAt: serverTimestamp() });
  },

  subscribe(callback) {
    const unsubscribe = onValue(ref(db, 'events'), snap => {
      callback(snap.exists() ? snap.val() : {});
    });
    return unsubscribe;
  }
};

export { db, ref, onValue, serverTimestamp };
