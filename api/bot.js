const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Firebase REST Setup
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

// Credentials Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || '8823465549:AAFfNZ1hDHR_eAWIeH5eWLCEm6dLkuSfhN0';
const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY || '54554fbd31a9a72c7e84e4418b59abcde50bd6921c4a89d8dd86ae9b7c8df90a';
const bot = new Telegraf(BOT_TOKEN);
const MINI_APP_URL = "https://gram-farming.vercel.app";
const PAYOUT_CHANNEL = '@GramFarming_Payout';

// Helper Function: Send Payout Proof to Telegram Channel
async function sendPayoutNotification(withdrawalData) {
  try {
    const { userId, userName, name, amount, tonAmount, received, currency, method, txUrl, date, destination } = withdrawalData || {};
    
    const formattedDate = date || new Date().toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const finalName = userName || name || (userId ? `User_${String(userId).slice(0, 4)}***` : 'Member');
    const finalAmount = amount || tonAmount || received || '0.00';
    const finalCurrency = currency || (method === 'TON' ? 'TON' : 'USDT');
    const finalMethod = method || 'TON Wallet / FaucetPay';

    const message = `💸 <b>Instant Payout Success</b> 💸\n\n` +
                    `🗣️ <b>User:</b> ${finalName}\n` +
                    `💳 <b>Method:</b> ${finalMethod}\n` +
                    `💸 <b>Amount:</b> <b>${finalAmount} ${finalCurrency}</b>\n` +
                    `📍 <b>Destination:</b> ${destination || 'N/A'}\n` +
                    `📅 <b>Date:</b> ${formattedDate}\n` +
                    `✅ <b>Status:</b> SUCCESS (Approved)`;

    const buttonUrl = txUrl || MINI_APP_URL;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('🚀 Open Mini App', buttonUrl)]
    ]);

    await bot.telegram.sendMessage(PAYOUT_CHANNEL, message, {
      parse_mode: 'HTML',
      ...keyboard
    });
    console.log("✅ Channel Notification Sent Successfully!");
    return true;
  } catch (error) {
    console.error('❌ Failed to post payout proof to channel:', error.description || error.message);
    return false;
  }
}

// Automatic FaucetPay Merchant API Integration
async function handleFaucetPayPayout(req, res) {
  const { email, amount, currency, userId, displayName } = req.body;

  if (!email || !amount) {
    return res.status(400).json({ success: false, message: "Email and amount are required." });
  }

  try {
    const numericAmount = parseFloat(amount);
    const satoshiAmount = Math.round(numericAmount * 100000000);

    const params = new URLSearchParams({
      api_key: FAUCETPAY_API_KEY,
      to: email,
      amount: String(satoshiAmount),
      currency: currency || 'USDT'
    });

    const faucetPayResponse = await axios.post('https://faucetpay.io/api/v1/send', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 15000
    });

    if (faucetPayResponse.data && faucetPayResponse.data.status === 200) {
      const payoutData = {
        userId: userId,
        userName: displayName,
        amount: amount,
        currency: currency || 'USDT',
        method: 'FAUCETPAY',
        destination: email,
        status: 'SUCCESS (Approved)',
        date: new Date().toLocaleString()
      };

      await sendPayoutNotification(payoutData);

      return res.status(200).json({
        success: true,
        message: "Payout sent successfully!",
        payout_id: faucetPayResponse.data.payout_id
      });
    } else {
      return res.status(400).json({
        success: false,
        message: faucetPayResponse.data.html_message || faucetPayResponse.data.message || "FaucetPay transfer failed."
      });
    }
  } catch (error) {
    console.error("FaucetPay Payout Error:", error.message);
    const errorMsg = error.response && error.response.data && (error.response.data.html_message || error.response.data.message)
                     ? (error.response.data.html_message || error.response.data.message)
                     : error.message;
    return res.status(500).json({ success: false, error: errorMsg });
  }
}

// Comprehensive Payout Polling Logic for TON & FaucetPay
async function checkAndSendPayouts() {
  const pathsToCheck = ['withdrawals', 'tonWithdrawals', 'faucetpayWithdrawals'];
  
  for (let dbPath of pathsToCheck) {
    try {
      const parentData = await getFirebaseData(dbPath);
      if (!parentData) continue;

      const processWithdrawalItem = async (itemKey, data, currentPath) => {
        if (!data || typeof data !== 'object') return;
        
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
            await updateFirebaseData(`${currentPath}/${itemKey}`, { postedToChannel: true });
          }
        }
      };

      for (let key in parentData) {
        let entry = parentData[key];
        if (!entry) continue;

        if (entry.status || entry.amount || entry.tonAmount || entry.received) {
          await processWithdrawalItem(key, entry, dbPath);
        } else {
          for (let subKey in entry) {
            let subEntry = entry[subKey];
            if (subEntry && typeof subEntry === 'object') {
              await processWithdrawalItem(subKey, subEntry, `${dbPath}/${key}`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error scanning ${dbPath}:`, err.message);
    }
  }
}

// Webhook & Endpoint Handling
app.post('/api/bot', async (req, res) => {
    try {
        if (req.body && req.body.email && req.body.amount) {
            return await handleFaucetPayPayout(req, res);
        }

        await bot.handleUpdate(req.body);
        await checkAndSendPayouts();
        res.status(200).send('OK');
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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
