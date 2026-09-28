import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCx2g_tueJ0tqghMMlh4z20ltA_UlLe_Hg",
  authDomain: "gramfarmingbot-1a570.firebaseapp.com",
  databaseURL: "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com",
  projectId: "gramfarmingbot-1a570",
  storageBucket: "gramfarmingbot-1a570.firebasestorage.app",
  messagingSenderId: "113291680927",
  appId: "1:113291680927:web:cb20c9f6b7914a546156aa"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const settingsRef = ref(db, 'adminSettings/general');
onValue(settingsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        console.log("Settings data mil gaya:", data);
        
        // Aap in values ko apne app me use kar sakte hain
        window.coinPerClick = data.coinPerClick;
        window.timer = data.timer;
        window.minWithdrawal = data.minWithdrawal;
    }
});
