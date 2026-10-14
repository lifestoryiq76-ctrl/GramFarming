import { TonClient, WalletContractV4, internal, toNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { userId, userName, amount, tonAddress } = req.body;

        if (!tonAddress || !amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid parameters provided.' });
        }

        const mnemonic = process.env.TON_MNEMONIC;
        if (!mnemonic) {
            return res.status(500).json({ success: false, message: 'Server wallet mnemonic missing in environment variables.' });
        }

        const apiKey = process.env.TONCENTER_API_KEY ? process.env.TONCENTER_API_KEY.trim() : '';

        // TonCenter RPC with direct apiKey parameter & fallback support
        const client = new TonClient({
            endpoint: apiKey 
                ? `https://toncenter.com/api/v2/jsonRPC?api_key=${apiKey}` 
                : 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: apiKey
        });

        // 1. Convert Mnemonic to Private Key
        const mnemonicArray = mnemonic.trim().split(/\s+/);
        const key = await mnemonicToPrivateKey(mnemonicArray);
        
        // 2. Initialize WalletContractV4
        const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
        const contract = client.open(wallet);

        // 3. Fetch Sequence Number
        const seqno = await contract.getSeqno();
        
        // 4. Send Transfer Transaction
        await contract.sendTransfer({
            secretKey: key.secretKey,
            seqno: seqno,
            messages: [
                internal({
                    to: tonAddress,
                    value: toNano(String(amount)),
                    bounce: false,
                    body: "Gram Farming Instant Payout",
                })
            ]
        });

        // 5. Notify Telegram Channel
        const channelId = process.env.PAYOUT_CHANNEL_ID || '@GramFarming_Payout';
        const msgText = `🚀 <b>New TON Instant Payout!</b>\n\n` +
                        `👤 <b>User:</b> ${userName || 'User'} (ID: ${userId})\n` +
                        `💎 <b>Amount:</b> ${amount} TON\n` +
                        `📬 <b>Wallet:</b> <code>${tonAddress}</code>\n\n` +
                        `✅ <i>Status: Sent via TON Blockchain</i>`;

        await bot.sendMessage(channelId, msgText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🚀 Open Mini App', url: 'https://t.me/GramFarmingBot/app' }
                ]]
            }
        }).catch(err => console.error("Telegram post failed:", err));

        return res.status(200).json({ success: true, message: 'Payout sent successfully!' });

    } catch (error) {
        console.error("TON Withdraw Detailed Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: error.message || 'Internal server error during TON transfer' 
        });
    }
}
