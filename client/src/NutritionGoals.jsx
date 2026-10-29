
import { useEffect, useState } from "react";

const API_URL =
  `${import.meta.env.VITE_API_URL || "http://localhost:5001/api"}/nutrition/goals`;

const initialProfile = {
  weightKg: "",
  heightCm: "",
  age: "",
  sex: "male",
  activityLevel: "sedentary",
  goal: "fat_loss",
};

const initialTargets = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 25,
};

const activityFactors = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};

function estimateTargets(profile) {
  const weight = Number(profile.weightKg);
  const height = Number(profile.heightCm);
  const age = Number(profile.age);

  if (
    !weight ||
    !height ||
    !age ||
    weight < 25 ||
    weight > 350 ||
    height < 100 ||
    height > 250 ||
    age < 18 ||
    age > 100
  ) {
    return null;
  }

  const resting =
    10 * weight +
    6.25 * height -
    5 * age +
    (profile.sex === "male" ? 5 : -161);

  const maintenance =
    resting * activityFactors[profile.activityLevel];

  const adjustments = {
    fat_loss: -400,
    maintenance: 0,
    weight_gain: 250,
  };

  const calories = Math.round(
    maintenance + adjustments[profile.goal]
  );

  return {
    calories,
    protein: Math.round((calories * 0.25) / 4),
    carbs: Math.round((calories * 0.45) / 4),
    fat: Math.round((calories * 0.3) / 9),
    fiber: 25,
  };
}

export default function NutritionGoals({ onSaved }) {
  const [profile, setProfile] = useState(initialProfile);
  const [targets, setTargets] = useState(initialTargets);
  const [targetSource, setTargetSource] = useState("calculated");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savedGoal, setSavedGoal] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadGoal() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("Could not load saved goals.");
        }

        const data = await response.json();

        if (!active) return;

        if (data) {
          setSavedGoal(data);
          setProfile(data.profile);
          setTargets(data.targets);
          setTargetSource(data.targetSource || "calculated");
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadGoal();

    return () => {
      active = false;
    };
  }, []);

  const suggested = estimateTargets(profile);

  function updateProfile(event) {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (targetSource === "calculated") {
      setTargets((previous) => ({
        ...previous,
        ...(estimateTargets({ ...profile, [name]: value }) || {}),
      }));
    }
  }

  function calculate() {
    const next = estimateTargets(profile);

    if (!next) {
      setError("Enter a valid weight, height and age first.");
      return;
    }

    setTargets(next);
    setTargetSource("calculated");
    setEditing(true);
    setError("");
    setNotice("Suggested targets calculated. Review them before saving.");
  }

  function updateTarget(event) {
    const { name, value } = event.target;

    setTargets((previous) => ({
      ...previous,
      [name]: value,
    }));

    setTargetSource("manual");
  }

  async function saveGoals(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            ...profile,
            weightKg: Number(profile.weightKg),
            heightCm: Number(profile.heightCm),
            age: Number(profile.age),
          },
          targets: Object.fromEntries(
            Object.entries(targets).map(([key, value]) => [
              key,
              Number(value),
            ])
          ),
          targetSource,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not save goals.");
      }

      setSavedGoal(data);
      setProfile(data.profile);
      setTargets(data.targets);
      setTargetSource(data.targetSource);
      setEditing(false);
      setNotice("Your nutrition goals have been saved!");
      onSaved?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel">Loading your nutrition goals…</div>;
  }

  const hasSavedGoal = Boolean(savedGoal) && !editing;

  return (
    <section className="nutrition-panel nutrition-goals-panel">
      <div className="nutrition-section-heading">
        <div>
          <div className="nutrition-eyebrow">YOUR PERSONAL PLAN</div>
          <h2>{hasSavedGoal ? "Your nutrition goals" : "Set your goals"}</h2>
          <p className="nutrition-subtitle">
            Choose a starting target and adjust it to suit your needs.
          </p>
        </div>

        {hasSavedGoal && (
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setEditing(true);
              setNotice("");
              setError("");
            }}
          >
            Edit goals
          </button>
        )}
      </div>

      {notice && (
        <div className="nutrition-alert nutrition-alert-success">
          {notice}
        </div>
      )}

      {error && (
        <div className="nutrition-alert nutrition-alert-error">
          {error}
        </div>
      )}

      {hasSavedGoal ? (
        <div className="nutrition-goal-saved">
          <div className="nutrition-goal-calories">
            <span>Daily calorie target</span>
            <strong>
              {Number(targets.calories).toLocaleString()}{" "}
              <small>kcal/day</small>
            </strong>
          </div>

          <div className="nutrition-goal-macros">
            {[
              ["Protein", targets.protein, "g"],
              ["Carbohydrates", targets.carbs, "g"],
              ["Fat", targets.fat, "g"],
              ["Fiber", targets.fiber, "g"],
            ].map(([name, value, unit]) => (
              <div className="nutrition-goal-macro" key={name}>
                <span>{name}</span>
                <strong>{value} {unit}</strong>
              </div>
            ))}
          </div>

          {savedGoal.estimates && (
            <p className="nutrition-disclaimer">
              Estimated maintenance:{" "}
              {savedGoal.estimates.maintenanceCalories.toLocaleString()} kcal/day.
              These calculations are approximate, not medical advice.
            </p>
          )}

          {savedGoal.notices?.map((item) => (
            <div
              className="nutrition-alert nutrition-alert-error"
              key={item}
            >
              {item}
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={saveGoals} className="nutrition-goal-form">
          <h3>About you</h3>

          <div className="nutrition-goal-fields">
            <label>
              Current weight (kg)
              <input
                name="weightKg"
                type="number"
                min="25"
                max="350"
                step="0.1"
                required
                value={profile.weightKg}
                onChange={updateProfile}
                placeholder="e.g. 95"
              />
            </label>

            <label>
              Height (cm)
              <input
                name="heightCm"
                type="number"
                min="100"
                max="250"
                required
                value={profile.heightCm}
                onChange={updateProfile}
                placeholder="e.g. 175"
              />
            </label>

            <label>
              Age
              <input
                name="age"
                type="number"
                min="18"
                max="100"
                required
                value={profile.age}
                onChange={updateProfile}
                placeholder="Age in years"
              />
            </label>

            <label>
              Sex used for equation
              <select
                name="sex"
                value={profile.sex}
                onChange={updateProfile}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>

            <label>
              Activity level
              <select
                name="activityLevel"
                value={profile.activityLevel}
                onChange={updateProfile}
              >
                <option value="sedentary">Sedentary — mostly sitting</option>
                <option value="light">Light — light exercise / walking</option>
                <option value="moderate">Moderate — regular exercise</option>
                <option value="very_active">Very active — intense activity</option>
              </select>
            </label>

            <label>
              Main goal
              <select
                name="goal"
                value={profile.goal}
                onChange={updateProfile}
              >
                <option value="fat_loss">Fat loss</option>
                <option value="maintenance">Maintain weight</option>
                <option value="weight_gain">Weight gain</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            className="secondary-btn"
            onClick={calculate}
          >
            Calculate suggested targets
          </button>

          {suggested && (
            <>
              <div className="nutrition-goal-preview">
                <div>
                  <span>Suggested daily calories</span>
                  <strong>
                    {suggested.calories.toLocaleString()} kcal
                  </strong>
                </div>
                <p>
                  This is an estimate. Review it before saving.
                </p>
              </div>

              <h3>Edit daily targets</h3>

              <div className="nutrition-goal-fields">
                {[
                  ["calories", "Calories (kcal)", 500, 10000],
                  ["protein", "Protein (g)", 0, 500],
                  ["carbs", "Carbohydrates (g)", 0, 1000],
                  ["fat", "Fat (g)", 0, 500],
                  ["fiber", "Fiber (g)", 0, 100],
                ].map(([name, label, min, max]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      type="number"
                      min={min}
                      max={max}
                      step="1"
                      required
                      value={targets[name]}
                      onChange={updateTarget}
                    />
                  </label>
                ))}
              </div>

              <p className="nutrition-disclaimer">
                Targets are starting estimates. Avoid aggressive calorie
                restriction; seek qualified advice if unsure about your needs.
              </p>

              <button
                className="nutrition-add-button"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save my nutrition goals"}
              </button>
            </>
          )}

          {savedGoal && (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setProfile(savedGoal.profile);
                setTargets(savedGoal.targets);
                setTargetSource(savedGoal.targetSource);
                setEditing(false);
                setError("");
                setNotice("");
              }}
            >
              Cancel changes
            </button>
          )}
        </form>
      )}
    </section>
  );
}
