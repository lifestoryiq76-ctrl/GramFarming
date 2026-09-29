import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Global settings object jo game me use hoga
window.gameSettings = {
    general: {},
    trees: {},
    ads: {},
    staking: {}
};

// Game start hone par Firebase से latest admin settings load karna
window.addEventListener('DOMContentLoaded', () => {
    loadAdminSettings();
});

function loadAdminSettings() {
    get(ref(db, 'adminSettings')).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            window.gameSettings = data;
            console.log("Admin Settings Loaded successfully in Game:", data);
            
            // Yahan aap apni game ki values ko update kar sakte hain
            // Jaise ki tree rewards, timers, ya staking percentages ko variables me assign karna
        }
    }).catch((error) => {
        console.error("Error loading admin settings:", error);
    });
}
