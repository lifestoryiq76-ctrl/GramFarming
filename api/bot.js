const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');

const app = express();
app.use(express.json());

// Root URL par HTML Web App (index.html) serve karein
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Firebase REST Setup
const FIREBASE_DATABASE_URL = "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com";
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function setFirebaseData(path, data) {
    try {
        await fetch(`${FIREBASE_DATABASE_URL}/${path}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return true;
    } catch(e) { return false; }
}

async function getFirebaseData(path) {
    try {
        let res = await fetch(`${FIREBASE_DATABASE_URL}/${path}.json`);
        return await res.json();
    } catch(e) { return null; }
}

async function updateFirebaseData(path, data) {
    try {
        await fetch(`${FIREBASE_DATABASE_URL}/${path}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return true;
    } catch(e) { return false; }
}

// Telegram Bot Setup
const BOT_TOKEN = process.env.BOT_TOKEN || '8887103142:AAEBZAe-bi4ylcSauB-mMGxf97iVxHaZrlE';
const ADMIN_ID = Number(process.env.ADMIN_TELEGRAM_ID || 6806028116);
const bot = new Telegraf(BOT_TOKEN);
const MINI_APP_URL = "https://gram-farming.vercel.app";

// Payout Channel Username
const PAYOUT_CHANNEL = '@GramFarming_Payout';

// Helper Function: Daily Check-in Reminder
async function sendDailyCheckinReminder(chatId, streakCount) {
  try {
    const messageText = `📅 <b>Daily Check-in Reminder</b>\n\n` +
      `You haven't claimed your daily check-in yet. Keep your streak going and secure today's reward.\n\n` +
      `🔥 Current streak: <b>${streakCount} day(s)</b>\n` +
      `🎁 Today's reward: <b>0.01 Coin</b>\n\n` +
      `Open the app and check in before the day ends to keep your streak.`;

    await bot.telegram.sendMessage(chatId, messageText, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Open Gram Farming', MINI_APP_URL)]
      ])
    });
  } catch (err) {
    console.error(`Failed to send check-in reminder to ${chatId}:`, err.message);
  }
}

// Helper Function: Custom Broadcast Message
async function sendBroadcastMessage(chatId, title, body) {
  try {
    const formattedMessage = `<b>${title}</b>\n\n${body}`;
    await bot.telegram.sendMessage(chatId, formattedMessage, { parse_mode: 'HTML' });
  } catch (err) {
    console.error(`Failed to send broadcast to ${chatId}:`, err.message);
  }
}

// Helper Function: Send Payout Proof to Telegram Channel
async function sendPayoutNotification(withdrawalData) {
  const { userId, amount, currency, method } = withdrawalData;
  const maskedUser = userId ? `${userId.toString().slice(0, 4)}***` : 'User';

  const message = `🎉 <b>NEW WITHDRAWAL APPROVED!</b> 🎉\n\n` +
                  `👤 <b>User ID:</b> <code>${maskedUser}</code>\n` +
                  `💰 <b>Amount:</b> <b>${amount} ${currency || 'GRAM'}</b>\n` +
                  `💳 <b>Method:</b> ${method || 'FaucetPay / Wallet'}\n` +
                  `⚡ <b>Status:</b> Completed ✅\n\n` +
                  `🌐 <b>Play & Earn:</b> @gram_farmingbot`;

  try {
    await bot.telegram.sendMessage(PAYOUT_CHANNEL, message, { parse_mode: 'HTML' });
    console.log('Payout proof posted successfully to channel!');
  } catch (error) {
    console.error('Failed to post payout proof to channel:', error.message);
  }
}

// 1. BROADCAST NOTIFICATION LISTENER (From Admin Panel)
async function pollBroadcasts() {
  const broadcasts = await getFirebaseData('botBroadcasts');
  if (broadcasts) {
    for (let key in broadcasts) {
      let data = broadcasts[key];
      if (data && data.status === 'pending') {
        const { title, body } = data;
        const users = await getFirebaseData('users');
        if (users) {
          for (let userId in users) {
            await sendBroadcastMessage(userId, title, body);
          }
        }
        await updateFirebaseData(`botBroadcasts/${key}`, { status: 'sent' });
      }
    }
  }
}
setInterval(pollBroadcasts, 10000);

// 2. AUTOMATED PAYOUT NOTIFICATION LISTENER (From Admin Panel / Firebase)
async function pollPayouts() {
  const withdrawals = await getFirebaseData('withdrawals');
  if (withdrawals) {
    for (let key in withdrawals) {
      let data = withdrawals[key];
      if (data && data.status === 'approved' && !data.postedToChannel) {
        await sendPayoutNotification(data);
        await updateFirebaseData(`withdrawals/${key}`, { postedToChannel: true });
      }
    }
  }
}
setInterval(pollPayouts, 5000);

// 3. DAILY AUTO CHECK-IN REMINDER (Cron Job - Daily at 10:00 AM)
cron.schedule('0 10 * * *', async () => {
  console.log('Sending Daily Check-in Reminders...');
  const users = await getFirebaseData('users');
  if (users) {
    for (let userId in users) {
      let userData = users[userId] || {};
      let currentStreak = userData.streak || 1;
      await sendDailyCheckinReminder(userId, currentStreak);
    }
  }
});

// Bot Commands
bot.command(['start', 'admin'], (ctx) => {
    ctx.reply(
        "🌱 *Gram Farming Admin Panel*",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📺 Ad Limits & Rewards', 'menu_ads')],
                [Markup.button.callback('🌐 Economic Settings', 'menu_general')],
                [Markup.button.url('📢 Payout Channel', `https://t.me/${PAYOUT_CHANNEL.replace('@', '')}`)]
            ])
        }
    );
});

// Webhook Handling
app.post('/api/bot', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) {
        res.status(500).send('Error');
    }
});

app.get('/api/bot', async (req, res) => {
    try {
        const webhookUrl = `https://${req.headers.host}/api/bot`;
        await bot.telegram.setWebhook(webhookUrl);
        res.send(`✅ Webhook set: ${webhookUrl}`);
    } catch (err) {
        res.status(500).send(`❌ Error: ${err.message}`);
    }
});

module.exports = app;
