const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const TOKEN = '8823465549:AAFFnZ1hDHR_eAWiEh5eWLCEm6dLkuSfHN0';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'Friend';

    const welcomeMessage = `Hello ${userName}! 🌱\n\nWelcome to **Gram Farming Mini App**!\n\nEarn coins, complete tasks, grow trees in mining, and withdraw real rewards directly. Click the button below to start playing!`;

    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "🚀 Play Gram Farming",
                        web_app: { url: "https://gramfarming-api.onrender.com" }
                    }
                ]
            ]
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
