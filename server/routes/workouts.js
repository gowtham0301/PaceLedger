
const express = require('express')
const mongoose = require('mongoose')
const Workout = require('../models/Workout')

const router = express.Router()

const workoutTypes = [
  'Walking',
  'Running',
  'Cycling',
  'Strength Training',
  'Yoga',
  'Swimming',
  'Other',
]

router.get('/', async (req, res) => {
  try {
    const workouts = await Workout.find().sort({ date: -1, createdAt: -1 })
    res.json(workouts)
  } catch (error) {
    res.status(500).json({ message: 'Failed to load workouts.' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { type, date, duration, calories, notes } = req.body

    if (!workoutTypes.includes(type)) {
      return res.status(400).json({ message: 'Select a valid workout type.' })
    }

    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({ message: 'Enter a valid workout date.' })
    }

    const minutes = Number(duration)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      return res.status(400).json({
        message: 'Duration must be between 1 and 1440 minutes.',
      })
    }

    let parsedCalories = null
    if (calories !== '' && calories !== null && calories !== undefined) {
      parsedCalories = Number(calories)
      if (!Number.isFinite(parsedCalories) || parsedCalories < 0) {
        return res.status(400).json({
          message: 'Calories must be a non-negative number.',
        })
      }
    }

    const workout = await Workout.create({
      type,
      date,
      duration: minutes,
      calories: parsedCalories,
      notes: String(notes || '').trim(),
    })

    res.status(201).json(workout)
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message })
    }
    res.status(500).json({ message: 'Failed to save workout.' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid workout ID.' })
    }

    const workout = await Workout.findByIdAndDelete(req.params.id)

    if (!workout) {
      return res.status(404).json({ message: 'Workout not found.' })
    }

    res.json({ message: 'Workout deleted successfully.' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete workout.' })
  }
})

module.exports = router
