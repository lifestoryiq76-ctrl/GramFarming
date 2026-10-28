const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

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

    await updateFirebaseData(`users/${userId}`, {
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
   2. DYNAMIC DAILY CHECK-IN REMINDER FUNCTION (5:30 AM)
   ========================================================= */
async function sendDailyCheckinReminder(chatId, userId) {
    try {
        const generalData = await getFirebaseData('adminSettings/general');
        const dynamicDailyReward = (generalData && generalData.dailyBonus) ? parseFloat(generalData.dailyBonus) : 0.10;

        let currentStreak = 0;
        if (userId) {
            const userData = await getFirebaseData(`users/${userId}`);
            if (userData && userData.streak !== undefined) {
                currentStreak = userData.streak;
            }
        }

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
   3. AUTOMATIC DAILY BROADCAST (Strict Single-Run Protection)
   ========================================================= */
async function triggerDailyCheckinBroadcast() {
    const todayDateStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Check Firebase to ensure broadcast hasn't run today across any server instance
    const lastRunDate = await getFirebaseData('systemStatus/lastDailyBroadcast');
    if (lastRunDate === todayDateStr) {
        console.log("⚠️ Daily broadcast already executed today. Skipping.");
        return;
    }

    // Lock it immediately in Firebase
    await updateFirebaseData('systemStatus', { lastDailyBroadcast: todayDateStr });

    console.log("📢 Triggering Daily Check-in Broadcast to all users at 5:30 AM...");
    const usersData = await getFirebaseData('users');
    if (usersData) {
        for (let uId in usersData) {
            const user = usersData[uId];
            if (user && user.telegramChatId) {
                await sendDailyCheckinReminder(user.telegramChatId, uId);
            }
        }
    }
}

// Timer checking every minute for 05:30 AM (Subah 5:30 baje)
setInterval(() => {
    const now = new Date();
    // India time (UTC+5:30) handle karne ke liye ya standard local time check
    if (now.getHours() === 5 && now.getMinutes() === 30) {
        triggerDailyCheckinBroadcast();
    }
}, 60000);


/* =========================================================
   4. LIVE NEW TASK PUBLISH BROADCAST TO ALL USERS
   ========================================================= */
let knownTaskIds = new Set();
let isInitializedTasks = false;

async function checkNewTasksAndBroadcast() {
    try {
        const tasksData = await getFirebaseData('customTasks');
        if (!tasksData) return;

        const currentTaskIds = Object.keys(tasksData);

        if (!isInitializedTasks) {
            currentTaskIds.forEach(id => knownTaskIds.add(id));
            isInitializedTasks = true;
            return;
        }

        for (let taskId of currentTaskIds) {
            if (!knownTaskIds.has(taskId)) {
                knownTaskIds.add(taskId);
                const newTask = tasksData[taskId];
                if (newTask) {
                    await broadcastNewTaskToAllUsers(newTask);
                }
            }
        }
    } catch (err) {
        console.error("Error checking new tasks:", err.message);
    }
}

async function broadcastNewTaskToAllUsers(taskData) {
    try {
        console.log("📢 Broadcasting new task to all users:", taskData.title);
        const usersData = await getFirebaseData('users');
        if (!usersData) return;

        const messageText = `📢 <b>New Paid Task Available!</b>\n\n` +
                            `A new paid task is available: <b>${taskData.title}</b>!\n` +
                            `Complete it now to earn <b>+0.05 Coin</b>!`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.webApp('🎯 View Tasks', MINI_APP_URL)]
        ]);

        for (let uId in usersData) {
            const user = usersData[uId];
            if (user && user.telegramChatId) {
                try {
                    await bot.telegram.sendMessage(user.telegramChatId, messageText, {
                        parse_mode: 'HTML',
                        ...keyboard
                    });
                } catch (e) {}
            }
        }
        console.log("✅ New Task broadcasted successfully to all users!");
    } catch (err) {
        console.error('❌ Failed to broadcast new task:', err.message);
    }
}

setInterval(checkNewTasksAndBroadcast, 15000);


/* =========================================================
   5. BOT DESCRIPTION UPDATER (Total Users Count)
   ========================================================= */
async function updateBotDescriptionWithTotalUsers() {
    try {
        const usersData = await getFirebaseData('users');
        let totalUsersCount = usersData ? Object.keys(usersData).length : 0;
        
        const descriptionText = `Gram Farming Bot\n👥 Total Users: ${totalUsersCount.toLocaleString()} users\n🚀 Earn crypto and complete tasks!`;
        await bot.telegram.setMyDescription(descriptionText);
    } catch (err) {
        console.error("❌ Failed to update bot description:", err.message);
    }
}

setInterval(updateBotDescriptionWithTotalUsers, 3600000);


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
                    `💸 <b>Amount:</b> <b>${finalAmount} ${currency || 'Gram'}</b>\n` +
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
      await updateFirebaseData(`withdrawals/${userId}/${reqKey}`, { ...payoutData, postedToChannel: true });
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
      currency: currency || 'Gram',
      method: 'Gram',
      destination: walletAddress,
      status: 'PENDING',
      postedToChannel: false,
      date: new Date().toLocaleString()
    };

    await updateFirebaseData(`withdrawals/${userId}/${reqKey}`, withdrawalData);

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
    const data = await getFirebaseData('withdrawals');
    if (!data) return ctx.reply("Koi pending Gram withdrawal nahi mila.");

    let responseMsg = "📋 <b>Single Gram Withdrawals (Pending):</b>\n\n";
    let count = 0;

    for (let uId in data) {
      const userWithdrawals = data[uId];
      for (let key in userWithdrawals) {
        const item = userWithdrawals[key];
        if (item && item.status === 'PENDING') {
          count++;
          responseMsg += `<b>${count}. Request ID:</b> <code>${key}</code>\n` +
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
    const data = await getFirebaseData('withdrawals');
    if (!data) return ctx.reply("Multi-send ke liye koi data nahi hai.");

    let batchText = "";
    let count = 0;

    for (let uId in data) {
      const userWithdrawals = data[uId];
      for (let key in userWithdrawals) {
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
    const allData = await getFirebaseData('withdrawals');
    let found = false;

    for (let uId in allData) {
      if (allData[uId][reqId]) {
        const item = allData[uId][reqId];
        item.status = 'SUCCESS (Approved)';
        await updateFirebaseData(`withdrawals/${uId}/${reqId}`, item);

        const posted = await sendPayoutNotification(item);
        if (posted) {
          await updateFirebaseData(`withdrawals/${uId}/${reqId}`, { postedToChannel: true });
        }
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
    const data = await getFirebaseData('withdrawals');
    if (!data) return ctx.reply("Approve karne ke liye koi data nahi mila.");

    let approvedCount = 0;
    for (let uId in data) {
      const userWithdrawals = data[uId];
      for (let key in userWithdrawals) {
        const item = userWithdrawals[key];
        if (item && item.status === 'PENDING') {
          item.status = 'SUCCESS (Approved)';
          await updateFirebaseData(`withdrawals/${uId}/${key}`, item);

          const posted = await sendPayoutNotification(item);
          if (posted) {
            await updateFirebaseData(`withdrawals/${uId}/${key}`, { postedToChannel: true });
          }
          approvedCount++;
        }
      }
    }

    ctx.reply(`✅ Total ${approvedCount} Requests Approved aur Payout Channel par post ho gaye!`);
  } catch (err) {
    ctx.reply(`Error: ${err.message}`);
  }
});

async function checkAndSendPayouts() {
  const pathsToCheck = ['withdrawals'];
  
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
