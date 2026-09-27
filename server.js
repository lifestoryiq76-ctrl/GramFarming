const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const TOKEN = '8823465549:AAFFnZ1hDHR_eAWiEh5eWLCEm6dLkuSfHN0';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;

// Aapki Secret Telegram Admin ID
const ADMIN_TELEGRAM_ID = 6806028116;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Bot Error Handling
bot.on('polling_error', (error) => {
    console.log(error.code);
});

// Telegram Command: /admin (Sirf aapke liye khulega)
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (userId !== ADMIN_TELEGRAM_ID) {
        return bot.sendMessage(chatId, '⚠️ You are not authorized to access the Admin Panel.');
    }

    bot.sendMessage(chatId, '🛠 Click the button below to open the Admin Panel inside Telegram:', {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: '🛠 Open Admin Panel',
                        web_app: { url: 'https://gramfarming.onrender.com/admin' }
                    }
                ]
            ]
        }
    });
});

app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    
    // Telegram Bot ke Menu Bar mein direct Admin Panel button set karne ke liye
    try {
        await bot.setChatMenuButton({
            menu_button: {
                type: 'web_app',
                text: '🛠 Admin Panel',
                web_app: { url: 'https://gramfarming.onrender.com/admin' }
            }
        });
        console.log("Telegram Menu Button set successfully!");
    } catch (err) {
        console.log("Failed to set menu button:", err.message);
    }
});
