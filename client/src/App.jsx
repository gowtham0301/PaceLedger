

import { useEffect, useState } from 'react'
import ImportData from './ImportData.jsx'
import ActivityPage from './ActivityPage.jsx'
import WorkoutsPage from './WorkoutsPage.jsx'
import NutritionPage from "./NutritionPage";
import SleepPage from './SleepPage.jsx';
import WeightGoalsPage from './WeightGoalsPage.jsx';
import AnalyticsPage from './AnalyticsPage.jsx'
import CalendarPage from './CalendarPage.jsx'
import ReportsPage from './ReportsPage.jsx'
import {
    Activity, LayoutDashboard, Dumbbell, Utensils, Moon,
    Scale, ChartNoAxesCombined, CalendarDays, FileText, Settings,
    Bell, Search, Flame, Footprints, Clock3, Target,
    TrendingUp, ChevronDown, Plus, ArrowUpRight, ArrowDownRight,
    HeartPulse, Droplets, Zap, Menu, X
} from 'lucide-react'
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, BarChart, Bar
} from 'recharts'


const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Activity', icon: Activity },
    { label: 'Workouts', icon: Dumbbell },
    { label: 'Nutrition', icon: Utensils },
    { label: 'Sleep', icon: Moon },
    { label: 'Weight & Goals', icon: Scale },
    { label: 'Analytics', icon: ChartNoAxesCombined },
    { label: 'Calendar', icon: CalendarDays },

    { label: 'Import Data', icon: FileText },

    { label: 'Reports', icon: FileText },
    { label: 'Settings', icon: Settings },
]

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

function localDateKey(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString('en-IN')
}

function formatRecordDate(value) {
    if (!value) return 'Unknown date'
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
    })
}

function Card({ children, className = '' }) {
    return <section className={`panel ${className}`}>{children}</section>
}

function SectionHeading({ title, subtitle, action }) {
    return (
        <div className="section-heading">
            <div>
                <h2>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {action}
        </div>
    )
}

function MetricCard({ icon: Icon, label, value, unit, change, positive = true, color, progress }) {
    return (
        <Card className="metric-card">
            <div className="metric-top">
                <span className={`metric-icon ${color}`}><Icon size={19} /></span>
                <span className={`trend ${positive ? 'good' : 'bad'}`}>
                    {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {change}
                </span>
            </div>
            <p className="metric-label">{label}</p>
            <div className="metric-value">{value}<span>{unit}</span></div>
            {progress !== undefined && (
                <div className="progress-track"><div className={`progress-fill ${color}`} style={{ width: `${progress}%` }} /></div>
            )}
        </Card>
    )
}

function Dashboard({ setPage }) {
    const [period, setPeriod] = useState('Week')
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    useEffect(() => {
        let cancelled = false
        async function loadRecords() {
            try {
                setLoadError('')
                const response = await fetch(`${API_URL}/fitness`)
                if (!response.ok) throw new Error(`API returned ${response.status}`)
                const data = await response.json()
                if (!cancelled) setRecords(Array.isArray(data) ? data : [])
            } catch (error) {
                console.error('Could not load dashboard fitness records:', error)
                if (!cancelled) setLoadError('Could not load saved fitness data. Check that the PaceLedger backend is running.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        loadRecords()
        return () => { cancelled = true }
    }, [])

    const todayKey = localDateKey()
    const today = records.find(record => record.date === todayKey)
    const latestRecord = records[0]
    const steps = Number(today?.steps || 0)
    const activeCalories = Number(today?.calories || 0)
    const exerciseMinutes = Number(today?.exerciseMinutes || 0)
    const distance = Number.parseFloat(today?.distance || 0) || 0
    const stepGoal = 10000
    const calorieGoal = 600
    const exerciseGoal = 60
    const stepProgress = Math.min(100, Math.round(steps / stepGoal * 100))
    const calorieProgress = Math.min(100, Math.round(activeCalories / calorieGoal * 100))
    const exerciseProgress = Math.min(100, Math.round(exerciseMinutes / exerciseGoal * 100))

    const daysToShow = period === 'Week' ? 7 : 30
    const chartData = Array.from({ length: daysToShow }, (_, index) => {
        const date = new Date()
        date.setHours(12, 0, 0, 0)
        date.setDate(date.getDate() - (daysToShow - 1 - index))
        const key = localDateKey(date)
        const record = records.find(item => item.date === key)
        return {
            day: period === 'Week'
                ? date.toLocaleDateString('en-US', { weekday: 'short' })
                : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
            steps: Number(record?.steps || 0),
            calories: Number(record?.calories || 0),
        }
    })
    const recordedDays = chartData.filter(day => day.steps > 0 || day.calories > 0)
    const averageSteps = recordedDays.length
        ? Math.round(recordedDays.reduce((sum, day) => sum + day.steps, 0) / recordedDays.length)
        : 0
    const totalCalories = recordedDays.reduce((sum, day) => sum + day.calories, 0)

    return (
        <>
            <div className="welcome-row">
                <div>
                    <div className="eyebrow">PACELEDGER / YOUR DAILY OVERVIEW</div>
                    <h1>Good afternoon <span>👋</span></h1>
                    <p>{today ? 'Here is the activity you imported for today.' : latestRecord ? `No activity imported for today yet. Latest record: ${formatRecordDate(latestRecord.date)}.` : 'Import an Apple Health screenshot to start building your fitness history.'}</p>
                </div>
                <button className="primary-btn" onClick={() => setPage('Import Data')}>
                    <Plus size={17} /> Import activity
                </button>
            </div>

            {loadError && <div className="notice" role="alert">{loadError}</div>}
            {loading && <p className="form-note">Loading your saved fitness records…</p>}

            <div className="metrics-grid">
                <MetricCard icon={Footprints} label="Steps today" value={formatNumber(steps)} unit={`/ ${formatNumber(stepGoal)}`} change={today ? `${stepProgress}% of goal` : 'No record today'} color="teal" progress={stepProgress} />
                <MetricCard icon={Flame} label="Active calories" value={formatNumber(activeCalories)} unit=" kcal" change={today ? `${calorieProgress}% of goal` : 'No record today'} color="orange" progress={calorieProgress} />
                <MetricCard icon={Clock3} label="Exercise minutes" value={formatNumber(exerciseMinutes)} unit=" min" change={today ? `${exerciseProgress}% of goal` : 'Not recorded'} color="blue" progress={exerciseProgress} />
                <MetricCard icon={Activity} label="Distance today" value={distance.toLocaleString('en-IN', { maximumFractionDigits: 2 })} unit={today?.distance ? ' (as shown)' : ''} change={today ? 'Imported' : 'No record today'} color="pink" />
            </div>

            <div className="main-grid">
                <Card>
                    <div className="card-heading">
                        <div><h3>Activity overview</h3><p>Steps from your saved imports</p></div>
                        <select value={period} onChange={e => setPeriod(e.target.value)} className="dark-select">
                            <option>Week</option><option>Month</option>
                        </select>
                    </div>
                    <div className="chart-legend"><span><i className="dot teal-dot" /> Steps</span><span className="legend-muted">Only imported days contain values</span></div>
                    <div className="chart-area">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs><linearGradient id="stepsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.24} /><stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} /></linearGradient></defs>
                                <CartesianGrid stroke="#202b3e" vertical={false} />
                                <XAxis dataKey="day" interval={period === 'Month' ? 4 : 0} tick={{ fill: '#8491a7', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
                                <Tooltip contentStyle={{ background: '#151f30', border: '1px solid #2b394d', borderRadius: 10, color: '#e5edf7' }} formatter={(value) => [formatNumber(value), 'Steps']} />
                                <Area type="monotone" dataKey="steps" stroke="#2dd4bf" strokeWidth={2.5} fill="url(#stepsGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="chart-footer"><span>Average on recorded days</span><strong>{formatNumber(averageSteps)} <small>steps/day</small></strong></div>
                </Card>

                <Card>
                    <div className="card-heading"><div><h3>Daily goals</h3><p>{today ? 'Progress based on today’s imported record' : 'Progress will appear when you import today’s data'}</p></div><Target size={19} color="#2dd4bf" /></div>
                    <div className="goal-ring-wrap">
                        <div className="goal-ring" style={{ background: `conic-gradient(#2dd4bf 0% ${stepProgress}%, #263448 ${stepProgress}% 100%)` }}><div><strong>{stepProgress}%</strong><span>steps completed</span></div></div>
                    </div>
                    <div className="goal-list">
                        <div className="goal-row"><span className="goal-symbol teal"><Footprints size={16} /></span><div><strong>Steps</strong><small>{formatNumber(steps)} / {formatNumber(stepGoal)}</small></div><span className="goal-percent">{stepProgress}%</span></div>
                        <div className="goal-row"><span className="goal-symbol orange"><Flame size={16} /></span><div><strong>Active calories</strong><small>{formatNumber(activeCalories)} / {formatNumber(calorieGoal)} kcal</small></div><span className="goal-percent">{calorieProgress}%</span></div>
                        <div className="goal-row"><span className="goal-symbol blue"><Clock3 size={16} /></span><div><strong>Exercise</strong><small>{formatNumber(exerciseMinutes)} / {exerciseGoal} minutes</small></div><span className="goal-percent">{exerciseProgress}%</span></div>
                    </div>
                    <button className="text-btn full-btn" onClick={() => setPage('Weight & Goals')}>Manage goals <ArrowUpRight size={15} /></button>
                </Card>
            </div>

            <div className="main-grid lower-grid">
                <Card>
                    <div className="card-heading"><div><h3>Recent imported activity</h3><p>Latest records saved in MongoDB</p></div><button className="text-btn" onClick={() => setPage('Import Data')}>View imports <ArrowUpRight size={15} /></button></div>
                    <div className="workout-list">
                        {records.slice(0, 4).map((record, index) => (
                            <div className="workout-row" key={record._id || record.date}>
                                <span className={`workout-icon wc-${index % 3}`}><Footprints size={19} /></span>
                                <div className="workout-info"><strong>{formatRecordDate(record.date)}</strong><small>Apple Health screenshot</small><small className="workout-date">{record.screenshots?.length || 0} screenshot(s)</small></div>
                                <div className="workout-stats"><strong>{formatNumber(record.steps)} steps</strong><small>{formatNumber(record.calories)} active kcal</small></div>
                            </div>
                        ))}
                        {!loading && records.length === 0 && <div className="empty-state"><span className="empty-icon"><Activity size={25} /></span><h3>No imported activity yet</h3><p>Your confirmed Apple Health records will appear here.</p><button className="primary-btn" onClick={() => setPage('Import Data')}><Plus size={16} /> Import your first record</button></div>}
                    </div>
                </Card>

                <Card>
                    <div className="card-heading"><div><h3>Active calories</h3><p>Calories from saved records in this {period.toLowerCase()}</p></div><Flame size={19} color="#fb923c" /></div>
                    <div className="chart-area small-chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barSize={19}>
                                <CartesianGrid stroke="#202b3e" vertical={false} />
                                <XAxis dataKey="day" interval={period === 'Month' ? 4 : 0} tick={{ fill: '#8491a7', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: '#151f30', border: '1px solid #2b394d', borderRadius: 10, color: '#e5edf7' }} formatter={(value) => [`${formatNumber(value)} kcal`, 'Active calories']} />
                                <Bar dataKey="calories" fill="#fb923c" radius={[5, 5, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="calorie-total"><span>Active calories on recorded days</span><strong>{formatNumber(totalCalories)} <small>kcal</small></strong></div>
                </Card>
            </div>
        </>
    )
}

function GenericPage({ page, setPage }) {
    const descriptions = {
        Activity: ['Activity tracking', 'Track your daily movement, steps and active minutes.'],
        Workouts: ['Workout history', 'Review your training sessions and record new workouts.'],
        Nutrition: ['Nutrition journal', 'Keep track of your meals, calories and hydration.'],
        Sleep: ['Sleep insights', 'Understand your sleep duration and recovery patterns.'],
        'Weight & Goals': ['Weight & goals', 'Track progress and set realistic fitness targets.'],
        Analytics: ['Your analytics', 'Discover trends in your activity and fitness data.'],
        Calendar: ['Fitness calendar', 'Review your activity and workout schedule.'],

        'Import Data': [
            'Import your fitness data',
            'Upload Apple Health screenshots and review extracted metrics before importing.'
        ],

        Reports: ['Reports & exports', 'Prepare summaries of your fitness progress.'],

        Settings: ['Settings', 'Manage your profile and application preferences.'],
    }

    const [search, setSearch] = useState('')
    const [notice, setNotice] = useState('')
    const [entries, setEntries] = useState([])
    const [formOpen, setFormOpen] = useState(false)
    const [entryName, setEntryName] = useState('')
    const [entryValue, setEntryValue] = useState('')

    const [title, subtitle] = descriptions[page] || descriptions.Activity
    const isSettings = page === 'Settings'
    const isReports = page === 'Reports'
    const isCalendar = page === 'Calendar'

    function addEntry(e) {
        e.preventDefault()
        if (!entryName.trim()) return
        setEntries(old => [...old, { name: entryName, value: entryValue || 'Logged', date: new Date().toLocaleDateString() }])
        setEntryName('')
        setEntryValue('')
        setFormOpen(false)
        setNotice('Entry added for this session.')
    }

    function exportCSV() {
        const rows = [['Name', 'Value', 'Date'], ...entries.map(x => [x.name, x.value, x.date])]
        const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `paceledger-${page.toLowerCase().replaceAll(' ', '-')}.csv`
        a.click()
        URL.revokeObjectURL(url)
        setNotice('CSV export generated.')
    }

    return (
        <>
            <div className="welcome-row">
                <div><div className="eyebrow">PACELEDGER / {page.toUpperCase()}</div><h1>{title}</h1><p>{subtitle}</p></div>
                {!isSettings && !isReports && <button className="primary-btn" onClick={() => setFormOpen(!formOpen)}><Plus size={17} /> Add entry</button>}
            </div>

            {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}

            {formOpen && (
                <Card className="entry-form-card">
                    <form onSubmit={addEntry}>
                        <label>Entry name<input value={entryName} onChange={e => setEntryName(e.target.value)} placeholder={`e.g. ${page === 'Activity' ? 'Morning walk' : page === 'Nutrition' ? 'Lunch' : 'Daily progress'}`} required /></label>
                        <label>Details / value<input value={entryValue} onChange={e => setEntryValue(e.target.value)} placeholder="e.g. 30 minutes or 250 kcal" /></label>
                        <button className="primary-btn" type="submit">Save entry</button>
                    </form>
                    <p className="form-note">Prototype only: entries are kept in the current page session, not in a database yet.</p>
                </Card>
            )}

            {isSettings ? (
                <Card>
                    <h3>Profile preferences</h3>
                    <p className="muted-text">Personalize your PaceLedger experience.</p>
                    <form className="settings-form" onSubmit={e => { e.preventDefault(); setNotice('Settings saved for this session.') }}>
                        <label>Display name<input defaultValue="Fitness Explorer" /></label>
                        <label>Email address<input type="email" placeholder="you@example.com" /></label>
                        <label>Daily step goal<input type="number" defaultValue="10000" min="1000" step="500" /></label>
                        <label>Preferred units<select defaultValue="Metric"><option>Metric</option><option>Imperial</option></select></label>
                        <button className="primary-btn" type="submit">Save preferences</button>
                    </form>
                </Card>
            ) : isReports ? (
                <Card>
                    <h3>Export your data</h3><p className="muted-text">Download entries you add in this session as a CSV file.</p>
                    <button className="primary-btn" onClick={exportCSV}><FileText size={17} /> Export CSV</button>
                </Card>
            ) : isCalendar ? (
                <Card>
                    <h3>October 2026</h3>
                    <div className="calendar-grid">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span className="calendar-day-label" key={`${d}${i}`}>{d}</span>)}{Array.from({ length: 35 }, (_, i) => { const day = i - 3; return <button key={i} className={`calendar-cell ${day === 13 ? 'today' : day < 1 || day > 31 ? 'outside' : ''}`} onClick={() => day > 0 && day <= 31 && setNotice(`October ${day}, 2026 selected.`)}>{day > 0 && day <= 31 ? day : ''}</button> })}</div>
                    <p className="form-note">Calendar entries are a visual prototype for now.</p>
                </Card>
            ) : (
                <>
                    <div className="metrics-grid generic-metrics">
                        <MetricCard icon={Activity} label="Entries this session" value={String(entries.length)} unit="" change="Live" color="teal" />
                        <MetricCard icon={Target} label="Daily goal" value="10,000" unit=" steps" change="Configured" color="blue" />
                        <MetricCard icon={Zap} label="Progress" value={entries.length ? 'Active' : 'Ready'} unit="" change="Session" color="orange" />
                        <MetricCard icon={TrendingUp} label="Trend" value="—" unit="" change="Collect data" color="pink" />
                    </div>
                    <Card>
                        <div className="card-heading"><div><h3>{page} entries</h3><p>Your recently added records</p></div><div className="search-box"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries" /></div></div>
                        {entries.filter(x => x.name.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                            <div className="empty-state"><span className="empty-icon"><Activity size={25} /></span><h3>No entries yet</h3><p>Add your first record to start building your {page.toLowerCase()} history.</p><button className="primary-btn" onClick={() => setFormOpen(true)}><Plus size={16} /> Add your first entry</button></div>
                        ) : entries.filter(x => x.name.toLowerCase().includes(search.toLowerCase())).map((x, i) => <div className="entry-row" key={`${x.name}-${i}`}><div><strong>{x.name}</strong><small>{x.date}</small></div><span>{x.value}</span></div>)}
                    </Card>
                    <button className="text-btn back-dashboard" onClick={() => setPage('Dashboard')}>← Back to dashboard</button>
                </>
            )}
        </>
    )
}

export default function App() {
    const [page, setPage] = useState('Dashboard')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const currentDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

    return (
        <div className="app-shell">
            {sidebarOpen && <button className="mobile-overlay" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
            <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
                <div className="brand"><span className="brand-mark"><Activity size={23} /></span><span>Pace<span>Ledger</span><small>FITNESS ANALYTICS</small></span><button className="close-sidebar" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
                <div className="workspace-label">WORKSPACE</div>
                <nav className="nav-list">
                    {navItems.map(item => {
                        const Icon = item.icon
                        return <button key={item.label} className={`nav-item ${page === item.label ? 'active' : ''}`} onClick={() => { setPage(item.label); setSidebarOpen(false) }}>
                            <Icon size={18} /><span>{item.label}</span>{item.label === 'Dashboard' && <span className="nav-live" />}
                        </button>
                    })}
                </nav>
                <div className="sidebar-bottom">
                    <div className="upgrade-card"><span className="upgrade-icon"><Zap size={17} /></span><strong>Your journey, your data.</strong><p>Small steps create lasting change.</p><button onClick={() => { setPage('Analytics'); setSidebarOpen(false) }}>Explore analytics <ArrowUpRight size={14} /></button></div>
                    <button className="user-profile" onClick={() => setPage('Settings')}><span className="avatar">G</span><span className="user-text"><strong>Fitness Explorer</strong><small>Personal account</small></span><ChevronDown size={16} /></button>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
                    <div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div>
                    <div className="topbar-right"><div className="date-chip"><CalendarDays size={15} />{currentDate}</div><button className="icon-btn" aria-label="Notifications" onClick={() => alert('You are all caught up!')}><Bell size={18} /><i /></button><span className="top-avatar">G</span></div>
                </header>
                <div className="page-content">
                    {page === 'Dashboard' ? (
                        <Dashboard setPage={setPage} />
                    ) : page === 'Import Data' ? (
                        <ImportData />
                    ) : page === 'Activity' ? (
                        <ActivityPage setPage={setPage} />
                    ) : page === 'Workouts' ? (
                        <WorkoutsPage />
                    ) : page === 'Nutrition' ? (
                        <NutritionPage />
                    ) : page === 'Sleep' ? (
                        <SleepPage />
                    ) : page === 'Weight & Goals' ? (
                        <WeightGoalsPage />
                    ) : page === 'Analytics' ? (
                        <AnalyticsPage />
                    ) : page === 'Calendar' ? (
                        <CalendarPage />
                    ) : page === 'Reports' ? (
                        <ReportsPage />
                    ) : (
                        <GenericPage key={page} page={page} setPage={setPage} />
                    )}
                    <footer className="app-footer"><span>© 2026 PaceLedger</span><span>Built for progress, not perfection <span className="footer-heart">♥</span></span></footer>
                </div>
            </main>
        </div>
    )
}
