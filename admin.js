const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Telegraf } = require('telegraf');

// ==================== CONFIGURATION & SETUP ====================

// Apne Telegram Bot ka token yahan daalein (ya environment variable use karein)
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new Telegraf(BOT_TOKEN);

// Firebase Initialization
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== TELEGRAM BOT LOGIC ====================

// Start command with referral tracking
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Anonymous';
    const firstName = ctx.from.first_name || '';
    
    // Check for referral parameter (e.g., /start 123456789)
    const payload = ctx.payload; 
    let referrerId = null;

    if (payload && payload !== String(userId)) {
      referrerId = payload;
    }

    const userRef = db.collection('users').doc(String(userId));
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Create new user in Firebase
      await userRef.set({
        userId: String(userId),
        username: username,
        firstName: firstName,
        balance: 0,
        energy: 100,
        referredBy: referrerId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      });

      // Give bonus to referrer if valid
      if (referrerId) {
        const referrerRef = db.collection('users').doc(String(referrerId));
        const referrerDoc = await referrerRef.get();
        if (referrerDoc.exists) {
          await referrerRef.update({
            balance: admin.firestore.FieldValue.increment(50) // 50 coins referral bonus
          });
          bot.telegram.sendMessage(referrerId, `🎉 Someone joined using your referral link! You earned 50 coins.`).catch(() => {});
        }
      }

      ctx.reply(`Welcome to the Bot, ${firstName}! 🚀\nYour account has been created successfully.`);
    } else {
      await userRef.update({ lastActive: admin.firestore.FieldValue.serverTimestamp() });
      ctx.reply(`Welcome back, ${firstName}! ⚡ Ready to farm coins?`);
    }
  } catch (error) {
    console.error('Bot Start Error:', error);
    ctx.reply('An error occurred. Please try again later.');
  }
});

// Launch Telegram Bot
bot.launch().then(() => {
  console.log('🤖 Telegram Bot is running successfully!');
});


// ==================== EXPRESS API ROUTES ====================

// 1. Server Status Check
app.get('/', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Telegram Bot & Firebase Server is Live and Fully Connected!' 
  });
});

// 2. User Data Auth / Sync Route (For Mini App)
app.post('/api/user/auth', async (req, res) => {
  try {
    const { userId, username, firstName, referrerId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'UserId is required' });
    }

    const userRef = db.collection('users').doc(String(userId));
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      const newUser = {
        userId: String(userId),
        username: username || 'Anonymous',
        firstName: firstName || '',
        balance: 0,
        energy: 100,
        referredBy: referrerId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await userRef.set(newUser);
      return res.status(201).json({ success: true, message: 'User registered', data: newUser });
    } else {
      await userRef.update({ lastActive: admin.firestore.FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true, message: 'User logged in', data: userDoc.data() });
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
    const userDoc = await db.collection('users').doc(String(userId)).get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: userDoc.data() });
  } catch (error) {
    console.error('Fetch User Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Update Balance (Mining, Ad Watch, or Tasks)
app.post('/api/user/update-balance', async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || amount === undefined) {
      return res.status(400).json({ success: false, message: 'UserId and amount are required' });
    }

    const userRef = db.collection('users').doc(String(userId));
    
    await userRef.update({
      balance: admin.firestore.FieldValue.increment(Number(amount)),
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    });

    const updatedDoc = await userRef.get();

    res.status(200).json({ 
      success: true, 
      message: 'Balance updated successfully', 
      newBalance: updatedDoc.data().balance 
    });
  } catch (error) {
    console.error('Update Balance Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Admin Stats Route
app.get('/api/admin/stats', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;

    let totalCoins = 0;
    usersSnapshot.forEach(doc => {
      totalCoins += doc.data().balance || 0;
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalCoinsDistributed: totalCoins
      }
    });
  } catch (error) {
    console.error('Admin Stats Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server & API running smoothly on port ${PORT}`);
});

// Enable graceful stop for Telegram Bot
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
