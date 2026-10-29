const express = require('express');
const mongoose = require('mongoose');
const SleepRecord = require('../models/SleepRecord');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const records = await SleepRecord.find().sort({ date: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load sleep records.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, bedtime, wakeTime, quality, notes } = req.body;

    if (!date || !bedtime || !wakeTime) {
      return res.status(400).json({
        message: 'Date, bedtime, and wake-up time are required.',
      });
    }

    const record = await SleepRecord.findOneAndUpdate(
      { date },
      { date, bedtime, wakeTime, quality, notes },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json(record);
  } catch (error) {
    res.status(400).json({
      message: error.message || 'Failed to save sleep record.',
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid sleep record ID.' });
    }

    const record = await SleepRecord.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({ message: 'Sleep record not found.' });
    }

    res.json({ message: 'Sleep record deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete sleep record.' });
  }
});

module.exports = router;
