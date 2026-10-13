import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { email, amount, currency, userId, displayName } = req.body;

        if (!email || !amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid payout details provided.' });
        }

        const faucetpayApiKey = process.env.FAUCETPAY_API_KEY;
        if (!faucetpayApiKey) {
            return res.status(500).json({ success: false, message: 'FaucetPay API Key missing in server environment variables.' });
        }

        // FaucetPay Send API Request
        const params = new URLSearchParams();
        params.append('api_key', faucetpayApiKey);
        params.append('to', email);
        params.append('amount', String(amount));
        params.append('currency', currency || 'USDT');
        params.append('ip_address', '127.0.0.1');

        const fpResponse = await fetch('https://faucetpay.io/api/v1/send', {
            method: 'POST',
            body: params
        });

        const fpData = await fpResponse.json();

        if (fpData && fpData.status === 200) {
            // Telegram Payout Channel Notification
            const channelId = process.env.PAYOUT_CHANNEL_ID || '@GramFarming_Payout';
            const msgText = `🚀 <b>New FaucetPay Instant Payout!</b>\n\n` +
                            `👤 <b>User:</b> ${displayName || 'User'} (ID: ${userId})\n` +
                            `💵 <b>Amount:</b> ${amount} ${currency || 'USDT'}\n` +
                            `📬 <b>Email:</b> <code>${email}</code>\n\n` +
                            `✅ <i>Status: Successfully Paid</i>`;

            await bot.sendMessage(channelId, msgText, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🚀 Open Mini App', url: 'https://t.me/GramFarmingBot/app' }
                    ]]
                }
            }).catch(err => console.error("Telegram post failed:", err));

            return res.status(200).json({ success: true, message: 'Payout successful!' });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: fpData.message || 'FaucetPay transfer failed.' 
            });
        }

    } catch (error) {
        console.error("FaucetPay API Error:", error);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error during FaucetPay processing.' });
    }
}
