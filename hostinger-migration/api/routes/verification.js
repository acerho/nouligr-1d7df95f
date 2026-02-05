const express = require('express');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const db = require('../config/database');

const router = express.Router();

// Rate limit check helper
async function checkRateLimit(identifier, actionType, maxAttempts, windowMinutes) {
  const [logs] = await db.execute(
    `SELECT COUNT(*) as count FROM rate_limit_log 
     WHERE identifier = ? AND action_type = ? 
     AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [identifier, actionType, windowMinutes]
  );
  
  return logs[0].count < maxAttempts;
}

// Log rate limit attempt
async function logRateLimitAttempt(identifier, actionType) {
  await db.execute(
    'INSERT INTO rate_limit_log (id, identifier, action_type) VALUES (?, ?, ?)',
    [uuidv4(), identifier, actionType]
  );
}

// Send verification code
router.post('/send-code', async (req, res) => {
  try {
    const { phone, patientName } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    // Format phone (ensure +30 prefix for Greece)
    let formattedPhone = phone.replace(/\s/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+30' + formattedPhone;
    }

    // Check rate limit (20 per hour per phone)
    const allowed = await checkRateLimit(formattedPhone, 'send_verification_code', 20, 60);
    if (!allowed) {
      return res.status(429).json({ error: 'Too many verification attempts. Try again later.' });
    }

    // Generate 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store verification
    await db.execute(
      'INSERT INTO email_verifications (id, email, code, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), formattedPhone, code, expiresAt]
    );

    // Log rate limit
    await logRateLimitAttempt(formattedPhone, 'send_verification_code');

    // Get Infobip settings
    const [settings] = await db.execute(
      'SELECT infobip_api_key, infobip_base_url FROM practice_settings LIMIT 1'
    );

    if (settings.length > 0 && settings[0].infobip_api_key) {
      // Send SMS via Infobip
      try {
        await axios.post(
          `${settings[0].infobip_base_url}/sms/2/text/advanced`,
          {
            messages: [{
              destinations: [{ to: formattedPhone }],
              text: `Your verification code is: ${code}. Valid for 10 minutes.`
            }]
          },
          {
            headers: {
              'Authorization': `App ${settings[0].infobip_api_key}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (smsError) {
        console.error('SMS send error:', smsError);
        // Don't fail the request, just log
      }
    }

    res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('Send code error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Verify code
router.post('/verify-code', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code required' });
    }

    // Format phone
    let formattedPhone = phone.replace(/\s/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+30' + formattedPhone;
    }

    // Check rate limit (5 attempts per 15 minutes)
    const allowed = await checkRateLimit(formattedPhone, 'verify_code', 5, 15);
    if (!allowed) {
      return res.status(429).json({ error: 'Too many verification attempts. Try again later.' });
    }

    // Log attempt
    await logRateLimitAttempt(formattedPhone, 'verify_code');

    // Find verification
    const [verifications] = await db.execute(
      `SELECT * FROM email_verifications 
       WHERE email = ? AND code = ? AND verified_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [formattedPhone, code]
    );

    if (verifications.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Mark as verified
    await db.execute(
      'UPDATE email_verifications SET verified_at = NOW() WHERE id = ?',
      [verifications[0].id]
    );

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

module.exports = router;
