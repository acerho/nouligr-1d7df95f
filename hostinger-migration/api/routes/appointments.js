const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate, requireStaff } = require('../middleware/auth');

const router = express.Router();

// Get all appointments (staff only)
router.get('/', authenticate, requireStaff, async (req, res) => {
  try {
    const [appointments] = await db.execute(`
      SELECT a.*, p.first_name, p.last_name, p.phone, p.email
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      ORDER BY a.scheduled_at DESC
    `);
    res.json(appointments);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get appointments for a specific date (public - for availability check)
router.get('/availability/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    const [appointments] = await db.execute(`
      SELECT scheduled_at, status FROM appointments 
      WHERE DATE(scheduled_at) = ? 
      AND status IN ('scheduled', 'arrived', 'in_progress')
    `, [date]);

    // Return only the times, not patient info
    const bookedSlots = appointments.map(apt => {
      const d = new Date(apt.scheduled_at);
      return d.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false,
        timeZone: 'Europe/Athens'
      });
    });

    res.json({ bookedSlots });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Get single appointment
router.get('/:id', authenticate, requireStaff, async (req, res) => {
  try {
    const [appointments] = await db.execute(`
      SELECT a.*, p.first_name, p.last_name, p.phone, p.email
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.id = ?
    `, [req.params.id]);

    if (appointments.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointments[0]);
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Create appointment (public for booking)
router.post('/', async (req, res) => {
  try {
    const {
      patient_id,
      scheduled_at,
      reason_for_visit,
      notes,
      booking_source
    } = req.body;

    if (!patient_id || !scheduled_at) {
      return res.status(400).json({ error: 'Patient ID and scheduled time required' });
    }

    const appointmentId = uuidv4();

    await db.execute(
      `INSERT INTO appointments (id, patient_id, scheduled_at, reason_for_visit, notes, booking_source, status)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
      [
        appointmentId,
        patient_id,
        scheduled_at,
        reason_for_visit || null,
        notes || null,
        booking_source || 'online'
      ]
    );

    const [newAppointment] = await db.execute(
      'SELECT * FROM appointments WHERE id = ?',
      [appointmentId]
    );

    res.status(201).json(newAppointment[0]);
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment
router.put('/:id', authenticate, requireStaff, async (req, res) => {
  try {
    const {
      status,
      scheduled_at,
      reason_for_visit,
      notes,
      checked_in_at,
      started_at,
      completed_at
    } = req.body;

    await db.execute(
      `UPDATE appointments SET 
        status = COALESCE(?, status),
        scheduled_at = COALESCE(?, scheduled_at),
        reason_for_visit = ?,
        notes = ?,
        checked_in_at = ?,
        started_at = ?,
        completed_at = ?
       WHERE id = ?`,
      [
        status,
        scheduled_at,
        reason_for_visit || null,
        notes || null,
        checked_in_at || null,
        started_at || null,
        completed_at || null,
        req.params.id
      ]
    );

    const [updated] = await db.execute(
      'SELECT * FROM appointments WHERE id = ?',
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/:id', authenticate, requireStaff, async (req, res) => {
  try {
    await db.execute('DELETE FROM appointments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Appointment deleted' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// Update appointment status (quick action)
router.patch('/:id/status', authenticate, requireStaff, async (req, res) => {
  try {
    const { status } = req.body;
    const now = new Date().toISOString();

    let updateFields = { status };

    // Set timestamps based on status
    if (status === 'arrived') {
      updateFields.checked_in_at = now;
    } else if (status === 'in_progress') {
      updateFields.started_at = now;
    } else if (status === 'completed') {
      updateFields.completed_at = now;
    }

    await db.execute(
      `UPDATE appointments SET 
        status = ?,
        checked_in_at = COALESCE(?, checked_in_at),
        started_at = COALESCE(?, started_at),
        completed_at = COALESCE(?, completed_at)
       WHERE id = ?`,
      [
        status,
        updateFields.checked_in_at || null,
        updateFields.started_at || null,
        updateFields.completed_at || null,
        req.params.id
      ]
    );

    const [updated] = await db.execute(
      'SELECT * FROM appointments WHERE id = ?',
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
