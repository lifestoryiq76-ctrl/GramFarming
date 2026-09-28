const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, update } = require('firebase/database');
const { Telegraf } = require('telegraf');

// Aapka Firebase Web Config
const firebaseConfig = {
  apiKey: "AIzaSyCx2g_tueJ0tqghMMlh4z20ltA_UlLe_Hg",
  authDomain: "gramfarmingbot-1a570.firebaseapp.com",
  databaseURL: "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com",
  projectId: "gramfarmingbot-1a570",
  storageBucket: "gramfarmingbot-1a570.firebasestorage.app",
  messagingSenderId: "113291680927",
  appId: "1:113291680927:web:cb20c9f6b7914a546156aa"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// Telegram Bot Setup
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new Telegraf(BOT_TOKEN);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== TELEGRAM BOT LOGIC ====================
bot.start(async (ctx) => {
  try {
    const userId = String(ctx.from.id);
    const username = ctx.from.username || 'Anonymous';
    const firstName = ctx.from.first_name || '';
    const payload = ctx.payload; 
    let referrerId = null;

    if (payload && payload !== userId) {
      referrerId = payload;
    }

    const userRef = ref(db, 'users/' + userId);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      const newUser = {
        userId: userId,
        username: username,
        firstName: firstName,
        balance: 0,
        energy: 100,
        referredBy: referrerId,
        createdAt: Date.now(),
        lastActive: Date.now()
      };
      
      await set(userRef, newUser);

      if (referrerId) {
        const referrerRef = ref(db, 'users/' + referrerId);
        const refSnapshot = await get(referrerRef);
        if (refSnapshot.exists()) {
          const currentBal = refSnapshot.val().balance || 0;
          await update(referrerRef, { balance: currentBal + 50 });
          bot.telegram.sendMessage(referrerId, `🎉 Someone joined using your referral link! You earned 50 coins.`).catch(() => {});
        }
      }

      ctx.reply(`Welcome to the Bot, ${firstName}! 🚀\nYour account has been created successfully.`);
    } else {
      await update(userRef, { lastActive: Date.now() });
      ctx.reply(`Welcome back, ${firstName}! ⚡ Ready to farm?`);
    }
  } catch (error) {
    console.error('Bot Start Error:', error);
    ctx.reply('An error occurred. Please try again later.');
  }
});

bot.launch().then(() => {
  console.log('🤖 Telegram Bot is running with Web SDK Realtime DB!');
});


// ==================== EXPRESS API ROUTES ====================
app.get('/', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Server is Live and Connected to Firebase Realtime Database!' 
  });
});

// User Auth / Sync Route
app.post('/api/user/auth', async (req, res) => {
  try {
    const { userId, username, firstName, referrerId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'UserId is required' });
    }

    const userRef = ref(db, 'users/' + String(userId));
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      const newUser = {
        userId: String(userId),
        username: username || 'Anonymous',
        firstName: firstName || '',
        balance: 0,
        energy: 100,
        referredBy: referrerId || null,
        createdAt: Date.now(),
        lastActive: Date.now()
      };
      
      await set(userRef, newUser);
      return res.status(201).json({ success: true, message: 'User registered', data: newUser });
    } else {
      await update(userRef, { lastActive: Date.now() });
      return res.status(200).json({ success: true, message: 'User logged in', data: snapshot.val() });
    }
  } catch (error) {
    console.error('Auth API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get User Profile & Balance
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userRef = ref(db, 'users/' + String(userId));
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: snapshot.val() });
  } catch (error) {
    console.error('Fetch User Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Balance Route (Admin panel / Mini app)
app.post('/api/user/update-balance', async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || amount === undefined) {
      return res.status(400).json({ success: false, message: 'UserId and amount are required' });
    }

    const userRef = ref(db, 'users/' + String(userId));
    const snapshot = await get(userRef);

    let currentBalance = 0;
    if (snapshot.exists() && snapshot.val().balance !== undefined) {
      currentBalance = Number(snapshot.val().balance);
    }

    const newBalance = currentBalance + Number(amount);

    await update(userRef, {
      balance: newBalance,
      lastActive: Date.now()
    });

    res.status(200).json({ 
      success: true, 
      message: 'Balance updated successfully', 
      newBalance: newBalance 
    });
  } catch (error) {
    console.error('Update Balance Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 10000; // Render port 10000 use karta hai
app.listen(PORT, () => {
  console.log(`🚀 Server running smoothly on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
