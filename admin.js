import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Admin Data Load Function
window.loadAdminData = async function() {
  try {
    // Load Settings
    let settingsSnap = await get(ref(db, 'adminSettings'));
    if(settingsSnap.exists()) {
      let s = settingsSnap.val();
      if(s.general) {
        if(document.getElementById('coinUsdtValue')) document.getElementById('coinUsdtValue').value = s.general.coinUsdtValue || 0.01;
        if(document.getElementById('dailyBonusAmt')) document.getElementById('dailyBonusAmt').value = s.general.dailyBonus || 2.00;
        if(document.getElementById('refBonusPct')) document.getElementById('refBonusPct').value = s.general.refBonus || 20;
        if(document.getElementById('minWithdrawal')) document.getElementById('minWithdrawal').value = s.general.minWithdrawal || 0.05;
      }
    }

    // Load Withdrawals
    let withdrawSnap = await get(ref(db, 'withdrawals'));
    let tbody = document.getElementById('withdrawalsTableBody');
    if(tbody) {
      tbody.innerHTML = '';
      if(withdrawSnap.exists()) {
        withdrawSnap.forEach((childSnap) => {
          let wId = childSnap.key;
          let w = childSnap.val();
          let row = `<tr>
            <td>${w.username || 'User'}</td>
            <td>${w.amount}</td>
            <td>${w.walletDetails}</td>
            <td>${w.status || 'Pending ⏳'}</td>
            <td><button onclick="approveWithdrawal('${wId}')" style="background:#22c55e; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Approve</button></td>
          </tr>`;
          tbody.innerHTML += row;
        });
      } else {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:15px; color:#94a3b8;">No withdrawal requests found.</td></tr>`;
      }
    }
  } catch(e) {
    console.log("Admin load error:", e);
  }
};

// Save Admin Settings
window.saveAdminSettings = async function() {
  let coinUsdtValue = parseFloat(document.getElementById('coinUsdtValue').value) || 0.01;
  let dailyBonus = parseFloat(document.getElementById('dailyBonusAmt').value) || 2.00;
  let refBonus = parseFloat(document.getElementById('refBonusPct').value) || 20;
  let minWithdrawal = parseFloat(document.getElementById('minWithdrawal'].value) || 0.05;

  try {
    await update(ref(db, 'adminSettings/general'), {
      coinUsdtValue, dailyBonus, refBonus, minWithdrawal
    });
    alert("Settings saved successfully to Realtime Database!");
  } catch(e) {
    alert("Error saving settings: " + e.message);
  }
};

// Approve Withdrawal
window.approveWithdrawal = async function(wId) {
  try {
    await update(ref(db, 'withdrawals/' + wId), { status: 'Approved ✅' });
    alert("Withdrawal approved!");
    loadAdminData();
  } catch(e) {
    alert("Error: " + e.message);
  }
};

// Automatically load data when page opens
document.addEventListener("DOMContentLoaded", () => {
  loadAdminData();
});
