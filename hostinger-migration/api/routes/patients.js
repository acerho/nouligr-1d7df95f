const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate, requireStaff } = require('../middleware/auth');

const router = express.Router();

// Get all patients (staff only)
router.get('/', authenticate, requireStaff, async (req, res) => {
  try {
    const [patients] = await db.execute(
      'SELECT * FROM patients ORDER BY last_name, first_name'
    );
    res.json(patients);
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Get single patient
router.get('/:id', authenticate, requireStaff, async (req, res) => {
  try {
    const [patients] = await db.execute(
      'SELECT * FROM patients WHERE id = ?',
      [req.params.id]
    );

    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patients[0]);
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// Create patient (public for booking, staff for manual)
router.post('/', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      sex,
      address,
      illness,
      national_health_number,
      custom_fields
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First and last name required' });
    }

    const patientId = uuidv4();

    await db.execute(
      `INSERT INTO patients (id, first_name, last_name, email, phone, date_of_birth, sex, address, illness, national_health_number, custom_fields)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        first_name,
        last_name,
        email || null,
        phone || null,
        date_of_birth || null,
        sex || null,
        address || null,
        illness || null,
        national_health_number || null,
        JSON.stringify(custom_fields || {})
      ]
    );

    const [newPatient] = await db.execute(
      'SELECT * FROM patients WHERE id = ?',
      [patientId]
    );

    res.status(201).json(newPatient[0]);
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// Update patient
router.put('/:id', authenticate, requireStaff, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      sex,
      address,
      illness,
      national_health_number,
      custom_fields
    } = req.body;

    await db.execute(
      `UPDATE patients SET 
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = ?,
        phone = ?,
        date_of_birth = ?,
        sex = ?,
        address = ?,
        illness = ?,
        national_health_number = ?,
        custom_fields = ?
       WHERE id = ?`,
      [
        first_name,
        last_name,
        email || null,
        phone || null,
        date_of_birth || null,
        sex || null,
        address || null,
        illness || null,
        national_health_number || null,
        JSON.stringify(custom_fields || {}),
        req.params.id
      ]
    );

    const [updated] = await db.execute(
      'SELECT * FROM patients WHERE id = ?',
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// Delete patient
router.delete('/:id', authenticate, requireStaff, async (req, res) => {
  try {
    await db.execute('DELETE FROM patients WHERE id = ?', [req.params.id]);
    res.json({ message: 'Patient deleted' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

// Find patient by phone (for booking)
router.get('/lookup/phone/:phone', async (req, res) => {
  try {
    const [patients] = await db.execute(
      'SELECT id, first_name, last_name, phone, email FROM patients WHERE phone = ?',
      [req.params.phone]
    );
    res.json(patients[0] || null);
  } catch (error) {
    console.error('Lookup patient error:', error);
    res.status(500).json({ error: 'Failed to lookup patient' });
  }
});

module.exports = router;
