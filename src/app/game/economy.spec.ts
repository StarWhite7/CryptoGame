import { advanceMarketPrice, estimatePaybackHours, hourlyElectricityCost, hourlyMiningRevenue, hourlyNetIncome } from './economy';
import { ECONOMY, MACHINE_DEFS } from './game-data';

describe('game economy model', () => {
  it('computes revenue and energy costs from the central balance settings', () => {
    expect(hourlyMiningRevenue(1, 100)).toBe(180);
    expect(hourlyElectricityCost(0.05)).toBe(90);
    expect(hourlyNetIncome(1, 0.05, 100)).toBe(90);
  });

  it('keeps the starter miner profitable across bearish, reference and bullish markets', () => {
    expect(hourlyNetIncome(1, 0.05, ECONOMY.priceFloor)).toBe(18);
    expect(hourlyNetIncome(1, 0.05, ECONOMY.startingPrice)).toBe(90);
    expect(hourlyNetIncome(1, 0.05, ECONOMY.priceCeiling)).toBe(198);
  });

  it('estimates practical payback time for each machine investment', () => {
    expect(estimatePaybackHours(400, 3, 0.15, 100)).toBeCloseTo(400 / 270);
    expect(estimatePaybackHours(950, 8, 0.35, 100)).toBeCloseTo(950 / 810);
  });

  it('returns no payback estimate for a loss-making investment', () => {
    expect(estimatePaybackHours(100, 0.01, 10, 60)).toBeNull();
  });

  it('bounds market prices and pulls extreme prices back toward the reference', () => {
    expect(advanceMarketPrice(10000, 1)).toBe(160);
    expect(advanceMarketPrice(1, 0)).toBe(60);
    expect(advanceMarketPrice(160, 0.5)).toBeLessThan(160);
  });

  it.each(MACHINE_DEFS.filter((machine) => machine.price > 0))('keeps $name viable with a bounded reference payback', (machine) => {
    const payback = estimatePaybackHours(machine.price, machine.hashrate, machine.power, ECONOMY.startingPrice);
    expect(hourlyNetIncome(machine.hashrate, machine.power, ECONOMY.priceFloor)).toBeGreaterThan(0);
    expect(payback).not.toBeNull();
    expect(payback).toBeGreaterThanOrEqual(1.4);
    expect(payback).toBeLessThanOrEqual(3);
  });

  it('allows the operator role to cover its wage at the reference price when fully utilized', () => {
    const hourlySaleCapacity = ECONOMY.autoSaleCrxAmount * 3600 / ECONOMY.autoSaleIntervalSeconds;
    const operatorWage = 250;
    expect(hourlySaleCapacity).toBe(6);
    expect(hourlySaleCapacity * ECONOMY.startingPrice - operatorWage).toBe(350);
  });
});