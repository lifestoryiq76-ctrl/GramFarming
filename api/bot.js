const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const cron = require('node-cron');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());

// Serve static files from root directory
app.use(express.static(path.join(__dirname, '..')));

// 1. Explicit Route for TON Connect Manifest
app.get('/tonconnect-manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.join(__dirname, '..', 'tonconnect-manifest.json'));
});

// 2. Serve main index.html for Root Path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// MongoDB Connection Setup
const uri = process.env.MONGO_URI || "mongodb+srv://lifestoryiq76_db_user:Rajesh123@cluster0.fpbqneq.mongodb.net/?retryWrites=true&w=majority";
let client;
let dbInstance;

async function getDB() {
    if (dbInstance) return dbInstance;
    if (!client) {
        client = new MongoClient(uri);
        await client.connect();
    }
    dbInstance = client.db('gram_farming');
    return dbInstance;
}

// MongoDB Helper Functions (Replacing Firebase REST)
async function getMongoData(collectionName, query = {}) {
    try {
        const db = await getDB();
        const collection = db.collection(collectionName);
        if (query._id || query.userId || query.key) {
            return await collection.findOne(query);
        }
        const results = await collection.find(query).toArray();
        // Convert array to object key-value pairs if needed to match old structure
        const dataObj = {};
        results.forEach(doc => {
            const docKey = doc.key || doc.userId || doc._id.toString();
            dataObj[docKey] = doc;
        });
        return Object.keys(dataObj).length > 0 ? dataObj : null;
    } catch(e) {
        console.error("Get Mongo Error:", e.message);
        return null;
    }
}

async function updateMongoData(collectionName, filterQuery, updateData) {
    try {
        const db = await getDB();
        const collection = db.collection(collectionName);
        await collection.updateOne(
            filterQuery,
            { $set: updateData },
            { upsert: true }
        );
        return true;
    } catch(e) {
        console.error("Update Mongo Error:", e.message);
        return false;
    }
}

// Credentials Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || '8823465549:AAFfNZ1hDHR_eAWIeH5eWLCEm6dLkuSfhN0';
const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY || '54554fbd31a9a72c7e84e4418b59abcde50bd6921c4a89d8dd86ae9b7c8df90a';
const FAUCETPAY_MERCHANT_USERNAME = process.env.FAUCETPAY_MERCHANT_USERNAME || "lifestoryiq76";

const bot = new Telegraf(BOT_TOKEN);
const MINI_APP_URL = "https://gram-farming.vercel.app";
const PAYOUT_CHANNEL = '@GramFarming_Payout';

/* =========================================================
   1. /start WELCOME MESSAGE COMMAND
   ========================================================= */
bot.start(async (ctx) => {
    const userId = String(ctx.from.id);
    const firstName = ctx.from.first_name || 'User';

    await updateMongoData('users', { userId: userId }, {
        userId: userId,
        name: "👑 " + firstName + (ctx.from.username ? ' (@' + ctx.from.username + ')' : ''),
        telegramChatId: ctx.chat.id
    });

    const welcomeMessage = 
`👋 Hola ${firstName}@ 🌏🌕
Bienvenido/a a Gram Farming

🚀 Un bot de recompensas donde tu tiempo y acciones
se convierten en criptomoneda real

🎉 Completa tareas y gana Coin al instante
👥 Invita amigos y cobra por cada referido
⛏️ Minería automática — acumula Coin mientras duermes
🎮 Juegos — Gram Farming
💸 Retiro instantáneo en USDT · TON

⬇️ Empieza a ganar ahora`;

    return ctx.reply(welcomeMessage, {
        ...Markup.inlineKeyboard([
            [Markup.button.webApp('🚀 Abrir Gram Farming', MINI_APP_URL)]
        ])
    });
});

/* =========================================================
   2. DYNAMIC DAILY CHECK-IN REMINDER FUNCTION (SAFEGUARDED)
   ========================================================= */
async function sendDailyCheckinReminder(chatId, userId) {
    try {
        const todayStr = new Date().toDateString();
        
        const userData = await getMongoData('users', { userId: String(userId) });
        if (userData && userData.lastReminderDate === todayStr) {
            return false; 
        }

        const generalData = await getMongoData('adminSettings', { key: 'general' });
        const dynamicDailyReward = (generalData && generalData.dailyBonus) ? parseFloat(generalData.dailyBonus) : 0.01;

        let currentStreak = userData && userData.streak !== undefined ? userData.streak : 0;

        const reminderMessage = 
`📅 Daily Check-in Reminder

You haven't claimed your daily check-in yet.
Keep your streak going and secure today's reward.

🔥 Current streak: ${currentStreak} day(s)
🎁 Today's reward: ${dynamicDailyReward.toFixed(2)} Coin

Open the app and check in before the day ends to keep your streak.`;

        await bot.telegram.sendMessage(chatId, reminderMessage, {
            ...Markup.inlineKeyboard([
                [Markup.button.webApp('🚀 Open Gram Farming', MINI_APP_URL)]
            ])
        });

        await updateMongoData('users', { userId: String(userId) }, { lastReminderDate: todayStr });
        return true;
    } catch (err) {
        console.error(`Error sending reminder to ${chatId}:`, err.message);
        return false;
    }
}

bot.command('reminder', async (ctx) => {
    await sendDailyCheckinReminder(ctx.chat.id, String(ctx.from.id));
});

/* =========================================================
   3. AUTOMATIC DAILY BROADCAST TIMER (9:30 AM STRICT LOCK)
   ========================================================= */
let lastBroadcastMinute = "";

async function triggerDailyCheckinBroadcast() {
    const now = new Date();
    const currentMinuteKey = `${now.toDateString()}-${now.getHours()}-${now.getMinutes()}`;
    
    if (lastBroadcastMinute === currentMinuteKey) return;
    lastBroadcastMinute = currentMinuteKey;

    console.log("📢 Triggering Daily Check-in Broadcast to users...");
    const usersData = await getMongoData('users');
    if (usersData) {
        for (let uId in usersData) {
            const user = usersData[uId];
            if (user && user.telegramChatId) {
                await sendDailyCheckinReminder(user.telegramChatId, user.userId || uId);
            }
        }
    }
}

setInterval(() => {
    const now = new Date();
    if (now.getHours() === 9 && now.getMinutes() === 30) {
        triggerDailyCheckinBroadcast();
    }
}, 30000);

/* =========================================================
   4. NODE-CRON SCHEDULE FOR 5:30 AM RESET
   ========================================================= */
cron.schedule('30 5 * * *', async () => {
    console.log("⏰ Running 5:30 AM Daily Reset Task...");
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

/* =========================================================
   5. NEW TASK PUBLISH BROADCAST ENDPOINT
   ========================================================= */
app.post('/api/tasks/publish', async (req, res) => {
    const { title, reward } = req.body;

    try {
        const taskTitle = title || 'Earn Mony';
        const taskReward = reward || '0.05';

        const taskMessage = 
`📣 <b>New Paid Task Available!</b>\n\n` +
`🎯 A new paid task is available: <b>${taskTitle}</b>!\n` +
`Complete it now to earn <b>+${taskReward} Coin</b>!`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.webApp('🎯 View Tasks', MINI_APP_URL)]
        ]);

        const usersData = await getMongoData('users');
        let sentCount = 0;

        if (usersData) {
            for (let uId in usersData) {
                const user = usersData[uId];
                if (user && user.telegramChatId) {
                    try {
                        await bot.telegram.sendMessage(user.telegramChatId, taskMessage, {
                            parse_mode: 'HTML',
                            ...keyboard
                        });
                        sentCount++;
                    } catch (err) {
                        console.error(`Failed to send task broadcast to ${user.telegramChatId}:`, err.message);
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: `Task published and broadcasted to ${sentCount} users successfully!`,
            sentCount
        });
    } catch (error) {
        console.error("Task Publish Error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

/* =========================================================
   6. PAYOUT NOTIFICATIONS & INSTANT WITHDRAWAL LOGIC
   ========================================================= */
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

    let finalCurrency = currency;
    if (!finalCurrency) {
        finalCurrency = (finalMethod === 'FAUCETPAY') ? 'USDT' : 'Gram';
    }

    const message = `💸 <b>Payout Success</b> 💸\n\n` +
                    `🗣️ <b>User:</b> ${finalName}\n` +
                    `💳 <b>Method:</b> ${finalMethod}\n` +
                    `💸 <b>Amount:</b> <b>${finalAmount} ${finalCurrency}</b>\n` +
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
    return true;
  } catch (error) {
    console.error('❌ Failed to post payout proof to channel:', error.description || error.message);
    return false;
  }
}

async function checkAndSendPayouts() {
  try {
    const parentData = await getMongoData('withdrawals');
    if (!parentData) return;

    for (let uId in parentData) {
      let userWithdrawals = parentData[uId];
      if (!userWithdrawals) continue;

      for (let key in userWithdrawals) {
        if (key === '_id') continue;
        let item = userWithdrawals[key];
        if (!item || typeof item !== 'object') continue;

        const statusText = String(item.status || '').toLowerCase();
        const isApproved = statusText.includes('approved') || 
                           statusText.includes('success') || 
                           statusText.includes('completed') || 
                           statusText.includes('paid');

        if (isApproved && !item.postedToChannel) {
          const success = await sendPayoutNotification(item);
          if (success) {
            await updateMongoData('withdrawals', { userId: uId, requestId: key }, { postedToChannel: true });
          }
        }
      }
    }
  } catch (err) {
    console.error("Error in checkAndSendPayouts:", err.message);
  }
}

const recentRequests = new Set();

async function handleFaucetPayPayout(req, res) {
  const { email, amount, currency, userId, displayName, requestId } = req.body;

  if (!email || !amount) {
    return res.status(400).json({ success: false, message: "Email and amount are required." });
  }

  const hitKey = `${userId}_${amount}_${email}`;
  if (recentRequests.has(hitKey)) {
    return res.status(400).json({ success: false, message: "Duplicate request prevented." });
  }

  recentRequests.add(hitKey);
  setTimeout(() => recentRequests.delete(hitKey), 5000);

  try {
    const reqKey = requestId || `fp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    if (requestId) {
      const existingReq = await getMongoData('withdrawals', { userId: String(userId), requestId: requestId });
      if (existingReq && existingReq.processed) {
        return res.status(400).json({ success: false, message: "This withdrawal has already been processed." });
      }
    }

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
        userId: String(userId),
        requestId: reqKey,
        userName: displayName,
        amount: amount,
        currency: currency || 'USDT',
        method: 'FAUCETPAY',
        destination: email,
        status: 'SUCCESS (Approved)',
        processed: true,
        postedToChannel: true,
        date: new Date().toLocaleString()
      };

      await updateMongoData('withdrawals', { userId: String(userId), requestId: reqKey }, payoutData);
      sendPayoutNotification(payoutData);

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

app.post('/api/withdraw/ton', async (req, res) => {
  const { walletAddress, amount, currency, userId, displayName, requestId } = req.body;

  if (!walletAddress || !amount) {
    return res.status(400).json({ success: false, message: "Wallet address and amount are required." });
  }

  try {
    const reqKey = requestId || `ton_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const withdrawalData = {
      requestId: reqKey,
      userId: String(userId || 'Unknown'),
      userName: displayName || 'User',
      amount: amount,
      currency: currency || 'Gram',
      method: 'Gram',
      destination: walletAddress,
      status: 'PENDING',
      postedToChannel: false,
      date: new Date().toLocaleString()
    };

    await updateMongoData('withdrawals', { userId: String(userId || 'Unknown'), requestId: reqKey }, withdrawalData);

    return res.status(200).json({
      success: true,
      message: "Gram Withdrawal Request submitted successfully! It will be processed manually.",
      id: reqKey
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

bot.command('single_ton', async (ctx) => {
  try {
    const data = await getMongoData('withdrawals');
    if (!data) return ctx.reply("Koi pending Gram withdrawal nahi mila.");

    let responseMsg = "📋 <b>Single Gram Withdrawals (Pending):</b>\n\n";
    let count = 0;

    for (let uId in data) {
      const userWithdrawals = data[uId];
      for (let key in userWithdrawals) {
        if (key === '_id') continue;
        const item = userWithdrawals[key];
        if (item && item.status === 'PENDING') {
          count++;
          responseMsg += `<b>${count}. Request ID:</b> <code>${item.requestId || key}</code>\n` +
                         `<b>User:</b> ${item.userName} (${item.userId})\n` +
                         `<b>Address:</b> <code>${item.destination}</code>\n` +
                         `<b>Amount:</b> ${item.amount} ${item.currency || 'Gram'}\n\n`;
        }
      }
    }

    if (count === 0) return ctx.reply("Koi Pending Gram Request nahi hai.");
    ctx.replyWithHTML(responseMsg);
  } catch (err) {
    ctx.reply(`Error: ${err.message}`);
  }
});

bot.command('multisend_ton', async (ctx) => {
  try {
    const data = await getMongoData('withdrawals');
    if (!data) return ctx.reply("Multi-send ke liye koi data nahi hai.");

    let batchText = "";
    let count = 0;

    for (let uId in data) {
      const userWithdrawals = data[uId];
      for (let key in userWithdrawals) {
        if (key === '_id') continue;
        const item = userWithdrawals[key];
        if (item && item.status === 'PENDING') {
          count++;
          batchText += `${item.destination}, ${item.amount}\n`;
        }
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
    const allData = await getMongoData('withdrawals');
    let found = false;

    for (let uId in allData) {
      const userWithdrawals = allData[uId];
      if (userWithdrawals && userWithdrawals[reqId]) {
        const item = userWithdrawals[reqId];
        if (item.postedToChannel) {
          return ctx.reply("⚠️ Yeh request pehle hi approved aur channel par post ho chuki hai.");
        }

        item.status = 'SUCCESS (Approved)';
        item.postedToChannel = true;
        
        await updateMongoData('withdrawals', { userId: uId, requestId: reqId }, item);
        sendPayoutNotification(item);

        found = true;
        ctx.reply(`✅ Request ${reqId} Approved aur Payout Channel par Post kar diya gaya!`);
        break;
      }
    }

    if (!found) ctx.reply("Yeh Request ID nahi mili.");
  } catch (err) {
    ctx.reply(`Error: ${err.message}`);
  }
});

bot.command('approve_all_ton', async (ctx) => {
  try {
    const data = await getMongoData('withdrawals');
    if (!data) return ctx.reply("Approve karne ke liye koi data nahi mila.");

    let approvedCount = 0;
    for (let uId in data) {
      const userWithdrawals = data[uId];
      for (let key in userWithdrawals) {
        if (key === '_id') continue;
        const item = userWithdrawals[key];
        if (item && item.status === 'PENDING' && !item.postedToChannel) {
          item.status = 'SUCCESS (Approved)';
          item.postedToChannel = true;
          
          await updateMongoData('withdrawals', { userId: uId, requestId: item.requestId || key }, item);
          sendPayoutNotification(item);
          approvedCount++;
        }
      }
    }

    ctx.reply(`✅ Total ${approvedCount} Requests Approved aur Payout Channel par post ho gaye!`);
  } catch (err) {
    ctx.reply(`Error: ${err.message}`);
  }
});

app.post('/api/bot', async (req, res) => {
    try {
        const { action, amount, currency, userId } = req.body || {};

        if (action === 'create_deposit') {
            const depositUrl = `https://faucetpay.io/merchant/webpay?merchant_username=${FAUCETPAY_MERCHANT_USERNAME}&item_name=Gram+Farming+Deposit&currency1=${currency || 'USDT'}&amount1=${amount}&custom=${userId}`;
            return res.status(200).json({ success: true, url: depositUrl });
        }

        if (req.body && req.body.email && req.body.amount) {
            return await handleFaucetPayPayout(req, res);
        }

        if (req.body && (req.body.update_id || req.body.message || req.body.callback_query)) {
            await bot.handleUpdate(req.body);
        }

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
