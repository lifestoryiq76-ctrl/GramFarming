// Apni Firebase Configuration yahan dalein
var firebaseConfig = {
  apiKey: "AIzaSyCx2g_tueJ0tqghMMlh4z20ltA_UlLe_Hg",
  authDomain: "gramfarmingbot-1a570.firebaseapp.com",
  databaseURL: "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com",
  projectId: "gramfarmingbot-1a570",
  storageBucket: "gramfarmingbot-1a570.firebasestorage.app",
  messagingSenderId: "113291680927",
  appId: "1:113291680927:web:cb20c9f6b7914a546156aa"
};

// Firebase initialize karein
firebase.initializeApp(firebaseConfig);
var db = firebase.database();

// Save button dabane par data save karne ka function
function saveSettings() {
    var coinVal = document.getElementById('coinInput').value;
    var timerVal = document.getElementById('timerInput').value;
    var withdrawVal = document.getElementById('withdrawInput').value;

    // Database ke 'adminSettings/general' path par data save karna
    db.ref('adminSettings/general').set({
        coinPerClick: Number(coinVal),
        timer: Number(timerVal),
        minWithdrawal: Number(withdrawVal)
    })
    .then(function() {
        alert("Settings successfully save ho gaya!");
    })
    .catch(function(error) {
        alert("Error: " + error.message);
    });
}
