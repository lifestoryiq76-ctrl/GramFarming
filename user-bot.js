const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- 0. Simple Express Server for Render Port Binding ---
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Gram Farming User Bot is running successfully! 🚀');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// --- 1. Telegram Bot Initialization ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// --- 2. Firebase Admin & Realtime Database Initialization ---
let privateKey = process.env.FIREBASE_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\n...";
privateKey = privateKey.replace(/\\n/g, '\n');

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "gramfarmingbot-1a570",
  private_key_id: "d7e7e98f12c7be3221841c329cf8ca544d029a8b",
  private_key: privateKey,
  client_email: "firebase-adminsdk-fbsvc@gramfarmingbot-1a570.iam.gserviceaccount.com"
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

// --- 3. User Bot Start Command & Auto Registration ---
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const username = ctx.from.username || ctx.from.first_name || 'N/A';

  try {
    const userRef = db.ref('users/' + userId);
    const snapshot = await userRef.once('value');
    
    if (!snapshot.exists()) {
      await userRef.set({
        userId: userId,
        username: username,
        balance: 0,
        joinedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error saving user to DB:', error);
  }

  await ctx.reply('🌾 *Welcome to Gram Farming!*\n\nApni farming shuru karne aur coins earn karne ke liye niche diye gaye button par click karein:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Open Gram Farming', 'https://gramfarming-api.onrender.com')]
    ])
  });
});

bot.launch().then(() => {
  console.log('Telegram User Bot is running successfully! 🚀');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
