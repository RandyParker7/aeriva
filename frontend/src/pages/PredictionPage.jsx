import { useEffect, useRef, useState } from 'react'
import {
  formatUtcDateInWib,
  formatUtcTimeInWib,
  wibDateTimeToUtcIso,
} from '../utils/time'
import './PredictionPage.css'

const CONDITIONS_REFRESH_INTERVAL = 15 * 60 * 1000

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

function formatShapFeature(feature) {
  const match = feature.match(/^(.*)_lag(\d+)$/)
  if (!match) {
    return feature
  }

  return `${shapFeatureLabels[match[1]] || match[1]} · lag ${match[2]}`
}

function ShapInterpretation({ interpretation }) {
  const maxImpact = Math.max(
    ...interpretation.features.map((feature) => Math.abs(feature.shap_value)),
  )

  return (
    <section className="prediction-shap" aria-labelledby="prediction-shap-title">
      <div className="prediction-shap-heading">
        <div>
          <h2 id="prediction-shap-title">Interpretasi model (SHAP)</h2>
          <p>
            Nilai prediksi dimulai dari baseline, yaitu nilai awal rata-rata
            model. Setiap fitur menggeser nilai itu: kontribusi positif
            (menaikkan) menambah prediksi dari baseline, sedangkan kontribusi
            negatif (menurunkan) menguranginya. Ini menjelaskan pengaruh fitur
            terhadap hasil model, bukan berarti nilai fiturnya sendiri naik
            atau turun. Fitur diurutkan berdasarkan besar pengaruhnya; semakin
            panjang garis, semakin besar kontribusinya.
          </p>
        </div>
        <span className="prediction-shap-baseline">
          Baseline {Number(interpretation.base_value).toFixed(2)}
        </span>
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
    </section>
  )
}

function PredictionPage() {
  const [selectedScenario, setSelectedScenario] = useState('')
  const [predictionDate, setPredictionDate] = useState('')
  const [predictionHour, setPredictionHour] = useState(12)
  const [location, setLocation] = useState('')
  const [conditionsLocation, setConditionsLocation] = useState('')
  const [pollutant, setPollutant] = useState('')
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionError, setPredictionError] = useState('')
  const [predictionResult, setPredictionResult] = useState(null)
  const [currentConditions, setCurrentConditions] = useState(null)
  const [currentConditionsError, setCurrentConditionsError] = useState('')
  const [mapError, setMapError] = useState('')
  const [isLoadingConditions, setIsLoadingConditions] = useState(false)
  const [conditionsRefresh, setConditionsRefresh] = useState(0)
  const conditionsMapRef = useRef(null)

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
        setConditionsLocation(
          (currentLocation) => currentLocation || data.locations?.[0] || ''
        )

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

  useEffect(() => {
    if (!conditionsLocation) {
      return undefined
    }

    const controller = new AbortController()

    async function loadCurrentConditions() {
      setIsLoadingConditions(true)
      setCurrentConditionsError('')

      try {
        const response = await fetch(
          `/api/current-conditions?location=${encodeURIComponent(conditionsLocation)}`,
          { signal: controller.signal, cache: 'no-store' },
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.detail || 'Gagal memuat data terkini.')
        }

        setCurrentConditions(data)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setCurrentConditionsError(error.message)
          setCurrentConditions(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingConditions(false)
        }
      }
    }

    loadCurrentConditions()
    return () => controller.abort()
  }, [conditionsLocation, conditionsRefresh])

  useEffect(() => {
    const refreshConditions = () => {
      if (document.visibilityState === 'visible') {
        setConditionsRefresh((refresh) => refresh + 1)
      }
    }
    const intervalId = window.setInterval(
      refreshConditions,
      CONDITIONS_REFRESH_INTERVAL,
    )

    document.addEventListener('visibilitychange', refreshConditions)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshConditions)
    }
  }, [])

  useEffect(() => {
    const locationCoordinates = options?.location_coordinates
    if (!locationCoordinates || !conditionsMapRef.current) {
      return undefined
    }

    let isDisposed = false
    let map

    async function initializeMap() {
      try {
        const leafletSpecifier = 'leaflet'
        const leaflet = await import(
          /* @vite-ignore */
          leafletSpecifier
        )
        if (isDisposed || !conditionsMapRef.current) {
          return
        }

        const coordinates = Object.values(locationCoordinates)
        const center = [
          coordinates.reduce((sum, point) => sum + point.latitude, 0) /
            coordinates.length,
          coordinates.reduce((sum, point) => sum + point.longitude, 0) /
            coordinates.length,
        ]
        map = new leaflet.Map(conditionsMapRef.current, {
          center,
          zoom: 7,
          scrollWheelZoom: false,
          doubleClickZoom: false,
        })
        new leaflet.TileLayer(
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          },
        ).addTo(map)

        Object.entries(locationCoordinates).forEach(([city, point]) => {
          new leaflet.Marker(
            [point.latitude, point.longitude],
            {
              icon: new leaflet.DivIcon({
                className: 'conditions-map-pin',
                html: '<span></span>',
                iconSize: [30, 38],
                iconAnchor: [15, 38],
              }),
              title: `Pantau ${city}`,
              alt: `Lokasi ${city}`,
            },
          )
            .on('click', () => {
            setIsLoadingConditions(true)
            setCurrentConditionsError('')
            setConditionsLocation(city)
            setConditionsRefresh((refresh) => refresh + 1)
          })
            .addTo(map)
        })
        setMapError('')
      } catch (error) {
        if (!isDisposed) {
          setMapError(`Peta gagal dimuat: ${error.message}`)
        }
      }
    }

    initializeMap()
    return () => {
      isDisposed = true
      map?.remove()
    }
  }, [options?.location_coordinates])

  const isCombinationAvailable = options?.available_predictions?.some(
    (item) =>
      item.location === location &&
      item.pollutant === pollutant &&
      item.scenario === selectedScenario,
  )

  const displayedConditions =
    currentConditions?.location === conditionsLocation
      ? currentConditions
      : null

  const currentMetricGroups = [
    {
      title: 'Kualitas udara',
      metrics: [
        { key: 'pm2_5', label: 'PM2.5', unit: 'µg/m³' },
        { key: 'carbon_monoxide', label: 'CO', unit: 'µg/m³' },
        { key: 'nitrogen_dioxide', label: 'NO₂', unit: 'µg/m³' },
        { key: 'sulphur_dioxide', label: 'SO₂', unit: 'µg/m³' },
        { key: 'ozone', label: 'O₃', unit: 'µg/m³' },
      ],
    },
    {
      title: 'Meteorologi',
      metrics: [
        { key: 'temperature_2m', label: 'Suhu', unit: '°C' },
        { key: 'relative_humidity_2m', label: 'Kelembapan', unit: '%' },
        { key: 'rain', label: 'Curah hujan', unit: 'mm' },
        { key: 'surface_pressure', label: 'Tekanan udara', unit: 'hPa' },
        { key: 'wind_speed_10m', label: 'Kecepatan angin', unit: 'km/j' },
        { key: 'wind_direction_10m', label: 'Arah angin', unit: '°' },
      ],
    },
  ]

  async function handlePrediction(event) {
    event.preventDefault()
    setIsPredicting(true)
    setPredictionError('')
    setPredictionResult(null)

    try {
      const response = await fetch('/api/prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          pollutant,
          scenario: selectedScenario,
          prediction_time: wibDateTimeToUtcIso(
            predictionDate,
            predictionHour,
          ),
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
    <section className="page-content prediction-page">
      <header className="prediction-page-header">
        <h1 className="header">Prediction</h1>
        <p className="prediction-intro">
          Pilih skenario dan parameter untuk menjalankan prediksi kualitas udara.
        </p>
      </header>
      <div className="prediction-workspace">
        <section className="prediction-module">
          {isLoadingOptions && (
            <p className="prediction-message" role="status">
              Memuat opsi prediksi...
            </p>
          )}
          {optionsError && (
            <p className="prediction-message error" role="alert">
              Tidak dapat terhubung ke backend: {optionsError}
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
                  value={predictionDate}
                  onChange={(event) => setPredictionDate(event.target.value)}
                />
              </label>

              <label className="prediction-field" htmlFor="prediction-location">
                <span>Kota</span>
                <select
                  id="prediction-location"
                  required
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                >
                  <option value="">Pilih kota</option>
                  {options?.locations?.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>

              <label className="prediction-field" htmlFor="prediction-pollutant">
                <span>Jenis polutan</span>
                <select
                  id="prediction-pollutant"
                  required
                  value={pollutant}
                  onChange={(event) => setPollutant(event.target.value)}
                >
                  <option value="">Pilih jenis polutan</option>
                  {options?.pollutants?.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <div className="prediction-hour">
                <div className="prediction-hour-heading">
                  <label htmlFor="prediction-hour">Waktu prediksi</label>
                  <output htmlFor="prediction-hour">
                    {String(predictionHour).padStart(2, '0')}:00
                  </output>
                </div>
                <input
                  id="prediction-hour"
                  type="range"
                  min="0"
                  max="23"
                  step="1"
                  value={predictionHour}
                  aria-valuetext={`${String(predictionHour).padStart(2, '0')}:00`}
                  onChange={(event) =>
                    setPredictionHour(Number(event.target.value))
                  }
                />
                <div className="prediction-hour-ticks" aria-hidden="true">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </div>
            </div>

            <div className="prediction-actions">
              <button
                className="prediction-button"
                type="submit"
                disabled={
                  isPredicting ||
                  Boolean(optionsError) ||
                  !predictionDate ||
                  !location ||
                  !pollutant ||
                  !isCombinationAvailable
                }
              >
                {isPredicting ? 'Memproses...' : 'Prediksi'}
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
                  Prediksi<span className="prediction-loading-dots">...</span>
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
              <div className="prediction-results" aria-live="polite">
                <section className="prediction-previous-hour">
                  <h2>Data {predictionResult.pollutant} 1 Jam Sebelumnya</h2>
                  <strong>
                    {predictionResult.previous_hour_pollutant.value}
                  </strong>
                  <div className="prediction-result-datetime">
                    <span className="prediction-result-date">
                      {formatUtcDateInWib(
                        predictionResult.previous_hour_pollutant.time,
                      )}
                    </span>
                    <strong className="prediction-result-time">
                      {formatUtcTimeInWib(
                        predictionResult.previous_hour_pollutant.time,
                      )} 
                    </strong>
                  </div>
                  <p>
                    Koordinat: {Number(predictionResult.latitude).toFixed(5)},{' '}
                    {Number(predictionResult.longitude).toFixed(5)}
                  </p>
                </section>
                <section className="prediction-result">
                  <h2>Hasil Prediksi</h2>
                  <p>
                    <strong>{predictionResult.prediction}</strong>
                  </p>
                  <div className="prediction-result-datetime">
                    <span className="prediction-result-date">
                      {formatUtcDateInWib(
                        predictionResult.prediction_time,
                      )}
                    </span>
                    <strong className="prediction-result-time">
                      {formatUtcTimeInWib(
                        predictionResult.prediction_time,
                      )}
                    </strong>
                  </div>
                  <p>
                    {predictionResult.location} · {predictionResult.pollutant} ·
                    {' '}{predictionResult.scenario}
                  </p>
                  <p>
                    Koordinat: {Number(predictionResult.latitude).toFixed(5)},{' '}
                    {Number(predictionResult.longitude).toFixed(5)}
                  </p>
                </section>
                <ShapInterpretation
                  interpretation={predictionResult.interpretation}
                />
              </div>
            )}
        </form>
        </section>
        <aside className="current-conditions" aria-labelledby="current-conditions-title">
          <div className="current-conditions-header">
            <div>
              <p className="current-conditions-eyebrow">PEMANTAUAN LANGSUNG</p>
              <h2 id="current-conditions-title">Kondisi saat ini</h2>
              <p className="conditions-location-prompt">
                Klik marker pada peta untuk melihat kondisi udara dan cuaca terkini di lokasi pemantauan.
              </p>
            </div>
            <button
              className="conditions-refresh"
              type="button"
              aria-label="Perbarui data kondisi saat ini"
              title="Perbarui data"
              disabled={!conditionsLocation || isLoadingConditions}
              onClick={() => setConditionsRefresh((refresh) => refresh + 1)}
            >
              ↻
            </button>
          </div>
          <div className="conditions-map-frame">
            <div
              className="conditions-map"
              ref={conditionsMapRef}
              role="img"
              aria-label={`Peta lokasi pemantauan ${conditionsLocation || ''}`}
            />
          </div>
          {mapError && (
            <p className="conditions-status conditions-error" role="alert">
              {mapError}
            </p>
          )}
          {displayedConditions?.updated_at && (
            <p className="current-conditions-time">
              Data per jam {formatUtcTimeInWib(
                displayedConditions.updated_at,
              )} 
            </p>
          )}
          {displayedConditions && (
            <div className="current-conditions-location-meta">
              <div className="current-conditions-place">
                <span className="current-conditions-place-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" focusable="false">
                    <path d="M10 18s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z" />
                    <circle cx="10" cy="8" r="2" />
                  </svg>
                </span>
                <div>
                  <span className="current-conditions-meta-label">Daerah pemantauan</span>
                  <strong>{conditionsLocation}</strong>
                </div>
              </div>
              <p className="current-conditions-coordinates">
                <span className="current-conditions-meta-label">Koordinat</span>
                <span>
                  {Number(displayedConditions.latitude).toFixed(5)},{' '}
                  {Number(displayedConditions.longitude).toFixed(5)}
                </span>
              </p>
            </div>
          )}
          {isLoadingConditions && (
            <div className="conditions-loading" role="status">
              <span className="conditions-loading-spinner" aria-hidden="true" />
              <span>
                Memuat pemantauan terkini untuk <strong>{conditionsLocation}</strong>
                <span className="conditions-loading-dots" aria-hidden="true">...</span>
              </span>
            </div>
          )}
          {currentConditionsError && (
            <p className="conditions-status conditions-error" role="alert">
              Data terkini gagal dimuat: {currentConditionsError}
            </p>
          )}
          {displayedConditions && (
            <div className="current-conditions-groups">
              {currentMetricGroups.map((group, index) => (
                <section
                  className={`conditions-group conditions-group-${index + 1}`}
                  key={group.title}
                >
                  <h3>{group.title}</h3>
                  <div className="conditions-grid">
                    {group.metrics.map((metric) => {
                      const value = displayedConditions.values[metric.key]
                      return (
                        <article className="condition-card" key={metric.key}>
                          <span className="condition-label">{metric.label}</span>
                          <strong className="condition-value">
                            {value == null ? '—' : Number(value).toLocaleString(
                              'id-ID',
                              { maximumFractionDigits: 1 },
                            )}
                            <span>{metric.unit}</span>
                          </strong>
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
          {!displayedConditions && !isLoadingConditions && !currentConditionsError && (
            <p className="conditions-status">
              Pilih lokasi untuk melihat kondisi udara dan cuaca terkini.
            </p>
          )}
          <p className="current-conditions-source">
            Sumber: Open-Meteo API
          </p>
        </aside>
      </div>
    </section>
  )
}

export default PredictionPage
