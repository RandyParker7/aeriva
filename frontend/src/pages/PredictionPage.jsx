import { useEffect, useRef, useState } from 'react'
import {
  formatUtcDateInWib,
  formatUtcTimeInWib,
} from '../utils/time'
import { formatPollutantLabel } from '../utils/pollutants'
import { getAirQualityCategory } from '../utils/airQuality'
import './PredictionPage.css'

const CONDITIONS_REFRESH_INTERVAL = 30 * 60 * 1000

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

function PredictionPage() {
  const [conditionsLocation, setConditionsLocation] = useState('')
  const [predictionLocation, setPredictionLocation] = useState('')
  const [predictionPollutant, setPredictionPollutant] = useState('')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionError, setPredictionError] = useState('')
  const [predictionResult, setPredictionResult] = useState(null)
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [currentConditions, setCurrentConditions] = useState(null)
  const [currentConditionsError, setCurrentConditionsError] = useState('')
  const [mapError, setMapError] = useState('')
  const [isLoadingConditions, setIsLoadingConditions] = useState(false)
  const [conditionsRefresh, setConditionsRefresh] = useState(0)
  const conditionsMapRef = useRef(null)
  const predictionResultsRef = useRef(null)
  const nextPredictionTime = new Date(currentTime)
  nextPredictionTime.setUTCMinutes(0, 0, 0)
  nextPredictionTime.setUTCHours(nextPredictionTime.getUTCHours() + 1)
  const nextPredictionTimeIso = nextPredictionTime.toISOString()
  const selectedModel = options?.final_predictions?.find(
    (item) =>
      item.location === predictionLocation &&
      item.pollutant === predictionPollutant,
  )
  const predictionCategory = predictionResult
    ? getAirQualityCategory(
        predictionResult.pollutant,
        Number(predictionResult.prediction),
      )
    : null

  useEffect(() => {
    if (!predictionResult || !predictionResultsRef.current) {
      return
    }

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    predictionResultsRef.current.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
    })
  }, [predictionResult])

  useEffect(() => {
    const controller = new AbortController()

    async function loadOptions() {
      try {
        const response = await fetch('/api/prediction-options', {
          signal: controller.signal,
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.detail || 'Gagal memuat data pemantauan.')
        }

        setOptions(data)
        setConditionsLocation(
          (currentLocation) => currentLocation || data.locations?.[0] || '',
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
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 30_000)

    return () => window.clearInterval(intervalId)
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
          zoom: 8,
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

  const displayedConditions =
    currentConditions?.location === conditionsLocation
      ? currentConditions
      : null

  async function handlePrediction() {
    if (!selectedModel) {
      return
    }

    setIsPredicting(true)
    setPredictionError('')
    setPredictionResult(null)

    try {
      const response = await fetch('/api/prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: predictionLocation,
          pollutant: predictionPollutant,
          prediction_time: nextPredictionTimeIso,
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
          Pantau kondisi kualitas udara dan meteorologi terkini di kota pemantauan.
        </p>
      </header>

      <aside className="current-conditions" aria-labelledby="current-conditions-title">
        <div className="current-conditions-header">
          <div>
            <p className="current-conditions-eyebrow">PEMANTAUAN LANGSUNG</p>
            <h2 id="current-conditions-title">Kondisi saat ini</h2>
            <p className="conditions-location-prompt">
              Pilih marker pada peta untuk melihat kondisi terkini di lokasi pemantauan.
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
          {displayedConditions?.updated_at && (
            <div className="current-conditions-update">
              <svg
                className="current-conditions-update-icon"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="7.25" />
                <path d="M10 5.75v4.5l3 1.75" />
              </svg>
              <div>
                <span className="current-conditions-update-label">
                  Pembaruan terakhir
                </span>
                <span className="current-conditions-update-datetime">
                  {formatUtcDateInWib(displayedConditions.updated_at)} ·{' '}
                  {formatUtcTimeInWib(displayedConditions.updated_at)} WIB
                </span>
              </div>
            </div>
          )}
        </div>
        {optionsError && (
          <p className="conditions-status conditions-error" role="alert">
            Data pemantauan gagal dimuat: {optionsError}
          </p>
        )}
        {mapError && (
          <p className="conditions-status conditions-error" role="alert">
            {mapError}
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
        {!displayedConditions && !isLoadingOptions && !isLoadingConditions &&
          !currentConditionsError && !optionsError && (
            <p className="conditions-status">
              Pilih lokasi untuk melihat kondisi udara dan cuaca terkini.
            </p>
          )}
        <p className="current-conditions-source">Sumber: Open-Meteo API</p>
      </aside>

      <section className="prediction-module next-hour-prediction" aria-labelledby="next-hour-prediction-title">
        <div className="prediction-module-heading">
          <div>
            <p className="current-conditions-eyebrow">PREDIKSI OTOMATIS</p>
            <h2 id="next-hour-prediction-title">Prediksi kualitas udara</h2>
            <p>Pilih kota dan polutan untuk melihat perkiraan satu jam ke depan.</p>
          </div>
        </div>

        <div className="next-hour-prediction-fields">
          <label className="prediction-field" htmlFor="next-hour-location">
            <span>Kota</span>
            <select
              id="next-hour-location"
              required
              value={predictionLocation}
              disabled={isLoadingOptions || Boolean(optionsError)}
              onChange={(event) => setPredictionLocation(event.target.value)}
            >
              <option value="">Pilih kota</option>
              {options?.locations?.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>

          <label className="prediction-field" htmlFor="next-hour-pollutant">
            <span>Jenis polutan</span>
            <select
              id="next-hour-pollutant"
              required
              value={predictionPollutant}
              disabled={isLoadingOptions || Boolean(optionsError)}
              onChange={(event) => setPredictionPollutant(event.target.value)}
            >
              <option value="">Pilih jenis polutan</option>
              {options?.pollutants?.map((item) => (
                <option key={item} value={item}>
                  {formatPollutantLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="next-hour-prediction-actions">
          <button
            className="prediction-button"
            type="button"
            aria-busy={isPredicting}
            disabled={
              isPredicting ||
              isLoadingOptions ||
              Boolean(optionsError) ||
              !predictionLocation ||
              !predictionPollutant ||
              !selectedModel
            }
            onClick={handlePrediction}
          >
            {isPredicting && (
              <span className="prediction-button-spinner" aria-hidden="true" />
            )}
            {isPredicting ? 'Memproses...' : 'Prediksi'}
          </button>
        </div>
        {predictionError && (
          <p className="prediction-message error" role="alert">
            Prediksi gagal: {predictionError}
          </p>
        )}
        {predictionResult && (
          <div
            className="next-hour-prediction-results"
            ref={predictionResultsRef}
            aria-live="polite"
          >
            <section className="next-hour-prediction-result previous">
              <span>
                Data {formatPollutantLabel(predictionResult.pollutant)} 1 jam
                sebelumnya
              </span>
              <strong>
                {Number(
                  predictionResult.previous_hour_pollutant.value,
                ).toLocaleString('id-ID', { maximumFractionDigits: 2 })}{' '}
                µg/m³
              </strong>
              <p>
                {formatUtcDateInWib(
                  predictionResult.previous_hour_pollutant.time,
                )}{' '}
                ·{' '}
                {formatUtcTimeInWib(
                  predictionResult.previous_hour_pollutant.time,
                )}{' '}
                WIB
              </p>
            </section>
            <div className="next-hour-prediction-flow" aria-label="Prediksi satu jam ke depan">
              <span className="next-hour-prediction-flow-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M4 12h15m-6-6 6 6-6 6" />
                </svg>
              </span>
              <span className="next-hour-prediction-flow-label">
                Prediksi
                <strong>+1 jam</strong>
              </span>
            </div>
            <section className="next-hour-prediction-result forecast">
              <span>
                Prediksi {formatPollutantLabel(predictionResult.pollutant)}
              </span>
              <strong>
                {Number(predictionResult.prediction).toLocaleString('id-ID', {
                  maximumFractionDigits: 2,
                })}{' '}
                µg/m³
              </strong>
              {predictionCategory && (
                <span className={`air-quality-category ${predictionCategory.key}`}>
                  {predictionCategory.label}
                </span>
              )}
              <p>
                {formatUtcDateInWib(predictionResult.prediction_time)} ·{' '}
                {formatUtcTimeInWib(predictionResult.prediction_time)} WIB
              </p>
            </section>
          </div>
        )}
      </section>
    </section>
  )
}

export default PredictionPage
