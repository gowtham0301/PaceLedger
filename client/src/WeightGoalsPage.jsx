
import { useEffect, useMemo, useState } from 'react';
import {
  Scale, Target, TrendingDown, TrendingUp, Plus,
  Trash2, RefreshCw, CalendarDays, Save, Flag,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import './WeightGoalsPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function number(value, digits = 1) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: digits,
  });
}

export default function WeightGoalsPage() {
  const today = todayKey();

  const [records, setRecords] = useState([]);
  const [goals, setGoals] = useState({
    startingWeight: '',
    goalWeight: '',
    height: '',
    targetDate: '',
  });
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingWeight, setSavingWeight] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [recordsResponse, goalsResponse] = await Promise.all([
        fetch(`${API_URL}/weight`),
        fetch(`${API_URL}/weight/goals`),
      ]);

      if (!recordsResponse.ok || !goalsResponse.ok) {
        throw new Error('Could not load weight and goal data.');
      }

      const [recordsData, goalsData] = await Promise.all([
        recordsResponse.json(),
        goalsResponse.json(),
      ]);

      const sorted = (Array.isArray(recordsData) ? recordsData : [])
        .sort((a, b) => b.date.localeCompare(a.date));

      setRecords(sorted);

      if (goalsData) {
        setGoals({
          startingWeight: goalsData.startingWeight ?? '',
          goalWeight: goalsData.goalWeight ?? '',
          height: goalsData.height ?? '',
          targetDate: goalsData.targetDate ?? '',
        });
      }
    } catch (err) {
      setError(err.message || 'Could not connect to the weight API.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedRecord = records.find((record) => record.date === date);

  useEffect(() => {
    setWeight(selectedRecord ? String(selectedRecord.weight) : '');
    setNotes(selectedRecord?.notes || '');
  }, [selectedRecord?._id, date]);

  const ascendingRecords = useMemo(
    () => [...records].sort((a, b) => a.date.localeCompare(b.date)),
    [records]
  );

  const latestRecord = ascendingRecords.at(-1);
  const firstRecord = ascendingRecords[0];
  const currentWeight = latestRecord ? Number(latestRecord.weight) : null;
  const startingWeight = Number(goals.startingWeight || firstRecord?.weight || 0);
  const goalWeight = Number(goals.goalWeight || 0);
  const weightChange =
    firstRecord && latestRecord
      ? Number(latestRecord.weight) - Number(firstRecord.weight)
      : 0;

  const remaining =
    currentWeight !== null && goalWeight > 0
      ? currentWeight - goalWeight
      : null;

  const goalProgress =
    startingWeight > 0 && goalWeight > 0 && currentWeight !== null &&
    startingWeight !== goalWeight
      ? Math.max(
          0,
          Math.min(
            100,
            ((startingWeight - currentWeight) /
              (startingWeight - goalWeight)) * 100
          )
        )
      : 0;

  const chartData = ascendingRecords.map((record) => ({
    date: record.date,
    label: new Date(`${record.date}T12:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    }),
    weight: Number(record.weight),
  }));

  async function saveWeight(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSavingWeight(true);

    try {
      const response = await fetch(`${API_URL}/weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          weight: Number(weight),
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not save weight.');
      }

      setNotice('Weight record saved successfully.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not save weight.');
    } finally {
      setSavingWeight(false);
    }
  }

  async function saveGoals(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSavingGoals(true);

    try {
      const response = await fetch(`${API_URL}/weight/goals`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startingWeight: goals.startingWeight === '' ? null : Number(goals.startingWeight),
          goalWeight: goals.goalWeight === '' ? null : Number(goals.goalWeight),
          height: goals.height === '' ? null : Number(goals.height),
          targetDate: goals.targetDate || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not save goals.');
      }

      setGoals({
        startingWeight: data.startingWeight ?? '',
        goalWeight: data.goalWeight ?? '',
        height: data.height ?? '',
        targetDate: data.targetDate ?? '',
      });

      setNotice('Weight goals saved successfully.');
    } catch (err) {
      setError(err.message || 'Could not save goals.');
    } finally {
      setSavingGoals(false);
    }
  }

  async function deleteRecord(record) {
    if (!window.confirm(`Delete the weight record for ${record.date}?`)) return;

    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/weight/${record._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not delete the record.');
      }

      setNotice('Weight record deleted.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not delete the record.');
    }
  }

  return (
    <div className="weight-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">PACELEDGER / PROGRESS</div>
          <h1>Weight <span>& Goals ⚖️</span></h1>
          <p>Track your trend, set a target, and measure progress over time.</p>
        </div>

        <button className="secondary-btn" type="button" onClick={loadData}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="notice" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      {loading && <p className="form-note">Loading your saved records...</p>}

      <div className="metrics-grid">
        <section className="panel metric-card">
          <div className="metric-top">
            <span className="metric-icon teal"><Scale size={19} /></span>
          </div>
          <p className="metric-label">Latest weight</p>
          <div className="metric-value">
            {currentWeight === null ? '—' : number(currentWeight)}
            <span> kg</span>
          </div>
          <p className="weight-metric-note">
            {latestRecord ? formatDate(latestRecord.date) : 'Log your first measurement'}
          </p>
        </section>

        <section className="panel metric-card">
          <div className="metric-top">
            <span className={`metric-icon ${weightChange <= 0 ? 'teal' : 'orange'}`}>
              {weightChange <= 0 ? <TrendingDown size={19} /> : <TrendingUp size={19} />}
            </span>
          </div>
          <p className="metric-label">Change since first record</p>
          <div className="metric-value">
            {records.length > 1 ? `${weightChange > 0 ? '+' : ''}${number(weightChange)}` : '—'}
            <span> kg</span>
          </div>
          <p className="weight-metric-note">Based on your saved history</p>
        </section>

        <section className="panel metric-card">
          <div className="metric-top">
            <span className="metric-icon blue"><Target size={19} /></span>
          </div>
          <p className="metric-label">Target weight</p>
          <div className="metric-value">
            {goalWeight > 0 ? number(goalWeight) : '—'}
            <span> kg</span>
          </div>
          <p className="weight-metric-note">
            {remaining === null
              ? 'Set your goal below'
              : remaining === 0
                ? 'Target reached'
                : `${number(Math.abs(remaining))} kg ${remaining > 0 ? 'to target' : 'below target'}`}
          </p>
        </section>
      </div>

      <div className="weight-layout">
        <section className="panel weight-chart-panel">
          <div className="card-heading">
            <div>
              <h3>Weight trend</h3>
              <p>Your saved measurements over time</p>
            </div>
            <TrendingDown size={20} color="#2dd4bf" />
          </div>

          {chartData.length < 1 ? (
            <div className="empty-state">
              <span className="empty-icon"><Scale size={25} /></span>
              <h3>No weight history yet</h3>
              <p>Save your first measurement to see your trend.</p>
            </div>
          ) : (
            <div className="weight-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#202b3e" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#8491a7', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={['dataMin - 2', 'dataMax + 2']}
                    tick={{ fill: '#8491a7', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#151f30',
                      border: '1px solid #2b394d',
                      borderRadius: 10,
                      color: '#e5edf7',
                    }}
                    formatter={(value) => [`${number(value)} kg`, 'Weight']}
                    labelFormatter={(label) => label}
                  />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="#2dd4bf"
                    strokeWidth={2.5}
                    fill="url(#weightGradient)"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="weight-chart-footer">
            <span>{records.length} measurement(s) saved</span>
            <span>Weight is recorded in kilograms</span>
          </div>
        </section>

        <section className="panel weight-form-panel">
          <div className="card-heading">
            <div>
              <h3>{selectedRecord ? 'Update weight' : 'Log weight'}</h3>
              <p>Use consistent conditions for more useful comparisons.</p>
            </div>
            <Scale size={20} color="#2dd4bf" />
          </div>

          <form className="weight-form" onSubmit={saveWeight}>
            <label>
              Measurement date
              <input
                type="date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>

            <label>
              Weight (kg)
              <input
                type="number"
                min="20"
                max="400"
                step="0.1"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="e.g. 97.2"
                required
              />
            </label>

            <label>
              Notes <span className="weight-optional">(optional)</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="e.g. Morning measurement"
              />
            </label>

            <button className="primary-btn" type="submit" disabled={savingWeight}>
              <Plus size={16} />
              {savingWeight ? 'Saving...' : selectedRecord ? 'Update measurement' : 'Save weight'}
            </button>
          </form>
        </section>
      </div>

      <section className="panel weight-goals-panel">
        <div className="card-heading">
          <div>
            <h3>Your weight goal</h3>
            <p>Save your starting point, target, and optional target date.</p>
          </div>
          <Flag size={20} color="#a78bfa" />
        </div>

        <form className="weight-goals-form" onSubmit={saveGoals}>
          <label>
            Starting weight (kg)
            <input
              type="number"
              min="20"
              max="400"
              step="0.1"
              value={goals.startingWeight}
              onChange={(event) => setGoals({ ...goals, startingWeight: event.target.value })}
              placeholder={firstRecord ? String(firstRecord.weight) : 'e.g. 100'}
            />
          </label>

          <label>
            Target weight (kg)
            <input
              type="number"
              min="20"
              max="400"
              step="0.1"
              value={goals.goalWeight}
              onChange={(event) => setGoals({ ...goals, goalWeight: event.target.value })}
              placeholder="e.g. 85"
            />
          </label>

          <label>
            Height (cm)
            <input
              type="number"
              min="100"
              max="250"
              step="0.1"
              value={goals.height}
              onChange={(event) => setGoals({ ...goals, height: event.target.value })}
              placeholder="Optional"
            />
          </label>

          <label>
            Target date
            <input
              type="date"
              min={today}
              value={goals.targetDate}
              onChange={(event) => setGoals({ ...goals, targetDate: event.target.value })}
            />
          </label>

          <button className="primary-btn weight-goals-save" type="submit" disabled={savingGoals}>
            <Save size={16} /> {savingGoals ? 'Saving...' : 'Save goals'}
          </button>
        </form>

        {goalWeight > 0 && startingWeight > 0 && currentWeight !== null && (
          <div className="weight-goal-progress">
            <div className="weight-goal-progress-heading">
              <span>Progress from starting weight to target</span>
              <strong>{number(goalProgress, 0)}%</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill teal" style={{ width: `${goalProgress}%` }} />
            </div>
            <p>
              Starting: {number(startingWeight)} kg · Current: {number(currentWeight)} kg · Target: {number(goalWeight)} kg
            </p>
          </div>
        )}
      </section>

      <section className="panel weight-history-panel">
        <div className="card-heading">
          <div>
            <h3>Recent measurements</h3>
            <p>Choose a date to edit its measurement.</p>
          </div>
          <CalendarDays size={19} color="#2dd4bf" />
        </div>

        {records.length === 0 ? (
          <p className="form-note">Your saved measurements will appear here.</p>
        ) : (
          <div className="weight-history-list">
            {records.slice(0, 10).map((record) => (
              <div className="weight-history-row" key={record._id}>
                <div className="weight-history-symbol"><Scale size={17} /></div>
                <button
                  className="weight-history-date"
                  type="button"
                  onClick={() => setDate(record.date)}
                >
                  <strong>{formatDate(record.date)}</strong>
                  <small>{record.notes || 'Weight measurement'}</small>
                </button>
                <strong className="weight-history-value">{number(record.weight)} kg</strong>
                <button
                  className="weight-delete-btn"
                  type="button"
                  aria-label={`Delete measurement from ${record.date}`}
                  onClick={() => deleteRecord(record)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="weight-disclaimer">
        Weight can fluctuate from day to day. Use longer-term trends rather than one measurement to judge progress.
      </p>
    </div>
  );
}
