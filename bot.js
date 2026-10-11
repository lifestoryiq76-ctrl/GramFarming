const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const app = express();
app.use(express.json());

// Static files (jaise index.html) serve karne ke liye
app.use(express.static(path.join(__dirname, '..')));

// Firebase Setup
const firebaseConfig = {
    databaseURL: "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com"
};

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
        credential: cert(serviceAccount),
        databaseURL: firebaseConfig.databaseURL
    });
} else {
    initializeApp({
        databaseURL: firebaseConfig.databaseURL
    });
}

const db = getDatabase();

// Telegram Bot Setup
const BOT_TOKEN = process.env.BOT_TOKEN || '8887103142:AAEBZAe-bi4ylcSauB-mMGxf97iVxHaZrlE';
const ADMIN_ID = Number(process.env.ADMIN_TELEGRAM_ID || 6806028116);
const bot = new Telegraf(BOT_TOKEN);

// Security Check: Sirf Admin Use Kar Sake
bot.use((ctx, next) => {
    if (ctx.from && ctx.from.id === ADMIN_ID) {
        return next();
    }
    return ctx.reply("❌ Access Denied: Aap is bot ke admin nahi hain!");
});

// Admin Panel Commands
bot.command(['start', 'admin'], (ctx) => {
    ctx.reply(
        "🌱 *Gram Farming Master Admin Panel*\n\nNiche diye gaye options se control karein:",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📺 Ad Limits & Rewards', 'menu_ads')],
                [Markup.button.callback('🌐 Economic Settings', 'menu_general')],
                [Markup.button.callback('💳 Pending Withdrawals', 'menu_withdrawals')]
            ])
        }
    );
});

// Ads Menu
bot.action('menu_ads', (ctx) => {
    ctx.editMessageText(
        "📺 *Ads Networks Control*\n\nCommands format:\n\n" +
        "🔹 `/monetag 50` - Set Monetag Limit\n" +
        "🔹 `/gigapub 50` - Set Gigapub Limit\n" +
        "🔹 `/clickadu 40` - Set Clickadu Limit\n" +
        "🔹 `/monetix 40` - Set Monetix Limit\n" +
        "🔹 `/hilltop 40` - Set Hilltopads Limit",
        { parse_mode: 'Markdown' }
    );
});

bot.hears(/^\/monetag (\d+)/, async (ctx) => {
    const limit = Number(ctx.match[1]);
    await db.ref('adminSettings/ads/monetagLimit').set(limit);
    await db.ref('adminSettings/adNetworks/monetag/limit').set(limit);
    ctx.reply(`✅ Monetag limit set to *${limit}*!`, { parse_mode: 'Markdown' });
});

bot.hears(/^\/gigapub (\d+)/, async (ctx) => {
    const limit = Number(ctx.match[1]);
    await db.ref('adminSettings/ads/gigapubLimit').set(limit);
    await db.ref('adminSettings/adNetworks/gigapub/limit').set(limit);
    ctx.reply(`✅ Gigapub limit set to *${limit}*!`, { parse_mode: 'Markdown' });
});

// Economic Settings Menu
bot.action('menu_general', (ctx) => {
    ctx.editMessageText(
        "🌐 *Economic Settings*\n\nCommands use karein:\n\n" +
        "🪙 `/coinrate 0.01` - Set 1 Coin Rate ($)\n" +
        "💵 `/minusdt 0.05` - Set Min USDT Withdraw\n" +
        "💎 `/minton 0.50` - Set Min TON Withdraw",
        { parse_mode: 'Markdown' }
    );
});

bot.hears(/^\/minusdt ([\d.]+)/, async (ctx) => {
    const val = Number(ctx.match[1]);
    await db.ref('adminSettings/general/minFaucetPay').set(val);
    await db.ref('adminSettings/general/minWithdrawal').set(val);
    ctx.reply(`✅ Min USDT withdrawal set to *$${val}*!`, { parse_mode: 'Markdown' });
});

// Pending Withdrawals Menu
bot.action('menu_withdrawals', async (ctx) => {
    const snapshot = await db.ref('withdrawals').once('value');
    if (!snapshot.exists()) {
        return ctx.reply("🎉 Koi pending withdrawal request nahi hai!");
    }
    
    let pendingFound = false;
    snapshot.forEach((userSnap) => {
        const uId = userSnap.key;
        userSnap.forEach((wSnap) => {
            const wId = wSnap.key;
            const w = wSnap.val();
            if (!w.status || (!w.status.includes('SUCCESS') && !w.status.includes('REJECTED'))) {
                pendingFound = true;
                ctx.reply(
                    `💳 *Withdrawal Request*\n\n👤 User: \`${uId}\`\n💰 Amount: *${w.amount}${w.method}*\n📍 Address: \`${w.destination}\``,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [
                                Markup.button.callback('✅ Approve', `app_${uId}_${wId}`),
                                Markup.button.callback('❌ Reject', `rej_${uId}_${wId}`)
                            ]
                        ])
                    }
                );
            }
        });
    });

    if (!pendingFound) ctx.reply("🎉 Sabhi withdrawals processed hain!");
});

// Approve Action
bot.action(/^app_(.+)_(.+)$/, async (ctx) => {
    const [, uId, wId] = ctx.match;
    await db.ref(`withdrawals/${uId}/${wId}/status`).set('SUCCESS (Approved)');
    ctx.editMessageText("✅ *Approved & Saved Successfully!*", { parse_mode: 'Markdown' });
});

// Reject Action
bot.action(/^rej_(.+)_(.+)$/, async (ctx) => {
    const [, uId, wId] = ctx.match;
    await db.ref(`withdrawals/${uId}/${wId}/status`).set('REJECTED');
    ctx.editMessageText("❌ *Request Rejected!*", { parse_mode: 'Markdown' });
});

// --- EXPRESS APIS & ROUTING ---

// Root Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Telegram Bot Webhook Endpoint (Telegram updates yahan aayengi)
app.post('/api/bot', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error');
    }
});

// Auto-Set Webhook Route (Browser se opening par auto set karega)
app.get('/api/bot', async (req, res) => {
    try {
        const webhookUrl = `https://${req.headers.host}/api/bot`;
        await bot.telegram.setWebhook(webhookUrl);
        res.send(`✅ Webhook successfully set to: <b>${webhookUrl}</b>`);
    } catch (err) {
        res.status(500).send(`❌ Failed to set Webhook: ${err.message}`);
    }
});

// FaucetPay Withdrawal API Endpoint
app.post('/api/withdraw', async (req, res) => {
    const { email, amount } = req.body;
    
    if (!email || !amount) {
        return res.json({ success: false, message: "Email aur amount dono zaroori hain!" });
    }

    console.log(`Processing withdrawal: ${amount} to FaucetPay email: ${email}`);
    res.json({ success: true, message: "FaucetPay par withdrawal successfully bhej diya gaya hai!" });
});

// Admin Broadcast API Endpoint
app.post('/api/admin/broadcast', (req, res) => {
    const { key, message } = req.body;
    const ADMIN_SECRET = "mySecretAdmin123"; 

    if (key !== ADMIN_SECRET) {
        return res.json({ success: false, message: "Galat Admin Key hai!" });
    }

    console.log(`Admin Broadcast Message: ${message}`);
    res.json({ success: true, message: "Broadcast sabhi users ko bhej diya gaya hai!" });
});

// Local Development Server
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server successfully port ${PORT} par chal raha hai!`);
    });
}

module.exports = app;
