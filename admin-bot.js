const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

// Express Server Setup for Render Port Binding
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Admin Bot is running successfully! 🚀');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Firebase Initialization with Environment Variables & Realtime DB URL
if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : undefined;

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
        }),
        databaseURL: "https://gramfarmingbot-1a570-default-rtdb.firebaseio.com"
    });
}

// Bot token (Supports TELEGRAM_BOT_TOKEN or BOT_TOKEN)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '8887103142:AAEBZAe-bi4ylcSaub-mMGxf7iVxHaZr1E';
const adminBot = new Telegraf(BOT_TOKEN);

// Admin Telegram ID
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '6806028116';

const isAdmin = (userId) => {
    return userId.toString() === ADMIN_TELEGRAM_ID.toString();
};

// Firebase Realtime Database connection
const db = admin.database();

// /start ya /admin command
adminBot.command(['start', 'admin'], async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        return ctx.reply('❌ Unauthorized: Aap is bot ke admin nahi hain.');
    }

    await ctx.reply('⚙️ *Gram Farming Admin Bot*\n\nNiche diye gaye options me se select karein:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('👥 Total Users Check', 'check_users')],
            [Markup.button.callback('💸 Pending Withdrawals', 'check_withdrawals')],
            [Markup.button.callback('📢 Broadcast Message', 'start_broadcast')],
            [Markup.button.webApp('🚀 Open', 'https://gramfarming-api.onrender.com')]
        ])
    });
});

// 1. Users Check Action
adminBot.action('check_users', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();
    
    try {
        const snapshot = await db.ref('users').once('value');
        const totalUsers = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        await ctx.editMessageText(`👥 *Total Registered Users:* ${totalUsers}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_home')]])
        });
    } catch (error) {
        await ctx.reply('Error fetching users: ' + error.message);
    }
});

// 2. Pending Withdrawals Action
adminBot.action('check_withdrawals', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();

    try {
        const snapshot = await db.ref('withdrawals').once('value');
        if (!snapshot.exists()) {
            return ctx.editMessageText('✅ Koi bhi pending withdrawal nahi hai.', {
                ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_home')]])
            });
        }

        let msg = '💸 *Pending Withdrawal Requests:*\n\n';
        let count = 0;
        snapshot.forEach(childSnapshot => {
            const data = childSnapshot.val();
            if (data.status === 'pending' || !data.status || data.status.includes('Pending')) {
                count++;
                msg += `ID: ${childSnapshot.key}\nUser: ${data.userId || data.username || 'N/A'}\nAmount: ${data.amount}\nMethod: ${data.payoutMethod || 'N/A'}\n-------------------\n`;
            }
        });

        if (count === 0) {
            msg = '✅ Koi bhi pending withdrawal request nahi hai!';
        }

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_home')]])
        });
    } catch (error) {
        await ctx.reply('Error: ' + error.message);
    }
});

// Broadcast info action
adminBot.action('start_broadcast', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();
    await ctx.editMessageText('📢 Broadcast ke liye command use karein:\n`/broadcast [Aapka message]`', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_home')]])
    });
});

adminBot.command('broadcast', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const text = ctx.message.text.replace('/broadcast', '').trim();
    if (!text) {
        return ctx.reply('⚠️ Kripya message bhi likhein. Example: /broadcast Hello users!');
    }

    try {
        const snapshot = await db.ref('users').once('value');
        if (!snapshot.exists()) {
            return ctx.reply('❌ Broadcast ke liye koi users nahi mile.');
        }

        let successCount = 0;
        const users = snapshot.val();

        for (const userId of Object.keys(users)) {
            try {
                await adminBot.telegram.sendMessage(userId, text);
                successCount++;
            } catch (err) {}
        }

        return ctx.reply(`✅ Broadcast successfully sent to ${successCount} users!`);
    } catch (error) {
        return ctx.reply(`❌ Broadcast Error: ${error.message}`);
    }
});

// Home Button
adminBot.action('admin_home', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();
    await ctx.editMessageText('⚙️ *Gram Farming Admin Bot*\n\nNiche diye gaye options me se select karein:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('👥 Total Users Check', 'check_users')],
            [Markup.button.callback('💸 Pending Withdrawals', 'check_withdrawals')],
            [Markup.button.callback('📢 Broadcast Message', 'start_broadcast')],
            [Markup.button.webApp('🚀 Open', 'https://gramfarming-api.onrender.com')]
        ])
    });
});

adminBot.launch().then(() => {
    console.log('Admin Bot is running successfully! 🚀');
});

process.once('SIGINT', () => adminBot.stop('SIGINT'));
process.once('SIGTERM', () => adminBot.stop('SIGTERM'));
