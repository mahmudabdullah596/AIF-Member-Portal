
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Replace with your Firebase project configuration
// You can find this in your Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: "AIzaSyCr0okEKDO9417ZCY9JNkqRnOpVTBTPFtk",
  authDomain: "aif-member-portal.firebaseapp.com",
  databaseURL: "https://aif-member-portal-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aif-member-portal",
  storageBucket: "aif-member-portal.firebasestorage.app",
  messagingSenderId: "397666821985",
  appId: "1:397666821985:web:5be26f2db8be8d9b01c720"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
