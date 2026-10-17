export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { userId, displayName, amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid deposit amount' });
  }

  const ADMIN_WALLET = "UQDFz_BjBSx-zBiwQx4wDs6BkFKy8z_uJoRnCYshNrgqthtd";
  const expectedNanoAmount = Math.round(parseFloat(amount) * 1e9); // Convert TON to nanoTON

  try {
    // TON Blockchain Toncenter API Call
    const response = await fetch(
      `https://toncenter.com/api/v2/getTransactions?address=${ADMIN_WALLET}&limit=10`
    );
    const data = await response.json();

    if (!data.ok || !data.result) {
      return res.status(500).json({ success: false, message: 'Blockchain fetch failed' });
    }

    let isFound = false;
    const nowSec = Math.floor(Date.now() / 1000);

    for (let tx of data.result) {
      // Check in_msg (incoming transaction)
      if (tx.in_msg && tx.in_msg.value) {
        const value = parseInt(tx.in_msg.value);
        const txTime = tx.utime;

        // Check if value matches and transaction happened within last 15 mins (900 seconds)
        if (Math.abs(value - expectedNanoAmount) <= 100000 && (nowSec - txTime) <= 900) {
          isFound = true;
          break;
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
        message: 'Transaction not found on Blockchain. Please wait 1-2 minutes after sending.'
      });
    }
  } catch (error) {
    console.error("Blockchain Verification Error:", error);
    return res.status(500).json({ success: false, message: 'Server error while checking blockchain' });
  }
}
