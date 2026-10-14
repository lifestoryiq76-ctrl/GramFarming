import { mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4, internal, toNano } from "@ton/ton";
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

        const mnemonicArray = mnemonic.trim().split(/\s+/);
        const key = await mnemonicToPrivateKey(mnemonicArray);
        
        const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
        const walletAddress = wallet.address.toString({ bounceable: false });

        // Fetch seqno directly via TonCenter HTTP API to avoid Wasm/Axios node issues
        const apiKey = process.env.TONCENTER_API_KEY ? `&api_key=${process.env.TONCENTER_API_KEY}` : '';
        const seqnoRes = await fetch(`https://toncenter.com/api/v2/jsonRPC`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "run_get_method",
                params: {
                    address: walletAddress,
                    method: "seqno",
                    stack: []
                }
            })
        });

        const seqnoData = await seqnoRes.json();
        let seqno = 0;
        if (seqnoData && seqnoData.result && seqnoData.result.stack && seqnoData.result.stack[0]) {
            seqno = parseInt(seqnoData.result.stack[0][1], 16) || 0;
        }

        // Build Transfer Message
        const transfer = wallet.createTransfer({
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

        const boc = transfer.toBoc().toString("base64");

        // Send Boc via TonCenter API
        const sendRes = await fetch(`https://toncenter.com/api/v2/jsonRPC`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "sendBoc",
                params: { boc: boc }
            })
        });

        const sendData = await sendRes.json();
        if (!sendData.result) {
            throw new Error("Failed to broadcast transaction to TON blockchain");
        }

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
