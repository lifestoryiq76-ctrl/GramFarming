import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Global settings object
window.gameSettings = {
    general: {},
    trees: {},
    staking: {}
};

// 🔴 Real-time Listener: Jaise hi Admin Panel se data change hoga, Mini App me turant update ho jayega
function listenAdminSettings() {
    const settingsRef = ref(db, 'adminSettings');
    
    onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            window.gameSettings = data;
            console.log("Live Admin Settings Updated:", data);
            
            // Yahan values ko game ke variables / UI par apply kar dein
            applySettingsToGame(data);
        } else {
            console.log("No admin settings found in database.");
        }
    }, (error) => {
        console.error("Error listening to admin settings:", error);
    });
}

// Game start hote hi listener chalu ho jayega
window.addEventListener('DOMContentLoaded', () => {
    listenAdminSettings();
});

function applySettingsToGame(data) {
    try {
        // Example: General settings apply karna
        if (data.general) {
            window.coinUsdtValue = data.general.coinUsdtValue || 0.01;
            window.dailyBonusReward = data.general.dailyBonus || 1.00;
        }

        // Example: Trees settings apply karna (Aap apne game ke variables ke mutabiq yahan set karein)
        if (data.trees) {
            window.treeSettings = data.trees;
        }

        console.log("Game variables updated successfully from Admin Panel!");
    } catch (err) {
        console.error("Error applying settings:", err);
    }
}
