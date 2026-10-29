
const mongoose = require("mongoose");

const nutritionEntrySchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    meal: {
      type: String,
      enum: ["Breakfast", "Lunch", "Snack", "Dinner"],
      required: true,
    },

    foodId: {
      type: String,
      required: true,
    },

    foodName: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.000001,
      max: 100000,
    },

    portionAmount: {
      type: Number,
      min: 0.1,
      max: 100000,
    },

    portionUnit: {
      type: String,
      enum: ["serving", "g", "ml"],
      default: "serving",
    },

    servingLabel: {
      type: String,
      required: true,
    },

    calories: { type: Number, required: true, min: 0 },
    protein: { type: Number, required: true, min: 0 },
    carbs: { type: Number, required: true, min: 0 },
    fat: { type: Number, required: true, min: 0 },
    fiber: { type: Number, default: 0, min: 0 },

    dataQuality: {
      type: String,
      enum: ["reference", "estimated"],
      default: "estimated",
    },

    source: {
      type: String,
      default: "PaceLedger food reference",
    },
  },
  { timestamps: true }
);

nutritionEntrySchema.index({ date: -1, meal: 1 });

module.exports = mongoose.model(
  "NutritionEntry",
  nutritionEntrySchema
);
