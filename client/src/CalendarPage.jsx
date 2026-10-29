
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, ChevronLeft, ChevronRight, Dumbbell, Utensils,
  Moon, Scale, Footprints, Flame, Clock3, CalendarDays,
  RefreshCw, CircleDot, Sparkles
} from 'lucide-react'
import './CalendarPage.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

const localDateKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const prettyDate = (key) => {
  if (!key) return ''
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

const number = (value) => Number(value || 0).toLocaleString('en-IN')

const sources = [
  { key: 'activity', label: 'Activity', color: '#2dd4bf', icon: Footprints },
  { key: 'workout', label: 'Workouts', color: '#60a5fa', icon: Dumbbell },
  { key: 'nutrition', label: 'Nutrition', color: '#fbbf24', icon: Utensils },
  { key: 'sleep', label: 'Sleep', color: '#a78bfa', icon: Moon },
  { key: 'weight', label: 'Weight', color: '#f472b6', icon: Scale },
]

function recordDate(record) {
  return record?.date ? String(record.date).slice(0, 10) : ''
}

export default function CalendarPage() {
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(localDateKey())
  const [data, setData] = useState({
    activity: [], workout: [], nutrition: [], sleep: [], weight: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    const endpoints = [
      ['activity', '/fitness'],
      ['workout', '/workouts'],
      ['nutrition', '/nutrition'],
      ['sleep', '/sleep'],
      ['weight', '/weight'],
    ]

    const results = await Promise.allSettled(
      endpoints.map(async ([key, path]) => {
        const response = await fetch(`${API_URL}${path}`)
        if (!response.ok) throw new Error(`${path} returned ${response.status}`)
        const records = await response.json()
        return [key, Array.isArray(records) ? records : []]
      })
    )

    const next = { activity: [], workout: [], nutrition: [], sleep: [], weight: [] }
    let failures = 0

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const [key, records] = result.value
        next[key] = records
      } else {
        failures += 1
      }
    })

    setData(next)
    if (failures === endpoints.length) {
      setError('Could not load calendar records. Check that the backend is running.')
    } else if (failures > 0) {
      setError('Some record types could not be loaded. Other available records are still shown.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const monthLabel = monthDate.toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric'
  })

  const calendarDays = useMemo(() => {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const offset = first.getDay()
    const count = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
    const cells = []

    for (let i = 0; i < 42; i += 1) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), i - offset + 1)
      const key = localDateKey(date)
      const types = sources.filter(({ key: type }) =>
        data[type].some((record) => recordDate(record) === key)
      )
      cells.push({
        key,
        day: date.getDate(),
        currentMonth: date.getMonth() === monthDate.getMonth(),
        today: key === localDateKey(),
        types,
        date,
      })
    }

    return { cells, count, offset }
  }, [monthDate, data])

  const selected = {
    activity: data.activity.filter((r) => recordDate(r) === selectedDate),
    workout: data.workout.filter((r) => recordDate(r) === selectedDate),
    nutrition: data.nutrition.filter((r) => recordDate(r) === selectedDate),
    sleep: data.sleep.filter((r) => recordDate(r) === selectedDate),
    weight: data.weight.filter((r) => recordDate(r) === selectedDate),
  }

  const monthRecords = Object.fromEntries(
    sources.map(({ key }) => [
      key,
      data[key].filter((record) => {
        const date = recordDate(record)
        return date.startsWith(
          `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
        )
      }),
    ])
  )

  const activeDates = new Set(
    sources.flatMap(({ key }) => monthRecords[key].map(recordDate))
  )

  const monthWorkoutMinutes = monthRecords.workout.reduce(
    (sum, workout) => sum + Number(workout.duration || 0), 0
  )

  const dayActivity = selected.activity.reduce((sum, r) => sum + Number(r.steps || 0), 0)
  const dayCalories = selected.activity.reduce((sum, r) => sum + Number(r.calories || 0), 0)
  const dayWorkoutMinutes = selected.workout.reduce(
    (sum, workout) => sum + Number(workout.duration || 0), 0
  )
  const dayFoodCalories = selected.nutrition.reduce(
    (sum, entry) => sum + Number(entry.calories || 0), 0
  )

  const hasSelectedRecords = sources.some(({ key }) => selected[key].length > 0)

  const moveMonth = (amount) => {
    setMonthDate((current) => new Date(
      current.getFullYear(), current.getMonth() + amount, 1
    ))
  }

  const goToday = () => {
    const now = new Date()
    setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(localDateKey(now))
  }

  return (
    <div className="calendar-page">
      <div className="calendar-hero">
        <div>
          <div className="calendar-eyebrow">
            <Sparkles size={14} /> PACELEDGER / YOUR TIMELINE
          </div>
          <h1>Your fitness <span>calendar.</span></h1>
          <p>Every walk, workout, meal and milestone — in one place.</p>
        </div>
        <button className="calendar-refresh" onClick={loadRecords} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'calendar-spinning' : ''} />
          {loading ? 'Loading' : 'Sync records'}
        </button>
      </div>

      {error && <div className="calendar-notice">{error}</div>}

      <div className="calendar-overview">
        <div className="calendar-stat">
          <span className="calendar-stat-icon teal"><CalendarDays size={19} /></span>
          <div><small>Active days this month</small><strong>{activeDates.size}</strong></div>
          <span className="calendar-stat-unit">days</span>
        </div>
        <div className="calendar-stat">
          <span className="calendar-stat-icon blue"><Dumbbell size={19} /></span>
          <div><small>Recorded workouts</small><strong>{monthRecords.workout.length}</strong></div>
          <span className="calendar-stat-unit">sessions</span>
        </div>
        <div className="calendar-stat">
          <span className="calendar-stat-icon purple"><Clock3 size={19} /></span>
          <div><small>Workout time</small><strong>{Math.floor(monthWorkoutMinutes / 60)}h {monthWorkoutMinutes % 60}m</strong></div>
          <span className="calendar-stat-unit">this month</span>
        </div>
      </div>

      <div className="calendar-workspace">
        <section className="calendar-main-card">
          <div className="calendar-month-toolbar">
            <div>
              <span className="calendar-section-kicker">YOUR SCHEDULE</span>
              <h2>{monthLabel}</h2>
            </div>
            <div className="calendar-nav">
              <button aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={19} /></button>
              <button onClick={goToday}>Today</button>
              <button aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={19} /></button>
            </div>
          </div>

          <div className="calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) =>
              <span key={day}>{day}</span>
            )}
          </div>

          <div className="calendar-month-grid">
            {calendarDays.cells.map((cell) => (
              <button
                key={cell.key}
                className={[
                  'calendar-date-cell',
                  !cell.currentMonth ? 'is-outside' : '',
                  cell.today ? 'is-today' : '',
                  selectedDate === cell.key ? 'is-selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  setSelectedDate(cell.key)
                  if (!cell.currentMonth) {
                    setMonthDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1))
                  }
                }}
                aria-label={`${prettyDate(cell.key)}${cell.types.length ? ', has records' : ''}`}
              >
                <span className="calendar-date-number">{cell.day}</span>
                {cell.today && <span className="calendar-today-tag">TODAY</span>}
                <span className="calendar-date-dots">
                  {cell.types.map((type) => (
                    <i key={type.key} style={{ background: type.color }} title={type.label} />
                  ))}
                </span>
                {cell.types.length > 0 && <span className="calendar-date-count">{cell.types.length} {cell.types.length === 1 ? 'log' : 'logs'}</span>}
              </button>
            ))}
          </div>

          <div className="calendar-legend">
            {sources.map(({ key, label, color, icon: Icon }) => (
              <span key={key}><i style={{ background: color }} /><Icon size={13} />{label}</span>
            ))}
          </div>
        </section>

        <aside className="calendar-detail-card">
          <div className="calendar-detail-top">
            <span className="calendar-detail-icon"><CalendarDays size={20} /></span>
            <span className="calendar-section-kicker">DAY OVERVIEW</span>
          </div>
          <h2>{prettyDate(selectedDate)}</h2>
          <p className="calendar-detail-subtitle">Your saved progress for this day.</p>

          <div className="calendar-day-metrics">
            <div><span className="teal-text"><Footprints size={15} /> Steps</span><strong>{number(dayActivity)}</strong></div>
            <div><span className="orange-text"><Flame size={15} /> Active kcal</span><strong>{number(dayCalories)}</strong></div>
            <div><span className="blue-text"><Dumbbell size={15} /> Workout</span><strong>{dayWorkoutMinutes} min</strong></div>
            <div><span className="yellow-text"><Utensils size={15} /> Food kcal</span><strong>{number(dayFoodCalories)}</strong></div>
          </div>

          <div className="calendar-activity-heading">
            <h3>Timeline</h3>
            <span>{sources.reduce((sum, { key }) => sum + selected[key].length, 0)} records</span>
          </div>

          <div className="calendar-timeline">
            {sources.map(({ key, label, color, icon: Icon }) =>
              selected[key].map((record, index) => (
                <div className="calendar-timeline-item" key={`${key}-${record._id || record.id || index}`}>
                  <span className="calendar-timeline-icon" style={{ color, background: `${color}18` }}>
                    <Icon size={16} />
                  </span>
                  <div className="calendar-timeline-copy">
                    <strong>{label}</strong>
                    <p>
                      {key === 'activity' ? `${number(record.steps)} steps · ${number(record.calories)} active kcal` :
                       key === 'workout' ? `${record.type || 'Workout'} · ${record.duration || 0} min` :
                       key === 'nutrition' ? `${record.foodName || record.name || record.foodId || 'Food entry'} · ${number(record.calories)} kcal` :
                       key === 'sleep' ? `${record.bedtime || 'Bedtime'} → ${record.wakeTime || 'Wake-up'}` :
                       `${record.weight ?? '—'} kg`}
                    </p>
                  </div>
                  <CircleDot size={13} color={color} />
                </div>
              ))
            )}

            {!hasSelectedRecords && (
              <div className="calendar-empty-day">
                <span><CalendarDays size={24} /></span>
                <strong>A little space in your timeline</strong>
                <p>No saved records for this date. Select another day or add data in one of the PaceLedger sections.</p>
              </div>
            )}
          </div>
          {loading && <p className="calendar-loading-note">Refreshing your records…</p>}
        </aside>
      </div>
    </div>
  )
}
