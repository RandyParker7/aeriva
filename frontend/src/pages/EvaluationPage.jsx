import { useEffect, useRef, useState } from 'react'
import {
  formatUtcDateTimeInWib,
  formatUtcTimeInWib,
  wibDateTimeToUtcIso,
} from '../utils/time'
import './EvaluationPage.css'

const metricDefinitions = [
  { key: 'mae', label: 'MAE', description: 'Mean Absolute Error' },
  { key: 'mape', label: 'MAPE', description: 'Mean Absolute Percentage Error' },
  { key: 'rmse', label: 'RMSE', description: 'Root Mean Squared Error' },
  { key: 'r2', label: 'R²', description: 'Koefisien determinasi' },
]

function formatMetric(value, key) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Tidak tersedia'
  }

  return `${value.toFixed(3)}${key === 'mape' ? '%' : ''}`
}

function getEvaluationInsights(result) {
  const scenarios = ['S1', 'S2']
  const insights = []
  const maeValues = Object.fromEntries(
    scenarios.map((scenario) => [scenario, result.metrics[scenario].mae]),
  )

  if (scenarios.every((scenario) => Number.isFinite(maeValues[scenario]))) {
    const [s1Mae, s2Mae] = [maeValues.S1, maeValues.S2]
    if (s1Mae === s2Mae) {
      insights.push({
        title: 'Kesalahan rata-rata',
        description: `MAE kedua skenario sama, yaitu ${s1Mae.toFixed(3)} dalam satuan ${result.pollutant}.`,
      })
    } else {
      const betterScenario = s1Mae < s2Mae ? 'S1' : 'S2'
      const otherScenario = betterScenario === 'S1' ? 'S2' : 'S1'
      const improvement = maeValues[otherScenario] > 0
        ? ((maeValues[otherScenario] - maeValues[betterScenario]) /
            maeValues[otherScenario]) *
          100
        : null
      insights.push({
        title: `MAE lebih rendah pada ${betterScenario}`,
        description: `Kesalahan absolut rata-rata ${betterScenario} sebesar ${maeValues[betterScenario].toFixed(3)}${improvement === null ? '' : `, sekitar ${improvement.toFixed(1)}% lebih rendah daripada ${otherScenario}`}.`,
      })
    }
  }

  const pointwiseCounts = { S1: 0, S2: 0, equal: 0 }
  result.points.forEach((point) => {
    const s1Error = Math.abs(point.actual - point.prediction_s1)
    const s2Error = Math.abs(point.actual - point.prediction_s2)
    if (!Number.isFinite(s1Error) || !Number.isFinite(s2Error)) {
      return
    }
    if (Math.abs(s1Error - s2Error) < 1e-9) {
      pointwiseCounts.equal += 1
    } else {
      pointwiseCounts[s1Error < s2Error ? 'S1' : 'S2'] += 1
    }
  })
  if (pointwiseCounts.S1 + pointwiseCounts.S2 + pointwiseCounts.equal > 0) {
    insights.push({
      title: 'Kedekatan prediksi per jam',
      description: `S1 lebih dekat ke data aktual pada ${pointwiseCounts.S1} jam, S2 pada ${pointwiseCounts.S2} jam${pointwiseCounts.equal ? `, dan sama dekat pada ${pointwiseCounts.equal} jam` : ''}.`,
    })
  }

  const averageErrors = Object.fromEntries(
    scenarios.map((scenario) => {
      const values = result.points
        .map((point) => point[`prediction_${scenario.toLowerCase()}`] - point.actual)
        .filter(Number.isFinite)
      return [
        scenario,
        values.length
          ? values.reduce((total, value) => total + value, 0) / values.length
          : null,
      ]
    }),
  )
  if (scenarios.some((scenario) => Number.isFinite(averageErrors[scenario]))) {
    const biasDescription = scenarios
      .filter((scenario) => Number.isFinite(averageErrors[scenario]))
      .map((scenario) => {
        const bias = averageErrors[scenario]
        const tendency = Math.abs(bias) < 0.0005
          ? 'mendekati seimbang'
          : bias > 0
            ? 'cenderung melebihkan'
            : 'cenderung merendahkan'
        return `${scenario} ${tendency} sebesar ${Math.abs(bias).toFixed(3)}`
      })
      .join('; ')
    insights.push({
      title: 'Arah kesalahan prediksi',
      description: `Rata-rata selisih prediksi dan aktual: ${biasDescription} dalam satuan ${result.pollutant}.`,
    })
  }

  const r2Values = Object.fromEntries(
    scenarios.map((scenario) => [scenario, result.metrics[scenario].r2]),
  )
  if (scenarios.every((scenario) => Number.isFinite(r2Values[scenario]))) {
    const betterScenario = r2Values.S1 === r2Values.S2
      ? null
      : r2Values.S1 > r2Values.S2
        ? 'S1'
        : 'S2'
    insights.push({
      title: 'Kesesuaian pola data',
      description: betterScenario
        ? `R² ${betterScenario} lebih tinggi (${r2Values[betterScenario].toFixed(3)}), sehingga lebih baik dalam menggambarkan variasi data aktual pada periode ini.${r2Values[betterScenario] < 0 ? ' Namun, nilai R² negatif menandakan performanya lebih buruk daripada pembanding rata-rata aktual.' : ''}`
        : `Nilai R² kedua skenario sama (${r2Values.S1.toFixed(3)}).`,
    })
  }

  return insights
}

function EvaluationChart({ points, pollutant }) {
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const width = 800
  const height = 320
  const left = 52
  const right = 20
  const top = 18
  const bottom = 48
  const chartWidth = width - left - right
  const chartHeight = height - top - bottom
  const values = points.flatMap((point) => [
    point.actual,
    point.prediction_s1,
    point.prediction_s2,
  ])
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const padding = dataMax === dataMin
    ? Math.max(Math.abs(dataMax) * 0.15, 3)
    : (dataMax - dataMin) * 0.3
  const minValue = dataMin - padding
  const maxValue = dataMax + padding
  const x = (index) => left + (index / (points.length - 1)) * chartWidth
  const y = (value) =>
    top + ((maxValue - value) / (maxValue - minValue)) * chartHeight
  const series = [
    { key: 'actual', label: 'Aktual', className: 'evaluation-line-actual' },
    { key: 'prediction_s1', label: 'Prediksi S1', className: 'evaluation-line-s1' },
    { key: 'prediction_s2', label: 'Prediksi S2', className: 'evaluation-line-s2' },
  ]
  const tickIndexes = [0, 6, 12, 18, points.length - 1]
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = maxValue - ((maxValue - minValue) * index) / 4
    return { value, position: top + (chartHeight * index) / 4 }
  })
  const hoveredDataPoint = hoveredPoint
    ? points[hoveredPoint.index]
    : null
  const hoveredSeries = series.find((item) => item.key === hoveredPoint?.key)
  const tooltipWidth = 158
  const tooltipHeight = 38
  const tooltipX = hoveredPoint
    ? Math.min(
        Math.max(x(hoveredPoint.index) + 8, left),
        width - right - tooltipWidth,
      )
    : 0
  const tooltipY = hoveredPoint
    ? Math.min(
        Math.max(y(hoveredDataPoint[hoveredPoint.key]) - tooltipHeight / 2, top),
        top + chartHeight - tooltipHeight,
      )
    : top

  function handlePointerMove(event) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * width
    const pointerY = ((event.clientY - bounds.top) / bounds.height) * height
    let nearestPoint = null
    let nearestDistance = 10

    points.forEach((point, index) => {
      series.forEach((item) => {
        const distance = Math.hypot(
          pointerX - x(index),
          pointerY - y(point[item.key]),
        )
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestPoint = { index, key: item.key }
        }
      })
    })

    setHoveredPoint(nearestPoint)
  }

  return (
    <section className="evaluation-chart-card" aria-labelledby="evaluation-chart-title">
      <div className="evaluation-section-heading">
        <div>
          <h2 id="evaluation-chart-title">Perbandingan hasil</h2>
          <p>Data aktual dan prediksi per jam.</p>
        </div>
        <span className="evaluation-chart-unit">{pollutant}</span>
      </div>
      <div className="evaluation-chart-scroll">
        <svg
          className="evaluation-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Grafik garis data aktual, prediksi S1, dan prediksi S2 untuk ${pollutant}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredPoint(null)}
        >
          {yTicks.map((tick) => (
            <g key={tick.position}>
              <line
                className="evaluation-chart-grid"
                x1={left}
                x2={width - right}
                y1={tick.position}
                y2={tick.position}
              />
              <text className="evaluation-chart-label" x={left - 9} y={tick.position + 4} textAnchor="end">
                {tick.value.toFixed(1)}
              </text>
            </g>
          ))}
          {tickIndexes.map((index) => (
            <text
              className="evaluation-chart-label"
              key={index}
              x={x(index)}
              y={height - 15}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            >
              {formatUtcTimeInWib(points[index].time)}
            </text>
          ))}
          {series.map((item) => (
            <polyline
              className={`evaluation-chart-line ${item.className}`}
              key={item.key}
              points={points
                .map((point, index) => `${x(index)},${y(point[item.key])}`)
                .join(' ')}
            />
          ))}
          {series.map((item) => (
            <g className={`evaluation-hourly-points ${item.className}`} key={`${item.key}-points`}>
              {points.map((point, index) => (
                <circle
                  key={`${item.key}-${point.time}`}
                  cx={x(index)}
                  cy={y(point[item.key])}
                  r="2.5"
                />
              ))}
            </g>
          ))}
          {hoveredDataPoint && (
            <g className="evaluation-chart-hover" pointerEvents="none">
              <circle
                className={hoveredSeries.className}
                cx={x(hoveredPoint.index)}
                cy={y(hoveredDataPoint[hoveredPoint.key])}
                r="5"
              />
              <g transform={`translate(${tooltipX}, ${tooltipY})`}>
                <rect width={tooltipWidth} height={tooltipHeight} rx="5" />
                <text className="evaluation-tooltip-time" x="7" y="13">
                  {formatUtcDateTimeInWib(hoveredDataPoint.time)}
                </text>
                <text
                  className="evaluation-tooltip-value"
                  x="7"
                  y="28"
                >
                  {hoveredSeries.label} · {Number(hoveredDataPoint[hoveredPoint.key]).toFixed(1)}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
      <div className="evaluation-chart-legend" aria-label="Legenda grafik">
        {series.map((item) => (
          <span className="evaluation-legend-item" key={item.key}>
            <span className={`evaluation-legend-swatch ${item.className}`} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
    </section>
  )
}

function EvaluationPage() {
  const [options, setOptions] = useState(null)
  const [location, setLocation] = useState('')
  const [pollutant, setPollutant] = useState('')
  const [evaluationDate, setEvaluationDate] = useState('')
  const [evaluationHour, setEvaluationHour] = useState(12)
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [optionsError, setOptionsError] = useState('')
  const [evaluationError, setEvaluationError] = useState('')
  const [evaluationResult, setEvaluationResult] = useState(null)
  const evaluationResultsRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadOptions() {
      try {
        const response = await fetch('/api/prediction-options', {
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.detail || 'Gagal memuat pilihan evaluasi.')
        }

        setOptions(data)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setOptionsError(error.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingOptions(false)
        }
      }
    }

    loadOptions()
    return () => controller.abort()
  }, [])

  const isCombinationAvailable = ['S1', 'S2'].every((scenario) =>
    options?.available_predictions?.some(
      (item) =>
        item.location === location &&
        item.pollutant === pollutant &&
        item.scenario === scenario,
    ),
  )
  
  useEffect(() => {
    if (evaluationResult) {
      evaluationResultsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [evaluationResult])

  async function handleEvaluation(event) {
    event.preventDefault()
    setIsEvaluating(true)
    setEvaluationError('')
    setEvaluationResult(null)

    try {
      const response = await fetch('/api/evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          pollutant,
          prediction_time: wibDateTimeToUtcIso(
            evaluationDate,
            evaluationHour,
          ),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Evaluasi gagal diproses.')
      }
      setEvaluationResult(data)
    } catch (error) {
      setEvaluationError(error.message)
    } finally {
      setIsEvaluating(false)
    }
  }

  return (
    <section className="page-content evaluation-page">
      <header className="evaluation-page-header">
        <h1>Evaluation</h1>
        <p>
          Bandingkan performa model Skenario 1 dan Skenario 2 dengan data aktual pada 24 jam
          hingga waktu yang dipilih.
        </p>
      </header>

      <section className="evaluation-module" aria-labelledby="evaluation-form-title">
        <div className="evaluation-section-heading">
          <div>
            <h2 id="evaluation-form-title">Parameter evaluasi</h2>
            <p>Pilih kota, polutan, tanggal, dan jam akhir evaluasi.</p>
          </div>
        </div>

        <form className="evaluation-form" onSubmit={handleEvaluation}>
          <label className="evaluation-field" htmlFor="evaluation-date">
            <span>Tanggal evaluasi</span>
            <input
              id="evaluation-date"
              type="date"
              required
              value={evaluationDate}
              onChange={(event) => setEvaluationDate(event.target.value)}
            />
          </label>
          <label className="evaluation-field" htmlFor="evaluation-location">
            <span>Kota</span>
            <select
              id="evaluation-location"
              required
              value={location}
              disabled={isLoadingOptions || Boolean(optionsError)}
              onChange={(event) => setLocation(event.target.value)}
            >
              <option value="">Pilih kota</option>
              {options?.locations?.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>
          <label className="evaluation-field" htmlFor="evaluation-pollutant">
            <span>Jenis polutan</span>
            <select
              id="evaluation-pollutant"
              required
              value={pollutant}
              disabled={isLoadingOptions || Boolean(optionsError)}
              onChange={(event) => setPollutant(event.target.value)}
            >
              <option value="">Pilih polutan</option>
              {options?.pollutants?.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          

          <div className="evaluation-hour">
            <div className="evaluation-hour-heading">
              <label htmlFor="evaluation-hour">Jam akhir evaluasi</label>
              <output htmlFor="evaluation-hour">
                {String(evaluationHour).padStart(2, '0')}:00
              </output>
            </div>
            <input
              id="evaluation-hour"
              type="range"
              min="0"
              max="23"
              step="1"
              value={evaluationHour}
              aria-valuetext={`${String(evaluationHour).padStart(2, '0')}:00`}
              onChange={(event) => setEvaluationHour(Number(event.target.value))}
            />
            <div className="evaluation-hour-ticks" aria-hidden="true">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
          </div>

          <div className="evaluation-actions">
            <button
              className="evaluation-button"
              type="submit"
              disabled={
                isEvaluating ||
                isLoadingOptions ||
                Boolean(optionsError) ||
                !location ||
                !pollutant ||
                !evaluationDate ||
                !isCombinationAvailable
              }
            >
              {isEvaluating ? 'Mengevaluasi...' : 'Jalankan evaluasi S1 & S2'}
            </button>
            {location && pollutant && !isCombinationAvailable && (
              <p className="evaluation-message error" role="alert">
                Kombinasi kota dan polutan ini belum memiliki model S1 dan S2.
              </p>
            )}
          </div>
        </form>
        {optionsError && (
          <p className="evaluation-message error" role="alert">
            Gagal memuat pilihan: {optionsError}
          </p>
        )}
        {isEvaluating && (
          <p className="evaluation-message" role="status">
            Menjalankan kedua model untuk 24 titik waktu...
          </p>
        )}
        {evaluationError && (
          <p className="evaluation-message error" role="alert">
            Evaluasi gagal: {evaluationError}
          </p>
        )}
      </section>

      {evaluationResult && (
        <div className="evaluation-results" aria-live="polite" ref={evaluationResultsRef}>
          <div className="evaluation-results-heading">
            <div>
              <h2>Hasil evaluasi</h2>
              <p>
                {evaluationResult.location} · {evaluationResult.pollutant} ·{' '}
                {formatUtcDateTimeInWib(evaluationResult.start_time)} sampai{' '}
                {formatUtcDateTimeInWib(evaluationResult.end_time)} 
              </p>
            </div>
            <span className="evaluation-point-count">
              {evaluationResult.points.length} titik data
            </span>
          </div>

          <div className="evaluation-metrics">
            {['S1', 'S2'].map((scenario) => (
              <section className="evaluation-scenario-card" key={scenario}>
                <h3>Skenario {scenario.slice(1)}</h3>
                <div className="evaluation-metric-grid">
                  {metricDefinitions.map((metric) => (
                    <div className="evaluation-metric" key={metric.key}>
                      <span title={metric.description}>{metric.label}</span>
                      <strong>{formatMetric(
                        evaluationResult.metrics[scenario][metric.key],
                        metric.key,
                      )}</strong>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <EvaluationChart
            points={evaluationResult.points}
            pollutant={evaluationResult.pollutant}
          />
          <section className="evaluation-insights" aria-labelledby="evaluation-insights-title">
            <div className="evaluation-section-heading">
              <div>
                <h2 id="evaluation-insights-title">Insight hasil evaluasi</h2>
                <p>Ringkasan otomatis berdasarkan hasil kedua skenario pada periode ini.</p>
              </div>
            </div>
            <div className="evaluation-insight-grid">
              {getEvaluationInsights(evaluationResult).map((insight) => (
                <article className="evaluation-insight-card" key={insight.title}>
                  <h3>{insight.title}</h3>
                  <p>{insight.description}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default EvaluationPage
