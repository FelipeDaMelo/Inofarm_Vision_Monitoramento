const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAgxuh5X_KwjyC6H5CC5gBqOoNINsxkcX4",
  authDomain: "inofarmvision.firebaseapp.com",
  databaseURL: "https://inofarmvision-default-rtdb.firebaseio.com",
  projectId: "inofarmvision",
  storageBucket: "inofarmvision.firebasestorage.app",
  messagingSenderId: "372997407875",
  appId: "1:372997407875:web:5ee12f1aadd808ea1d87b6",
  measurementId: "G-EXXJHCEZS1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const querySnapshot = await getDocs(collection(db, "whatsapp_chats"));
  console.log(`Found ${querySnapshot.size} chats`);
  querySnapshot.forEach((doc) => {
    console.log(doc.id, " => ", doc.data());
  });
}

check().catch(console.error);
