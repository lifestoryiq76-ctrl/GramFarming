const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

// Static files serve karne ke liye
app.use(express.static(path.join(__dirname, '..')));

// Firebase Setup - Express & Anonymous REST mode
const FIREBASE_DATABASE_URL = "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com";

if (!admin.apps.length) {
    admin.initializeApp({
        databaseURL: FIREBASE_DATABASE_URL
    });
}

// Fallback to fetch directly if SDK auth fails
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Helper function to update/read Firebase without Auth issues
async function getFirebaseData(path) {
    try {
        const res = await fetch(`${FIREBASE_DATABASE_URL}/${path}.json`);
        return await res.json();
    } catch(e) {
        return null;
    }
}

async function setFirebaseData(path, data) {
    try {
        await fetch(`${FIREBASE_DATABASE_URL}/${path}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return true;
    } catch(e) {
        return false;
    }
}

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
    await setFirebaseData('adminSettings/ads/monetagLimit', limit);
    await setFirebaseData('adminSettings/adNetworks/monetag/limit', limit);
    ctx.reply(`✅ Monetag limit set to *${limit}*!`, { parse_mode: 'Markdown' });
});

bot.hears(/^\/gigapub (\d+)/, async (ctx) => {
    const limit = Number(ctx.match[1]);
    await setFirebaseData('adminSettings/ads/gigapubLimit', limit);
    await setFirebaseData('adminSettings/adNetworks/gigapub/limit', limit);
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
    await setFirebaseData('adminSettings/general/minFaucetPay', val);
    await setFirebaseData('adminSettings/general/minWithdrawal', val);
    ctx.reply(`✅ Min USDT withdrawal set to *$${val}*!`, { parse_mode: 'Markdown' });
});

// Pending Withdrawals Menu
bot.action('menu_withdrawals', async (ctx) => {
    const withdrawals = await getFirebaseData('withdrawals');
    if (!withdrawals) {
        return ctx.reply("🎉 Koi pending withdrawal request nahi hai!");
    }
    
    let pendingFound = false;
    Object.keys(withdrawals).forEach((uId) => {
        const userWithdrawals = withdrawals[uId];
        Object.keys(userWithdrawals).forEach((wId) => {
            const w = userWithdrawals[wId];
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
    await setFirebaseData(`withdrawals/${uId}/${wId}/status`, 'SUCCESS (Approved)');
    ctx.editMessageText("✅ *Approved & Saved Successfully!*", { parse_mode: 'Markdown' });
});

// Reject Action
bot.action(/^rej_(.+)_(.+)$/, async (ctx) => {
    const [, uId, wId] = ctx.match;
    await setFirebaseData(`withdrawals/${uId}/${wId}/status`, 'REJECTED');
    ctx.editMessageText("❌ *Request Rejected!*", { parse_mode: 'Markdown' });
});

// Express Webhook Routing
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
