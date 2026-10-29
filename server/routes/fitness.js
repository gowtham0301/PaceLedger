
const express = require('express')
const FitnessRecord = require('../models/FitnessRecord')

const router = express.Router()

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

// GET all records, newest activity date first
router.get('/', async (req, res) => {
  try {
    const records = await FitnessRecord.find().sort({ date: -1 })
    res.json(records)
  } catch (error) {
    console.error('Fetch records error:', error)
    res.status(500).json({ message: 'Could not fetch fitness records.' })
  }
})

// GET a single record by date
router.get('/:date', async (req, res) => {
  try {
    const record = await FitnessRecord.findOne({ date: req.params.date })
    if (!record) return res.status(404).json({ message: 'Record not found.' })
    res.json(record)
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch fitness record.' })
  }
})

// CREATE or update the record for a date
router.put('/:date', async (req, res) => {
  try {
    const { date } = req.params

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Date must use YYYY-MM-DD format.' })
    }

    const payload = {
      date,
      steps: toNumberOrNull(req.body.steps),
      distance: String(req.body.distance ?? ''),
      calories: toNumberOrNull(req.body.calories),
      totalCalories: toNumberOrNull(req.body.totalCalories),
      flightsClimbed: toNumberOrNull(req.body.flightsClimbed),
      exerciseMinutes: toNumberOrNull(req.body.exerciseMinutes),
      source: String(req.body.source || 'Apple Health screenshot'),
      screenshots: Array.isArray(req.body.screenshots)
        ? req.body.screenshots.map(name => String(name).slice(0, 200))
        : [],
    }

    const record = await FitnessRecord.findOneAndUpdate(
      { date },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    )

    res.json({ message: 'Fitness record saved.', record })
  } catch (error) {
    console.error('Save record error:', error)
    res.status(400).json({ message: 'Could not save record. Check the submitted values.' })
  }
})

// DELETE a record by date
router.delete('/:date', async (req, res) => {
  try {
    const record = await FitnessRecord.findOneAndDelete({ date: req.params.date })
    if (!record) return res.status(404).json({ message: 'Record not found.' })
    res.json({ message: 'Fitness record deleted.' })
  } catch (error) {
    res.status(500).json({ message: 'Could not delete fitness record.' })
  }
})

module.exports = router
