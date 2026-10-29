
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Footprints,
  Flame,
  Search,
  CalendarDays,
  RefreshCw,
  Trash2,
  Route,
  Clock3,
  ArrowUpRight,
} from 'lucide-react'

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN')
}

function formatDate(value) {
  if (!value) return 'Unknown date'
  const [year, month, day] = value.split('-').map(Number)

  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function ActivityPage({ setPage }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [deletingDate, setDeletingDate] = useState('')

  async function loadRecords() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`${API_URL}/fitness`)
      if (!response.ok) {
        throw new Error(`Could not load records (${response.status})`)
      }

      const data = await response.json()
      setRecords(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not connect to the backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [])

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase()

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        record.date?.includes(query) ||
        formatDate(record.date).toLowerCase().includes(query)

      const matchesFrom = !fromDate || record.date >= fromDate
      const matchesTo = !toDate || record.date <= toDate

      return matchesSearch && matchesFrom && matchesTo
    })
  }, [records, search, fromDate, toDate])

  const totals = useMemo(() => ({
    steps: filteredRecords.reduce(
      (sum, record) => sum + Number(record.steps || 0), 0
    ),
    calories: filteredRecords.reduce(
      (sum, record) => sum + Number(record.calories || 0), 0
    ),
    distance: filteredRecords.reduce(
      (sum, record) => sum + (Number.parseFloat(record.distance) || 0), 0
    ),
  }), [filteredRecords])

  async function deleteRecord(date) {
    const confirmed = window.confirm(
      `Delete the fitness record for ${formatDate(date)}? This cannot be undone.`
    )
    if (!confirmed) return

    try {
      setDeletingDate(date)
      setError('')

      const response = await fetch(
        `${API_URL}/fitness/${encodeURIComponent(date)}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.message || 'Could not delete the record.')
      }

      setRecords((previous) =>
        previous.filter((record) => record.date !== date)
      )
    } catch (err) {
      setError(err.message || 'Could not delete the record.')
    } finally {
      setDeletingDate('')
    }
  }

  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">PACELEDGER / YOUR MOVEMENT</div>
          <h1>Activity history</h1>
          <p>Explore your imported daily activity, all saved in MongoDB.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="secondary-btn" onClick={loadRecords} disabled={loading}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="primary-btn" onClick={() => setPage('Import Data')}>
            <ArrowUpRight size={16} />
            Import activity
          </button>
        </div>
      </div>

      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}

      <div className="metrics-grid">
        <section className="panel metric-card">
          <div className="metric-top">
            <span className="metric-icon teal"><Footprints size={19} /></span>
          </div>
          <p className="metric-label">Total steps in results</p>
          <div className="metric-value">{formatNumber(totals.steps)}</div>
        </section>

        <section className="panel metric-card">
          <div className="metric-top">
            <span className="metric-icon orange"><Flame size={19} /></span>
          </div>
          <p className="metric-label">Active calories</p>
          <div className="metric-value">
            {formatNumber(totals.calories)}<span> kcal</span>
          </div>
        </section>

        <section className="panel metric-card">
          <div className="metric-top">
            <span className="metric-icon blue"><Route size={19} /></span>
          </div>
          <p className="metric-label">Total distance shown</p>
          <div className="metric-value">
            {totals.distance.toLocaleString('en-IN', {
              maximumFractionDigits: 2,
            })}
          </div>
        </section>

        <section className="panel metric-card">
          <div className="metric-top">
            <span className="metric-icon pink"><CalendarDays size={19} /></span>
          </div>
          <p className="metric-label">Recorded days</p>
          <div className="metric-value">{filteredRecords.length}</div>
        </section>
      </div>

      <section className="panel">
        <div className="card-heading">
          <div>
            <h3>Daily records</h3>
            <p>Search or narrow the dates to find an activity.</p>
          </div>
          <Activity size={20} color="#2dd4bf" />
        </div>

        <div className="activity-filters">
          <label className="activity-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search date..."
            />
          </label>

          <label className="activity-date-filter">
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>

          <label className="activity-date-filter">
            <span>To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>

          <button
            className="secondary-btn"
            onClick={() => {
              setSearch('')
              setFromDate('')
              setToDate('')
            }}
          >
            Clear filters
          </button>
        </div>

        {loading ? (
          <p className="form-note">Loading your saved activities...</p>
        ) : filteredRecords.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon"><Activity size={25} /></span>
            <h3>{records.length ? 'No matching activities' : 'No activities yet'}</h3>
            <p>
              {records.length
                ? 'Try changing your search or date filters.'
                : 'Import an Apple Health screenshot to see your daily records here.'}
            </p>
            {!records.length && (
              <button className="primary-btn" onClick={() => setPage('Import Data')}>
                Import your first record
              </button>
            )}
          </div>
        ) : (
          <div className="activity-record-list">
            {filteredRecords.map((record) => (
              <article className="activity-record" key={record._id || record.date}>
                <span className="workout-icon wc-0">
                  <Footprints size={20} />
                </span>

                <div className="activity-record-main">
                  <strong>{formatDate(record.date)}</strong>
                  <small>
                    {record.screenshots?.length || 0} screenshot(s)
                    {' · '}
                    {record.source || 'Apple Health screenshot'}
                  </small>
                  <div className="activity-record-stats">
                    <span><Footprints size={14} /> {formatNumber(record.steps)} steps</span>
                    <span><Flame size={14} /> {formatNumber(record.calories)} active kcal</span>
                    <span><Route size={14} /> {record.distance || '—'} distance</span>
                    <span><Clock3 size={14} /> {record.exerciseMinutes ?? '—'} exercise min</span>
                  </div>
                </div>

                <button
                  className="delete-record-btn"
                  title={`Delete record for ${formatDate(record.date)}`}
                  aria-label={`Delete record for ${formatDate(record.date)}`}
                  disabled={deletingDate === record.date}
                  onClick={() => deleteRecord(record.date)}
                >
                  <Trash2 size={16} />
                  {deletingDate === record.date ? 'Deleting...' : 'Delete'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
