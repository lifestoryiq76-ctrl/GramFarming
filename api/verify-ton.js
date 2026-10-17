export default async function handler(req, res) {
  // CORS Headers set karein taaki network block na ho
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { userId, displayName, amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid deposit amount' });
  }

  const ADMIN_WALLET = "UQDFz_BjBSx-zBiwQx4wDs6BkFKy8z_uJoRnCYshNrgqthtd";
  const expectedNano = Math.round(parseFloat(amount) * 1e9); // TON to nanoTON

  try {
    // 1st Attempt: TonAPI Fetch
    let isFound = false;
    let response = await fetch(`https://tonapi.io/v2/blockchain/accounts/${ADMIN_WALLET}/transactions?limit=15`);
    
    if (response.ok) {
      let data = await response.json();
      const nowSec = Math.floor(Date.now() / 1000);

      if (data && data.transactions) {
        for (let tx of data.transactions) {
          if (tx.in_msg && tx.in_msg.value) {
            let val = parseInt(tx.in_msg.value);
            let txTime = tx.utime;
            // Amount Match & Time within last 20 minutes (1200 seconds)
            if (Math.abs(val - expectedNano) <= 20000000 && (nowSec - txTime) <= 1200) {
              isFound = true;
              break;
            }
          }
        }
      }
    }

    // 2nd Backup Attempt: Toncenter Fallback
    if (!isFound) {
      let tcResp = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${ADMIN_WALLET}&limit=15`);
      if (tcResp.ok) {
        let tcData = await tcResp.json();
        const nowSec = Math.floor(Date.now() / 1000);
        if (tcData.ok && tcData.result) {
          for (let tx of tcData.result) {
            if (tx.in_msg && tx.in_msg.value) {
              let val = parseInt(tx.in_msg.value);
              let txTime = tx.utime;
              if (Math.abs(val - expectedNano) <= 20000000 && (nowSec - txTime) <= 1200) {
                isFound = true;
                break;
              }
            }
          }
        }
      }
    }

    if (isFound) {
      return res.status(200).json({
        success: true,
        message: 'Deposit verified successfully on TON Blockchain!'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Transaction not found. Please wait 1-2 minutes after sending GRAM and try again.'
      });
    }

  } catch (error) {
    console.error("TON Verify Error:", error);
    return res.status(500).json({
      success: false,
      message: 'Network verification timeout. Please click verify again after 10 seconds.'
    });
  }
}
