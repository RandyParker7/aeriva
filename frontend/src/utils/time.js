const INDONESIA_TIME_ZONE = 'Asia/Jakarta'
const UTC_OFFSET_HOURS = 7

function parseUtcTimestamp(timestamp) {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)
  const date = new Date(hasTimeZone ? timestamp : `${timestamp}Z`)

  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid UTC timestamp: ${timestamp}`)
  }

  return date
}

function getIndonesiaDateTimeParts(timestamp) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDONESIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(parseUtcTimestamp(timestamp))

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

export function formatUtcDateTimeInWib(timestamp) {
  const { day, month, year, hour, minute } =
    getIndonesiaDateTimeParts(timestamp)

  return `${day}/${month}/${year} ${hour}:${minute}`
}

export function formatUtcDateInWib(timestamp) {
  const { day, month, year } = getIndonesiaDateTimeParts(timestamp)

  return `${day}/${month}/${year}`
}

export function formatUtcTimeInWib(timestamp) {
  const { hour, minute } = getIndonesiaDateTimeParts(timestamp)

  return `${hour}:${minute}`
}

export function wibDateTimeToUtcIso(date, hour) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError('Invalid WIB date or hour')
  }

  const [, year, month, day] = match.map(Number)
  const utcTimestamp = Date.UTC(
    year,
    month - 1,
    day,
    hour - UTC_OFFSET_HOURS,
  )

  return new Date(utcTimestamp).toISOString()
}
