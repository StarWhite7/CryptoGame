import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GameService } from './game.service';

describe('GameService transactions', () => {
  let game: GameService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    game = TestBed.inject(GameService);
    game.state.update((state) => ({ ...state, cash: 100, crx: 2 }));
  });

  afterEach(() => {
    game.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rejects invalid CRX sale amounts without corrupting balances', () => {
    game.sellCrx(Number.NaN);
    game.sellCrx(-1);

    expect(game.state().cash).toBe(100);
    expect(game.state().crx).toBe(2);
  });

  it('rejects invalid casino wagers without corrupting balances', () => {
    game.coinFlip('pile', Number.NaN);
    game.blackjack(-5);

    expect(game.state().cash).toBe(100);
    expect(game.state().crx).toBe(2);
  });

  it('does not allow the same property upgrade to be charged twice', () => {
    game.state.update((state) => ({ ...state, cash: 2000 }));
    game.buyPowerUpgrade('breaker_t1');
    const cashAfterFirstPurchase = game.state().cash;
    game.buyPowerUpgrade('breaker_t1');

    expect(game.state().cash).toBe(cashAfterFirstPurchase);
    expect(game.property()?.powerBonus).toBe(5);
  });

  it('does not charge for premature repairs and scales repair cost with damage', () => {
    game.state.update((state) => ({
      ...state,
      cash: 2000,
      properties: { ...state.properties, old_town_studio: { ...state.properties['old_town_studio'], machines: [{ uid: 'm1', typeId: 'laptop_gaming', on: false, health: 0.99 }] } },
    }));
    game.repairMachine('old_town_studio', 'm1');
    expect(game.state().cash).toBe(2000);

    game.state.update((state) => ({
      ...state,
      properties: { ...state.properties, old_town_studio: { ...state.properties['old_town_studio'], machines: [{ uid: 'm1', typeId: 'laptop_gaming', on: false, health: 0.5 }] } },
    }));
    game.repairMachine('old_town_studio', 'm1');
    expect(game.state().cash).toBe(1940);
    expect(game.property()?.machines[0].health).toBe(1);
  });

  it('requires the previous property before buying a later building', () => {
    game.state.update((state) => ({ ...state, cash: 100000 }));
    game.buyProperty('small_warehouse');

    expect(game.state().ownedPropertyIds).toEqual(['old_town_studio']);
    expect(game.canBuyProperty('small_warehouse')).toBe(false);
    expect(game.canBuyProperty('garage')).toBe(true);
  });

  it('requires two installed machines to finish the tutorial, not two in inventory', () => {
    game.state.update((state) => ({
      ...state,
      cash: 1000,
      crx: 0,
      tutorialStep: game.tutorialSteps.length - 1,
      stats: { ...state.stats, visitedShop: true, machinesBought: 1 },
    }));
    game.buyMachine('laptop_gaming');
    expect(game.state().tutorialStep).toBe(game.tutorialSteps.length - 1);
    game.placeMachine('old_town_studio', 'laptop_used');
    expect(game.state().tutorialStep).toBe(game.tutorialSteps.length - 1);
    game.placeMachine('old_town_studio', 'laptop_gaming');
    expect(game.state().tutorialStep).toBe(game.tutorialSteps.length);
  });

  it('normalizes malformed and legacy saves without leaving the player stranded', () => {
    const save = JSON.stringify({
      cash: 0,
      crx: -1,
      crxPrice: 100000,
      inventory: [],
      ownedPropertyIds: ['old_town_studio', 'missing_property'],
      properties: { old_town_studio: { machines: [{ uid: 'm1', typeId: 'unknown', on: true, health: 1 }, { uid: 'm1', typeId: 'laptop_used', on: true, health: 0 }] } },
      priceHistory: [],
    });
    vi.stubGlobal('localStorage', { getItem: () => save, setItem: vi.fn(), removeItem: vi.fn() });

    expect(game.continueGame()).toBe(true);
    expect(game.state().cash).toBe(0);
    expect(game.state().crx).toBe(0);
    expect(game.state().crxPrice).toBe(160);
    expect(game.state().ownedPropertyIds).toEqual(['old_town_studio']);
    expect(game.state().properties['old_town_studio'].machines).toHaveLength(1);
    expect(game.state().properties['old_town_studio'].machines[0].health).toBe(0);
    expect(game.state().inventory).toEqual([{ typeId: 'laptop_used', qty: 1 }]);
  });

  it('migrates legacy upgrade totals so purchased improvements cannot be duplicated', () => {
    const save = JSON.stringify({
      cash: 2000,
      ownedPropertyIds: ['old_town_studio'],
      properties: { old_town_studio: { coolingBonus: 5, powerBonus: 5, roomTemp: 22, machines: [] } },
      inventory: [{ typeId: 'laptop_used', qty: 1 }],
    });
    vi.stubGlobal('localStorage', { getItem: () => save, setItem: vi.fn(), removeItem: vi.fn() });
    expect(game.continueGame()).toBe(true);
    game.buyCooling('fan');
    game.buyPowerUpgrade('breaker_t1');

    expect(game.state().cash).toBe(2000);
    expect(game.property()?.coolingItems).toContain('fan');
    expect(game.property()?.powerUpgrades).toContain('breaker_t1');
  });

  it('reports an unreadable save without replacing the current state', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{invalid json', setItem: vi.fn(), removeItem: vi.fn() });
    expect(game.continueGame()).toBe(false);
    expect(game.state().cash).toBe(100);
    expect(game.toasts().at(-1)?.message).toContain('Impossible de lire');
  });

  it('charges electricity while mining and freezes the simulation when paused', () => {
    game.state.update((state) => ({
      ...state,
      cash: 200,
      crx: 0,
      tutorialStep: game.tutorialSteps.length,
      milestonesDone: Object.fromEntries(game.milestones.map((milestone) => [milestone.id, true])),
      properties: { ...state.properties, old_town_studio: { ...state.properties['old_town_studio'], machines: [{ uid: 'm1', typeId: 'laptop_used', on: true, health: 1 }] } },
    }));
    vi.useFakeTimers();
    game.start();
    vi.advanceTimersByTime(1000);

    expect(game.state().playSeconds).toBe(1);
    expect(game.state().crx).toBeCloseTo(0.0005);
    expect(game.state().cash).toBeCloseTo(199.975);

    game.modal.set('pause');
    vi.advanceTimersByTime(5000);
    expect(game.state().playSeconds).toBe(1);
  });

  it('charges staff payroll, supports dismissal and automates CRX sales', () => {
    game.state.update((state) => ({ ...state, cash: 20000 }));
    game.hireStaff('technician');
    const cashAfterHire = game.state().cash;
    game.hireStaff('technician');
    expect(game.state().cash).toBe(cashAfterHire);
    expect(game.staffPayrollPerHour()).toBe(90);
    game.fireStaff('technician');
    expect(game.staffPayrollPerHour()).toBe(0);

    game.state.update((state) => ({
      ...state,
      cash: 1000,
      crx: 0,
      tutorialStep: game.tutorialSteps.length,
      milestonesDone: Object.fromEntries(game.milestones.map((milestone) => [milestone.id, true])),
      staff: { ...state.staff, operator: true },
      autoSaleTimer: 1,
      properties: { ...state.properties, old_town_studio: { ...state.properties['old_town_studio'], machines: [{ uid: 'm1', typeId: 'laptop_used', on: true, health: 1 }] } },
    }));
    vi.useFakeTimers();
    game.start();
    vi.advanceTimersByTime(1000);

    expect(game.state().crx).toBe(0);
    expect(game.state().stats.salesCount).toBe(1);
    expect(game.state().cash).toBeCloseTo(1000 - 0.025 - 250 / 3600 + 0.05);
  });
});