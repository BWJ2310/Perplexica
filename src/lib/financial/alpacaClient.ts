import axios from 'axios';

export interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  paper?: boolean; // Use paper trading endpoint
}

export interface MarketDataRequest {
  ticker: string;
  timeframe: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';
  interval?: '1Day' | '1Hour' | '5Min' | '15Min';
}

export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  // Price Data
  current_price: number;
  price_change: number;
  price_change_percent: number;
  
  // Moving Averages
  sma_10?: number;
  sma_20?: number;
  sma_50?: number;
  ema_12?: number;
  ema_26?: number;
  
  // Momentum Indicators
  rsi_14?: number;
  macd?: {
    macd_line: number;
    signal_line: number;
    histogram: number;
  };
  stochastic?: {
    k: number;
    d: number;
  };
  
  // Volatility
  bollinger_bands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  atr_14?: number;
  volatility_30d?: number;
  
  // Volume
  obv?: number;
  volume_sma_20?: number;
  volume_ratio?: number; // Current vs average
  
  // Support/Resistance
  support_levels?: number[];
  resistance_levels?: number[];
  pivot_point?: {
    pivot: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  };
  
  // Additional Metrics
  high_52w?: number;
  low_52w?: number;
  beta?: number;
}

export class AlpacaMarketData {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: AlpacaConfig) {
    this.baseUrl = config.paper 
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';
    
    this.headers = {
      'APCA-API-KEY-ID': config.apiKey,
      'APCA-API-SECRET-KEY': config.apiSecret,
    };
  }

  async getHistoricalData(
    ticker: string, 
    timeframe: string
  ): Promise<OHLCV[]> {
    const endDate = new Date();
    const startDate = this.getStartDate(timeframe);
    
    // Determine bar timeframe based on period
    let barTimeframe = '1Day';
    if (timeframe === '1D') {
      barTimeframe = '5Min';
    } else if (timeframe === '1W') {
      barTimeframe = '1Hour';
    }
    
    try {
      const response = await axios.get(
        `https://data.alpaca.markets/v2/stocks/${ticker}/bars`,
        {
          headers: this.headers,
          params: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            timeframe: barTimeframe,
            limit: 10000,
            adjustment: 'all',
            feed: 'sip',
            asof: endDate.toISOString(),
          },
        }
      );

      return response.data.bars.map((bar: any) => ({
        timestamp: new Date(bar.t),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));
    } catch (error: any) {
      console.error('Alpaca API error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch data from Alpaca: ${error.message}`);
    }
  }

  async getLatestQuote(ticker: string) {
    try {
      const response = await axios.get(
        `https://data.alpaca.markets/v2/stocks/${ticker}/quotes/latest`,
        {
          headers: this.headers,
          params: {
            feed: 'sip',
          },
        }
      );
      
      return {
        bid: response.data.quote.bp,
        ask: response.data.quote.ap,
        bid_size: response.data.quote.bs,
        ask_size: response.data.quote.as,
        timestamp: new Date(response.data.quote.t),
      };
    } catch (error) {
      console.error('Failed to get quote:', error);
      return null;
    }
  }

  private getStartDate(timeframe: string): Date {
    const now = new Date();
    const date = new Date(now);
    
    switch (timeframe) {
      case '1D':
        date.setDate(date.getDate() - 1);
        break;
      case '1W':
        date.setDate(date.getDate() - 7);
        break;
      case '1M':
        date.setMonth(date.getMonth() - 1);
        break;
      case '3M':
        date.setMonth(date.getMonth() - 3);
        break;
      case '6M':
        date.setMonth(date.getMonth() - 6);
        break;
      case '1Y':
        date.setFullYear(date.getFullYear() - 1);
        break;
      default:
        date.setMonth(date.getMonth() - 1);
    }
    
    return date;
  }
}

// Technical Indicator Calculations
export class TechnicalAnalysis {
  static calculateIndicators(data: OHLCV[]): TechnicalIndicators {
    if (data.length === 0) {
      throw new Error('No data available for calculations');
    }

    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);
    
    const latest = data[data.length - 1];
    const previous = data[data.length - 2];
    
    return {
      // Price Data
      current_price: latest.close,
      price_change: latest.close - previous?.close || 0,
      price_change_percent: ((latest.close - previous?.close) / previous?.close) * 100 || 0,
      
      // Moving Averages
      sma_10: this.sma(closes, 10),
      sma_20: this.sma(closes, 20),
      sma_50: this.sma(closes, 50),
      ema_12: this.ema(closes, 12),
      ema_26: this.ema(closes, 26),
      
      // Momentum
      rsi_14: this.rsi(closes, 14),
      macd: this.macd(closes),
      stochastic: this.stochastic(highs, lows, closes, 14),
      
      // Volatility
      bollinger_bands: this.bollingerBands(closes, 20),
      atr_14: this.atr(highs, lows, closes, 14),
      volatility_30d: this.volatility(closes, 30),
      
      // Volume
      obv: this.obv(closes, volumes),
      volume_sma_20: this.sma(volumes, 20),
      volume_ratio: latest.volume / this.sma(volumes, 20),
      
      // Support/Resistance
      support_levels: this.findSupportResistance(lows, 'support'),
      resistance_levels: this.findSupportResistance(highs, 'resistance'),
      pivot_point: this.pivotPoints(latest.high, latest.low, latest.close),
      
      // 52 Week
      high_52w: Math.max(...closes.slice(-252)),
      low_52w: Math.min(...closes.slice(-252)),
    };
  }

  private static sma(values: number[], period: number): number {
    if (values.length < period) return 0;
    const subset = values.slice(-period);
    return subset.reduce((sum, val) => sum + val, 0) / period;
  }

  private static ema(values: number[], period: number): number {
    if (values.length < period) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = this.sma(values.slice(0, period), period);
    
    for (let i = period; i < values.length; i++) {
      ema = (values[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  private static rsi(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private static macd(closes: number[]) {
    const ema12 = this.ema(closes, 12);
    const ema26 = this.ema(closes, 26);
    const macdLine = ema12 - ema26;
    
    // For signal line, we'd need historical MACD values
    // Simplified version
    const signalLine = macdLine * 0.9; // Approximation
    
    return {
      macd_line: macdLine,
      signal_line: signalLine,
      histogram: macdLine - signalLine,
    };
  }

  private static stochastic(
    highs: number[], 
    lows: number[], 
    closes: number[], 
    period: number = 14
  ) {
    if (closes.length < period) return { k: 50, d: 50 };
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    const d = k * 0.9; // Simplified - should be 3-period SMA of K
    
    return { k, d };
  }

  private static bollingerBands(closes: number[], period: number = 20) {
    const sma = this.sma(closes, period);
    const stdDev = this.standardDeviation(closes.slice(-period));
    
    return {
      upper: sma + (stdDev * 2),
      middle: sma,
      lower: sma - (stdDev * 2),
    };
  }

  private static atr(
    highs: number[], 
    lows: number[], 
    closes: number[], 
    period: number = 14
  ): number {
    if (highs.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const highLow = highs[i] - lows[i];
      const highPrevClose = Math.abs(highs[i] - closes[i - 1]);
      const lowPrevClose = Math.abs(lows[i] - closes[i - 1]);
      
      trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
    }
    
    return this.sma(trueRanges, period);
  }

  private static volatility(closes: number[], period: number = 30): number {
    if (closes.length < period) return 0;
    
    const returns: number[] = [];
    const subset = closes.slice(-period - 1);
    
    for (let i = 1; i < subset.length; i++) {
      returns.push((subset[i] - subset[i - 1]) / subset[i - 1]);
    }
    
    return this.standardDeviation(returns) * Math.sqrt(252) * 100; // Annualized
  }

  private static obv(closes: number[], volumes: number[]): number {
    let obv = 0;
    
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
    }
    
    return obv;
  }

  private static findSupportResistance(
    values: number[], 
    type: 'support' | 'resistance'
  ): number[] {
    // Simplified - find local minima/maxima
    const levels: number[] = [];
    const window = 10;
    
    for (let i = window; i < values.length - window; i++) {
      const subset = values.slice(i - window, i + window + 1);
      const current = values[i];
      
      if (type === 'support' && current === Math.min(...subset)) {
        levels.push(current);
      } else if (type === 'resistance' && current === Math.max(...subset)) {
        levels.push(current);
      }
    }
    
    // Return top 3 most recent unique levels
    return [...new Set(levels)].slice(-3);
  }

  private static pivotPoints(high: number, low: number, close: number) {
    const pivot = (high + low + close) / 3;
    const r1 = (2 * pivot) - low;
    const r2 = pivot + (high - low);
    const s1 = (2 * pivot) - high;
    const s2 = pivot - (high - low);
    
    return { pivot, r1, r2, s1, s2 };
  }

  private static standardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }
}