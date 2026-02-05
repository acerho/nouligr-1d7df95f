const express = require('express');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const db = require('../config/database');
const { authenticate, requireStaff } = require('../middleware/auth');

const router = express.Router();

// Send booking confirmation (public)
router.post('/booking-confirmation', async (req, res) => {
  try {
    const { phone, patientName, appointmentDate, appointmentTime, practiceName, practiceAddress } = req.body;

    if (!phone || !patientName || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Format phone
    let formattedPhone = phone.replace(/\s/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+30' + formattedPhone;
    }

    // Get Infobip settings
    const [settings] = await db.execute(
      'SELECT infobip_api_key, infobip_base_url, practice_name, address FROM practice_settings LIMIT 1'
    );

    const message = `Γεια σας ${patientName}! Το ραντεβού σας στο ${practiceName || settings[0]?.practice_name || 'ιατρείο'} επιβεβαιώθηκε για ${appointmentDate} στις ${appointmentTime}. Διεύθυνση: ${practiceAddress || settings[0]?.address || 'N/A'}`;

    if (settings.length > 0 && settings[0].infobip_api_key) {
      try {
        await axios.post(
          `${settings[0].infobip_base_url}/sms/2/text/advanced`,
          {
            messages: [{
              destinations: [{ to: formattedPhone }],
              text: message
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
      }
    }

    // Log notification
    await db.execute(
      'INSERT INTO notification_logs (id, message, notification_type) VALUES (?, ?, ?)',
      [uuidv4(), message, 'booking_confirmation']
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Booking confirmation error:', error);
    res.status(500).json({ error: 'Failed to send confirmation' });
  }
});

// Send appointment reminder (staff only)
router.post('/appointment-reminder', authenticate, requireStaff, async (req, res) => {
  try {
    const { appointmentId } = req.body;

    // Get appointment with patient details
    const [appointments] = await db.execute(`
      SELECT a.*, p.first_name, p.last_name, p.phone 
      FROM appointments a 
      JOIN patients p ON a.patient_id = p.id 
      WHERE a.id = ?
    `, [appointmentId]);

    if (appointments.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const apt = appointments[0];
    const scheduledDate = new Date(apt.scheduled_at);
    const dateStr = scheduledDate.toLocaleDateString('el-GR');
    const timeStr = scheduledDate.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });

    // Get settings
    const [settings] = await db.execute(
      'SELECT infobip_api_key, infobip_base_url, practice_name FROM practice_settings LIMIT 1'
    );

    const message = `Υπενθύμιση: ${apt.first_name}, έχετε ραντεβού στο ${settings[0]?.practice_name || 'ιατρείο'} στις ${dateStr} ${timeStr}.`;

    if (settings.length > 0 && settings[0].infobip_api_key && apt.phone) {
      try {
        await axios.post(
          `${settings[0].infobip_base_url}/sms/2/text/advanced`,
          {
            messages: [{
              destinations: [{ to: apt.phone }],
              text: message
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
      }
    }

    // Log notification
    await db.execute(
      'INSERT INTO notification_logs (id, patient_id, appointment_id, message, notification_type) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), apt.patient_id, appointmentId, message, 'reminder']
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Reminder error:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// Send reschedule notification (staff only)
router.post('/reschedule', authenticate, requireStaff, async (req, res) => {
  try {
    const { appointmentId, oldDate, oldTime, newDate, newTime } = req.body;

    // Get appointment with patient
    const [appointments] = await db.execute(`
      SELECT a.*, p.first_name, p.phone 
      FROM appointments a 
      JOIN patients p ON a.patient_id = p.id 
      WHERE a.id = ?
    `, [appointmentId]);

    if (appointments.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const apt = appointments[0];

    // Get settings
    const [settings] = await db.execute(
      'SELECT infobip_api_key, infobip_base_url, practice_name FROM practice_settings LIMIT 1'
    );

    const message = `${apt.first_name}, το ραντεβού σας άλλαξε. Παλιό: ${oldDate} ${oldTime}. Νέο: ${newDate} ${newTime}. ${settings[0]?.practice_name || 'Ιατρείο'}`;

    if (settings.length > 0 && settings[0].infobip_api_key && apt.phone) {
      try {
        await axios.post(
          `${settings[0].infobip_base_url}/sms/2/text/advanced`,
          {
            messages: [{
              destinations: [{ to: apt.phone }],
              text: message
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
      }
    }

    // Log notification
    await db.execute(
      'INSERT INTO notification_logs (id, patient_id, appointment_id, message, notification_type) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), apt.patient_id, appointmentId, message, 'reschedule']
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Reschedule notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;
