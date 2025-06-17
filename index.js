const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@adiwajshing/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json());

const authFile = './auth_info.json';
const { state, saveState } = useSingleFileAuthState(authFile);

async function startWhatsApp() {
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('Scan this QR code with WhatsApp:', qr);
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed due to', lastDisconnect.error, ', reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        startWhatsApp();
      }
    }
    if (connection === 'open') {
      console.log('WhatsApp connection opened');
    }
  });

  return sock;
}

startWhatsApp().then(sock => {
  app.post('/send', async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) {
      return res.status(400).json({ error: 'Missing number or message' });
    }
    const id = number.includes('@s.whatsapp.net') ? number : number + '@s.whatsapp.net';

    try {
      await sock.sendMessage(id, { text: message });
      return res.json({ status: 'Message sent' });
    } catch (err) {
      console.error('Failed to send message:', err);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  });

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start WhatsApp socket:', err);
});
