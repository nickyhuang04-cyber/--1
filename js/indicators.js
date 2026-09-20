// 技術指標計算（純函式，輸入/輸出皆為數值陣列，缺值以 null 表示）

function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// 以序列中第一個非 null 值起算的 EMA，前 period-1 筆為 null，第 period 筆以 SMA 種子起算
function emaFromSeries(values, period) {
  const out = new Array(values.length).fill(null);
  const startIdx = values.findIndex((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (startIdx === -1) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  let count = 0;
  let prev = null;
  for (let i = startIdx; i < values.length; i++) {
    if (prev === null) {
      sum += values[i];
      count++;
      if (count === period) {
        prev = sum / period;
        out[i] = prev;
      }
    } else {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function kd(highs, lows, closes, period = 9) {
  const k = new Array(closes.length).fill(null);
  const d = new Array(closes.length).fill(null);
  let prevK = 50;
  let prevD = 50;
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    const rsv = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
    const kVal = (prevK * 2) / 3 + rsv / 3;
    const dVal = (prevD * 2) / 3 + kVal / 3;
    k[i] = kVal;
    d[i] = dVal;
    prevK = kVal;
    prevD = dVal;
  }
  return { k, d };
}

function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = emaFromSeries(closes, fast);
  const emaSlow = emaFromSeries(closes, slow);
  const diff = closes.map((_, i) => (emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i] - emaSlow[i] : null));
  const signal = emaFromSeries(diff, signalPeriod);
  const hist = diff.map((v, i) => (v !== null && signal[i] !== null ? v - signal[i] : null));
  return { macd: diff, signal, hist };
}
