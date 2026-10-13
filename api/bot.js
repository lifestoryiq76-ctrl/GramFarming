const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const { TonClient, WalletContractV4, internal, toNano } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');

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

// Telegram Direct Mini App Link (Fixes refresh issue)
const MINI_APP_URL = "https://t.me/GramFarmingbot_bot/app";
const PAYOUT_CHANNEL = '@GramFarming_Payout';

// Initialize TON Client with Toncenter API Key
const tonClient = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TON_API_KEY
});

// Automated TON Transfer via MyTonWallet Seed Phrase
async function processTonBlockchainPayout(toAddress, amountInTon) {
    try {
        if (!process.env.TON_WALLET_MNEMONIC) {
            throw new Error("TON_WALLET_MNEMONIC is missing in Vercel!");
        }

        const mnemonic = process.env.TON_WALLET_MNEMONIC.trim().split(/\s+/);
        const key = await mnemonicToPrivateKey(mnemonic);

        // WalletContractV4 for standard TON Wallets
        const wallet = WalletContractV4.create({ 
            publicKey: key.publicKey, 
            workchain: 0 
        });

        const contract = tonClient.open(wallet);
        const seqno = await contract.getSeqno();

        // Send transaction
        await contract.sendTransfer({
            seqno: seqno,
            secretKey: key.secretKey,
            messages: [
                internal({
                    to: toAddress,
                    value: toNano(String(amountInTon)),
                    bounce: false,
                    body: 'Gram Farming Instant Withdrawal',
                })
            ]
        });

        return { success: true };
    } catch (error) {
        console.error("TON Transfer Error:", error.message);
        return { success: false, error: error.message };
    }
}

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
    const finalCurrency = currency || (method === 'TON' || method === 'TON Blockchain' ? 'TON' : 'USDT');
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

// Endpoint: Instant TON Withdrawal API Route
app.post('/api/ton-withdraw', async (req, res) => {
    const { userId, userName, displayName, amount, tonAddress } = req.body;

    if (!tonAddress || !amount || amount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid address or amount" });
    }

    // 1. Execute Blockchain Transfer
    const tonResult = await processTonBlockchainPayout(tonAddress, amount);

    if (tonResult.success) {
        const payoutDetails = {
            userId: userId,
            userName: userName || displayName,
            amount: amount,
            currency: 'TON',
            method: 'TON Blockchain',
            destination: tonAddress,
            status: 'SUCCESS (Approved)',
            date: new Date().toLocaleString()
        };

        // 2. Trigger Channel Notification Immediately
        await sendPayoutNotification(payoutDetails);

        return res.json({ 
            success: true, 
            message: "Instant TON Payout successful and posted to channel!" 
        });
    } else {
        return res.status(500).json({ 
            success: false, 
            message: "TON Transfer failed: " + tonResult.error 
        });
    }
});

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

// Payout Polling Logic
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

        // Direct trigger from admin panel approval
        if (req.body && req.body.action === 'admin_approval') {
            await sendPayoutNotification(req.body);
            return res.status(200).json({ success: true, message: "Notification sent!" });
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
