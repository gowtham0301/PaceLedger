
import { useEffect, useRef, useState } from 'react'
import {
    Upload, Image as ImageIcon, FileImage, X, Trash2,
    ScanText, CheckCircle2, ArrowRight, CalendarDays
} from 'lucide-react'

const emptyMetrics = {
    date: new Date().toISOString().slice(0, 10),
    steps: '',
    distance: '',
    calories: '',
    totalCalories: '',
    flightsClimbed: '',
    exerciseMinutes: '',
}

export default function ImportData() {
    const inputRef = useRef(null)
    const [files, setFiles] = useState([])
    const [stage, setStage] = useState('upload')
    const [busy, setBusy] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState('')
    const [metrics, setMetrics] = useState(emptyMetrics)
    const [rawText, setRawText] = useState('')
    const [history, setHistory] = useState([])

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
    const [loadingHistory, setLoadingHistory] = useState(true)

    useEffect(() => {
        async function loadHistory() {
            try {
                const response = await fetch(`${API_URL}/fitness`)
                if (!response.ok) throw new Error('Could not load saved records')

                const records = await response.json()
                setHistory(records)
            } catch (error) {
                console.error('Loading fitness history failed:', error)
                setError('Could not load saved records. Check that the backend is running.')
            } finally {
                setLoadingHistory(false)
            }
        }

        loadHistory()
    }, [])

    function addFiles(fileList) {
        const accepted = Array.from(fileList).filter(file =>
            file.type.startsWith('image/')
        )
        if (!accepted.length) {
            setError('Please select PNG, JPG, or another supported image file.')
            return
        }

        setError('')
        const additions = accepted.map(file => ({
            id: `${file.name}-${file.lastModified}-${Math.random()}`,
            file,
            preview: URL.createObjectURL(file),
        }))
        setFiles(previous => [...previous, ...additions])
    }

    function removeFile(id) {
        setFiles(previous => {
            const removed = previous.find(file => file.id === id)
            if (removed) URL.revokeObjectURL(removed.preview)
            return previous.filter(file => file.id !== id)
        })
    }

    async function scanScreenshot(file) {
        const { default: Tesseract } = await import('tesseract.js')
        const result = await Tesseract.recognize(file, 'eng', {
            logger: message => {
                if (message.status === 'recognizing text') {
                    setProgress(Math.round((message.progress || 0) * 100))
                }
            },
        })
        return result.data.text
    }

    function parseMetrics(text) {
        const normalized = text
            .replace(/\r/g, '\n')
            .replace(/[ \t]+/g, ' ')
            .replace(/(\d)\s*,\s*(\d)/g, '$1,$2')

        const lines = normalized
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)

        const number = value => {
            if (!value) return ''
            const match = value.match(/\d[\d,]*(?:\.\d+)?/)
            return match ? match[0].replace(/,/g, '') : ''
        }

        const valueAfterLabel = (labels, options = {}) => {
            const labelPattern = new RegExp(labels, 'i')

            for (let i = 0; i < lines.length; i++) {
                if (!labelPattern.test(lines[i])) continue

                const sameLine = lines[i].replace(labelPattern, ' ')
                const inline = number(sameLine)

                if (inline && (!options.rejectGoal || !sameLine.includes('/'))) {
                    return inline
                }

                for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                    const candidate = lines[j]

                    if (/^(steps?|distance|move|exercise|flights climbed|total calories)/i.test(candidate)) {
                        break
                    }

                    const found = number(candidate)
                    if (found) return found
                }
            }

            return ''
        }

        let steps = ''
        let distance = ''

        for (let i = 0; i < lines.length; i++) {
            if (/steps?\s+distance/i.test(lines[i])) {
                const sameLine = lines[i].replace(/steps?\s+distance/i, '')
                const nextLine = lines.slice(i + 1, i + 4).join(' ')

                const values = (sameLine + ' ' + nextLine).match(
                    /\d[\d,]*(?:\.\d+)?/g
                ) || []

                if (values.length >= 2) {
                    steps = number(values[0])
                    distance = number(values[1])
                }
                break
            }
        }

        if (!steps) {
            steps = valueAfterLabel('\\bSteps?\\b')
        }

        if (!distance) {
            const match = normalized.match(
                /(\d+(?:\.\d+)?)\s*(?:km|kilometers?|mi|miles?)\b/i
            )
            distance = match ? match[1] : valueAfterLabel('\\bDistance\\b')
        }

        let activeCalories = ''
        const moveMatch = normalized.match(
            /\bMove\b[\s\S]{0,100}?(\d[\d,]*)\s*\/\s*\d[\d,]*\s*(?:kcal|cal)\b/i
        )

        if (moveMatch) {
            activeCalories = number(moveMatch[1])
        } else {
            activeCalories = valueAfterLabel(
                '\\b(?:Active Energy|Active Calories)\\b'
            )
        }

        const totalMatch = normalized.match(
            /\bTOTAL\s+([\d,]+)\s*(?:KCAL|CALORIES)\b/i
        )

        const flightsMatch = normalized.match(
            /\bFlights?\s+Climbed\b[\s\S]{0,40}?(\d[\d,]*)/i
        )

        let date = ''
        const dateMatch = normalized.match(
            /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,]?\s*(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i
        )

        if (dateMatch) {
            const monthIndex = new Date(`${dateMatch[2]} 1, 2000`).getMonth()
            date = `${dateMatch[3]}-${String(monthIndex + 1).padStart(2, '0')}-${String(Number(dateMatch[1])).padStart(2, '0')}`
        }

        const exerciseMinutes = valueAfterLabel(
            '\\bExercise\\b',
            { rejectGoal: true }
        )

        return {
            date,
            steps,
            distance,
            calories: activeCalories,
            totalCalories: totalMatch ? number(totalMatch[1]) : '',
            flightsClimbed: flightsMatch ? number(flightsMatch[1]) : '',
            exerciseMinutes,
        }
    }

    async function startScan() {
        if (!files.length) return
        setBusy(true)
        setError('')
        setProgress(0)
        setRawText('')
        try {
            let combinedText = ''
            for (const item of files) {
                combinedText += `\n${await scanScreenshot(item.file)}\n`
            }
            setRawText(combinedText)
            setMetrics(parseMetrics(combinedText))
            setStage('review')
        } catch (e) {
            setError('Could not read one of the images. Try a clearer screenshot.')
            console.error(e)
        } finally {
            setBusy(false)
            setProgress(0)
        }
    }

    function updateMetric(key, value) {
        setMetrics(previous => ({ ...previous, [key]: value }))
    }

    async function saveImport() {
        if (!metrics.date) {
            setError('Please select the activity date.')
            return
        }

        const numericFields = [
            'steps',
            'calories',
            'totalCalories',
            'flightsClimbed',
            'exerciseMinutes',
        ]

        for (const key of numericFields) {
            const value = metrics[key]
            if (value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
                setError(`Please enter a valid non-negative value for ${key}.`)
                return
            }
        }

        try {
            setBusy(true)
            setError('')

            const response = await fetch(
                `${API_URL}/fitness/${encodeURIComponent(metrics.date)}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...metrics,
                        source: 'Apple Health screenshot',
                        screenshots: files.map(file => file.file.name),
                    }),
                }
            )

            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.message || 'Failed to save fitness record.')
            }

            setHistory(previous => [
                result.record,
                ...previous.filter(record => record.date !== result.record.date),
            ])

            setFiles(previous => {
                previous.forEach(file => URL.revokeObjectURL(file.preview))
                return []
            })

            setMetrics(emptyMetrics)
            setRawText('')
            setStage('upload')
        } catch (error) {
            setError(error.message || 'Could not save the record.')
        } finally {
            setBusy(false)
        }
    }

    function resetImport() {
        files.forEach(file => URL.revokeObjectURL(file.preview))
        setFiles([])
        setMetrics(emptyMetrics)
        setRawText('')
        setError('')
        setStage('upload')
    }

    return (
        <div className="import-page">
            <div className="import-intro">
                <div>
                    <div className="eyebrow">PACELEDGER / DATA IMPORT</div>
                    <h1>Import fitness data</h1>
                    <p>Turn your daily screenshots into a fitness history.</p>
                </div>
                <span className="import-badge"><ScanText size={15} /> OCR enabled</span>
            </div>

            <div className="import-steps">
                <div className={`import-step ${stage === 'upload' ? 'selected' : 'complete'}`}>
                    <span>1</span><div><strong>Upload</strong><small>Add screenshots</small></div>
                </div>
                <div className="step-line" />
                <div className={`import-step ${stage === 'review' ? 'selected' : ''}`}>
                    <span>2</span><div><strong>Review</strong><small>Verify extracted data</small></div>
                </div>
                <div className="step-line" />
                <div className="import-step"><span>3</span><div><strong>Import</strong><small>Confirm records</small></div></div>
            </div>

            {stage === 'upload' ? (
                <>
                    <div
                        className="drop-zone"
                        onDragOver={event => event.preventDefault()}
                        onDrop={event => {
                            event.preventDefault()
                            addFiles(event.dataTransfer.files)
                        }}
                    >
                        <div className="upload-symbol"><Upload size={28} /></div>
                        <h2>Drop your screenshots here</h2>
                        <p>Upload Apple Health screenshots, one image or multiple days at once.</p>
                        <button className="primary-btn" onClick={() => inputRef.current?.click()}>
                            <ImageIcon size={17} /> Choose images
                        </button>
                        <span className="upload-hint">PNG, JPG, WEBP · Multiple images supported</span>
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            hidden
                            onChange={event => {
                                addFiles(event.target.files)
                                event.target.value = ''
                            }}
                        />
                    </div>

                    {files.length > 0 && (
                        <section className="panel upload-files">
                            <div className="card-heading">
                                <div><h3>Selected screenshots ({files.length})</h3><p>Images queued for text extraction</p></div>
                                <button className="text-btn" onClick={resetImport}><Trash2 size={14} /> Clear all</button>
                            </div>
                            <div className="preview-grid">
                                {files.map(file => (
                                    <div className="preview-card" key={file.id}>
                                        <img src={file.preview} alt={file.file.name} />
                                        <div className="preview-meta"><FileImage size={14} /><span title={file.file.name}>{file.file.name}</span></div>
                                        <button className="remove-image" onClick={() => removeFile(file.id)} aria-label="Remove image"><X size={15} /></button>
                                    </div>
                                ))}
                            </div>
                            {busy && <div className="ocr-progress"><div style={{ width: `${progress}%` }} /><p>Reading screenshot text… {progress}%</p></div>}
                            <div className="upload-actions">
                                <span>{files.length} image{files.length !== 1 ? 's' : ''} ready</span>
                                <button className="primary-btn" disabled={busy} onClick={startScan}>
                                    <ScanText size={16} />{busy ? 'Scanning…' : 'Extract data'} <ArrowRight size={15} />
                                </button>
                            </div>
                        </section>
                    )}
                </>
            ) : (
                <section className="panel review-panel">
                    <div className="card-heading">
                        <div><h3>Review extracted metrics</h3><p>OCR can misread text. Check and correct every value before importing.</p></div>
                        <span className="review-icon"><CheckCircle2 size={20} /></span>
                    </div>
                    <div className="review-source"><ImageIcon size={16} />{files.length} screenshot(s) scanned</div>
                    <form onSubmit={event => { event.preventDefault(); saveImport() }}>
                        <div className="review-fields">
                            <label><span><CalendarDays size={14} /> Activity date</span><input type="date" value={metrics.date} onChange={e => updateMetric('date', e.target.value)} required /></label>
                            <label><span>Steps</span><input inputMode="numeric" value={metrics.steps} onChange={e => updateMetric('steps', e.target.value)} placeholder="e.g. 8432" /></label>
                            <label><span>Distance (as shown)</span><input value={metrics.distance} onChange={e => updateMetric('distance', e.target.value)} placeholder="e.g. 5.8 km" /></label>
                            <label><span>Active calories (kcal)</span><input inputMode="numeric" value={metrics.calories} onChange={e => updateMetric('calories', e.target.value)} placeholder="e.g. 426" /></label>
                            <label><span>Total calories (kcal)</span><input inputMode="numeric" value={metrics.totalCalories} onChange={e => updateMetric('totalCalories', e.target.value)} placeholder="e.g. 2567" /></label>
                            <label><span>Flights climbed</span><input inputMode="numeric" value={metrics.flightsClimbed} onChange={e => updateMetric('flightsClimbed', e.target.value)} placeholder="e.g. 5" /></label>
                            <label><span>Exercise minutes</span><input inputMode="numeric" value={metrics.exerciseMinutes} onChange={e => updateMetric('exerciseMinutes', e.target.value)} placeholder="e.g. 48" /></label>
                        </div>
                        {rawText && <details className="ocr-details"><summary>View text detected by OCR</summary><pre>{rawText}</pre></details>}
                        <div className="review-actions">
                            <button type="button" className="secondary-btn" onClick={() => setStage('upload')}>Back to screenshots</button>
                            <button type="submit" className="primary-btn"><CheckCircle2 size={16} /> Confirm import</button>
                        </div>
                    </form>
                </section>
            )}

            {error && <div className="notice">{error}<button onClick={() => setError('')}><X size={14} /></button></div>}

            <section className="panel imported-panel">
                <div className="card-heading"><div><h3>Saved fitness records</h3><p>Records loaded from your MongoDB database</p></div><span className="record-count">{history.length}</span></div>
                {loadingHistory && <p className="form-note">Loading saved records...</p>}
                {!loadingHistory && history.length === 0 ? (
                    <div className="empty-state compact-empty"><span className="empty-icon"><FileImage size={23} /></span><h3>No imports yet</h3><p>Your confirmed screenshot records will appear here.</p></div>
                ) : history.map(record => (
                    <div className="imported-record" key={record.id}>
                        <span className="record-icon"><CheckCircle2 size={18} /></span>
                        <div className="record-info"><strong>{record.date}</strong><small>{record.screenshots.length} screenshot(s) · {record.source}</small></div>
                        <div className="record-metrics">
                            {record.steps && <span>{Number(record.steps).toLocaleString()} steps</span>}
                            {record.calories && <span>{record.calories} kcal</span>}
                        </div>
                    </div>
                ))}
            </section>
        </div>
    )
}
