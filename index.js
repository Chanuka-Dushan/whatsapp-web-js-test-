const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());

// Use LocalAuth to persist session
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox'],
  },
});

// Display QR if needed
client.on('qr', (qr) => {
  console.log('📲 Scan this QR code with WhatsApp:');
  qrcode.generate(qr, { small: true });
});

// Ready event
client.on('ready', () => {
  console.log('✅ WhatsApp Web is ready to send messages!');
});

// Basic POST /send
app.post('/send', async (req, res) => {
  const { number, message } = req.body;
  if (!number || !message) {
    return res.status(400).json({ error: 'Missing number or message' });
  }

  const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

  try {
    await client.sendMessage(chatId, message);
    res.status(200).json({ status: 'Message sent' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Start
client.initialize();
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
