
const mongoose = require('mongoose')

const workoutSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'Walking',
        'Running',
        'Cycling',
        'Strength Training',
        'Yoga',
        'Swimming',
        'Other',
      ],
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
    },
    calories: {
      type: Number,
      min: 0,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Workout', workoutSchema)
