
import { useEffect, useMemo, useState } from 'react';
import {
  Moon,
  Clock3,
  Target,
  Plus,
  Trash2,
  RefreshCw,
  BedDouble,
  Sun,
} from 'lucide-react';
import './SleepPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDuration(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return 0;

  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);

  let minutes = wh * 60 + wm - (bh * 60 + bm);
  if (minutes <= 0) minutes += 24 * 60;

  return minutes;
}

function formatDuration(minutes) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SleepPage() {
  const today = localDateKey();

  const [records, setRecords] = useState([]);
  const [date, setDate] = useState(today);
  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState('Good');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const duration = getDuration(bedtime, wakeTime);

  async function loadRecords() {
    try {
      setError('');
      const response = await fetch(`${API_URL}/sleep`);

      if (!response.ok) {
        throw new Error('Could not load sleep records.');
      }

      const data = await response.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Could not connect to the Sleep API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const selectedRecord = useMemo(
    () => records.find((record) => record.date === date),
    [records, date]
  );

  useEffect(() => {
    if (selectedRecord) {
      setBedtime(selectedRecord.bedtime || '23:00');
      setWakeTime(selectedRecord.wakeTime || '07:00');
      setQuality(selectedRecord.quality || 'Good');
      setNotes(selectedRecord.notes || '');
    } else {
      setBedtime('23:00');
      setWakeTime('07:00');
      setQuality('Good');
      setNotes('');
    }
  }, [selectedRecord, date]);

  const recentRecords = [...records]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const averageMinutes = recentRecords.length
    ? Math.round(
        recentRecords.reduce(
          (sum, record) =>
            sum + getDuration(record.bedtime, record.wakeTime),
          0
        ) / recentRecords.length
      )
    : 0;

  const goodNights = recentRecords.filter(
    (record) => getDuration(record.bedtime, record.wakeTime) >= 7 * 60
  ).length;

  async function saveSleep(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/sleep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          bedtime,
          wakeTime,
          quality,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not save sleep record.');
      }

      setNotice('Sleep record saved successfully.');
      await loadRecords();
    } catch (err) {
      setError(err.message || 'Could not save sleep record.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSleep(record) {
    if (!window.confirm(`Delete the sleep record for ${record.date}?`)) {
      return;
    }

    try {
      setError('');
      setNotice('');

      const response = await fetch(`${API_URL}/sleep/${record._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Could not delete sleep record.');
      }

      setNotice('Sleep record deleted.');
      await loadRecords();
    } catch (err) {
      setError(err.message || 'Could not delete sleep record.');
    }
  }

  return (
    <div className="sleep-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">PACELEDGER / RECOVERY</div>
          <h1>Your sleep, <span>your recovery 🌙</span></h1>
          <p>
            Track your sleep duration, quality, and nightly routine.
          </p>
        </div>

        <button
          className="secondary-btn sleep-refresh-btn"
          type="button"
          onClick={loadRecords}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="notice" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="metrics-grid sleep-metrics">
        <section className="panel metric-card">
          <div className="metric-top">
            <span className="metric-icon purple"><Moon size={19} /></span>
          </div>
          <p className="metric-label">Average sleep · last 7 records</p>
          <div className="metric-value">
            {formatDuration(averageMinutes)}
          </div>
        </section>

        <section className="panel metric-card">
          <div className="metric-top">
            <span className="metric-icon teal"><Target size={19} /></span>
          </div>
          <p className="metric-label">Nights with 7+ hours</p>
          <div className="metric-value">
            {goodNights}<span> / {recentRecords.length}</span>
          </div>
        </section>

        <section className="panel metric-card">
          <div className="metric-top">
            <span className="metric-icon blue"><BedDouble size={19} /></span>
          </div>
          <p className="metric-label">Records saved</p>
          <div className="metric-value">{records.length}</div>
        </section>
      </div>

      <div className="sleep-layout">
        <section className="panel sleep-form-panel">
          <div className="card-heading">
            <div>
              <h3>{selectedRecord ? 'Update sleep record' : 'Log your sleep'}</h3>
              <p>Record when you went to bed and woke up.</p>
            </div>
            <Moon size={20} color="#a78bfa" />
          </div>

          <form className="sleep-form" onSubmit={saveSleep}>
            <label>
              Sleep date
              <input
                type="date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>

            <div className="sleep-time-grid">
              <label>
                <span><BedDouble size={15} /> Bedtime</span>
                <input
                  type="time"
                  value={bedtime}
                  onChange={(event) => setBedtime(event.target.value)}
                  required
                />
              </label>

              <label>
                <span><Sun size={15} /> Wake-up time</span>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(event) => setWakeTime(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="sleep-duration-preview">
              <Clock3 size={18} />
              <div>
                <span>Calculated sleep duration</span>
                <strong>{formatDuration(duration)}</strong>
              </div>
            </div>

            <label>
              Sleep quality
              <select
                value={quality}
                onChange={(event) => setQuality(event.target.value)}
              >
                <option>Excellent</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor</option>
              </select>
            </label>

            <label>
              Notes <span className="sleep-optional">(optional)</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="e.g. Late dinner, woke up once..."
              />
            </label>

            <button className="primary-btn" type="submit" disabled={saving}>
              <Plus size={17} />
              {saving
                ? 'Saving...'
                : selectedRecord
                  ? 'Update sleep'
                  : 'Save sleep'}
            </button>
          </form>
        </section>

        <section className="panel sleep-history-panel">
          <div className="card-heading">
            <div>
              <h3>Recent sleep history</h3>
              <p>Your latest saved nights.</p>
            </div>
            <Clock3 size={19} color="#2dd4bf" />
          </div>

          {loading ? (
            <p className="form-note">Loading sleep history...</p>
          ) : recentRecords.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Moon size={25} /></span>
              <h3>No sleep records yet</h3>
              <p>Save your first night to start tracking your recovery.</p>
            </div>
          ) : (
            <div className="sleep-history-list">
              {recentRecords.map((record) => (
                <div className="sleep-history-row" key={record._id}>
                  <div className="sleep-history-icon">
                    <Moon size={18} />
                  </div>

                  <div className="sleep-history-info">
                    <strong>{formatDate(record.date)}</strong>
                    <span>
                      {record.bedtime} – {record.wakeTime}
                    </span>
                    <small>{record.quality} quality</small>
                  </div>

                  <div className="sleep-history-duration">
                    <strong>
                      {formatDuration(
                        getDuration(record.bedtime, record.wakeTime)
                      )}
                    </strong>
                    <button
                      type="button"
                      className="sleep-delete-btn"
                      title="Delete record"
                      aria-label={`Delete sleep record for ${record.date}`}
                      onClick={() => deleteSleep(record)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <p className="sleep-disclaimer">
        Sleep duration is calculated from the bedtime and wake-up times you
        enter. This tracker provides personal logging, not a medical assessment.
      </p>
    </div>
  );
}
