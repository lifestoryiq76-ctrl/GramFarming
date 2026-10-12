const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');

const app = express();
app.use(express.json());

// Root URL par HTML Web App (index.html) serve karein
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Firebase REST Setup (Using built-in global fetch directly)
const FIREBASE_DATABASE_URL = "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com";

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
const bot = new Telegraf(BOT_TOKEN);
const MINI_APP_URL = "https://gram-farming.vercel.app";
const PAYOUT_CHANNEL = '@GramFarming_Payout';

// Helper Function: Send Stylish Payout Proof to Telegram Channel
async function sendPayoutNotification(withdrawalData) {
  try {
    const { userId, userName, name, amount, tonAmount, currency, method, txUrl, date } = withdrawalData || {};
    
    const formattedDate = date || new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const finalName = userName || name || (userId ? `User_${String(userId).slice(0, 4)}***` : 'Member');
    const finalAmount = amount || tonAmount || '0.00';
    const finalMethod = method || 'TON Wallet / FaucetPay';

    const message = `✅ <b>Withdrawal Success</b>\n` +
                    `🗣 <b>User:</b> ${finalName}\n` +
                    `💸 <b>Amount:</b> <b>${finalAmount} ${currency || 'TON'}</b>\n` +
                    `💳 <b>Method:</b> ${finalMethod}\n` +
                    `📅 <b>Date:</b> ${formattedDate}`;

    const buttonUrl = txUrl || MINI_APP_URL;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('👀 View transaction', buttonUrl)]
    ]);

    await bot.telegram.sendMessage(PAYOUT_CHANNEL, message, {
      parse_mode: 'HTML',
      ...keyboard
    });
    return true;
  } catch (error) {
    console.error('Failed to post payout proof:', error.message);
    return false;
  }
}

// Payout Polling Logic with Broad Status Matching
async function checkAndSendPayouts() {
  const pathsToCheck = ['withdrawals', 'tonWithdrawals', 'faucetpayWithdrawals'];
  
  for (let dbPath of pathsToCheck) {
    try {
      const withdrawals = await getFirebaseData(dbPath);
      if (withdrawals) {
        for (let key in withdrawals) {
          let data = withdrawals[key];
          if (!data) continue;

          const statusText = String(data.status || '').toLowerCase();
          const isApproved = statusText.includes('approved') || 
                             statusText.includes('success') || 
                             statusText.includes('completed') || 
                             statusText.includes('paid') || 
                             statusText.includes('sent') ||
                             statusText.includes('done');

          if (isApproved && !data.postedToChannel) {
            const success = await sendPayoutNotification(data);
            if (success) {
              await updateFirebaseData(`${dbPath}/${key}`, { postedToChannel: true });
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error in ${dbPath}:`, err.message);
    }
  }
}

// Webhook & Endpoint Handling
app.post('/api/bot', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        await checkAndSendPayouts();
        res.status(200).send('OK');
    } catch (err) {
        res.status(200).send('OK');
    }
});

app.get('/api/bot', async (req, res) => {
    try {
        const webhookUrl = `https://${req.headers.host}/api/bot`;
        await bot.telegram.setWebhook(webhookUrl);
        await checkAndSendPayouts();
        res.status(200).send(`✅ Bot Active, Webhook Set & Payouts Checked Successfully!`);
    } catch (err) {
        res.status(200).send(`⚠️ Handled: ${err.message}`);
    }
});

module.exports = app;
