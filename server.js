import express from 'express';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ALERT_FILE = './alerts.json';

app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.tradewithjars.net');
  next();
});


let cachedPrices = { solana: 0, 'usd-coin': 1 };
let lastFetch = 0;

async function getPrices() {
  const now = Date.now();
  if (now - lastFetch > 3600000) {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd');
      const data = await res.json();
      cachedPrices = data;
      lastFetch = now;
      console.log('✅ Fetched prices:', cachedPrices);
    } catch (err) {
      console.error('❌ Failed to fetch prices:', err);
    }
  }
  return cachedPrices;
}

function toUSD(amount, mint, prices) {
  try {
    if (mint.includes('So11111111111111111111111111111111111111112')) {
      return amount * (prices.solana?.usd || 0);
    } else if (mint.includes('BXXkv6zRCzUVtpKzLZqYU8djDNBm6JjHoBeX6xBKUWsp')) {
      return amount * (prices['usd-coin']?.usd || 0);
    }
  } catch (err) {
    console.error('Price conversion error:', err);
  }
  return 0;
}

function saveAlert(alert) {
  let alerts = [];
  if (fs.existsSync(ALERT_FILE)) {
    alerts = JSON.parse(fs.readFileSync(ALERT_FILE));
  }
  alerts.unshift(alert);
  if (alerts.length > 15) alerts = alerts.slice(0, 15);
  fs.writeFileSync(ALERT_FILE, JSON.stringify(alerts, null, 2));
}

async function sendToDiscord(alert) {
  await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: '🐋 Whale Transfer Detected!',
          color: 0x00ffcc,
          fields: [
            { name: 'Token', value: alert.token, inline: false },
            { name: 'Amount', value: alert.amount.toLocaleString(), inline: true },
            { name: 'USD Value', value: `$${alert.usdValue.toLocaleString()}`, inline: true },
            { name: 'From', value: alert.source, inline: false },
            { name: 'To', value: alert.destination, inline: false },
            { name: 'Transaction', value: `[View on Solscan](${alert.txLink})`, inline: false }
          ],
          timestamp: alert.timestamp,
          footer: {
            text: 'Jars SOL Whale Tracker',
            icon_url: 'https://tradewithjars.net/TradeWithJarslogo.png'
          }
        }
      ]
    })
  });
}

app.post('/webhook', async (req, res) => {
  try {
    const tx = req.body;
    const prices = await getPrices();

    for (const transfer of tx.events?.tokenTransfers || []) {
      const amount = parseFloat(transfer.tokenAmount);
      const usdValue = toUSD(amount, transfer.mint, prices);

      if (usdValue >= 50000000) {
        const alert = {
          token: transfer.mint,
          amount,
          usdValue,
          source: transfer.source,
          destination: transfer.destination,
          txLink: `https://solscan.io/tx/${tx.signature}`,
          timestamp: new Date().toISOString()
        };

        saveAlert(alert);
        await sendToDiscord(alert);
        console.log('🐋 Whale Alert sent and saved.');
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Error');
  }
});

app.get('/alerts.json', (req, res) => {
  if (fs.existsSync(ALERT_FILE)) {
    res.setHeader('Content-Type', 'application/json');
    res.send(fs.readFileSync(ALERT_FILE));
  } else {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Whale alert server running on port ${PORT}`);
});
