
const mongoose = require('mongoose')

const fitnessRecordSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    steps: {
      type: Number,
      min: 0,
      default: null,
    },
    distance: {
      type: String,
      default: '',
    },
    calories: {
      type: Number,
      min: 0,
      default: null,
    },
    totalCalories: {
      type: Number,
      min: 0,
      default: null,
    },
    flightsClimbed: {
      type: Number,
      min: 0,
      default: null,
    },
    exerciseMinutes: {
      type: Number,
      min: 0,
      default: null,
    },
    source: {
      type: String,
      default: 'Apple Health screenshot',
    },
    screenshots: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
)

fitnessRecordSchema.index({ date: 1 }, { unique: true })

module.exports = mongoose.model('FitnessRecord', fitnessRecordSchema)
