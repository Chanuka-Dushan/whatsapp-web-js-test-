const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const express = require('express');
const pino = require('pino');
const fs = require('fs');

const app = express();
app.use(express.json());

async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: 'silent' }) // keep logs clean
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('✅ WhatsApp connected');
    } else if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startSocket();
    }
  });

  return sock;
}

startSocket().then((sock) => {
  app.post('/send', async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) {
      return res.status(400).json({ error: 'Missing number or message' });
    }

    const id = number.endsWith('@s.whatsapp.net')
      ? number
      : `${number}@s.whatsapp.net`;

    try {
      await sock.sendMessage(id, { text: message });
      res.json({ status: 'Message sent ✅' });
    } catch (err) {
      console.error('❌ Message send failed:', err);
      res.status(500).json({ error: 'Send failed' });
    }
  });

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`🚀 API Server running at http://localhost:${PORT}`);
  });
});
