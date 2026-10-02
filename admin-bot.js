const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

// Express Server Setup for Render Port Binding
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Admin Bot is running successfully! 🚀');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Firebase Initialization with Environment Variables
if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : undefined;

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
        })
    });
}

// Bot token (Render environment variable se ya fallback)
const adminBot = new Telegraf(process.env.BOT_TOKEN || '8887103142:AAEBZAe-bi4ylcSaub-mMGxf7iVxHaZr1E');

// Apni Telegram numeric ID yaha daalein ya environment variable se lein
const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID) || 123456789; 

// Firebase database connection
const db = admin.firestore();

// /start ya /admin command
adminBot.command(['start', 'admin'], async (ctx) => {
    if (ctx.from.id !== ADMIN_TELEGRAM_ID) {
        return ctx.reply('❌ Unauthorized: Aap is bot ke admin nahi hain.');
    }

    await ctx.reply('⚙️ **Gram Farming Admin Bot**\n\nNiche diye gaye options me se select karein:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('👥 Total Users Check', 'check_users')],
            [Markup.button.callback('💸 Pending Withdrawals', 'check_withdrawals')],
            [Markup.button.callback('📢 Broadcast Message', 'start_broadcast')]
        ])
    });
});

// 1. Users Check Action
adminBot.action('check_users', async (ctx) => {
    if (ctx.from.id !== ADMIN_TELEGRAM_ID) return;
    await ctx.answerCbQuery();
    
    try {
        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;
        await ctx.editMessageText(`👥 **Total Registered Users:** ${totalUsers}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_home')]])
        });
    } catch (error) {
        await ctx.reply('Error fetching users: ' + error.message);
    }
});

// 2. Pending Withdrawals Action
adminBot.action('check_withdrawals', async (ctx) => {
    if (ctx.from.id !== ADMIN_TELEGRAM_ID) return;
    await ctx.answerCbQuery();

    try {
        const withdrawSnapshot = await db.collection('withdrawals').where('status', '==', 'pending').get();
        if (withdrawSnapshot.empty) {
            return ctx.editMessageText('✅ Koi bhi pending withdrawal nahi hai.', {
                ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_home')]])
            });
        }

        let msg = '💸 **Pending Withdrawal Requests:**\n\n';
        withdrawSnapshot.forEach(doc => {
            const data = doc.data();
            msg += `ID: ${doc.id}\nUser: ${data.userId}\nAmount: ${data.amount}\nMethod: ${data.payoutMethod}\n-------------------\n`;
        });

        await ctx.editMessageText(msg, {
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'admin_home')]])
        });
    } catch (error) {
        await ctx.reply('Error: ' + error.message);
    }
});

// Home Button
adminBot.action('admin_home', async (ctx) => {
    if (ctx.from.id !== ADMIN_TELEGRAM_ID) return;
    await ctx.answerCbQuery();
    await ctx.editMessageText('⚙️ **Gram Farming Admin Bot**\n\nNiche diye gaye options me se select karein:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('👥 Total Users Check', 'check_users')],
            [Markup.button.callback('💸 Pending Withdrawals', 'check_withdrawals')],
            [Markup.button.callback('📢 Broadcast Message', 'start_broadcast')]
        ])
    });
});

adminBot.launch();
console.log('Admin Bot is running successfully! 🚀');
