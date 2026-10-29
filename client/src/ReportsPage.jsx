
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FileText, Download, Printer, RefreshCw, Activity,
  Dumbbell, Moon, Utensils, Scale, CalendarDays,
  AlertCircle, CheckCircle2
} from 'lucide-react'
import './ReportsPage.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

function number(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 1,
  })
}

function getRows(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.records)) return data.records
  if (Array.isArray(data?.entries)) return data.entries
  return []
}

function getSleepHours(record) {
  if (!record?.bedtime || !record?.wakeTime) return 0

  const toMinutes = (time) => {
    const match = String(time).match(/^(\d{1,2}):(\d{2})/)
    if (!match) return null
    return Number(match[1]) * 60 + Number(match[2])
  }

  let start = toMinutes(record.bedtime)
  let end = toMinutes(record.wakeTime)
  if (start === null || end === null) return 0
  if (end <= start) end += 1440

  return (end - start) / 60
}

function saveCSV(rows, filename) {
  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value ?? '').replaceAll('"', '""')}"`
    ).join(',')
  ).join('\r\n')

  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [period, setPeriod] = useState(7)
  const [data, setData] = useState({
    activity: [],
    workouts: [],
    nutrition: [],
    sleep: [],
    weight: [],
  })
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState([])

  const loadReports = useCallback(async () => {
    setLoading(true)
    setErrors([])

    const endpoints = [
      ['activity', '/fitness'],
      ['workouts', '/workouts'],
      ['sleep', '/sleep'],
      ['weight', '/weight'],
    ]

    const results = await Promise.all(
      endpoints.map(async ([key, endpoint]) => {
        try {
          const response = await fetch(`${API_URL}${endpoint}`)
          if (!response.ok) {
            throw new Error(`${key}: HTTP ${response.status}`)
          }

          const json = await response.json()

          return {
            key,
            rows: Array.isArray(json)
              ? json
              : Array.isArray(json?.records)
                ? json.records
                : [],
            error: null,
          }
        } catch (error) {
          return { key, rows: [], error: error.message }
        }
      })
    )

    const nutritionStartDate = dateKey(
      new Date(new Date().setDate(new Date().getDate() - 29))
    )

    const nutritionDates = Array.from({ length: 30 }, (_, index) => {
      const date = new Date()
      date.setHours(12, 0, 0, 0)
      date.setDate(date.getDate() - (29 - index))
      return dateKey(date)
    })

    const nutritionResults = await Promise.all(
      nutritionDates.map(async (date) => {
        try {
          const response = await fetch(
            `${API_URL}/nutrition?date=${date}`
          )

          if (!response.ok) {
            throw new Error(`nutrition: HTTP ${response.status}`)
          }

          const entries = await response.json()
          return Array.isArray(entries) ? entries : []
        } catch (error) {
          console.error(`Nutrition fetch failed for ${date}:`, error)
          return []
        }
      })
    )

    const nutritionRows = nutritionResults.flat()

    results.push({
      key: 'nutrition',
      rows: nutritionRows,
      error: null,
    })

    const nextData = {}
    results.forEach(result => {
      nextData[result.key] = result.rows
    })

    setData(nextData)
    setErrors(results.filter(result => result.error).map(result => result.error))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const today = dateKey(new Date())
  const startDate = dateKey(
    new Date(new Date().setDate(new Date().getDate() - period + 1))
  )

  const withinRange = (record) =>
    record.date >= startDate && record.date <= today

  const report = useMemo(() => {
    const activity = data.activity.filter(withinRange)
    const workouts = data.workouts.filter(withinRange)
    const nutrition = data.nutrition.filter(withinRange)
    const sleep = data.sleep.filter(withinRange)
    const weight = data.weight.filter(withinRange)

    const sum = (rows, key) =>
      rows.reduce((total, row) => total + Number(row[key] || 0), 0)

    const sleepHours = sleep.reduce(
      (total, record) => total + getSleepHours(record), 0
    )

    const nutritionCalories = sum(nutrition, 'calories')
    const nutritionProtein = sum(nutrition, 'protein')
    const workoutMinutes = sum(workouts, 'duration')
    const steps = sum(activity, 'steps')
    const activeCalories = sum(activity, 'calories')

    const days = Array.from({ length: period }, (_, index) => {
      const date = new Date()
      date.setHours(12, 0, 0, 0)
      date.setDate(date.getDate() - (period - 1 - index))
      const key = dateKey(date)

      return {
        date: key,
        steps: sum(activity.filter(row => row.date === key), 'steps'),
        activeCalories: sum(activity.filter(row => row.date === key), 'calories'),
        foodCalories: sum(nutrition.filter(row => row.date === key), 'calories'),
        protein: sum(nutrition.filter(row => row.date === key), 'protein'),
        workoutMinutes: sum(workouts.filter(row => row.date === key), 'duration'),
      }
    })

    return {
      activity, workouts, nutrition, sleep, weight, days,
      steps, activeCalories, nutritionCalories, nutritionProtein,
      workoutMinutes, sleepHours,
      latestWeight: weight.length
        ? [...weight].sort((a, b) => b.date.localeCompare(a.date))[0]
        : null,
    }
  }, [data, period, startDate, today])

  function exportReport() {
    const rows = [
      ['PaceLedger Fitness Report'],
      ['Period', `${startDate} to ${today}`],
      [],
      ['Metric', 'Value'],
      ['Total steps', report.steps],
      ['Active calories', report.activeCalories],
      ['Workout minutes', report.workoutMinutes],
      ['Food calories logged', report.nutritionCalories],
      ['Protein logged (g)', report.nutritionProtein],
      ['Sleep hours recorded', report.sleepHours.toFixed(1)],
      ['Latest weight (kg)', report.latestWeight?.weight ?? 'No record'],
      [],
      ['Date', 'Steps', 'Active calories', 'Food calories', 'Protein (g)', 'Workout minutes'],
      ...report.days.map(day => [
        day.date, day.steps, day.activeCalories,
        day.foodCalories, day.protein, day.workoutMinutes,
      ]),
    ]

    saveCSV(rows, `PaceLedger-Report-${startDate}-to-${today}.csv`)
  }

  const cards = [
    { label: 'Total steps', value: number(report.steps), unit: 'steps', icon: Activity, color: 'teal' },
    { label: 'Active calories', value: number(report.activeCalories), unit: 'kcal', icon: Activity, color: 'orange' },
    { label: 'Workout time', value: `${Math.floor(report.workoutMinutes / 60)}h ${report.workoutMinutes % 60}m`, unit: '', icon: Dumbbell, color: 'blue' },
    { label: 'Food calories logged', value: number(report.nutritionCalories), unit: 'kcal', icon: Utensils, color: 'green' },
    { label: 'Sleep recorded', value: `${number(report.sleepHours)}h`, unit: '', icon: Moon, color: 'purple' },
    { label: 'Latest weight', value: report.latestWeight ? number(report.latestWeight.weight) : '—', unit: report.latestWeight ? 'kg' : '', icon: Scale, color: 'pink' },
  ]

  return (
    <div className="reports-page">
      <div className="reports-heading">
        <div>
          <div className="reports-eyebrow">PACELEDGER / YOUR PROGRESS</div>
          <h1>Your fitness <span>report.</span></h1>
          <p>One view of your recorded activity, training, nutrition, sleep and weight.</p>
        </div>
        <button className="reports-secondary-btn" onClick={loadReports} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="reports-toolbar">
        <div className="reports-period">
          {[7, 30].map(days => (
            <button
              key={days}
              className={period === days ? 'selected' : ''}
              onClick={() => setPeriod(days)}
            >
              {days} days
            </button>
          ))}
        </div>

        <div className="reports-actions">
          <button className="reports-secondary-btn" onClick={() => window.print()}>
            <Printer size={16} /> Print / Save PDF
          </button>
          <button className="reports-primary-btn" onClick={exportReport} disabled={loading}>
            <Download size={16} /> Download CSV
          </button>
        </div>
      </div>

      <div className="reports-period-label">
        <CalendarDays size={15} />
        {formatDate(startDate)} — {formatDate(today)}
      </div>

      {errors.length > 0 && (
        <div className="reports-warning">
          <AlertCircle size={18} />
          <div>
            <strong>Some data could not be loaded.</strong>
            <p>{errors.join(' · ')}. Check the relevant API routes.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="reports-empty">Loading your saved reports…</div>
      ) : (
        <>
          <div className="reports-metrics">
            {cards.map(card => {
              const Icon = card.icon
              return (
                <section className="reports-metric" key={card.label}>
                  <span className={`reports-metric-icon ${card.color}`}>
                    <Icon size={20} />
                  </span>
                  <p>{card.label}</p>
                  <div className="reports-metric-value">
                    {card.value} <small>{card.unit}</small>
                  </div>
                </section>
              )
            })}
          </div>

          <section className="reports-panel">
            <div className="reports-panel-heading">
              <div>
                <h2>Daily breakdown</h2>
                <p>Values reflect records saved in PaceLedger.</p>
              </div>
              <FileText size={21} />
            </div>

            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Steps</th>
                    <th>Active kcal</th>
                    <th>Food kcal</th>
                    <th>Protein</th>
                    <th>Workout</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.slice().reverse().map(day => (
                    <tr key={day.date}>
                      <td>{formatDate(day.date)}</td>
                      <td>{number(day.steps)}</td>
                      <td>{number(day.activeCalories)}</td>
                      <td>{number(day.foodCalories)}</td>
                      <td>{number(day.protein)} g</td>
                      <td>{day.workoutMinutes} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="reports-footnote">
              <CheckCircle2 size={14} />
              Missing entries mean no record was found; they do not prove that no activity or food was consumed.
            </p>
          </section>

          <section className="reports-panel reports-summary">
            <div className="reports-panel-heading">
              <div>
                <h2>Report summary</h2>
                <p>Highlights from your selected period.</p>
              </div>
              <Activity size={21} />
            </div>
            <div className="reports-summary-grid">
              <div>
                <span>Activity records</span>
                <strong>{report.activity.length} days</strong>
              </div>
              <div>
                <span>Workout sessions</span>
                <strong>{report.workouts.length}</strong>
              </div>
              <div>
                <span>Nutrition entries</span>
                <strong>{report.nutrition.length}</strong>
              </div>
              <div>
                <span>Sleep records</span>
                <strong>{report.sleep.length}</strong>
              </div>
              <div>
                <span>Weight measurements</span>
                <strong>{report.weight.length}</strong>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
