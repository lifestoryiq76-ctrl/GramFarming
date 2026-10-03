const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// --- 0. Simple Express Server for Render Port Binding ---
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Gram Farming Admin Bot is running successfully! 🚀');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// --- 1. Telegram Bot Initialization ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
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

// Admin Telegram User IDs
const ADMIN_IDS = ['6806028116']; 

const isAdmin = (ctx) => {
  return ADMIN_IDS.includes(ctx.from.id.toString()) || ADMIN_IDS.length === 0;
};

// --- 3. Bot Commands & Keyboard ---
bot.start((ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⚠️ Aapke paas is bot ko use karne ki permission nahi hai.');
  }

  ctx.reply('⚙️ *Gram Farming Admin Bot*\n\nNiche diye gaye options me se select karein:', {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        [{ text: '👥 Total Users Check' }, { text: '⏳ Pending Withdrawals' }],
        [{ text: '📢 Broadcast Message' }]
      ],
      resize_keyboard: true
    }
  });
});

// --- 4. Total Users Check Handler ---
bot.hears('👥 Total Users Check', async (ctx) => {
  if (!isAdmin(ctx)) return;

  try {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    
    if (!snapshot.exists()) {
      return ctx.reply('👥 Abhi tak koi user registered nahi hai.');
    }

    const usersData = snapshot.val();
    const totalUsers = Object.keys(usersData).length;

    return ctx.reply(`📊 *Total Registered Users:* ${totalUsers}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching users:', error);
    return ctx.reply(`❌ Error fetching users: ${error.message}`);
  }
});

// --- 5. Pending Withdrawals Handler ---
bot.hears('⏳ Pending Withdrawals', async (ctx) => {
  if (!isAdmin(ctx)) return;

  try {
    const withdrawalsRef = db.ref('withdrawals');
    const snapshot = await withdrawalsRef.once('value');

    if (!snapshot.exists()) {
      return ctx.reply('💸 Koi withdrawal request maujood nahi hai.');
    }

    let message = '💸 *Pending Withdrawals List:*\n\n';
    let count = 0;

    snapshot.forEach((childSnapshot) => {
      const w = childSnapshot.val();
      if (w.status === 'pending' || !w.status || w.status.includes('Pending')) {
        count++;
        message += `👤 User: ${w.username || w.userId || 'N/A'}\n`;
        messageляти += `💰 Amount: ${w.amount}\n`;
        message += `🌐 Method/Wallet: ${w.payoutMethod || w.walletDetails || 'N/A'}\n`;
        message += `-------------------\n`;
      }
    });

    if (count === 0) {
      return ctx.reply('✅ Koi bhi pending withdrawal request nahi hai!');
    }

    return ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    return ctx.reply(`❌ Error fetching withdrawals: ${error.message}`);
  }
});

// --- 6. Broadcast Message ---
bot.hears('📢 Broadcast Message', (ctx) => {
  if (!isAdmin(ctx)) return;
  return ctx.reply('📢 Broadcast feature ke liye command use karein: /broadcast [Aapka message]');
});

bot.command('broadcast', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const text = ctx.message.text.replace('/broadcast', '').trim();
  if (!text) {
    return ctx.reply('⚠️ Kripya message bhi likhein. Example: /broadcast Hello users!');
  }

  try {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');

    if (!snapshot.exists()) {
      return ctx.reply('❌ Broadcast ke liye koi users nahi mile.');
    }

    let successCount = 0;
    const users = snapshot.val();

    for (const userId of Object.keys(users)) {
      try {
        await bot.telegram.sendMessage(userId, text);
        successCount++;
      } catch (err) {}
    }

    return ctx.reply(`✅ Broadcast successfully sent to ${successCount} users!`);
  } catch (error) {
    return ctx.reply(`❌ Broadcast Error: ${error.message}`);
  }
});

bot.launch().then(() => {
  console.log('Telegram Admin Bot is running successfully! 🚀');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
