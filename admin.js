const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Telegraf } = require('telegraf');

// Telegram Bot Token
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new Telegraf(BOT_TOKEN);

// Firebase Initialization with Realtime Database URL
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com"
  });
}

const db = admin.database(); // Realtime Database instance
const app = express();

// Middleware
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

    const userRef = db.ref('users/' + userId);
    const snapshot = await userRef.get();

    if (!snapshot.exists()) {
      // Naya user Realtime DB me save karein
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
      
      await userRef.set(newUser);

      // Referrer bonus update
      if (referrerId) {
        const referrerRef = db.ref('users/' + referrerId);
        const refSnapshot = await referrerRef.get();
        if (refSnapshot.exists()) {
          const currentBal = refSnapshot.val().balance || 0;
          await referrerRef.update({ balance: currentBal + 50 });
          bot.telegram.sendMessage(referrerId, `🎉 Someone joined using your referral link! You earned 50 coins.`).catch(() => {});
        }
      }

      ctx.reply(`Welcome to the Bot, ${firstName}! 🚀\nYour account has been created successfully.`);
    } else {
      await userRef.update({ lastActive: Date.now() });
      ctx.reply(`Welcome back, ${firstName}! ⚡ Ready to farm?`);
    }
  } catch (error) {
    console.error('Bot Start Error:', error);
    ctx.reply('An error occurred. Please try again later.');
  }
});

bot.launch().then(() => {
  console.log('🤖 Telegram Bot is running with Realtime Database!');
});


// ==================== EXPRESS API ROUTES ====================

// 1. Server Status Check
app.get('/', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Server is Live and Connected to Firebase Realtime Database!' 
  });
});

// 2. User Data Auth / Sync Route (Mini App ke liye)
app.post('/api/user/auth', async (req, res) => {
  try {
    const { userId, username, firstName, referrerId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'UserId is required' });
    }

    const userRef = db.ref('users/' + String(userId));
    const snapshot = await userRef.get();

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
      
      await userRef.set(newUser);
      return res.status(201).json({ success: true, message: 'User registered', data: newUser });
    } else {
      await userRef.update({ lastActive: Date.now() });
      return res.status(200).json({ success: true, message: 'User logged in', data: snapshot.val() });
    }
  } catch (error) {
    console.error('Auth API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Get User Profile & Balance
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userRef = db.ref('users/' + String(userId));
    const snapshot = await userRef.get();

    if (!snapshot.exists()) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: snapshot.val() });
  } catch (error) {
    console.error('Fetch User Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Update Balance Route (Admin panel ya mining se balance update karne ke liye)
app.post('/api/user/update-balance', async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || amount === undefined) {
      return res.status(400).json({ success: false, message: 'UserId and amount are required' });
    }

    const userRef = db.ref('users/' + String(userId));
    const snapshot = await userRef.get();

    let currentBalance = 0;
    if (snapshot.exists() && snapshot.val().balance !== undefined) {
      currentBalance = Number(snapshot.val().balance);
    }

    const newBalance = currentBalance + Number(amount);

    await userRef.update({
      balance: newBalance,
      lastActive: Date.now()
    });

    res.status(200).json({ 
      success: true, 
      message: 'Balance updated successfully in Realtime DB', 
      newBalance: newBalance 
    });
  } catch (error) {
    console.error('Update Balance Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running smoothly on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
