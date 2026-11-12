const pollutantUnits = {
  'PM2.5': 'µg/m³',
  'PM2_5': 'µg/m³',
  CO: 'µg/m³',
  NO2: 'µg/m³',
  'NO₂': 'µg/m³',
  SO2: 'µg/m³',
  'SO₂': 'µg/m³',
  O3: 'µg/m³',
  'O₃': 'µg/m³',
}

export function getPollutantUnit(pollutant) {
  return pollutantUnits[pollutant] ?? ''
}

export function formatPollutantLabel(pollutant) {
  const unit = getPollutantUnit(pollutant)
  return unit ? `${pollutant} (${unit})` : pollutant
}
