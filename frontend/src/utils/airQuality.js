
const pollutantThresholds = {
  'PM2.5': {
    good: 15.5,
    moderate: 55.4,
    unhealthy: 150.4,
    veryUnhealthy: 250.4,
  },
  PM2_5: {
    good: 15.5,
    moderate: 55.4,
    unhealthy: 150.4,
    veryUnhealthy: 250.4,
  },
  CO: {
    good: 4000,
    moderate: 8000,
    unhealthy: 15000,
    veryUnhealthy: 30000,
  },
  NO2: {
    good: 80,
    moderate: 200,
    unhealthy: 1130,
    veryUnhealthy: 2260,
  },
  'NO₂': {
    good: 80,
    moderate: 200,
    unhealthy: 1130,
    veryUnhealthy: 2260,
  },
  SO2: {
    good: 52,
    moderate: 180,
    unhealthy: 400,
    veryUnhealthy: 800,
  },
  'SO₂': {
    good: 52,
    moderate: 180,
    unhealthy: 400,
    veryUnhealthy: 800,
  },
  O3: {
    good: 120,
    moderate: 235,
    unhealthy: 400,
    veryUnhealthy: 800,
  },
  'O₃': {
    good: 120,
    moderate: 235,
    unhealthy: 400,
    veryUnhealthy: 800,
  },
}

export function getAirQualityCategory(pollutant, concentration) {
  const thresholds = pollutantThresholds[pollutant]

  if (!thresholds || !Number.isFinite(concentration)) {
    return null
  }

  if (concentration < 0) {
    return null
  }

  if (concentration <= thresholds.good) {
    return { key: 'good', label: 'Baik' }
  }

  if (concentration <= thresholds.moderate) {
    return { key: 'moderate', label: 'Sedang' }
  }

  if (concentration <= thresholds.unhealthy) {
    return { key: 'unhealthy', label: 'Tidak Sehat' }
  }

  if (concentration <= thresholds.veryUnhealthy) {
    return { key: 'veryUnhealthy', label: 'Sangat Tidak Sehat' }
  }

  return { key: 'hazardous', label: 'Berbahaya' }
}