const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
const express = require('express');
require('dotenv').config();

const { getAIResponse } = require('./gemini');

async function getExcelData(message) {
  try {
    const filePath = path.join(__dirname, 'data.xlsx');
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws, { defval: "" });

    const messageWords = message.toLowerCase().split(/\W+/);
    // Your custom matching logic here

    return null; // fallback to Gemini if no match
  } catch (err) {
    console.error("Excel read error:", err.message);
    return "❌ Failed to read Excel data.";
  }
}

// 🧠 Initialize WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(), // 🔐 Persistent auth
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// 📸 QR Code Generation
client.on('qr', (qr) => {
  console.log('📱 Scan this QR code to login:');
  qrcode.generate(qr, { small: true });
});

// ✅ Ready
client.on('ready', () => {
  console.log('✅ Successfully connected to WhatsApp!');
});

// 💬 Handle Incoming Messages
client.on('message', async (msg) => {
  const text = msg.body.trim();
  const from = msg.from;

  let response = await getExcelData(text);
  if (!response) {
    response = await getAIResponse(text);
  }

  if (response && typeof response === 'string') {
    await client.sendMessage(from, response);
  } else {
    console.warn("⚠️ No valid response generated.");
  }
});


const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_, res) => {
  res.send('WhatsApp bot is running!');
});

app.listen(PORT, () => {
  console.log(`Dummy server is listening on port ${PORT}`);
});

// 🚀 Start the bot
client.initialize();
