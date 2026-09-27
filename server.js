const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const TOKEN = '7822460549:AAFVaZdN4R_vMeSh20AC6mGslissN490';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
const PORT = process.env.PORT || 3000;

// Admin Secret Telegram Chat ID
const ADMIN_CHAT_ID = 'YOUR_ADMIN_CHAT_ID';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Error handling
bot.on('polling_error', (error) => {
    console.log(error.code);
});

app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);

    // Set up the specific admin panel web app menu button
    try {
        await bot.setChatMenuButton({
            menu_button: {
                type: 'web_app',
                text: 'Admin Panel',
                web_app: { url: 'https://lifestoryiq76-ctrl.github.io/GramFarming' }
            }
        });
        console.log('Admin Panel Menu Button set successfully!');
    } catch (error) {
        console.log('Failed to set menu button:', error.message);
    }
});
