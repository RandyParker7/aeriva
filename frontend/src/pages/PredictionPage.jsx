import { useEffect, useState } from 'react'
import './PredictionPage.css'

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

function PredictionPage() {
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
          prediction_time: `${predictionDate}T${String(predictionHour).padStart(2, '0')}:00`,
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
                  <h2>Data 1 Jam Sebelumnya</h2>
                  <p className="prediction-result-label">
                    {predictionResult.pollutant}
                  </p>
                  <strong>
                    {predictionResult.previous_hour_pollutant.value}
                  </strong>
                  <p className="prediction-result-meta">
                    {predictionResult.previous_hour_pollutant.time}
                  </p>
                </section>
                <section className="prediction-result">
                  <h2>Hasil Prediksi</h2>
                  <p>
                    <strong>{predictionResult.prediction}</strong>
                  </p>
                  <p>
                    {predictionResult.location} · {predictionResult.pollutant} ·
                    {' '}{predictionResult.scenario} ·{' '}
                    {predictionResult.prediction_time}
                  </p>
                  <p>
                    Koordinat: {Number(predictionResult.latitude).toFixed(5)},{' '}
                    {Number(predictionResult.longitude).toFixed(5)}
                  </p>
                </section>
              </div>
            )}
        </form>
      </section>
    </section>
  )
}

export default PredictionPage
