const express = require('express');
const { Telegraf, Markup } = require('telegraf');

// Express Server Setup for Render Port Binding
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Gram User Mini App Bot is running! 🎮');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// User Bot Token (Render environment variable se ya fallback)
const bot = new Telegraf(process.env.BOT_TOKEN || '8823465549:AAFfNZ1hDHR_eAWiEhH5eWLCEm6dLkuSfHN0');

bot.start((ctx) => {
    ctx.reply('🌾 Welcome to Gram Farming!\n\nTap the button below to open the game and start farming:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.webApp('🎮 Play Game', 'https://gramfarming-api.onrender.com')]
        ])
    });
});

bot.launch();
console.log('User Mini App Bot is running successfully! 🚀');
