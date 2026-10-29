
import { useCallback, useEffect, useMemo, useState } from "react";
import "./NutritionPage.css";
import NutritionGoals from "./NutritionGoals";


const API_URL =
  `${import.meta.env.VITE_API_URL || "http://localhost:5001/api"}/nutrition`;
const GOALS_API_URL = `${API_URL}/goals`;

const MEALS = ["Breakfast", "Lunch", "Snack", "Dinner"];

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 1,
  });
}

async function readResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function MacroBar({ label, value, target, color, unit = "g" }) {
  const current = Number(value || 0);
  const goal = Number(target || 0);
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;

  return (
    <div className="nutrition-macro">
      <div className="nutrition-macro-heading">
        <span>{label}{goal > 0 ? ` · ${Math.round(percentage)}%` : ""}</span>
        <strong>
          {formatNumber(current)}{goal > 0 ? ` / ${formatNumber(goal)}` : ""} {unit}
        </strong>
      </div>
      <div className="nutrition-macro-track">
        <div
          className={`nutrition-macro-fill ${color}`}
          style={{ width: `${goal > 0 ? percentage : Math.min(current / 150 * 100, 100)}%` }}
        />
      </div>
      {goal > 0 && (
        <span className="nutrition-stat-foot">
          {current >= goal
            ? `${formatNumber(current - goal)} ${unit} over target`
            : `${formatNumber(goal - current)} ${unit} remaining`}
        </span>
      )}
    </div>
  );
}

function MacroTargetCard({ label, icon, value, target, color }) {
  const consumed = Number(value || 0);
  const goal = Number(target || 0);
  const percent = goal > 0 ? (consumed / goal) * 100 : 0;
  const remaining = Math.max(0, goal - consumed);
  const over = goal > 0 && consumed > goal;

  return (
    <article className="nutrition-stat nutrition-macro-target-card">
      <span className="nutrition-stat-icon">{icon}</span>
      <p>{label}</p>

      <h2>
        {formatNumber(consumed)} <small>g</small>
      </h2>

      {goal > 0 ? (
        <>
          <div className="nutrition-calorie-target-line">
            <span>Target: {formatNumber(goal)} g</span>
            <strong>{Math.round(percent)}%</strong>
          </div>

          <div
            className="nutrition-calorie-progress-track"
            role="progressbar"
            aria-label={`${label} target progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(percent))}
          >
            <div
              className={`nutrition-calorie-progress-fill ${color} ${
                over ? "over-target" : ""
              }`}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>

          <span className="nutrition-stat-foot">
            {over
              ? `${formatNumber(consumed - goal)} g over target`
              : `${formatNumber(remaining)} g remaining`}
          </span>
        </>
      ) : (
        <span className="nutrition-stat-foot">
          Set your goals to track progress
        </span>
      )}
    </article>
  );
}

export default function NutritionPage() {
  const [date, setDate] = useState(getLocalDate);
  const [meal, setMeal] = useState("Breakfast");
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [portionUnit, setPortionUnit] = useState("serving");
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [macroTargets, setMacroTargets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDiary = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [entryData, summaryData] = await Promise.all([
        fetch(`${API_URL}?date=${date}`).then(readResponse),
        fetch(`${API_URL}/summary?date=${date}`).then(readResponse),
      ]);

      setEntries(entryData);
      setSummary(summaryData);
    } catch (err) {
      setError(err.message || "Could not load your nutrition diary.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadDiary();
  }, [loadDiary]);

  useEffect(() => {
    let cancelled = false;

    async function loadMacroTargets() {
      try {
        const response = await fetch(GOALS_API_URL);
        if (!response.ok) return;

        const data = await response.json();

        if (!cancelled) {
          setMacroTargets(data?.targets ?? null);
        }
      } catch (error) {
        console.error("Could not load macro targets:", error);
      }
    }

    loadMacroTargets();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!query.trim() || selectedFood) {
      setFoods([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await fetch(
          `${API_URL}/foods?q=${encodeURIComponent(query.trim())}`
        ).then(readResponse);

        if (!cancelled) setFoods(results);
      } catch {
        if (!cancelled) setFoods([]);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selectedFood]);

  const selectFood = (food) => {
    setSelectedFood(food);
    setQuery(food.name);
    setQuantity("1");
    setPortionUnit("serving");
    setFoods([]);
    setNotice("");
    setError("");
  };

  const clearFoodSelection = () => {
    setSelectedFood(null);
    setQuery("");
    setFoods([]);
  };

  const addFood = async (event) => {
    event.preventDefault();

    if (!selectedFood) {
      setError("Choose a food from the suggestions first.");
      return;
    }

    const amount = Number(quantity);
    const maxAmount = portionUnit === "serving" ? 100 : 100000;

    if (!Number.isFinite(amount) || amount < 0.1 || amount > maxAmount) {
      setError(
        portionUnit === "serving"
          ? "Enter a quantity between 0.1 and 100 servings."
          : `Enter a portion amount between 0.1 and ${maxAmount} ${portionUnit}.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          meal,
          foodId: selectedFood.id,
          portionAmount: Number(quantity),
          portionUnit,
        }),
      }).then(readResponse);

      setNotice(`${selectedFood.name} added to ${meal.toLowerCase()}.`);
      clearFoodSelection();
      await loadDiary();
    } catch (err) {
      setError(err.message || "Could not save this food.");
    } finally {
      setSaving(false);
    }
  };

  const deleteFood = async (id) => {
    if (!window.confirm("Delete this food entry?")) return;

    setError("");
    setNotice("");

    try {
      await fetch(`${API_URL}/${id}`, { method: "DELETE" }).then(readResponse);
      setNotice("Food entry deleted.");
      await loadDiary();
    } catch (err) {
      setError(err.message || "Could not delete this entry.");
    }
  };

  const mealTotals = useMemo(() => {
    return MEALS.map((mealName) => ({
      name: mealName,
      calories: entries
        .filter((entry) => entry.meal === mealName)
        .reduce((total, entry) => total + entry.calories, 0),
      count: entries.filter((entry) => entry.meal === mealName).length,
    }));
  }, [entries]);

  const suggestions = useMemo(() => {
    if (!summary) return [];

    const messages = [];
    const daily = summary.daily;

    if (daily.entryCount === 0) {
      messages.push({
        type: "info",
        title: "Start with your first meal",
        text: "Add the foods you eat to build a more complete daily picture.",
      });
    } else {
      if (daily.protein < 20) {
        messages.push({
          type: "info",
          title: "Protein logged so far is low",
          text: "Consider adding a protein-containing food if it fits your needs. This is a partial-day observation, not a daily diagnosis.",
        });
      }

      if (daily.fiber < 5) {
        messages.push({
          type: "info",
          title: "Fiber logged so far is low",
          text: "Fruit, vegetables, pulses or whole grains can contribute fiber.",
        });
      }

      const calorieTarget = Number(macroTargets?.calories || 0);
      if (calorieTarget > 0 && daily.calories > calorieTarget) {
        messages.push({
          type: "caution",
          title: "Daily calorie target exceeded",
          text: `Your logged total is ${formatNumber(daily.calories - calorieTarget)} kcal above your saved target. Food estimates and individual needs vary; this is information, not a judgment.`,
        });
      } else if (calorieTarget > 0 && daily.calories > 0) {
        messages.push({
          type: "info",
          title: "Daily calorie progress",
          text: `${formatNumber(calorieTarget - daily.calories)} kcal remain to reach your saved target, based on foods logged so far.`,
        });
      }

      if (entries.some((entry) => entry.dataQuality === "estimated")) {
        messages.push({
          type: "info",
          title: "Some values are estimates",
          text: "Recipes, cooking oil and serving sizes can change calories and macros. Treat estimated values as guides, not exact measurements.",
        });
      }
    }

    if (daily.entryCount > 0 && daily.entryCount < 3) {
      messages.push({
        type: "info",
        title: "Your diary may be incomplete",
        text: "If you have eaten other meals or snacks, add them for a more useful daily total.",
      });
    }

    return messages.slice(0, 3);
  }, [summary, entries, macroTargets]);

  const daily = summary?.daily;
  const weekly = summary?.weekly;
  const weeklyConsistency = useMemo(() => {
    const days = weekly?.days || [];
    const target = Number(macroTargets?.calories || 0);

    // Only count days with recorded food entries.
    const loggedDays = days.filter(
      (day) => Number(day.entryCount ?? (day.calories > 0 ? 1 : 0)) > 0
    );

    const daysWithinTarget = target > 0
      ? loggedDays.filter((day) => {
          const calories = Number(day.calories || 0);
          return calories >= target * 0.9 && calories <= target * 1.1;
        })
      : [];

    const loggedDayCount = loggedDays.length;
    const withinTargetCount = daysWithinTarget.length;

    const averageCalories = loggedDayCount > 0
      ? loggedDays.reduce(
          (total, day) => total + Number(day.calories || 0),
          0
        ) / loggedDayCount
      : 0;

    return {
      loggedDayCount,
      withinTargetCount,
      consistencyPercent: loggedDayCount > 0 && target > 0
        ? Math.round((withinTargetCount / loggedDayCount) * 100)
        : null,
      averageCalories,
      target,
    };
  }, [weekly, macroTargets]);

  const weeklyProteinConsistency = useMemo(() => {
    const days = weekly?.days || [];
    const target = Number(macroTargets?.protein || 0);

    // Count only days with recorded food entries.
    const loggedDays = days.filter(
      (day) =>
        Number(day.entryCount ?? (day.calories > 0 ? 1 : 0)) > 0
    );

    const daysMeetingTarget = target > 0
      ? loggedDays.filter(
          (day) => Number(day.protein || 0) >= target
        )
      : [];

    const totalProtein = loggedDays.reduce(
      (sum, day) => sum + Number(day.protein || 0),
      0
    );

    return {
      loggedDays: loggedDays.length,
      daysMeetingTarget: daysMeetingTarget.length,
      averageProtein: loggedDays.length
        ? totalProtein / loggedDays.length
        : 0,
      percent: loggedDays.length > 0 && target > 0
        ? Math.round(
            (daysMeetingTarget.length / loggedDays.length) * 100
          )
        : null,
      target,
    };
  }, [weekly, macroTargets]);

  const weeklyNutritionReport = useMemo(() => {
    const days = weekly?.days || [];

    const loggedDays = days.filter(
      (day) => Number(day.entryCount ?? (day.calories > 0 ? 1 : 0)) > 0
    );

    const totalCalories = loggedDays.reduce(
      (sum, day) => sum + Number(day.calories || 0),
      0
    );

    const totalProtein = loggedDays.reduce(
      (sum, day) => sum + Number(day.protein || 0),
      0
    );

    const bestDay = loggedDays.length
      ? [...loggedDays].sort(
          (a, b) => Number(b.calories || 0) - Number(a.calories || 0)
        )[0]
      : null;

    return {
      loggedDays: loggedDays.length,
      totalDays: days.length,
      totalCalories,
      totalProtein,
      averageCalories: loggedDays.length
        ? totalCalories / loggedDays.length
        : 0,
      averageProtein: loggedDays.length
        ? totalProtein / loggedDays.length
        : 0,
      bestDay,
      missingDays: Math.max(0, days.length - loggedDays.length),
    };
  }, [weekly]);

  const selectedDate = new Date(`${date}T00:00:00`);
  const today = new Date();

  const isToday =
    selectedDate.getFullYear() === today.getFullYear() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getDate() === today.getDate();

  const isPastDate = selectedDate < new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const minutesElapsed = isPastDate
    ? 1440
    : isToday
    ? today.getHours() * 60 + today.getMinutes()
    : 0;

  const dayProgress = Math.round((minutesElapsed / 1440) * 100);

  const consumedCalories = Number(daily?.calories || 0);
  const calorieTarget = Number(macroTargets?.calories || 0);

  const calorieProgress =
    calorieTarget > 0
      ? Math.round((consumedCalories / calorieTarget) * 100)
      : 0;

  const paceDifference = calorieProgress - dayProgress;

  const weeklyDays = weekly?.days || [];

  const weeklyChartMax = Math.max(
    1,
    Number(macroTargets?.calories || 0),
    ...weeklyDays.map((day) => Number(day.calories || 0))
  );

  const downloadWeeklyNutritionReport = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const days = weekly?.days || [];

    const loggedDays = days.filter(
      (day) => Number(day.entryCount ?? (day.calories > 0 ? 1 : 0)) > 0
    );

    const bestDay = loggedDays.length
      ? [...loggedDays].sort(
          (a, b) => Number(b.calories || 0) - Number(a.calories || 0)
        )[0]
      : null;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;

    const colors = {
      navy: [11, 20, 36],
      panel: [20, 34, 54],
      teal: [45, 212, 191],
      white: [241, 245, 249],
      muted: [148, 163, 184],
      border: [48, 65, 86],
      blue: [96, 165, 250],
    };

    const setFill = (color) => doc.setFillColor(...color);
    const setText = (color) => doc.setTextColor(...color);

    const drawBackground = () => {
      setFill(colors.navy);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
    };

    const drawHeader = (continued = false) => {
      setFill(colors.panel);
      doc.roundedRect(margin, 12, contentWidth, 32, 4, 4, "F");

      setFill(colors.teal);
      doc.roundedRect(margin + 5, 18, 3, 20, 1, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      setText(colors.white);
      doc.text("PaceLedger", margin + 12, 24);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(colors.muted);
      doc.text("FITNESS ANALYTICS  /  WEEKLY NUTRITION", margin + 12, 32);

      doc.setFontSize(8);
      setText(colors.teal);
      doc.text(
        continued ? "WEEKLY REPORT · CONTINUED" : "WEEKLY REPORT",
        pageWidth - margin - 5,
        24,
        { align: "right" }
      );

      doc.setDrawColor(...colors.border);
      doc.line(margin, 49, pageWidth - margin, 49);
    };

    const drawSectionTitle = (title, y) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      setText(colors.teal);
      doc.text(title.toUpperCase(), margin, y);
    };

    const drawMetricCard = (x, y, w, label, value, accent) => {
      setFill(colors.panel);
      doc.roundedRect(x, y, w, 25, 3, 3, "F");

      setFill(accent);
      doc.roundedRect(x, y + 4, 1.5, 17, 0.5, 0.5, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(colors.muted);
      doc.text(label, x + 6, y + 8);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      setText(colors.white);
      doc.text(String(value), x + 6, y + 18);
    };

    drawBackground();
    drawHeader();

    let y = 59;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    setText(colors.white);
    doc.text("Your nutrition at a glance", margin, y);

    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(colors.muted);
    doc.text(
      `Week: ${weekly?.startDate || "N/A"} to ${weekly?.endDate || "N/A"}`,
      margin,
      y
    );

    y += 12;

    const gap = 5;
    const cardWidth = (contentWidth - gap) / 2;

    drawMetricCard(
      margin, y, cardWidth, "TOTAL CALORIES",
      `${formatNumber(weeklyNutritionReport.totalCalories)} kcal`,
      colors.teal
    );

    drawMetricCard(
      margin + cardWidth + gap, y, cardWidth, "TOTAL PROTEIN",
      `${formatNumber(weeklyNutritionReport.totalProtein)} g`,
      colors.blue
    );

    y += 29;

    drawMetricCard(
      margin, y, cardWidth, "AVG. CALORIES / LOGGED DAY",
      `${formatNumber(weeklyNutritionReport.averageCalories)} kcal`,
      colors.teal
    );

    drawMetricCard(
      margin + cardWidth + gap, y, cardWidth, "AVG. PROTEIN / LOGGED DAY",
      `${formatNumber(weeklyNutritionReport.averageProtein)} g`,
      colors.blue
    );

    y += 35;
    drawSectionTitle("Weekly calorie overview", y);
    y += 7;

    // Weekly calorie bars
    const chartX = margin;
    const chartY = y;
    const chartW = contentWidth;
    const chartH = 35;
    const maxCalories = Math.max(
      1,
      ...days.map((day) => Number(day.calories || 0))
    );
    const barGap = 7;
    const barW = (chartW - barGap * 6) / 7;

    setFill(colors.panel);
    doc.roundedRect(chartX, chartY, chartW, chartH + 13, 3, 3, "F");

    days.forEach((day, index) => {
      const x = chartX + index * (barW + barGap);
      const value = Number(day.calories || 0);
      const barHeight = value > 0 ? (value / maxCalories) * chartH : 1;

      setFill(value > 0 ? colors.teal : colors.border);
      doc.roundedRect(
        x,
        chartY + chartH - barHeight + 2,
        barW,
        barHeight,
        1,
        1,
        "F"
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText(colors.muted);
      doc.text(
        new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", {
          weekday: "short",
        }),
        x + barW / 2,
        chartY + chartH + 9,
        { align: "center" }
      );
    });

    y = chartY + chartH + 24;
    drawSectionTitle("Daily breakdown", y);
    y += 7;

    // Table header
    const colDate = margin + 3;
    const colCalories = margin + 65;
    const colProtein = margin + 105;
    const colStatus = margin + 139;

    const drawTableHeader = () => {
      setFill(colors.panel);
      doc.roundedRect(margin, y - 5, contentWidth, 11, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setText(colors.teal);
      doc.text("DAY / DATE", colDate, y + 2);
      doc.text("CALORIES", colCalories, y + 2);
      doc.text("PROTEIN", colProtein, y + 2);
      doc.text("STATUS", colStatus, y + 2);
      y += 12;
    };

    drawTableHeader();

    days.forEach((day, index) => {
      if (y > pageHeight - 35) {
        doc.addPage();
        drawBackground();
        drawHeader(true);
        y = 61;
        drawTableHeader();
      }

      const logged =
        Number(day.entryCount ?? (day.calories > 0 ? 1 : 0)) > 0;

      if (index % 2 === 0) {
        setFill(colors.panel);
        doc.rect(margin, y - 5, contentWidth, 10, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(colors.white);

      const dateLabel = new Date(`${day.date}T12:00:00`).toLocaleDateString(
        "en-IN",
        { weekday: "short", day: "2-digit", month: "short" }
      );

      doc.text(dateLabel, colDate, y + 1);
      doc.text(
        logged ? formatNumber(day.calories) : "—",
        colCalories,
        y + 1
      );
      doc.text(
        logged ? `${formatNumber(day.protein)} g` : "—",
        colProtein,
        y + 1
      );

      setText(logged ? colors.teal : colors.muted);
      doc.text(logged ? "Logged" : "No entry", colStatus, y + 1);

      y += 10;
    });

    y += 5;

    if (y > pageHeight - 28) {
      doc.addPage();
      drawBackground();
      drawHeader(true);
      y = 61;
    }

    setFill(colors.panel);
    doc.roundedRect(margin, y, contentWidth, 23, 3, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(colors.white);
    doc.text("WEEKLY HIGHLIGHT", margin + 5, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(colors.muted);

    const highlight = bestDay
      ? `Highest logged calories: ${bestDay.date} · ${formatNumber(bestDay.calories)} kcal`
      : "No food entries recorded this week.";

    doc.text(highlight, margin + 5, y + 15);

    y += 29;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(colors.muted);

    const note =
      "Based on recorded food entries only. Missing entries do not mean zero food was consumed.";

    doc.text(note, margin, Math.min(y, pageHeight - 12));

    // Page numbers
    const pageCount = doc.internal.getNumberOfPages();

    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFontSize(7);
      setText(colors.muted);
      doc.text(
        `PACELEDGER  •  PRIVATE FITNESS REPORT  •  ${page}/${pageCount}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: "center" }
      );
    }

    doc.save(
      `PaceLedger-Weekly-Nutrition-${weekly?.startDate || "report"}.pdf`
    );
  };

  return (
    <main className="nutrition-page">
      <header className="nutrition-page-header">
        <div>
          <p className="nutrition-eyebrow">FUEL YOUR PROGRESS</p>
          <h1>Nutrition</h1>
          <p className="nutrition-subtitle">
            Track meals, understand your macros, and build consistent habits.
          </p>
        </div>

        <label className="nutrition-date-picker">
          <span>Diary date</span>
          <input
            type="date"
            value={date}
            max={getLocalDate()}
            onChange={(event) => {
              setDate(event.target.value);
              setNotice("");
            }}
          />
        </label>
      </header>

      {error && (
        <div className="nutrition-alert nutrition-alert-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="nutrition-alert nutrition-alert-success" role="status">
          {notice}
        </div>
      )}

      <section className="nutrition-summary-grid">
        <article className="nutrition-stat nutrition-stat-primary nutrition-calorie-progress-card">
          <span className="nutrition-stat-icon">🔥</span>
          <p>Daily calorie progress</p>
          <h2>
            {formatNumber(daily?.calories)} <small>kcal</small>
          </h2>
          {Number(macroTargets?.calories) > 0 ? (
            <>
              <div className="nutrition-calorie-target-line">
                <span>Target: {formatNumber(macroTargets.calories)} kcal</span>
                <strong>
                  {Math.round((Number(daily?.calories || 0) / macroTargets.calories) * 100)}%
                </strong>
              </div>
              <div
                className="nutrition-calorie-progress-track"
                role="progressbar"
                aria-label="Daily calorie target progress"
                aria-valuemin={0}
                aria-valuemax={macroTargets.calories}
                aria-valuenow={Math.min(Number(daily?.calories || 0), macroTargets.calories)}
              >
                <div
                  className={`nutrition-calorie-progress-fill ${Number(daily?.calories || 0) > macroTargets.calories ? "over-target" : ""}`}
                  style={{ width: `${Math.min((Number(daily?.calories || 0) / macroTargets.calories) * 100, 100)}%` }}
                />
              </div>
              <span className="nutrition-stat-foot">
                {Number(daily?.calories || 0) >= macroTargets.calories
                  ? `${formatNumber(Number(daily?.calories || 0) - macroTargets.calories)} kcal over target`
                  : `${formatNumber(macroTargets.calories - Number(daily?.calories || 0))} kcal remaining`}
                {` · ${daily?.entryCount || 0} food entries`}
              </span>
            </>
          ) : (
            <span className="nutrition-stat-foot">
              {daily?.entryCount || 0} food entries · Set a target below to track progress.
            </span>
          )}
        </article>

        <MacroTargetCard
          label="Protein"
          icon="🥚"
          value={daily?.protein}
          target={macroTargets?.protein}
          color="protein"
        />

        <MacroTargetCard
          label="Carbohydrates"
          icon="🌾"
          value={daily?.carbs}
          target={macroTargets?.carbs}
          color="carbs"
        />

        <MacroTargetCard
          label="Fat"
          icon="🥑"
          value={daily?.fat}
          target={macroTargets?.fat}
          color="fat"
        />
      </section>

      <section className="nutrition-panel nutrition-pace-panel">
        <div className="nutrition-section-heading">
          <div>
            <div className="nutrition-eyebrow">DAILY PACE</div>
            <h2>How your day is progressing</h2>
            <p className="nutrition-subtitle">
              Compare calorie progress with elapsed time, not a meal-by-meal rule.
            </p>
          </div>
        </div>

        {calorieTarget > 0 ? (
          <>
            <div className="nutrition-pace-row">
              <span>Calorie target completed</span>
              <strong>{calorieProgress}%</strong>
            </div>

            <div className="nutrition-calorie-progress-track">
              <div
                className="nutrition-calorie-progress-fill"
                style={{ width: `${Math.min(100, calorieProgress)}%` }}
              />
            </div>

            <div className="nutrition-pace-row">
              <span>Day elapsed</span>
              <strong>{dayProgress}%</strong>
            </div>

            <div className="nutrition-calorie-progress-track">
              <div
                className="nutrition-calorie-progress-fill nutrition-time-fill"
                style={{ width: `${dayProgress}%` }}
              />
            </div>

            <div className="nutrition-pace-note">
              {isPastDate
                ? "Past-day view: compare your logged intake with your daily target."
                : !isToday
                ? "Future-day view: no time-based comparison is available yet."
                : dayProgress < 5
                ? "The day has just started. Your intake may change as you log meals."
                : paceDifference < -20
                ? "You've logged a smaller share of your target than the share of the day elapsed. Check that you've recorded everything you ate."
                : paceDifference > 20
                ? "You've logged a larger share of your target than the share of the day elapsed. This isn't automatically a problem; use your overall target as context."
                : "Your logged calorie progress is reasonably close to the share of the day elapsed."}
            </div>
          </>
        ) : (
          <p className="nutrition-subtitle">
            Set a daily calorie target to enable the pace comparison.
          </p>
        )}
      </section>

      <div className="nutrition-main-grid">
        <section className="nutrition-panel nutrition-entry-panel">
          <div className="nutrition-section-heading">
            <div>
              <p className="nutrition-eyebrow">FOOD DIARY</p>
              <h2>Add a meal</h2>
            </div>
            <span className="nutrition-heading-icon">＋</span>
          </div>

          <div className="nutrition-meal-tabs" aria-label="Choose meal">
            {MEALS.map((item) => (
              <button
                key={item}
                type="button"
                className={meal === item ? "active" : ""}
                onClick={() => setMeal(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <form onSubmit={addFood} className="nutrition-food-form">
            <label htmlFor="nutrition-food-search">What did you eat?</label>

            <div className="nutrition-search-wrap">
              <input
                id="nutrition-food-search"
                type="text"
                value={query}
                autoComplete="off"
                placeholder="Search rice, dosa, dal, banana..."
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedFood(null);
                  setNotice("");
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && foods.length > 0 && !selectedFood) {
                    event.preventDefault();
                    selectFood(foods[0]);
                  }
                }}
              />

              {foods.length > 0 && !selectedFood && (
                <div className="nutrition-suggestions-list">
                  {foods.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      className="nutrition-food-option"
                      onClick={() => selectFood(food)}
                    >
                      <span>
                        <strong>{food.name}</strong>
                        <small>{food.servingLabel}</small>
                      </span>
                      <span className="nutrition-food-option-calories">
                        {food.calories} kcal
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedFood && (
              <div className="nutrition-selected-food">
                <div>
                  <strong>{selectedFood.name}</strong>
                  <span>
                    {selectedFood.calories} kcal · {selectedFood.servingLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearFoodSelection}
                  aria-label="Change selected food"
                >
                  Change
                </button>
              </div>
            )}

            <label htmlFor="nutrition-quantity">Portion amount</label>
            <div className="nutrition-portion-row">
              <input
                id="nutrition-quantity"
                type="number"
                min={portionUnit === "serving" ? "0.1" : "1"}
                max={portionUnit === "serving" ? "100" : "100000"}
                step={portionUnit === "serving" ? "0.1" : "1"}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
              <select
                value={portionUnit}
                onChange={(event) => setPortionUnit(event.target.value)}
                aria-label="Portion unit"
              >
                <option value="serving">Standard serving</option>
                {selectedFood?.servingGrams && (
                  <option value="g">Grams (g)</option>
                )}
                {selectedFood?.servingMl && (
                  <option value="ml">Millilitres (ml)</option>
                )}
              </select>
            </div>

            {selectedFood && (
              <div className="nutrition-estimate-note">
                <strong>
                  {selectedFood.dataQuality === "reference"
                    ? "Reference data"
                    : "Estimated nutrition"}
                </strong>
                <span>{selectedFood.source}</span>
                <span>
                  Reference serving: {selectedFood.servingLabel}
                </span>
                <span>
                  {portionUnit === "g" && selectedFood.servingGrams
                    ? `Estimated calories: ${formatNumber(
                       selectedFood.calories *
                         Number(quantity || 0) /
                         selectedFood.servingGrams
                     )} kcal`
                    : portionUnit === "ml" && selectedFood.servingMl
                    ? `Estimated calories: ${formatNumber(
                       selectedFood.calories *
                         Number(quantity || 0) /
                         selectedFood.servingMl
                     )} kcal`
                    : `Estimated calories: ${formatNumber(
                       selectedFood.calories * Number(quantity || 0)
                     )} kcal`}
                </span>
              </div>
            )}

            <button
              className="nutrition-add-button"
              type="submit"
              disabled={saving || !selectedFood}
            >
              {saving ? "Saving meal..." : "＋ Add food"}
            </button>
            <p className="nutrition-form-hint">
              Type to search. Select a suggestion, choose your portion, then
              press Enter or use Add food.
            </p>
          </form>
        </section>

        <section className="nutrition-panel">
          <div className="nutrition-section-heading">
            <div>
              <p className="nutrition-eyebrow">TODAY'S BREAKDOWN</p>
              <h2>Meals</h2>
            </div>
            <span className="nutrition-heading-icon">◷</span>
          </div>

          <div className="nutrition-meal-breakdown">
            {mealTotals.map((item) => (
              <div className="nutrition-meal-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.count} {item.count === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <strong>{formatNumber(item.calories)} kcal</strong>
              </div>
            ))}
          </div>

          <div className="nutrition-macros">
            <h3>Macro overview</h3>
            <MacroBar label="Protein" value={daily?.protein} target={macroTargets?.protein} color="protein" />
            <MacroBar label="Carbs" value={daily?.carbs} target={macroTargets?.carbs} color="carbs" />
            <MacroBar label="Fat" value={daily?.fat} target={macroTargets?.fat} color="fat" />
            <MacroBar label="Fiber" value={daily?.fiber} target={macroTargets?.fiber} color="fiber" />
            <p className="nutrition-form-hint">
              Bars are visual comparisons, not personalized targets.
            </p>
          </div>
        </section>
      </div>

      <section className="nutrition-panel nutrition-diary-panel">
        <div className="nutrition-section-heading">
          <div>
            <p className="nutrition-eyebrow">{formatDate(date).toUpperCase()}</p>
            <h2>Logged foods</h2>
          </div>
          <span className="nutrition-entry-count">
            {entries.length} entries
          </span>
        </div>

        {loading ? (
          <div className="nutrition-empty-state">Loading your food diary...</div>
        ) : entries.length === 0 ? (
          <div className="nutrition-empty-state">
            <span>🥗</span>
            <h3>No foods logged for this date</h3>
            <p>Add a food above to start your diary.</p>
          </div>
        ) : (
          <div className="nutrition-entry-list">
            {entries.map((entry) => (
              <article className="nutrition-entry-row" key={entry._id}>
                <div className="nutrition-entry-symbol">🍽️</div>
                <div className="nutrition-entry-details">
                  <strong>{entry.foodName}</strong>
                  <span>
                    {entry.meal} ·{" "}
                    {entry.portionAmount != null
                      ? `${formatNumber(entry.portionAmount)} ${
                          entry.portionUnit === "g"
                            ? "g"
                            : entry.portionUnit === "ml"
                            ? "ml"
                            : "servings"
                        }`
                      : `${formatNumber(entry.quantity)} × ${entry.servingLabel}`}
                  </span>
                  <small>
                    {entry.dataQuality === "estimated"
                      ? "Estimated values"
                      : "Reference values"}
                  </small>
                </div>
                <div className="nutrition-entry-numbers">
                  <strong>{formatNumber(entry.calories)} kcal</strong>
                  <span>
                    P {formatNumber(entry.protein)} · C{" "}
                    {formatNumber(entry.carbs)} · F {formatNumber(entry.fat)} g
                  </span>
                </div>
                <button
                  className="nutrition-delete-button"
                  type="button"
                  onClick={() => deleteFood(entry._id)}
                  aria-label={`Delete ${entry.foodName}`}
                  title="Delete entry"
                >
                  ×
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="nutrition-panel nutrition-weekly-panel">
        <div className="nutrition-section-heading">
          <div>
            <p className="nutrition-eyebrow">WEEKLY PROGRESS</p>
            <h2>This week's calories</h2>
            <p className="nutrition-subtitle">
              {weekly
                ? `${formatDate(weekly.startDate)} – ${formatDate(weekly.endDate)}`
                : "Your weekly food diary"}
            </p>
          </div>
          <span className="nutrition-heading-icon">↗</span>
        </div>

        <div className="nutrition-weekly-total">
          <div>
            <span>Total logged calories</span>
            <strong>{formatNumber(weekly?.calories)} <small>kcal</small></strong>
          </div>
          <div>
            <span>Daily average</span>
            <strong>
              {formatNumber((weekly?.calories || 0) / 7)} <small>kcal/day</small>
            </strong>
          </div>
        </div>

        <div className="nutrition-consistency-card">
          <div className="nutrition-consistency-header">
            <div>
              <span className="nutrition-consistency-label">
                WEEKLY CONSISTENCY
              </span>
              <h3>How consistently are you meeting your target?</h3>
            </div>

            <strong className="nutrition-consistency-score">
              {weeklyConsistency.consistencyPercent === null
                ? "—"
                : `${weeklyConsistency.consistencyPercent}%`}
            </strong>
          </div>

          <div className="nutrition-consistency-track">
            <div
              className="nutrition-consistency-fill"
              style={{
                width: `${weeklyConsistency.consistencyPercent ?? 0}%`,
              }}
            />
          </div>

          <div className="nutrition-consistency-stats">
            <div>
              <span>Days within target</span>
              <strong>
                {weeklyConsistency.withinTargetCount} /{" "}
                {weeklyConsistency.loggedDayCount}
              </strong>
            </div>

            <div>
              <span>Average on logged days</span>
              <strong>
                {weeklyConsistency.loggedDayCount > 0
                  ? `${formatNumber(weeklyConsistency.averageCalories)} kcal/day`
                  : "Not available"}
              </strong>
            </div>
          </div>

          <p className="nutrition-form-hint">
            {weeklyConsistency.target <= 0
              ? "Set a daily calorie target to calculate weekly consistency."
              : weeklyConsistency.loggedDayCount === 0
              ? "No food entries were recorded this week yet."
              : `${weeklyConsistency.loggedDayCount} of 7 days have food entries. A day is within target when its logged calories are 90–110% of your saved goal.`}
          </p>
        </div>

        <div className="nutrition-consistency-card nutrition-protein-weekly-card">
          <div className="nutrition-consistency-header">
            <div>
              <span className="nutrition-consistency-label">
                WEEKLY PROTEIN
              </span>
              <h3>How consistent is your protein intake?</h3>
            </div>

            <strong className="nutrition-consistency-score">
              {weeklyProteinConsistency.percent === null
                ? "—"
                : `${weeklyProteinConsistency.percent}%`}
            </strong>
          </div>

          <div className="nutrition-consistency-track">
            <div
              className="nutrition-consistency-fill nutrition-protein-fill"
              style={{
                width: `${weeklyProteinConsistency.percent ?? 0}%`,
              }}
            />
          </div>

          <div className="nutrition-consistency-stats">
            <div>
              <span>Days meeting protein target</span>
              <strong>
                {weeklyProteinConsistency.daysMeetingTarget} /{" "}
                {weeklyProteinConsistency.loggedDays}
              </strong>
            </div>

            <div>
              <span>Average on logged days</span>
              <strong>
                {weeklyProteinConsistency.loggedDays > 0
                  ? `${formatNumber(weeklyProteinConsistency.averageProtein)} g/day`
                  : "Not available"}
              </strong>
            </div>
          </div>

          <p className="nutrition-form-hint">
            {weeklyProteinConsistency.target <= 0
              ? "Set a protein target to calculate weekly progress."
              : weeklyProteinConsistency.loggedDays === 0
              ? "No food entries were recorded this week yet."
              : `Protein target: ${formatNumber(weeklyProteinConsistency.target)} g/day. Only days with food entries are counted; incomplete diaries may underestimate protein intake.`}
          </p>
        </div>

        <div className="nutrition-consistency-card nutrition-weekly-report">
          <div className="nutrition-consistency-header">
            <div>
              <span className="nutrition-consistency-label">
                WEEKLY REPORT
              </span>
              <h3>Your nutrition at a glance</h3>
              <button
                type="button"
                className="nutrition-download-btn"
                onClick={downloadWeeklyNutritionReport}
              >
                ↓ Download PDF
              </button>
            </div>
            <span className="nutrition-report-icon">↗</span>
          </div>

          <div className="nutrition-report-grid">
            <div className="nutrition-report-stat">
              <span>Total calories logged</span>
              <strong>
                {formatNumber(weeklyNutritionReport.totalCalories)} kcal
              </strong>
            </div>

            <div className="nutrition-report-stat">
              <span>Total protein logged</span>
              <strong>
                {formatNumber(weeklyNutritionReport.totalProtein)} g
              </strong>
            </div>

            <div className="nutrition-report-stat">
              <span>Average calories on logged days</span>
              <strong>
                {weeklyNutritionReport.loggedDays > 0
                  ? `${formatNumber(weeklyNutritionReport.averageCalories)} kcal/day`
                  : "Not available"}
              </strong>
            </div>

            <div className="nutrition-report-stat">
              <span>Average protein on logged days</span>
              <strong>
                {weeklyNutritionReport.loggedDays > 0
                  ? `${formatNumber(weeklyNutritionReport.averageProtein)} g/day`
                  : "Not available"}
              </strong>
            </div>
          </div>

          <div className="nutrition-report-footer">
            <div>
              <span>Highest-calorie logged day</span>
              <strong>
                {weeklyNutritionReport.bestDay
                  ? `${new Date(
                      `${weeklyNutritionReport.bestDay.date}T12:00:00`
                    ).toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })} · ${formatNumber(
                      weeklyNutritionReport.bestDay.calories
                    )} kcal`
                  : "No entries yet"}
              </strong>
            </div>

            <div>
              <span>Diary coverage</span>
              <strong>
                {weeklyNutritionReport.loggedDays} /{" "}
                {weeklyNutritionReport.totalDays} days
              </strong>
            </div>
          </div>

          <p className="nutrition-form-hint">
            {weeklyNutritionReport.loggedDays === 0
              ? "Start logging meals to generate your weekly report."
              : weeklyNutritionReport.missingDays > 0
              ? `${weeklyNutritionReport.missingDays} day(s) have no food entries. Actual intake may be higher than the logged totals.`
              : "All days have food entries. Keep logging consistently for a more useful weekly overview."}
          </p>
        </div>

        <div className="nutrition-week-chart nutrition-week-target-chart">
          {weeklyDays.map((day) => {
            const calories = Number(day.calories || 0);
            const target = Number(macroTargets?.calories || 0);

            const height = calories > 0
              ? Math.max(2, (calories / weeklyChartMax) * 100)
              : 0;

            const targetHeight = target > 0
              ? (target / weeklyChartMax) * 100
              : 0;

            const percent = target > 0
              ? Math.round((calories / target) * 100)
              : null;

            const reachedTarget = target > 0 && calories >= target;
            const hasEntries = Number(day.entryCount || 0) > 0;

            return (
              <div className="nutrition-week-day" key={day.date}>
                <span className="nutrition-week-day-value">
                  {hasEntries ? formatNumber(calories) : "—"}
                </span>

                {percent !== null && (
                  <span className="nutrition-week-day-percent">
                    {hasEntries ? `${percent}%` : "No entries"}
                  </span>
                )}

                <div className="nutrition-week-bar-track">
                  {target > 0 && (
                    <div
                      className="nutrition-week-target-marker"
                      style={{ bottom: `${targetHeight}%` }}
                      title={`Daily target: ${formatNumber(target)} kcal`}
                    />
                  )}

                  {hasEntries && (
                    <div
                      className={`nutrition-week-bar ${
                        day.date === date ? "selected" : ""
                      } ${
                        reachedTarget ? "target-reached" : "target-not-reached"
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${formatNumber(calories)} kcal${
                        target > 0 ? ` · ${percent}% of target` : ""
                      }`}
                    />
                  )}
                </div>

                <button
                  type="button"
                  className={day.date === date ? "selected" : ""}
                  onClick={() => setDate(day.date)}
                  title={`View ${day.date}`}
                >
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString("en-IN", {
                    weekday: "short",
                  })}
                </button>
              </div>
            );
          })}
        </div>
        <div className="nutrition-week-legend">
          {Number(macroTargets?.calories || 0) > 0 ? (
            <>
              <span>
                <i className="nutrition-legend-dot nutrition-legend-below" />
                Below target
              </span>
              <span>
                <i className="nutrition-legend-dot nutrition-legend-reached" />
                Target reached or exceeded
              </span>
              <span>
                <i className="nutrition-legend-line" />
                Daily target
              </span>
            </>
          ) : (
            <span>Set a calorie goal to compare daily intake with your target.</span>
          )}
        </div>
        <p className="nutrition-form-hint">
          No entries means no food was recorded for that date, not necessarily
          that no food was eaten. Values are based on your logged foods.
        </p>
      </section>

      <section className="nutrition-panel nutrition-insights-panel">
        <div className="nutrition-section-heading">
          <div>
            <p className="nutrition-eyebrow">BASED ON YOUR FOOD LOG</p>
            <h2>Suggestions & notes</h2>
          </div>
          <span className="nutrition-heading-icon">✳</span>
        </div>

        {suggestions.length === 0 ? (
          <div className="nutrition-empty-state nutrition-insight-empty">
            Add foods to see contextual suggestions.
          </div>
        ) : (
          <div className="nutrition-insights-list">
            {suggestions.map((item, index) => (
              <article
                className={`nutrition-insight nutrition-insight-${item.type}`}
                key={`${item.title}-${index}`}
              >
                <span>{item.type === "caution" ? "!" : "i"}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="nutrition-disclaimer">
          Nutrition values may be approximate, especially for mixed dishes.
          Suggestions are general information, not medical advice. Calorie
          requirements differ between individuals.
        </p>
      </section>

      <NutritionGoals
        onSaved={(savedGoals) => {
          setMacroTargets(savedGoals.targets);
        }}
      />
    </main>
  );
}
