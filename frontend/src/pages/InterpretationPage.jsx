import { useEffect, useRef, useState } from 'react'
import {
  formatUtcDateInWib,
  formatUtcDateTimeInWib,
  formatUtcTimeInWib,
  getWibDateTimeParts,
  wibDateTimeToUtcIso,
} from '../utils/time'
import { formatPollutantLabel } from '../utils/pollutants'
import { getAirQualityCategory } from '../utils/airQuality'
import './PredictionPage.css'
import './Interpretation.css'

const scenarios = [
  {
    id: 'S1',
    name: 'Skenario 1',
    description: 'Data Historis Polutan',
  },
  {
    id: 'S2',
    name: 'Skenario 2',
    description: 'Data Historis Polutan + Meteorologi',
  },
]

const shapFeatureLabels = {
  temperature: 'Suhu',
  humidity: 'Kelembapan',
  rain: 'Curah hujan',
  pressure: 'Tekanan udara',
  wind_speed: 'Kecepatan angin',
  wind_direction: 'Arah angin',
}

function getPredictionHourBounds(date, timeRange) {
  if (!date || !timeRange) {
    return { min: 0, max: 23 }
  }

  const minDateTime = getWibDateTimeParts(timeRange.min)
  const maxDateTime = getWibDateTimeParts(timeRange.max)
  return {
    min: date === minDateTime.date ? minDateTime.hour : 0,
    max: date === maxDateTime.date ? maxDateTime.hour : 23,
  }
}

function formatShapFeature(feature) {
  const match = feature.match(/^(.*)_lag(\d+)$/)
  if (!match) {
    return feature
  }

  return `${shapFeatureLabels[match[1]] || match[1]} · lag ${match[2]}`
}

function Previous24HoursChart({ points, pollutant }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const validPoints = points.filter(
    (point) => Number.isFinite(point.value),
  )

  if (!validPoints.length) {
    return (
      <section className="interpretation-history-chart">
        <div className="interpretation-history-heading">
          <div>
            <h2>Data aktual 24 jam sebelum prediksi</h2>
            <p>{formatPollutantLabel(pollutant)}</p>
          </div>
        </div>
        <p className="interpretation-history-empty">
          Data historis 24 jam tidak tersedia untuk waktu prediksi ini.
        </p>
      </section>
    )
  }

  const width = 900
  const height = 330
  const left = 58
  const right = 22
  const top = 24
  const bottom = 52
  const chartWidth = width - left - right
  const chartHeight = height - top - bottom
  const maxValue = Math.max(...validPoints.map((point) => point.value), 1) * 1.15
  const x = (index) => left + ((index + 0.5) / points.length) * chartWidth
  const y = (value) => top + ((maxValue - value) / maxValue) * chartHeight
  const barWidth = (chartWidth / points.length) * 0.62
  const ticks = Array.from({ length: 5 }, (_, index) => ({
    value: (maxValue * (4 - index)) / 4,
    position: top + (chartHeight * index) / 4,
  }))
  const tickIndexes = [0, 5, 11, 17, 23].filter(
    (index) => index < points.length,
  )
  const hoveredPoint =
    hoveredIndex === null ? null : points[hoveredIndex]
  const tooltipWidth = 188
  const tooltipHeight = 42
  const tooltipX = hoveredIndex === null
    ? 0
    : Math.min(
        Math.max(x(hoveredIndex) - tooltipWidth / 2, left),
        width - right - tooltipWidth,
      )
  const tooltipY = hoveredPoint && Number.isFinite(hoveredPoint.value)
    ? Math.max(top, y(hoveredPoint.value) - tooltipHeight - 8)
    : top

  return (
    <section className="interpretation-history-chart">
      <div className="interpretation-history-heading">
        <div>
          <h2>Data aktual 24 jam sebelum prediksi</h2>
          <p>Perubahan {formatPollutantLabel(pollutant)} per jam</p>
        </div>
        <span className="interpretation-history-count">
          {validPoints.length} titik data
        </span>
      </div>
      <div className="interpretation-history-scroll">
        <svg
          className="interpretation-history-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label={`Diagram batang ${formatPollutantLabel(pollutant)} selama 24 jam sebelum prediksi`}
          onPointerLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="history-bar-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7887eb" />
              <stop offset="100%" stopColor="#5364c5" />
            </linearGradient>
          </defs>
          {ticks.map((tick) => (
            <g key={tick.position}>
              <line
                className="interpretation-history-grid"
                x1={left}
                x2={width - right}
                y1={tick.position}
                y2={tick.position}
              />
              <text
                className="interpretation-history-axis-label"
                x={left - 10}
                y={tick.position + 4}
                textAnchor="end"
              >
                {tick.value.toFixed(1)}
              </text>
            </g>
          ))}
          {points.map((point, index) => {
            const isValid = Number.isFinite(point.value)
            const barY = isValid ? y(point.value) : top + chartHeight
            const barHeight = isValid ? top + chartHeight - barY : 0

            return (
              <rect
                className={`interpretation-history-bar ${
                  hoveredIndex === index ? 'active' : ''
                }`}
                key={point.time}
                x={x(index) - barWidth / 2}
                y={barY}
                width={barWidth}
                height={barHeight}
                rx="4"
                tabIndex={isValid ? 0 : undefined}
                aria-label={
                  isValid
                    ? `${formatUtcDateTimeInWib(point.time)}, ${point.value.toFixed(2)} µg/m³`
                    : `${formatUtcDateTimeInWib(point.time)}, data tidak tersedia`
                }
                onPointerEnter={() => setHoveredIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
              />
            )
          })}
          {tickIndexes.map((index) => (
            <text
              className="interpretation-history-axis-label"
              key={index}
              x={x(index)}
              y={height - 18}
              textAnchor="middle"
            >
              {formatUtcTimeInWib(points[index].time)}
            </text>
          ))}
          {hoveredPoint && Number.isFinite(hoveredPoint.value) && (
            <g className="interpretation-history-tooltip" pointerEvents="none">
              <rect
                x={tooltipX}
                y={tooltipY}
                width={tooltipWidth}
                height={tooltipHeight}
                rx="7"
              />
              <text x={tooltipX + 10} y={tooltipY + 16}>
                {formatUtcDateTimeInWib(hoveredPoint.time)}
              </text>
              <text
                className="interpretation-history-tooltip-value"
                x={tooltipX + 10}
                y={tooltipY + 33}
              >
                {hoveredPoint.value.toFixed(2)} µg/m³
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="interpretation-history-legend">
        <span className="interpretation-history-legend-dot" aria-hidden="true" />
        Data aktual
      </div>
    </section>
  )
}

function ShapInterpretation({ interpretation }) {
  const maxImpact = Math.max(
    ...interpretation.features.map((feature) => Math.abs(feature.shap_value)),
  )

  return (
    <section className="prediction-shap" aria-labelledby="prediction-shap-title">
      <div className="prediction-shap-heading">
        <div>
          <span className="prediction-shap-eyebrow">MEMAHAMI HASIL MODEL</span>
          <h2 id="prediction-shap-title">Faktor yang memengaruhi prediksi</h2>
        </div>
        <span className="prediction-shap-baseline">
          Nilai awal model <strong>{Number(interpretation.base_value).toFixed(2)}</strong>
        </span>
      </div>
      <div className="prediction-shap-layout">
        <aside className="prediction-shap-guide" aria-label="Panduan membaca SHAP">
          <div className="prediction-shap-guide-intro">
            <span className="prediction-shap-guide-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 3v18m0-18 6 6m-6-6L6 9m6 12 6-6m-6 6-6-6" />
              </svg>
            </span>
            <div>
              <h3>Cara membaca</h3>
              <p>
                SHAP menunjukkan seberapa besar tiap data input menggeser
                prediksi dari nilai awal model, bukan hubungan sebab-akibat.
              </p>
            </div>
          </div>
          <div className="prediction-shap-legend">
            <div className="prediction-shap-legend-item">
              <span className="prediction-shap-legend-swatch positive" aria-hidden="true">↑</span>
              <div>
                <strong>Menaikkan prediksi</strong>
                <p>Kontribusi positif mendorong nilai polutan lebih tinggi.</p>
              </div>
            </div>
            <div className="prediction-shap-legend-item">
              <span className="prediction-shap-legend-swatch negative" aria-hidden="true">↓</span>
              <div>
                <strong>Menurunkan prediksi</strong>
                <p>Kontribusi negatif mendorong nilai polutan lebih rendah.</p>
              </div>
            </div>
            <div className="prediction-shap-legend-item">
              <span className="prediction-shap-legend-swatch neutral" aria-hidden="true">•</span>
              <div>
                <strong>Pengaruh kecil</strong>
                <p>Nilai mendekati nol hampir tidak menggeser hasil prediksi.</p>
              </div>
            </div>
          </div>
          <div className="prediction-shap-lag-note">
            <strong>Apa arti lag?</strong>
            <p>
              Lag adalah jarak waktu data input dari waktu prediksi:
              <b> lag 1</b> = 1 jam sebelumnya,
              <b> lag 2</b> = 2 jam sebelumnya, dan
              <b> lag 3</b> = 3 jam sebelumnya. Pada Skenario 2, ini juga
              berlaku untuk data meteorologi.
            </p>
          </div>
        </aside>

        <div className="prediction-shap-results">
          <div className="prediction-shap-results-heading">
            <div>
              <h3>Kontribusi setiap fitur</h3>
              <p>Bar lebih panjang berarti kontribusi lebih besar.</p>
            </div>
            <span>{interpretation.features.length} fitur</span>
          </div>
          <ol className="prediction-shap-list">
            {interpretation.features.map((feature) => {
              const magnitude = Math.abs(feature.shap_value)
              const barWidth = maxImpact
                ? `${(magnitude / maxImpact) * 100}%`
                : '0%'
              const direction = feature.impact === 'positive'
                ? 'Menaikkan'
                : feature.impact === 'negative'
                  ? 'Menurunkan'
                  : 'Netral'

              return (
                <li className="prediction-shap-item" key={feature.feature}>
                  <div className="prediction-shap-item-heading">
                    <span className="prediction-shap-feature">
                      {formatShapFeature(feature.feature)}
                      <span>Nilai input {Number(feature.value).toFixed(2)}</span>
                    </span>
                    <span className={`prediction-shap-impact ${feature.impact}`}>
                      {direction} · {feature.shap_value > 0 ? '+' : ''}
                      {Number(feature.shap_value).toFixed(3)}
                    </span>
                  </div>
                  <div className="prediction-shap-track" aria-hidden="true">
                    <span
                      className={`prediction-shap-bar ${feature.impact}`}
                      style={{ width: barWidth }}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

function InterpretationPage() {
  const [selectedScenario, setSelectedScenario] = useState('')
  const [predictionDate, setPredictionDate] = useState('')
  const [predictionHour, setPredictionHour] = useState(12)
  const [location, setLocation] = useState('')
  const [pollutant, setPollutant] = useState('')
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionError, setPredictionError] = useState('')
  const [predictionResult, setPredictionResult] = useState(null)
  const predictionResultsRef = useRef(null)
  const predictionTimeRange = options?.prediction_time_range
  const predictionHourBounds = getPredictionHourBounds(
    predictionDate,
    predictionTimeRange,
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadOptions() {
      try {
        const response = await fetch('/api/prediction-options', {
          signal: controller.signal,
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.detail || 'Gagal memuat opsi prediksi.')
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

  const isCombinationAvailable = options?.available_predictions?.some(
    (item) =>
      item.location === location &&
      item.pollutant === pollutant &&
      item.scenario === selectedScenario,
  )
  const predictionCategory = predictionResult
    ? getAirQualityCategory(
        predictionResult.pollutant,
        Number(predictionResult.prediction),
      )
    : null

  useEffect(() => {
    if (predictionResult) {
      predictionResultsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [predictionResult])

  async function handlePrediction(event) {
    event.preventDefault()
    setIsPredicting(true)
    setPredictionError('')
    setPredictionResult(null)

    try {
      const predictionTime = wibDateTimeToUtcIso(
        predictionDate,
        predictionHour,
      )
      if (
        !predictionTimeRange ||
        Date.parse(predictionTime) < Date.parse(predictionTimeRange.min) ||
        Date.parse(predictionTime) > Date.parse(predictionTimeRange.max)
      ) {
        throw new Error('Waktu prediksi berada di luar rentang data yang tersedia.')
      }

      const response = await fetch('/api/prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          pollutant,
          scenario: selectedScenario,
          prediction_time: predictionTime,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Prediksi gagal diproses.')
      }

      setPredictionResult(data)
    } catch (error) {
      setPredictionError(error.message)
    } finally {
      setIsPredicting(false)
    }
  }

  return (
    <section className="page-content prediction-page interpretation-page">
      <header className="prediction-page-header">
        <h1 className="header">Interpretation</h1>
        <p className="prediction-intro">
          Jalankan prediksi kualitas udara, lalu pahami faktor yang memengaruhi
          hasil model melalui interpretasi SHAP.
        </p>
      </header>
      <section className="prediction-module">
        {isLoadingOptions && (
          <p className="prediction-message" role="status">
            Memuat opsi prediksi...
          </p>
        )}
        {optionsError && (
          <p className="prediction-message error" role="alert">
            Opsi prediksi gagal dimuat: {optionsError}
          </p>
        )}
        <fieldset className="scenario-selection">
          <legend>Pilih skenario prediksi</legend>
          <div className="scenario-options">
            {scenarios.map((scenario) => (
              <label
                className={`scenario-option ${
                  selectedScenario === scenario.id ? 'selected' : ''
                }`}
                key={scenario.id}
              >
                <input
                  type="radio"
                  name="prediction-scenario"
                  value={scenario.id}
                  checked={selectedScenario === scenario.id}
                  disabled={isLoadingOptions || Boolean(optionsError)}
                  onChange={() => {
                    setSelectedScenario(scenario.id)
                    setPredictionError('')
                    setPredictionResult(null)
                  }}
                />
                <span className="scenario-option-content">
                  <span className="scenario-name">{scenario.name}</span>
                  <span className="scenario-description">
                    {scenario.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <form className="prediction-form" onSubmit={handlePrediction}>
          <div className="prediction-form-heading">
            <h2>Parameter prediksi</h2>
          </div>
          <div className="prediction-fields">
            <label className="prediction-field" htmlFor="prediction-date">
              <span>Tanggal prediksi</span>
              <input
                id="prediction-date"
                type="date"
                required
                min={predictionTimeRange
                  ? getWibDateTimeParts(predictionTimeRange.min).date
                  : undefined}
                max={predictionTimeRange
                  ? getWibDateTimeParts(predictionTimeRange.max).date
                  : undefined}
                disabled={isLoadingOptions || Boolean(optionsError)}
                value={predictionDate}
                onChange={(event) => {
                  const nextDate = event.target.value
                  const nextBounds = getPredictionHourBounds(
                    nextDate,
                    predictionTimeRange,
                  )
                  setPredictionDate(nextDate)
                  setPredictionHour((hour) =>
                    Math.min(nextBounds.max, Math.max(nextBounds.min, hour)),
                  )
                }}
              />
            </label>

            <label className="prediction-field" htmlFor="prediction-location">
              <span>Kota</span>
              <select
                id="prediction-location"
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

            <label className="prediction-field" htmlFor="prediction-pollutant">
              <span>Jenis polutan</span>
              <select
                id="prediction-pollutant"
                required
                value={pollutant}
                disabled={isLoadingOptions || Boolean(optionsError)}
                onChange={(event) => setPollutant(event.target.value)}
              >
                <option value="">Pilih jenis polutan</option>
                {options?.pollutants?.map((item) => (
                  <option key={item} value={item}>
                    {formatPollutantLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label
              className="prediction-field prediction-hour"
              htmlFor="prediction-hour"
            >
              <span>Waktu prediksi</span>
              <select
                id="prediction-hour"
                required
                value={predictionHour}
                onChange={(event) =>
                  setPredictionHour(Number(event.target.value))
                }
              >
                {Array.from(
                  {
                    length:
                      predictionHourBounds.max - predictionHourBounds.min + 1,
                  },
                  (_, index) => {
                    const hour = predictionHourBounds.min + index
                    return (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, '0')}:00
                      </option>
                    )
                  },
                )}
              </select>
            </label>
          </div>

          <div className="prediction-actions">
            <button
              className="prediction-button"
              type="submit"
              disabled={
                isPredicting ||
                isLoadingOptions ||
                Boolean(optionsError) ||
                !predictionTimeRange ||
                !predictionDate ||
                !location ||
                !pollutant ||
                !isCombinationAvailable
              }
            >
              {isPredicting ? 'Menjalankan prediksi...' : 'Jalankan prediksi'}
            </button>
            {selectedScenario && location && pollutant && !isCombinationAvailable && (
              <p className="prediction-message error" role="alert">
                Kombinasi kota, polutan, dan skenario ini tidak tersedia.
              </p>
            )}
          </div>

          {isPredicting && (
            <div className="prediction-loading" role="status">
              <p>
                Menjalankan prediksi<span className="prediction-loading-dots">...</span>
              </p>
              <span className="prediction-loading-spinner" aria-hidden="true" />
            </div>
          )}

          {predictionError && (
            <p className="prediction-message error" role="alert">
              Prediksi gagal: {predictionError}
            </p>
          )}
          {predictionResult && (
            <div
              className="prediction-results"
              aria-live="polite"
              ref={predictionResultsRef}
            >
              <section className="prediction-result interpretation-result-card">
                <header className="interpretation-result-heading">
                  <div>
                    <span>RINGKASAN</span>
                    <h2>Hasil Prediksi</h2>
                  </div>
                  <span className="interpretation-result-scenario">
                    {predictionResult.scenario}
                  </span>
                </header>
                <div className="interpretation-result-content">
                  <div className="interpretation-result-reading">
                    <span>
                      Prediksi {formatPollutantLabel(predictionResult.pollutant)}
                    </span>
                    <div className="interpretation-result-value">
                      <strong>
                        {Number(predictionResult.prediction).toLocaleString(
                          'id-ID',
                          { maximumFractionDigits: 2 },
                        )}
                      </strong>
                      <span>µg/m³</span>
                    </div>
                    {predictionCategory && (
                      <span className={`air-quality-category ${predictionCategory.key}`}>
                        {predictionCategory.label}
                      </span>
                    )}
                  </div>
                  <div className="interpretation-result-details">
                    <div className="interpretation-result-detail">
                      <span className="interpretation-result-detail-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <rect x="3.5" y="5" width="17" height="16" rx="2" />
                          <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
                        </svg>
                      </span>
                      <div>
                        <span>Waktu prediksi</span>
                        <strong>
                          {formatUtcDateInWib(predictionResult.prediction_time)}
                        </strong>
                        <strong className="interpretation-result-time">
                          {formatUtcTimeInWib(predictionResult.prediction_time)} WIB
                        </strong>
                      </div>
                    </div>
                    <div className="interpretation-result-detail">
                      <span className="interpretation-result-detail-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                          <circle cx="12" cy="10" r="2.5" />
                        </svg>
                      </span>
                      <div>
                        <span>Lokasi</span>
                        <strong>{predictionResult.location}</strong>
                      </div>
                    </div>
                    <div className="interpretation-result-detail interpretation-result-coordinates">
                      <span className="interpretation-result-detail-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <circle cx="12" cy="12" r="7.5" />
                          <circle cx="12" cy="12" r="2.5" />
                          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                        </svg>
                      </span>
                      <div>
                        <span>Koordinat</span>
                        <strong>
                          {Number(predictionResult.latitude).toFixed(5)},{' '}
                          {Number(predictionResult.longitude).toFixed(5)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <Previous24HoursChart
                points={predictionResult.previous_24_hours || []}
                pollutant={predictionResult.pollutant}
              />
              <ShapInterpretation
                interpretation={predictionResult.interpretation}
              />
            </div>
          )}
        </form>
      </section>
    </section>
  )
}

export default InterpretationPage
