
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CalendarDays,
  Clock3,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Dumbbell,
} from 'lucide-react'

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

const TYPES = [
  'Walking',
  'Running',
  'Cycling',
  'Strength Training',
  'Yoga',
  'Swimming',
  'Other',
]

const today = () => {
  const date = new Date()
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const initialForm = () => ({
  type: 'Walking',
  date: today(),
  duration: '30',
  calories: '',
  notes: '',
})

const formatNumber = (value) =>
  Number(value || 0).toLocaleString('en-IN')

const formatDate = (value) => {
  if (!value) return 'Unknown date'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState([])
  const [form, setForm] = useState(initialForm)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadWorkouts() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`${API_URL}/workouts`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Could not load workouts.')
      }

      setWorkouts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not connect to the backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkouts()
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return workouts.filter((workout) => {
      const matchesType =
        typeFilter === 'All' || workout.type === typeFilter

      const matchesSearch =
        !query ||
        workout.type?.toLowerCase().includes(query) ||
        workout.date?.includes(query) ||
        workout.notes?.toLowerCase().includes(query)

      return matchesType && matchesSearch
    })
  }, [workouts, search, typeFilter])

  const totals = useMemo(() => ({
    count: filtered.length,
    minutes: filtered.reduce(
      (sum, workout) => sum + Number(workout.duration || 0), 0
    ),
    calories: filtered.reduce(
      (sum, workout) => sum + Number(workout.calories || 0), 0
    ),
  }), [filtered])

  function updateForm(event) {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
  }

  async function addWorkout(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!form.date) {
      setError('Please select a workout date.')
      return
    }

    const duration = Number(form.duration)
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      setError('Duration must be between 1 and 1440 minutes.')
      return
    }

    if (
      form.calories !== '' &&
      (!Number.isFinite(Number(form.calories)) || Number(form.calories) < 0)
    ) {
      setError('Calories must be a non-negative number.')
      return
    }

    try {
      setSaving(true)

      const response = await fetch(`${API_URL}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          duration,
          calories: form.calories === '' ? null : Number(form.calories),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Could not save workout.')
      }

      setWorkouts((previous) =>
        [data, ...previous].sort((a, b) =>
          b.date.localeCompare(a.date) ||
          new Date(b.createdAt) - new Date(a.createdAt)
        )
      )
      setForm(initialForm())
      setNotice('Workout saved successfully.')
    } catch (err) {
      setError(err.message || 'Could not save workout.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteWorkout(id) {
    if (!window.confirm('Delete this workout permanently?')) return

    try {
      setDeletingId(id)
      setError('')
      setNotice('')

      const response = await fetch(
        `${API_URL}/workouts/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Could not delete workout.')
      }

      setWorkouts((previous) =>
        previous.filter((workout) => workout._id !== id)
      )
      setNotice('Workout deleted.')
    } catch (err) {
      setError(err.message || 'Could not delete workout.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">PACELEDGER / TRAINING</div>
          <h1>Workouts</h1>
          <p>Plan your sessions, record your effort, and build consistency.</p>
        </div>
        <button
          className="secondary-btn"
          onClick={loadWorkouts}
          disabled={loading}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="notice" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="metrics-grid">
        <section className="panel metric-card">
          <span className="metric-icon teal"><Dumbbell size={19} /></span>
          <p className="metric-label">Workouts</p>
          <div className="metric-value">{formatNumber(totals.count)}</div>
        </section>

        <section className="panel metric-card">
          <span className="metric-icon blue"><Clock3 size={19} /></span>
          <p className="metric-label">Exercise time</p>
          <div className="metric-value">
            {formatNumber(totals.minutes)}<span> min</span>
          </div>
        </section>

        <section className="panel metric-card">
          <span className="metric-icon orange"><Flame size={19} /></span>
          <p className="metric-label">Workout calories</p>
          <div className="metric-value">
            {formatNumber(totals.calories)}<span> kcal</span>
          </div>
        </section>

        <section className="panel metric-card">
          <span className="metric-icon pink"><CalendarDays size={19} /></span>
          <p className="metric-label">Workout types</p>
          <div className="metric-value">
            {new Set(filtered.map((workout) => workout.type)).size}
          </div>
        </section>
      </div>

      <div className="workouts-layout">
        <section className="panel">
          <div className="card-heading">
            <div>
              <h3>Log a workout</h3>
              <p>Save a session to your workout history.</p>
            </div>
            <Plus size={20} color="#2dd4bf" />
          </div>

          <form className="workout-form" onSubmit={addWorkout}>
            <label>
              Workout type
              <select name="type" value={form.type} onChange={updateForm}>
                {TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              Date
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={updateForm}
                required
              />
            </label>

            <label>
              Duration (minutes)
              <input
                type="number"
                name="duration"
                value={form.duration}
                onChange={updateForm}
                min="1"
                max="1440"
                step="1"
                required
              />
            </label>

            <label>
              Calories burned (optional)
              <input
                type="number"
                name="calories"
                value={form.calories}
                onChange={updateForm}
                min="0"
                step="1"
                placeholder="e.g. 180"
              />
            </label>

            <label className="workout-notes">
              Notes (optional)
              <textarea
                name="notes"
                value={form.notes}
                onChange={updateForm}
                maxLength="500"
                rows="3"
                placeholder="How did the session go?"
              />
            </label>

            <button className="primary-btn" type="submit" disabled={saving}>
              <Plus size={16} />
              {saving ? 'Saving...' : 'Save workout'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="card-heading">
            <div>
              <h3>Workout history</h3>
              <p>Saved separately from imported daily activity.</p>
            </div>
            <Activity size={20} color="#2dd4bf" />
          </div>

          <div className="workout-filters">
            <label className="activity-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workouts..."
              />
            </label>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter by workout type"
            >
              <option value="All">All types</option>
              {TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="form-note">Loading workouts...</p>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Dumbbell size={25} /></span>
              <h3>No workouts found</h3>
              <p>Add your first workout or change your filters.</p>
            </div>
          ) : (
            <div className="activity-record-list">
              {filtered.map((workout) => (
                <article
                  className="activity-record"
                  key={workout._id}
                >
                  <span className="workout-icon wc-0">
                    <Dumbbell size={20} />
                  </span>

                  <div className="activity-record-main">
                    <strong>{workout.type}</strong>
                    <small>{formatDate(workout.date)}</small>
                    <div className="activity-record-stats">
                      <span><Clock3 size={14} /> {workout.duration} min</span>
                      {workout.calories != null && (
                        <span><Flame size={14} /> {formatNumber(workout.calories)} kcal</span>
                      )}
                    </div>
                    {workout.notes && <small>{workout.notes}</small>}
                  </div>

                  <button
                    className="delete-record-btn"
                    disabled={deletingId === workout._id}
                    onClick={() => deleteWorkout(workout._id)}
                    aria-label={`Delete ${workout.type} workout`}
                  >
                    <Trash2 size={16} />
                    {deletingId === workout._id ? 'Deleting...' : 'Delete'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
