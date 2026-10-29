
const express = require("express");
const mongoose = require("mongoose");
const NutritionEntry = require("../models/NutritionEntry");
const foods = require("../data/foods");
const NutritionGoal = require("../models/NutritionGoal");

const router = express.Router();

const meals = ["Breakfast", "Lunch", "Snack", "Dinner"];

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function summarize(entries) {
  const total = entries.reduce(
    (result, entry) => {
      result.calories += entry.calories;
      result.protein += entry.protein;
      result.carbs += entry.carbs;
      result.fat += entry.fat;
      result.fiber += entry.fiber;
      return result;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  for (const key of Object.keys(total)) {
    total[key] = Math.round(total[key] * 10) / 10;
  }

  return total;
}

// Search foods: GET /api/nutrition/foods?q=rice
router.get("/foods", (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();

  if (query.length < 1) return res.json([]);

  const matches = foods
    .filter((food) => food.name.toLowerCase().includes(query))
    .slice(0, 10);

  res.json(matches);
});

// Daily and weekly summary
// GET /api/nutrition/summary?date=2026-10-13
router.get("/summary", async (req, res) => {
  try {
    const date = req.query.date;

    if (!isValidDate(date)) {
      return res.status(400).json({ message: "Provide a valid date (YYYY-MM-DD)." });
    }

    const startOfWeek = addDays(date, -(
      (new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7
    ));
    const endOfWeek = addDays(startOfWeek, 6);

    const entries = await NutritionEntry.find({
      date: { $gte: startOfWeek, $lte: endOfWeek },
    }).sort({ date: 1, createdAt: 1 });

    const dailyEntries = entries.filter((entry) => entry.date === date);

    const weeklyDays = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(startOfWeek, index);
      const dayEntries = entries.filter((entry) => entry.date === day);

      return {
        date: day,
        ...summarize(dayEntries),
        entryCount: dayEntries.length,
      };
    });

    const mealTotals = meals.map((meal) => ({
      meal,
      ...summarize(dailyEntries.filter((entry) => entry.meal === meal)),
    }));

    res.json({
      date,
      daily: {
        ...summarize(dailyEntries),
        entryCount: dailyEntries.length,
      },
      weekly: {
        startDate: startOfWeek,
        endDate: endOfWeek,
        ...summarize(entries),
        days: weeklyDays,
      },
      mealTotals,
    });
  } catch (error) {
    console.error("Nutrition summary error:", error);
    res.status(500).json({ message: "Could not calculate nutrition summary." });
  }
});

// Get diary entries for a date
// GET /api/nutrition?date=2026-10-13
router.get("/", async (req, res) => {
  try {
    const date = req.query.date;

    if (!isValidDate(date)) {
      return res.status(400).json({ message: "Provide a valid date (YYYY-MM-DD)." });
    }

    const entries = await NutritionEntry.find({ date }).sort({
      createdAt: 1,
    });

    res.json(entries);
  } catch (error) {
    console.error("Nutrition list error:", error);
    res.status(500).json({ message: "Could not load nutrition entries." });
  }
});

// Add a food entry
router.post("/", async (req, res) => {
  try {
    const { date, meal, foodId } = req.body;
    const portionUnit = req.body.portionUnit || "serving";

    if (!isValidDate(date)) {
      return res.status(400).json({ message: "Provide a valid date." });
    }

    if (!meals.includes(meal)) {
      return res.status(400).json({ message: "Choose a valid meal category." });
    }

    const food = foods.find((item) => item.id === foodId);

    if (!food) {
      return res.status(400).json({
        message: "Choose a food from the suggestions.",
      });
    }

    if (!["serving", "g", "ml"].includes(portionUnit)) {
      return res.status(400).json({ message: "Invalid portion unit." });
    }

    // Older frontend requests still work as standard servings.
    const rawAmount =
      req.body.portionAmount ?? req.body.quantity ?? 1;
    const amount = Number(rawAmount);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return res.status(400).json({
        message: "Enter a valid positive portion amount.",
      });
    }

    let multiplier;
    let quantity;
    let servingLabel = food.servingLabel;

    if (portionUnit === "g") {
      if (!food.servingGrams) {
        return res.status(400).json({
          message: "Gram measurement is unavailable for this food. Use servings.",
        });
      }

      multiplier = amount / food.servingGrams;
      quantity = multiplier;
      servingLabel = `${amount} g`;
    } else if (portionUnit === "ml") {
      if (!food.servingMl) {
        return res.status(400).json({
          message: "Millilitre measurement is unavailable for this food. Use servings.",
        });
      }

      multiplier = amount / food.servingMl;
      quantity = multiplier;
      servingLabel = `${amount} ml`;
    } else {
      if (amount > 100) {
        return res.status(400).json({
          message: "Serving quantity cannot exceed 100.",
        });
      }

      multiplier = amount;
      quantity = amount;
    }

    const scale = (value) =>
      Math.round(value * multiplier * 10) / 10;

    const entry = await NutritionEntry.create({
      date,
      meal,
      foodId: food.id,
      foodName: food.name,
      quantity,
      portionAmount: amount,
      portionUnit,
      servingLabel,
      calories: scale(food.calories),
      protein: scale(food.protein),
      carbs: scale(food.carbs),
      fat: scale(food.fat),
      fiber: scale(food.fiber),
      dataQuality: food.dataQuality,
      source: food.source,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Nutrition create error:", error);
    res.status(500).json({ message: "Could not save food entry." });
  }
});

// Delete an entry
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid entry ID." });
    }

    const deleted = await NutritionEntry.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Nutrition entry not found." });
    }

    res.json({ message: "Nutrition entry deleted." });
  } catch (error) {
    console.error("Nutrition delete error:", error);
    res.status(500).json({ message: "Could not delete nutrition entry." });
  }
});

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};

function calculateSuggestedTargets(profile) {
  const { weightKg, heightCm, age, sex, activityLevel, goal } = profile;

  // Mifflin-St Jeor estimated resting energy expenditure.
  const resting =
    10 * weightKg +
    6.25 * heightCm -
    5 * age +
    (sex === "male" ? 5 : -161);

  const maintenance = resting * ACTIVITY_FACTORS[activityLevel];

  const adjustments = {
    fat_loss: -400,
    maintenance: 0,
    weight_gain: 250,
  };

  const calories = Math.round(maintenance + adjustments[goal]);

  // Suggested macro distribution: 25% protein, 45% carbs, 30% fat.
  const protein = Math.round((calories * 0.25) / 4);
  const carbs = Math.round((calories * 0.45) / 4);
  const fat = Math.round((calories * 0.3) / 9);

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: 25,
  };
}

// Read saved goal settings
router.get("/goals", async (req, res) => {
  try {
    const goal = await NutritionGoal.findOne().sort({ updatedAt: -1 });
    res.json(goal);
  } catch (error) {
    console.error("Nutrition goals read error:", error);
    res.status(500).json({ message: "Could not load nutrition goals." });
  }
});

// Calculate and save a starting target, or save edited targets.
router.put("/goals", async (req, res) => {
  try {
    const { profile, targets, targetSource } = req.body;

    if (!profile || typeof profile !== "object") {
      return res.status(400).json({
        message: "Provide your profile details.",
      });
    }

    const { weightKg, heightCm, age, sex, activityLevel, goal } = profile;

    if (
      !Number.isFinite(Number(weightKg)) ||
      !Number.isFinite(Number(heightCm)) ||
      !Number.isFinite(Number(age)) ||
      Number(weightKg) < 25 ||
      Number(weightKg) > 350 ||
      Number(heightCm) < 100 ||
      Number(heightCm) > 250 ||
      Number(age) < 18 ||
      Number(age) > 100 ||
      !["male", "female"].includes(sex) ||
      !Object.hasOwn(ACTIVITY_FACTORS, activityLevel) ||
      !["fat_loss", "maintenance", "weight_gain"].includes(goal)
    ) {
      return res.status(400).json({
        message: "Check your profile details and selected options.",
      });
    }

    const normalizedProfile = {
      weightKg: Number(weightKg),
      heightCm: Number(heightCm),
      age: Number(age),
      sex,
      activityLevel,
      goal,
    };

    let normalizedTargets;
    const source = targetSource === "manual" ? "manual" : "calculated";

    if (source === "manual") {
      if (!targets || typeof targets !== "object") {
        return res.status(400).json({
          message: "Provide your calorie and macro targets.",
        });
      }

      normalizedTargets = {
        calories: Number(targets.calories),
        protein: Number(targets.protein),
        carbs: Number(targets.carbs),
        fat: Number(targets.fat),
        fiber: Number(targets.fiber),
      };

      const limits = {
        calories: [500, 10000],
        protein: [0, 500],
        carbs: [0, 1000],
        fat: [0, 500],
        fiber: [0, 100],
      };

      for (const [key, [min, max]] of Object.entries(limits)) {
        const value = normalizedTargets[key];

        if (!Number.isFinite(value) || value < min || value > max) {
          return res.status(400).json({
            message: `Check your ${key} target.`,
          });
        }
      }
    } else {
      normalizedTargets = calculateSuggestedTargets(normalizedProfile);
    }

    const saved = await NutritionGoal.findOneAndUpdate(
      {},
      {
        $set: {
          profile: normalizedProfile,
          targets: normalizedTargets,
          targetSource: source,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    const resting =
      10 * normalizedProfile.weightKg +
      6.25 * normalizedProfile.heightCm -
      5 * normalizedProfile.age +
      (normalizedProfile.sex === "male" ? 5 : -161);

    const maintenanceEstimate =
      resting * ACTIVITY_FACTORS[normalizedProfile.activityLevel];

    const notices = [];

    if (normalizedTargets.calories < 1200) {
      notices.push(
        "This calorie target is very low. Please consult a qualified healthcare professional before using it."
      );
    } else if (
      normalizedTargets.calories < 1500 &&
      normalizedProfile.sex === "male"
    ) {
      notices.push(
        "This calorie target is low for many adults. Consider professional guidance before following it."
      );
    }

    if (normalizedTargets.calories > 5000) {
      notices.push(
        "This is a high daily target. Check your inputs and consider professional guidance."
      );
    }

    res.json({
      ...saved.toObject(),
      estimates: {
        restingCalories: Math.round(resting),
        maintenanceCalories: Math.round(maintenanceEstimate),
      },
      notices,
    });
  } catch (error) {
    console.error("Nutrition goals save error:", error);
    res.status(500).json({ message: "Could not save nutrition goals." });
  }
});

module.exports = router;
