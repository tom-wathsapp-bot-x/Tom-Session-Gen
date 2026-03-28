const { default: makeWASocket, useMultiFileAuthState, delay, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const fs = require("fs-extra");
const crypto = require('crypto');
global.crypto = crypto;

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("<h1>Tom Session Generator</h1><p>Use /pair?num=88017xxxxxxxx to get code.</p>");
});

async function createSession(num, res) {
    const authPath = `./session_${num}`;
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        await delay(5000);
        try {
            const code = await sock.requestPairingCode(num);
            if (!res.headersSent) res.json({ code: code });
        } catch (err) {
            if (!res.headersSent) res.json({ error: "Service Busy" });
        }
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") {
            await delay(10000);
            const creds = JSON.parse(fs.readFileSync(`${authPath}/creds.json`));
            const sessionId = Buffer.from(JSON.stringify(creds)).toString("base64");
            
            await sock.sendMessage(sock.user.id, { 
                text: `TOM_SESSION_ID:${sessionId}` 
            });
            
            console.log(`Session sent to ${num}`);
            await delay(2000);
            fs.removeSync(authPath); // Security cleanup
            process.exit(0);
        }
    });
}

app.get("/pair", async (req, res) => {
    const num = req.query.num;
    if (!num) return res.json({ error: "Provide Number" });
    await createSession(num, res);
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
