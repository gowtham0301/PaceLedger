
const mongoose = require('mongoose');

const weightRecordSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    weight: {
      type: Number,
      required: true,
      min: 20,
      max: 400,
    },
    notes: {
      type: String,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
);

weightRecordSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('WeightRecord', weightRecordSchema);
