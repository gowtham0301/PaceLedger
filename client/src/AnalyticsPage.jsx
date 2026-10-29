
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Footprints,
  Flame,
  Dumbbell,
  Moon,
  Scale,
  Utensils,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import './AnalyticsPage.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

function getDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDate(date, amount) {
  const result = new Date(`${date}T12:00:00`)
  result.setDate(result.getDate() + amount)
  return getDateKey(result)
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: digits,
  })
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

function durationInMinutes(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return null

  const parseTime = (value) => {
    const [hours, minutes] = value.split(':').map(Number)
    return hours * 60 + minutes
  }

  const start = parseTime(bedtime)
  const end = parseTime(wakeTime)

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null

  return (end - start + 1440) % 1440
}

function formatDuration(minutes) {
  if (minutes == null) return '—'
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function StatCard({ icon: Icon, label, value, subtitle, color }) {
  return (
    <section className="analytics-stat-card">
      <div className={`analytics-stat-icon ${color}`}>
        <Icon size={20} />
      </div>
      <span className="analytics-stat-label">{label}</span>
      <strong className="analytics-stat-value">{value}</strong>
      <span className="analytics-stat-subtitle">{subtitle}</span>
    </section>
  )
}

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <section className={`analytics-panel ${className}`}>
      <div className="analytics-panel-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function EmptyChart({ message }) {
  return <div className="analytics-empty">{message}</div>
}

export default function AnalyticsPage() {
  const [range, setRange] = useState(7)
  const [refreshKey, setRefreshKey] = useState(0)
  const [fitness, setFitness] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [sleep, setSleep] = useState([])
  const [weight, setWeight] = useState([])
  const [nutritionDays, setNutritionDays] = useState([])
  const [nutritionGoals, setNutritionGoals] = useState(null)
  const [weightGoals, setWeightGoals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadAnalytics() {
      setLoading(true)
      setError('')

      try {
        const requests = [
          fetch(`${API_URL}/fitness`, { signal: controller.signal }),
          fetch(`${API_URL}/workouts`, { signal: controller.signal }),
          fetch(`${API_URL}/sleep`, { signal: controller.signal }),
          fetch(`${API_URL}/weight`, { signal: controller.signal }),
          fetch(`${API_URL}/nutrition/goals`, { signal: controller.signal }),
          fetch(`${API_URL}/weight/goals`, { signal: controller.signal }),
        ]

        const responses = await Promise.all(requests)
        const failed = responses.find((response) => !response.ok)

        if (failed) {
          throw new Error(`An API request failed (${failed.status}).`)
        }

        const [
          fitnessData,
          workoutData,
          sleepData,
          weightData,
          nutritionGoalData,
          weightGoalData,
        ] = await Promise.all(responses.map((response) => response.json()))

        const today = getDateKey(new Date())
        const firstDay = shiftDate(today, -29)

        // Nutrition summaries are weekly. Fetch one summary for each date
        // in the selected 30-day window, then retain only the requested dates.
        const summaryDates = Array.from({ length: 30 }, (_, index) =>
          shiftDate(firstDay, index)
        )

        const summaryResponses = await Promise.all(
          summaryDates.map((date) =>
            fetch(
              `${API_URL}/nutrition/summary?date=${date}`,
              { signal: controller.signal }
            )
          )
        )

        const failedSummary = summaryResponses.find(
          (response) => !response.ok
        )

        if (failedSummary) {
          throw new Error('Could not load nutrition summaries.')
        }

        const summaries = await Promise.all(
          summaryResponses.map((response) => response.json())
        )

        const nutritionByDate = new Map()

        summaries.forEach((summary) => {
          ;(summary.weekly?.days || []).forEach((day) => {
            if (day.date >= firstDay && day.date <= today) {
              nutritionByDate.set(day.date, day)
            }
          })
        })

        setFitness(Array.isArray(fitnessData) ? fitnessData : [])
        setWorkouts(Array.isArray(workoutData) ? workoutData : [])
        setSleep(Array.isArray(sleepData) ? sleepData : [])
        setWeight(Array.isArray(weightData) ? weightData : [])
        setNutritionGoals(nutritionGoalData)
        setWeightGoals(weightGoalData)
        setNutritionDays(
          summaryDates.map((date) => ({
            date,
            ...(nutritionByDate.get(date) || {}),
          }))
        )
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Analytics loading error:', err)
          setError(err.message || 'Could not load analytics data.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadAnalytics()
    return () => controller.abort()
  }, [refreshKey])

  const today = getDateKey(new Date())
  const startDate = shiftDate(today, -(range - 1))

  const visibleDates = useMemo(
    () => Array.from({ length: range }, (_, index) =>
      shiftDate(startDate, index)
    ),
    [startDate, range]
  )

  const activityByDate = useMemo(() => {
    const map = new Map()
    fitness.forEach((record) => map.set(record.date, record))
    return map
  }, [fitness])

  const nutritionByDate = useMemo(() => {
    const map = new Map()
    nutritionDays.forEach((day) => map.set(day.date, day))
    return map
  }, [nutritionDays])

  const activityChart = visibleDates.map((date) => {
    const record = activityByDate.get(date)
    return {
      date,
      day: formatDate(date),
      steps: record ? Number(record.steps || 0) : null,
      calories: record ? Number(record.calories || 0) : null,
    }
  })

  const nutritionChart = visibleDates.map((date) => {
    const record = nutritionByDate.get(date)
    return {
      date,
      day: formatDate(date),
      calories: record?.entryCount > 0
        ? Number(record.calories || 0)
        : null,
      protein: record?.entryCount > 0
        ? Number(record.protein || 0)
        : null,
    }
  })

  const workoutChart = visibleDates.map((date) => {
    const dailyWorkouts = workouts.filter((workout) => workout.date === date)
    return {
      date,
      day: formatDate(date),
      minutes: dailyWorkouts.reduce(
        (sum, workout) => sum + Number(workout.duration || 0),
        0
      ),
      sessions: dailyWorkouts.length,
    }
  })

  const sleepChart = visibleDates.map((date) => {
    const record = sleep.find((item) => item.date === date)
    const minutes = record
      ? durationInMinutes(record.bedtime, record.wakeTime)
      : null

    return {
      date,
      day: formatDate(date),
      minutes: minutes != null && minutes > 0 ? minutes : null,
      quality: record?.quality || '',
    }
  })

  const weightChart = weight
    .filter((record) => record.date >= startDate && record.date <= today)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => ({
      date: record.date,
      day: formatDate(record.date),
      weight: Number(record.weight),
    }))

  const loggedActivity = activityChart.filter((day) => day.steps !== null)
  const loggedNutrition = nutritionChart.filter(
    (day) => day.calories !== null
  )
  const loggedSleep = sleepChart.filter((day) => day.minutes !== null)

  const totalSteps = loggedActivity.reduce(
    (sum, day) => sum + day.steps,
    0
  )

  const totalActiveCalories = loggedActivity.reduce(
    (sum, day) => sum + day.calories,
    0
  )

  const totalWorkoutMinutes = workoutChart.reduce(
    (sum, day) => sum + day.minutes,
    0
  )

  const averageSleep = loggedSleep.length
    ? Math.round(
        loggedSleep.reduce((sum, day) => sum + day.minutes, 0) /
        loggedSleep.length
      )
    : null

  const averageWeight = weightChart.length
    ? weightChart[weightChart.length - 1].weight
    : null

  const averageIntake = loggedNutrition.length
    ? Math.round(
        loggedNutrition.reduce((sum, day) => sum + day.calories, 0) /
        loggedNutrition.length
      )
    : null

  const proteinTarget = Number(nutritionGoals?.targets?.protein || 0)
  const calorieTarget = Number(nutritionGoals?.targets?.calories || 0)
  const goalWeight = Number(weightGoals?.goalWeight || 0)

  const firstWeight = weightChart[0]?.weight
  const lastWeight = weightChart[weightChart.length - 1]?.weight
  const weightChange =
    firstWeight != null && lastWeight != null
      ? Math.round((lastWeight - firstWeight) * 10) / 10
      : null

  if (loading) {
    return (
      <div className="analytics-loading">
        <RefreshCw className="analytics-spin" size={20} />
        Loading your analytics…
      </div>
    )
  }

  return (
    <div className="analytics-page">
      <div className="analytics-page-header">
        <div>
          <div className="eyebrow">PACELEDGER / INSIGHTS</div>
          <h1>Analytics <span>Overview</span></h1>
          <p>Explore your saved activity, nutrition, workouts, sleep and weight.</p>
        </div>

        <div className="analytics-header-actions">
          <div className="analytics-range">
            <button
              className={range === 7 ? 'selected' : ''}
              onClick={() => setRange(7)}
            >
              7 days
            </button>
            <button
              className={range === 30 ? 'selected' : ''}
              onClick={() => setRange(30)}
            >
              30 days
            </button>
          </div>
          <button
            className="analytics-refresh"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="analytics-error" role="alert">
          <strong>Some analytics couldn't load.</strong>
          <p>{error}</p>
          <button onClick={() => setRefreshKey((key) => key + 1)}>
            Try again
          </button>
        </div>
      )}

      <div className="analytics-date-caption">
        {formatDate(startDate)} – {formatDate(today)} · {range}-day view
      </div>

      <div className="analytics-stats-grid">
        <StatCard
          icon={Footprints}
          label="Total steps"
          value={formatNumber(totalSteps)}
          subtitle={`${loggedActivity.length} days with activity records`}
          color="teal"
        />
        <StatCard
          icon={Flame}
          label="Active calories"
          value={`${formatNumber(totalActiveCalories)} kcal`}
          subtitle="From saved activity records"
          color="orange"
        />
        <StatCard
          icon={Dumbbell}
          label="Workout time"
          value={formatDuration(totalWorkoutMinutes)}
          subtitle={`${workouts.filter((workout) => workout.date >= startDate && workout.date <= today).length} sessions`}
          color="blue"
        />
        <StatCard
          icon={Moon}
          label="Average sleep"
          value={formatDuration(averageSleep)}
          subtitle={`${loggedSleep.length} nights with records`}
          color="purple"
        />
        <StatCard
          icon={Utensils}
          label="Average food calories"
          value={averageIntake == null ? '—' : `${formatNumber(averageIntake)} kcal`}
          subtitle={`${loggedNutrition.length} days with food entries`}
          color="green"
        />
        <StatCard
          icon={Scale}
          label="Latest weight"
          value={averageWeight == null ? '—' : `${formatNumber(averageWeight, 1)} kg`}
          subtitle={
            weightChange == null
              ? 'No weight records in this period'
              : `${weightChange > 0 ? '+' : ''}${formatNumber(weightChange, 1)} kg since first visible record`
          }
          color="pink"
        />
      </div>

      <div className="analytics-chart-grid">
        <ChartCard
          title="Daily steps"
          subtitle="Imported activity records only"
        >
          {loggedActivity.length === 0 ? (
            <EmptyChart message="No activity records in this period." />
          ) : (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityChart}>
                  <defs>
                    <linearGradient id="analyticsStepsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#202b3e" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ background: '#151f30', border: '1px solid #2b394d', borderRadius: 10, color: '#e5edf7' }} formatter={(value) => [formatNumber(value), 'Steps']} />
                  <Area connectNulls={false} type="monotone" dataKey="steps" stroke="#2dd4bf" strokeWidth={2.5} fill="url(#analyticsStepsGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Active calories"
          subtitle="Calories burned according to imported records"
        >
          {loggedActivity.length === 0 ? (
            <EmptyChart message="No active-calorie records in this period." />
          ) : (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityChart}>
                  <CartesianGrid stroke="#202b3e" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip contentStyle={{ background: '#151f30', border: '1px solid #2b394d', borderRadius: 10, color: '#e5edf7' }} formatter={(value) => [`${formatNumber(value)} kcal`, 'Active calories']} />
                  <Bar dataKey="calories" fill="#fb923c" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Nutrition trends"
          subtitle="Food calories and protein on logged days"
        >
          {loggedNutrition.length === 0 ? (
            <EmptyChart message="No nutrition entries in this period." />
          ) : (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={nutritionChart}>
                  <CartesianGrid stroke="#202b3e" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="calories" tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ background: '#151f30', border: '1px solid #2b394d', borderRadius: 10, color: '#e5edf7' }} formatter={(value, name) => [name === 'calories' ? `${formatNumber(value)} kcal` : `${formatNumber(value, 1)} g`, name === 'calories' ? 'Food calories' : 'Protein']} />
                  <Area connectNulls={false} yAxisId="calories" type="monotone" dataKey="calories" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="analytics-chart-note">
            {calorieTarget > 0
              ? `Saved calorie target: ${formatNumber(calorieTarget)} kcal/day`
              : 'Set a nutrition target to compare intake with your goal.'}
            {proteinTarget > 0 ? ` · Protein target: ${formatNumber(proteinTarget)} g/day` : ''}
          </p>
        </ChartCard>

        <ChartCard
          title="Workout minutes"
          subtitle="Total recorded workout time per day"
        >
          {workoutChart.every((day) => day.sessions === 0) ? (
            <EmptyChart message="No workouts recorded in this period." />
          ) : (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workoutChart}>
                  <CartesianGrid stroke="#202b3e" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip contentStyle={{ background: '#151f30', border: '1px solid #2b394d', borderRadius: 10, color: '#e5edf7' }} formatter={(value) => [`${formatNumber(value)} min`, 'Workout time']} />
                  <Bar dataKey="minutes" fill="#60a5fa" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Sleep duration"
          subtitle="Calculated from bedtime and wake-up time"
        >
          {loggedSleep.length === 0 ? (
            <EmptyChart message="No sleep records in this period." />
          ) : (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sleepChart}>
                  <CartesianGrid stroke="#202b3e" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} width={42} tickFormatter={(value) => `${Math.floor(value / 60)}h`} />
                  <Tooltip contentStyle={{ background: '#151f30', border: '1px solid #2b394d', borderRadius: 10, color: '#e5edf7' }} formatter={(value) => [formatDuration(value), 'Sleep']} />
                  <Area connectNulls={false} type="monotone" dataKey="minutes" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Weight trend"
          subtitle="Saved measurements during this period"
        >
          {weightChart.length === 0 ? (
            <EmptyChart message="No weight measurements in this period." />
          ) : (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightChart}>
                  <CartesianGrid stroke="#202b3e" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip contentStyle={{ background: '#151f30', border: '1px solid #2b394d', borderRadius: 10, color: '#e5edf7' }} formatter={(value) => [`${formatNumber(value, 1)} kg`, 'Weight']} />
                  <Area type="monotone" dataKey="weight" stroke="#2dd4bf" fill="#2dd4bf" fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {goalWeight > 0 && (
            <p className="analytics-chart-note">
              Saved target weight: {formatNumber(goalWeight, 1)} kg
            </p>
          )}
        </ChartCard>
      </div>

      <section className="analytics-panel analytics-insight-panel">
        <div className="analytics-insight-icon"><TrendingUp size={20} /></div>
        <div>
          <h3>How to read these insights</h3>
          <p>
            These charts summarize records saved in PaceLedger. Missing dates
            mean no record was found, not necessarily that no activity, food,
            or sleep occurred. Food intake and activity calories are separate
            measures and should not be treated as a direct calorie-balance calculation.
          </p>
        </div>
      </section>
    </div>
  )
}
