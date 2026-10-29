
const mongoose = require('mongoose');

const weightGoalSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: 'default',
    },
    startingWeight: {
      type: Number,
      min: 20,
      max: 400,
      default: null,
    },
    goalWeight: {
      type: Number,
      min: 20,
      max: 400,
      default: null,
    },
    height: {
      type: Number,
      min: 100,
      max: 250,
      default: null,
    },
    targetDate: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WeightGoal', weightGoalSchema);
