const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, '..')));

const FIREBASE_DATABASE_URL = "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com";

if (!admin.apps.length) {
    admin.initializeApp({
        databaseURL: FIREBASE_DATABASE_URL
    });
}

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function getFirebaseData(path) {
    try {
        const res = await fetch(`${FIREBASE_DATABASE_URL}/${path}.json`);
        return await res.json();
    } catch(e) { return null; }
}

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

const BOT_TOKEN = process.env.BOT_TOKEN || '8887103142:AAEBZAe-bi4ylcSauB-mMGxf97iVxHaZrlE';
const ADMIN_ID = Number(process.env.ADMIN_TELEGRAM_ID || 6806028116);
const bot = new Telegraf(BOT_TOKEN);

// Admin Command Handler with ID Debugging
bot.command(['start', 'admin'], (ctx) => {
    const senderId = ctx.from ? ctx.from.id : 'Unknown';
    
    // Agar ID match nahi hoti, toh user ko unka sahi ID bata do taaki pata chale
    if (senderId !== ADMIN_ID) {
        return ctx.reply(`❌ Access Denied!\nAapka Telegram ID: \`${senderId}\` hai.\nExpected Admin ID: \`${ADMIN_ID}\``, { parse_mode: 'Markdown' });
    }

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
        "📺 *Ads Networks Control*\n\nCommands format:\n🔹 `/monetag 50` - Set Monetag Limit",
        { parse_mode: 'Markdown' }
    );
});

bot.hears(/^\/monetag (\d+)/, async (ctx) => {
    const limit = Number(ctx.match[1]);
    await setFirebaseData('adminSettings/ads/monetagLimit', limit);
    ctx.reply(`✅ Monetag limit set to *${limit}*!`, { parse_mode: 'Markdown' });
});

// Webhook Endpoint
app.post('/api/bot', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) {
        console.error("Webhook Error:", err);
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
