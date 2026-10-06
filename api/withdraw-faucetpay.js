export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, amount, currency } = req.body;

  if (!email || !amount) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY;

    const response = await fetch('https://faucetpay.io/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: FAUCETPAY_API_KEY,
        to: email,
        amount: Math.floor(amount * 100000000),
        currency: currency || 'USDT'
      })
    });

    const data = await response.json();

    if (data && data.status === 200) {
      return res.status(200).json({ success: true, message: 'Withdrawal successful', data });
    } else {
      return res.status(400).json({ success: false, message: data.message || 'FaucetPay API error' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error connecting to FaucetPay' });
  }
}
