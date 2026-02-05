const express = require('express');
const db = require('../config/database');
const { authenticate, requireStaff } = require('../middleware/auth');

const router = express.Router();

// Get practice settings (public view - no sensitive data)
router.get('/public', async (req, res) => {
  try {
    const [settings] = await db.execute(`
      SELECT 
        id, practice_name, doctor_name, phone_number, address, 
        specialty, logo_url, is_closed, closure_reason, 
        operating_hours, custom_patient_fields,
        infobip_base_url, infobip_sender_email
      FROM practice_settings 
      LIMIT 1
    `);

    if (settings.length === 0) {
      return res.json(null);
    }

    res.json(settings[0]);
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get full practice settings (staff only)
router.get('/', authenticate, requireStaff, async (req, res) => {
  try {
    const [settings] = await db.execute('SELECT * FROM practice_settings LIMIT 1');

    if (settings.length === 0) {
      return res.json(null);
    }

    res.json(settings[0]);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update practice settings
router.put('/', authenticate, requireStaff, async (req, res) => {
  try {
    const {
      practice_name,
      doctor_name,
      phone_number,
      address,
      specialty,
      logo_url,
      is_closed,
      closure_reason,
      operating_hours,
      custom_patient_fields,
      infobip_api_key,
      infobip_base_url,
      infobip_sender_email
    } = req.body;

    // Get existing settings
    const [existing] = await db.execute('SELECT id FROM practice_settings LIMIT 1');

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    await db.execute(
      `UPDATE practice_settings SET 
        practice_name = COALESCE(?, practice_name),
        doctor_name = COALESCE(?, doctor_name),
        phone_number = ?,
        address = ?,
        specialty = ?,
        logo_url = ?,
        is_closed = COALESCE(?, is_closed),
        closure_reason = ?,
        operating_hours = COALESCE(?, operating_hours),
        custom_patient_fields = COALESCE(?, custom_patient_fields),
        infobip_api_key = ?,
        infobip_base_url = ?,
        infobip_sender_email = ?
       WHERE id = ?`,
      [
        practice_name,
        doctor_name,
        phone_number || null,
        address || null,
        specialty || null,
        logo_url || null,
        is_closed,
        closure_reason || null,
        operating_hours ? JSON.stringify(operating_hours) : null,
        custom_patient_fields ? JSON.stringify(custom_patient_fields) : null,
        infobip_api_key || null,
        infobip_base_url || null,
        infobip_sender_email || null,
        existing[0].id
      ]
    );

    const [updated] = await db.execute('SELECT * FROM practice_settings WHERE id = ?', [existing[0].id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
