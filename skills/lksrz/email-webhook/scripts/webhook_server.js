const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '50mb' })); // Support large attachments

const PORT = process.env.PORT || 19192;

// Security: Use a strong secret. Do not provide a weak default.
const SECRET = process.env.WEBHOOK_SECRET;
if (!SECRET || SECRET === 'dev-secret') {
    console.error('CRITICAL ERROR: WEBHOOK_SECRET is not set or uses a weak default.');
    console.error('Please set a strong WEBHOOK_SECRET environment variable.');
    process.exit(1);
}

// Security: Sanitize INBOX_FILE to prevent directory traversal.
// We only allow the filename, and it will be stored in the process CWD.
const RAW_INBOX_FILE = process.env.INBOX_FILE || 'inbox.jsonl';
const INBOX_FILE = path.basename(RAW_INBOX_FILE);
const INBOX_PATH = path.resolve(process.cwd(), INBOX_FILE);

app.post('/api/email', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${SECRET}`) {
        console.warn(`[AUTH] Unauthorized webhook attempt from ${req.ip}`);
        return res.status(403).send('Forbidden');
    }

    const email = req.body;
    
    // Basic validation of body
    if (!email || typeof email !== 'object') {
        return res.status(400).send('Invalid payload');
    }

    console.log(`[OK] Received email from ${email.from || 'unknown'} to ${email.to || 'unknown'}: ${email.subject || '(no subject)'}`);

    try {
        const entry = JSON.stringify({
            receivedAt: new Date().toISOString(),
            ...email
        }) + '\n';
        
        fs.appendFileSync(INBOX_PATH, entry);
        res.status(200).send({ success: true });
    } catch (e) {
        console.error(`[ERROR] Failed to save email: ${e.message}`);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n📧 EMAIL WEBHOOK SERVER READY (v1.1.0)`);
    console.log(`Port: ${PORT}`);
    console.log(`Inbox: ${INBOX_PATH}`);
    console.log(`Endpoint: /api/email\n`);
    console.log(`SECURITY: Directory traversal protected. Token auth required.`);
});
