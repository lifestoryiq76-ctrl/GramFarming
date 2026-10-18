const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const app = express();
app.use(express.json());

// Serve static files from root directory
app.use(express.static(path.join(__dirname, '..')));

// 1. Explicit Route for TON Connect Manifest (Fixes "Cannot GET /tonconnect-manifest.json")
app.get('/tonconnect-manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.join(__dirname, '..', 'tonconnect-manifest.json'));
});

// 2. Serve main index.html for Root Path
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
const ADMIN_ID = process.env.ADMIN_ID || 0; // Set ADMIN_ID in Vercel Env Var
const bot = new Telegraf(BOT_TOKEN);
const MINI_APP_URL = "https://gram-farming.vercel.app";
const PAYOUT_CHANNEL = '@GramFarming_Payout';

// Helper Function: Send Payout Proof to Telegram Channel
async function sendPayoutNotification(withdrawalData) {
  try {
    const { userId, userName, name, amount, tonAmount, currency, method, txUrl, date, destination } = withdrawalData || {};
    
    const formattedDate = date || new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const finalName = userName || name || (userId ? `User_${String(userId).slice(0, 4)}***` : 'Member');
    const finalAmount = amount || tonAmount || '0.00';
    const finalMethod = method || 'TON Wallet';

    const message = `💸 <b>Payout Success</b> 💸\n\n` +
                    `🗣️ <b>User:</b> ${finalName}\n` +
                    `💳 <b>Method:</b> ${finalMethod}\n` +
                    `💸 <b>Amount:</b> <b>${finalAmount} ${currency || 'TON'}</b>\n` +
                    `📍 <b>Destination:</b> <code>${destination || 'N/A'}</code>\n` +
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

      const reqKey = `fp_${Date.now()}`;
      await updateFirebaseData(`faucetpayWithdrawals/${reqKey}`, { ...payoutData, postedToChannel: true });
      await sendPayoutNotification(payoutData);

      return res.status(200).json({
        success: true,
        message: "FaucetPay Payout sent successfully!",
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

// Manual TON Withdrawal Endpoint
app.post('/api/withdraw/ton', async (req, res) => {
  const { walletAddress, amount, currency, userId, displayName } = req.body;

  if (!walletAddress || !amount) {
    return res.status(400).json({ success: false, message: "Wallet address and amount are required." });
  }

  try {
    const reqKey = `ton_${Date.now()}`;
    const withdrawalData = {
      id: reqKey,
      userId: userId || 'Unknown',
      userName: displayName || 'User',
      amount: amount,
      currency: currency || 'TON',
      method: 'TON Wallet',
      destination: walletAddress,
      status: 'PENDING',
      postedToChannel: false,
      date: new Date().toLocaleString()
    };

    await updateFirebaseData(`tonWithdrawals/${reqKey}`, withdrawalData);

    return res.status(200).json({
      success: true,
      message: "TON Withdrawal Request submitted successfully! It will be processed manually.",
      id: reqKey
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Commands for TON Manual & Multi-send
bot.command('single_ton', async (ctx) => {
  try {
    const data = await getFirebaseData('tonWithdrawals');
    if (!data) return ctx.reply("Koi pending TON withdrawal nahi mila.");

    let responseMsg = "📋 <b>Single TON Withdrawals (Pending):</b>\n\n";
    let count = 0;

    for (let key in data) {
      const item = data[key];
      if (item && item.status === 'PENDING') {
        count++;
        responseMsg += `<b>${count}. Request ID:</b> <code>${key}</code>\n` +
                       `<b>User:</b> ${item.userName} (${item.userId})\n` +
                       `<b>Address:</b> <code>${item.destination}</code>\n` +
                       `<b>Amount:</b> ${item.amount} ${item.currency || 'TON'}\n\n`;
      }
    }

    if (count === 0) return ctx.reply("Koi Pending TON Request nahi hai.");
    ctx.replyWithHTML(responseMsg);
  } catch (err) {
    ctx.reply(`Error: ${err.message}`);
  }
});

bot.command('multisend_ton', async (ctx) => {
  try {
    const data = await getFirebaseData('tonWithdrawals');
    if (!data) return ctx.reply("Multi-send ke liye koi data nahi hai.");

    let batchText = "";
    let count = 0;

    for (let key in data) {
      const item = data[key];
      if (item && item.status === 'PENDING') {
        count++;
        batchText += `${item.destination}, ${item.amount}\n`;
      }
    }

    if (count === 0) return ctx.reply("Multi-send ke liye koi Pending request nahi hai.");

    const msg = `🚀 <b>Multi-Send List (${count} Requests):</b>\n` +
                `<i>Tonkeeper / MyTonWallet Multi-send Tool mein copy-paste karein:</i>\n\n` +
                `<code>${batchText}</code>\n\n` +
                `Payment dene ke baad approve karne ke liye use karein:\n` +
                `<code>/approve_all_ton</code>`;

    ctx.replyWithHTML(msg);
  } catch (err) {
    ctx.reply(`Error: ${err.message}`);
  }
});

bot.command('approve_ton', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const reqId = args[1];

  if (!reqId) return ctx.reply("Kripya Request ID dein. Example: /approve_ton ton_1710000000");

  try {
    const item = await getFirebaseData(`tonWithdrawals/${reqId}`);
    if (!item) return ctx.reply("Yeh Request ID nahi mili.");

    item.status = 'SUCCESS (Approved)';
    await updateFirebaseData(`tonWithdrawals/${reqId}`, item);

    const posted = await sendPayoutNotification(item);
    if (posted) {
      await updateFirebaseData(`tonWithdrawals/${reqId}`, { postedToChannel: true });
    }

    ctx.reply(`✅ Request ${reqId} Approved aur Payout Channel par Post kar diya gaya!`);
  } catch (err) {
    ctx.reply(`Error: ${err.message}`);
  }
});

bot.command('approve_all_ton', async (ctx) => {
  try {
    const data = await getFirebaseData('tonWithdrawals');
    if (!data) return ctx.reply("Approve karne ke liye koi data nahi milha.");

    let approvedCount = 0;
    for (let key in data) {
      const item = data[key];
      if (item && item.status === 'PENDING') {
        item.status = 'SUCCESS (Approved)';
        await updateFirebaseData(`tonWithdrawals/${key}`, item);

        const posted = await sendPayoutNotification(item);
        if (posted) {
          await updateFirebaseData(`tonWithdrawals/${key}`, { postedToChannel: true });
        }
        approvedCount++;
      }
    }

    ctx.reply(`✅ Total ${approvedCount} Requests Approved aur Payout Channel par post ho gaye!`);
  } catch (err) {
    ctx.reply(`Error: ${err.message}`);
  }
});

// Payout Polling Logic (For Admin Panel Manual Approvals)
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

        if (entry.status || entry.amount || entry.tonAmount) {
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
      console.error(`Error in ${dbPath}:`, err.message);
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
