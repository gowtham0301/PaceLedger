
const mongoose = require("mongoose");

const nutritionGoalSchema = new mongoose.Schema(
  {
    profile: {
      weightKg: { type: Number, required: true, min: 25, max: 350 },
      heightCm: { type: Number, required: true, min: 100, max: 250 },
      age: { type: Number, required: true, min: 18, max: 100 },
      sex: {
        type: String,
        enum: ["male", "female"],
        required: true,
      },
      activityLevel: {
        type: String,
        enum: ["sedentary", "light", "moderate", "very_active"],
        required: true,
      },
      goal: {
        type: String,
        enum: ["fat_loss", "maintenance", "weight_gain"],
        required: true,
      },
    },

    targets: {
      calories: { type: Number, required: true, min: 500, max: 10000 },
      protein: { type: Number, required: true, min: 0, max: 500 },
      carbs: { type: Number, required: true, min: 0, max: 1000 },
      fat: { type: Number, required: true, min: 0, max: 500 },
      fiber: { type: Number, required: true, min: 0, max: 100 },
    },

    targetSource: {
      type: String,
      enum: ["calculated", "manual"],
      default: "calculated",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NutritionGoal", nutritionGoalSchema);
