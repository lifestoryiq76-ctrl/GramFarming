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

// Game start hone par Firebase se latest admin settings load karna
window.addEventListener('DOMContentLoaded', () => {
    loadAdminSettings();
});

function loadAdminSettings() {
    get(ref(db, 'adminSettings')).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            window.gameSettings = data;
            console.log("Admin Settings Loaded successfully in Game:", data);
            
            // Yahan hum settings ko game ke variables me set kar rahe hain
            applySettingsToGame(data);
        }
    }).catch((error) => {
        console.error("Error loading admin settings:", error);
    });
}

function applySettingsToGame(data) {
    try {
        // 1. General Settings apply karna
        if (data.general) {
            window.coinUsdtValue = data.general.coinUsdtValue;
            window.dailyBonusReward = data.general.dailyBonus;
            window.referralBonusPercent = data.general.refBonus;
            window.minWithdrawalLimit = data.general.minWithdrawal;
        }

        // 2. Trees Configuration apply karna
        if (data.trees) {
            window.pineSettings = data.trees.pine;
            window.appleSettings = data.trees.apple;
            window.sakuraSettings = data.trees.sakura;
            window.crystalSettings = data.trees.crystal;
        }

        // 3. Staking APY apply karna
        if (data.staking) {
            window.stakingAPY = data.staking;
        }

        console.log("Settings applied to game variables successfully!");
    } catch (err) {
        console.error("Error applying settings:", err);
    }
}
