const mongoose = require('mongoose');

const sleepRecordSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    bedtime: {
      type: String,
      required: true,
      match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    },
    wakeTime: {
      type: String,
      required: true,
      match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    },
    quality: {
      type: String,
      enum: ['Excellent', 'Good', 'Fair', 'Poor'],
      default: 'Good',
    },
    notes: {
      type: String,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
);

sleepRecordSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('SleepRecord', sleepRecordSchema);
