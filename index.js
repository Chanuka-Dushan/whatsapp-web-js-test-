const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

const app = express();
app.use(express.json());

async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: true, // ✅ QR will be shown in Termux terminal
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      console.log('✅ WhatsApp connected!');
    } else if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log('⚠️ Reconnecting...');
        startSocket();
      } else {
        console.log('❌ Logged out. Please re-scan QR.');
      }
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

    const id = number.includes('@s.whatsapp.net') ? number : number + '@s.whatsapp.net';

    try {
      await sock.sendMessage(id, { text: message });
      res.json({ status: '✅ Message sent' });
    } catch (err) {
      console.error('❌ Error sending message:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
