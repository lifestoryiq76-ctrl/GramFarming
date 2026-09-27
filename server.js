const { TonClient, WalletContractV4, internal, toNano } = require("@ton/ton");
const { mnemonicToPrivateKey } = require("@ton/crypto");

// TON Client Setup
const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: process.env.TONCENTER_API_KEY || 'YOUR_TONCENTER_API_KEY'
});

// TON Withdraw API Endpoint
app.post('/api/withdraw-ton', async (serverReq, serverRes) => {
  try {
    const { userId, tonAddress, amountTon } = serverReq.body;

    if (!amountTon || amountTon < 0.05) {
      return serverRes.json({ success: false, message: "Minimum withdraw limit 0.05 TON hai!" });
    }

    // Aapke bot ke admin wallet ke 24 secret words yahan aayenge
    const MNEMONIC = process.env.BOT_WALLET_MNEMONIC || "word1 word2 word3 ... word24";
    const key = await mnemonicToPrivateKey(MNEMONIC.split(" "));
    
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
    const walletContract = client.open(wallet);
    
    const seqno = await walletContract.getSeqno();
    
    const transfer = walletContract.createTransfer({
      seqno,
      secretKey: key.secretKey,
      messages: [
        internal({
          to: tonAddress,
          value: toNano(amountTon.toString()),
          bounce: false,
          body: "Gram Farming Instant Payout 🚀"
        })
      ]
    });

    await walletContract.send(transfer);

    serverRes.json({ success: true, message: "TON successfully transfer ho gaya!" });

  } catch (error) {
    console.error("TON Withdraw Error:", error);
    serverRes.json({ success: false, message: "Transaction fail ho gayi, dobara koshish karein." });
  }
});
