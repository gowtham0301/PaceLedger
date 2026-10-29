
const express = require('express');
const mongoose = require('mongoose');
const WeightRecord = require('../models/WeightRecord');
const WeightGoal = require('../models/WeightGoal');

const router = express.Router();

function validateDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date;
}

router.get('/goals', async (req, res) => {
  try {
    const goals = await WeightGoal.findOne({ key: 'default' });
    res.json(goals);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load weight goals.' });
  }
});

router.put('/goals', async (req, res) => {
  try {
    const { startingWeight, goalWeight, height, targetDate = '' } = req.body;

    for (const [name, value] of Object.entries({
      startingWeight,
      goalWeight,
      height,
    })) {
      if (value !== null && value !== undefined && value !== '') {
        if (!Number.isFinite(Number(value))) {
          return res.status(400).json({ message: `${name} must be a number.` });
        }
      }
    }

    if (
      targetDate !== '' &&
      (!validateDate(targetDate) || targetDate < new Date().toISOString().slice(0, 10))
    ) {
      return res.status(400).json({ message: 'Target date must be a valid date today or later.' });
    }

    const payload = {
      startingWeight: startingWeight === '' || startingWeight == null ? null : Number(startingWeight),
      goalWeight: goalWeight === '' || goalWeight == null ? null : Number(goalWeight),
      height: height === '' || height == null ? null : Number(height),
      targetDate,
    };

    const goals = await WeightGoal.findOneAndUpdate(
      { key: 'default' },
      { $set: payload, $setOnInsert: { key: 'default' } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(goals);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to save weight goals.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const records = await WeightRecord.find().sort({ date: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load weight records.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, weight, notes = '' } = req.body;

    if (!validateDate(date)) {
      return res.status(400).json({ message: 'Provide a valid measurement date.' });
    }

    if (date > new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ message: 'Weight records cannot be dated in the future.' });
    }

    if (weight === '' || weight === null || weight === undefined ||
        !Number.isFinite(Number(weight))) {
      return res.status(400).json({ message: 'Weight must be a valid number.' });
    }

    if (typeof notes !== 'string' || notes.length > 500) {
      return res.status(400).json({ message: 'Notes must be 500 characters or fewer.' });
    }

    const record = await WeightRecord.findOneAndUpdate(
      { date },
      { $set: { date, weight: Number(weight), notes } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json(record);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to save weight record.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid weight record ID.' });
    }

    const record = await WeightRecord.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({ message: 'Weight record not found.' });
    }

    res.json({ message: 'Weight record deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete weight record.' });
  }
});

module.exports = router;
