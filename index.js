const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  generateWAMessage,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const express = require('express');
const pino = require('pino');

const app = express();
app.use(express.json());

async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  // 🟩 Manually show QR in terminal
  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log("📷 Scan the QR below:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected!');
    } else if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output.statusCode;

      if (reason !== DisconnectReason.loggedOut) {
        console.log('⚠️ Disconnected, reconnecting...');
        startSocket();
      } else {
        console.log('❌ Logged out. Please delete auth folder to reset.');
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

    const jid = number.includes('@s.whatsapp.net') ? number : number + '@s.whatsapp.net';

    try {
      await sock.sendMessage(jid, { text: message });
      res.json({ status: '✅ Message sent' });
    } catch (err) {
      console.error('❌ Send failed:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
