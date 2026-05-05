import dayjs from 'dayjs';

export const DEFAULT_CHECKIN_HOUR = 14;

function splitCheckoutHour(rawHour) {
  const fallback = 12;
  const value = Number.isFinite(Number(rawHour)) ? Number(rawHour) : fallback;
  const extraDays = Math.floor(value / 24);
  const normalizedHour = ((value % 24) + 24) % 24;
  return { extraDays, normalizedHour, source: value };
}

function ensureDayjs(value) {
  const candidate = dayjs(value);
  return candidate.isValid() ? candidate : null;
}

export function normalizeStayRange(range, checkoutHour, options = {}) {
  if (!Array.isArray(range) || range.length !== 2) {
    return range;
  }
  const { checkinHour = DEFAULT_CHECKIN_HOUR, minNights = 1, arrivalTime } = options;
  const minStay = Number.isFinite(Number(minNights)) && Number(minNights) > 0 ? Number(minNights) : 1;
  const [rawStart, rawEnd] = range;
  const start = ensureDayjs(rawStart);
  const end = ensureDayjs(rawEnd);
  if (!start) {
    return range;
  }
  const baseStart = start.startOf('day');
  const arrivalMoment = arrivalTime ? ensureDayjs(arrivalTime) : null;
  let normalizedStart = baseStart
    .add(checkinHour, 'hour')
    .minute(0)
    .second(0)
    .millisecond(0);
  if (arrivalMoment && arrivalMoment.isValid()) {
    normalizedStart = baseStart
      .hour(arrivalMoment.hour())
      .minute(arrivalMoment.minute())
      .second(arrivalMoment.second())
      .millisecond(0);
  }

  const { extraDays, normalizedHour } = splitCheckoutHour(checkoutHour);

  let normalizedEnd = end
    ? end
        .startOf('day')
        .add(extraDays, 'day')
        .add(normalizedHour, 'hour')
        .minute(0)
        .second(0)
        .millisecond(0)
    : null;

  if (!normalizedEnd || !normalizedEnd.isAfter(normalizedStart)) {
    const base = normalizedStart.startOf('day').add(minStay, 'day');
    normalizedEnd = base
      .add(extraDays, 'day')
      .add(normalizedHour, 'hour')
      .minute(0)
      .second(0)
      .millisecond(0);
    if (!normalizedEnd.isAfter(normalizedStart)) {
      normalizedEnd = normalizedStart.add(minStay, 'day').minute(0).second(0).millisecond(0);
    }
  }

  return [normalizedStart, normalizedEnd];
}

export function computeStayNights(inputRange, checkoutHour, options = {}) {
  const { minNights = 1, checkinHour = DEFAULT_CHECKIN_HOUR, arrivalTime } = options;
  const minimum = Math.max(1, Number(minNights) || 1);
  const normalized = normalizeStayRange(inputRange, checkoutHour, { minNights, checkinHour, arrivalTime });
  if (!Array.isArray(normalized) || normalized.length !== 2) {
    return minimum;
  }
  const [startRaw, endRaw] = normalized;
  const start = ensureDayjs(startRaw);
  const end = ensureDayjs(endRaw);
  if (!start || !end || !start.isValid() || !end.isValid() || !start.isBefore(end)) {
    return minimum;
  }
  const { extraDays } = splitCheckoutHour(checkoutHour);
  const adjustedEnd = end.subtract(extraDays, 'day');
  if (!adjustedEnd.isValid()) {
    return minimum;
  }
  const startDay = start.startOf('day');
  const endDay = adjustedEnd.startOf('day');
  let nights = endDay.diff(startDay, 'day');
  if (!Number.isFinite(nights)) {
    nights = minimum;
  }
  if (nights < minimum) {
    nights = minimum;
  }
  return nights;
}

export function createDefaultStayRange(checkoutHour, options = {}) {
  const { baseDate = dayjs(), checkinHour = DEFAULT_CHECKIN_HOUR, minNights = 1, arrivalTime } = options;
  const baseDay = baseDate.startOf('day');
  let start = baseDay
    .add(checkinHour, 'hour')
    .minute(0)
    .second(0)
    .millisecond(0);
  const arrivalMoment = arrivalTime ? ensureDayjs(arrivalTime) : null;
  if (arrivalMoment && arrivalMoment.isValid()) {
    start = baseDay
      .hour(arrivalMoment.hour())
      .minute(arrivalMoment.minute())
      .second(arrivalMoment.second())
      .millisecond(0);
  }
  const tentativeEnd = start.add(Number(minNights) > 0 ? Number(minNights) : 1, 'day');
  return normalizeStayRange([start, tentativeEnd], checkoutHour, { checkinHour, minNights, arrivalTime });
}

export function clampRangeToToday(range, checkoutHour, options = {}) {
  const todayStart = dayjs().startOf('day');
  const normalized = normalizeStayRange(range, checkoutHour, options);
  if (!Array.isArray(normalized) || normalized.length !== 2) {
    return normalized;
  }
  const [start, end] = normalized;
  if (start.isBefore(todayStart)) {
    const arrivalMoment = options.arrivalTime ? ensureDayjs(options.arrivalTime) : null;
    let shiftedStart = todayStart
      .add(options.checkinHour ?? DEFAULT_CHECKIN_HOUR, 'hour')
      .minute(0)
      .second(0)
      .millisecond(0);
    if (arrivalMoment && arrivalMoment.isValid()) {
      shiftedStart = todayStart
        .hour(arrivalMoment.hour())
        .minute(arrivalMoment.minute())
        .second(arrivalMoment.second())
        .millisecond(0);
    }
    return normalizeStayRange([shiftedStart, end], checkoutHour, options);
  }
  return normalized;
}
