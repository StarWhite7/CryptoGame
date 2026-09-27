import { ECONOMY } from './game-data';

export function hourlyMiningRevenue(hashrate: number, price: number): number {
  if (!Number.isFinite(hashrate) || !Number.isFinite(price)) return 0;
  return Math.max(0, hashrate) * ECONOMY.miningCrxPerHashSecond * 3600 * Math.max(0, price);
}

export function hourlyElectricityCost(power: number): number {
  if (!Number.isFinite(power)) return 0;
  return Math.max(0, power) * ECONOMY.electricityCostPerKwHour;
}

export function hourlyNetIncome(hashrate: number, power: number, price: number): number {
  return hourlyMiningRevenue(hashrate, price) - hourlyElectricityCost(power);
}

export function estimatePaybackHours(investment: number, hashrate: number, power: number, price: number): number | null {
  const netIncome = hourlyNetIncome(hashrate, power, price);
  return Number.isFinite(investment) && investment > 0 && netIncome > 0 ? investment / netIncome : null;
}

export function advanceMarketPrice(currentPrice: number, randomValue: number): number {
  const drift = (ECONOMY.startingPrice - currentPrice) * ECONOMY.marketMeanReversion;
  const volatility = (Math.max(0, Math.min(1, randomValue)) * 2 - 1) * ECONOMY.startingPrice * ECONOMY.marketVolatility;
  return Math.max(ECONOMY.priceFloor, Math.min(ECONOMY.priceCeiling, currentPrice + drift + volatility));
}