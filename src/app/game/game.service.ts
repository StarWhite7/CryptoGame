import { Injectable, signal } from '@angular/core';
import { COOLING_ITEMS, ECONOMY, MACHINE_DEFS, MILESTONES, POWER_UPGRADES, PROPERTY_DEFS, SECURITY_ITEM, STAFF_DEFS, TUTORIAL_STEPS, machineDef, propertyDef } from './game-data';
import { GamePanel, GameState, GameToast, Machine, PropertyState, ToastKind } from './game.models';
import { advanceMarketPrice, estimatePaybackHours, hourlyElectricityCost, hourlyNetIncome } from './economy';

const SAVE_KEY = 'cryptocity_save_v1';

function defaultState(): GameState {
  return {
    cash: ECONOMY.startingCash,
    crx: 0,
    crxPrice: ECONOMY.startingPrice,
    priceHistory: [ECONOMY.startingPrice],
    inventory: [{ typeId: 'laptop_used', qty: 1 }],
    properties: { old_town_studio: { coolingBonus: 0, powerBonus: 0, roomTemp: 22, coolingItems: [], powerUpgrades: [], machines: [] } },
    ownedPropertyIds: ['old_town_studio'],
    upgrades: { security: false },
    milestonesDone: {},
    tutorialStep: 0,
    playSeconds: 0,
    marketTimer: ECONOMY.marketIntervalSeconds,
    eventTimer: ECONOMY.eventIntervalMinSeconds,
    autoSaleTimer: ECONOMY.autoSaleIntervalSeconds,
    staff: { technician: false, energy_manager: false, operator: false },
    stats: { totalMined: 0, salesCount: 0, machinesBought: 0, visitedShop: false, currentHashrate: 0, cashEarnedFromSales: 0 },
    eventLog: [],
    activePropertyId: 'old_town_studio',
  };
}

function restoreInstalledIds(definitions: { id: string; amount: number }[], savedIds: unknown, bonus: number): string[] {
  if (Array.isArray(savedIds)) {
    return [...new Set(savedIds.filter((id): id is string => typeof id === 'string' && definitions.some((definition) => definition.id === id)))];
  }
  let remainder = Math.max(0, Number.isFinite(bonus) ? bonus : 0);
  const restored: string[] = [];
  for (const definition of [...definitions].sort((left, right) => right.amount - left.amount)) {
    if (definition.amount <= remainder + 0.001) {
      restored.push(definition.id);
      remainder -= definition.amount;
    }
  }
  return remainder > 0.001 ? definitions.map((definition) => definition.id) : restored;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly state = signal<GameState>(defaultState());
  readonly activePanel = signal<GamePanel>('home');
  readonly toasts = signal<GameToast[]>([]);
  readonly modal = signal<string | null>(null);
  readonly casinoOutcome = signal('');
  readonly machineDefs = MACHINE_DEFS;
  readonly propertyDefs = PROPERTY_DEFS;
  readonly coolingItems = COOLING_ITEMS;
  readonly securityItem = SECURITY_ITEM;
  readonly staffDefs = STAFF_DEFS;
  readonly powerUpgrades = POWER_UPGRADES;
  readonly milestones = MILESTONES;
  readonly tutorialSteps = TUTORIAL_STEPS;
  private tickHandle?: ReturnType<typeof setInterval>;
  private uidCounter = 1;
  private toastId = 0;

  hasSave(): boolean {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  newGame(): void {
    this.state.set(defaultState());
    this.uidCounter = 1;
    this.activePanel.set('home');
    this.modal.set(null);
    this.casinoOutcome.set('');
    this.start();
    this.notify('Nouvelle partie démarrée. Bonne chance !', 'gold');
  }

  continueGame(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<GameState> | null;
      const merged = this.normalizeSave(parsed && typeof parsed === 'object' ? parsed : {});
      this.state.set(merged);
      this.uidCounter = Math.max(0, ...Object.values(merged.properties).flatMap((property) => property.machines.map((machine) => Number(machine.uid.match(/^m(\d+)$/)?.[1]) || 0))) + 1;
      this.activePanel.set('home');
      this.start();
      this.notify('Partie chargée.', 'gold');
      return true;
    } catch {
      this.notify('Impossible de lire cette sauvegarde. Elle n’a pas été modifiée.', 'danger');
      return false;
    }
  }

  save(manual = false): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state()));
      if (manual) this.notify('Partie sauvegardée.', 'gold');
    } catch { this.notify('Erreur de sauvegarde.', 'danger'); }
  }

  resetSave(): void {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* Storage can be disabled by the browser. */ }
    this.notify('Sauvegarde effacée.', 'warn');
  }

  start(): void {
    this.stop();
    this.tickHandle = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = undefined;
  }

  showPanel(panel: GamePanel): void {
    this.activePanel.set(panel);
    if (panel === 'shop') this.state.update((state) => ({ ...state, stats: { ...state.stats, visitedShop: true } }));
  }

  property(id = this.state().activePropertyId): PropertyState | undefined { return this.state().properties[id]; }
  propertyDefinition(id = this.state().activePropertyId) { return propertyDef(id); }
  machineDefinition(id: string) { return machineDef(id); }
  machineHourlyNet(id: string): number {
    const machine = machineDef(id);
    return machine ? hourlyNetIncome(machine.hashrate, machine.power, this.state().crxPrice) : 0;
  }
  machinePaybackHours(id: string): number | null {
    const machine = machineDef(id);
    return machine ? estimatePaybackHours(machine.price, machine.hashrate, machine.power, this.state().crxPrice) : null;
  }
  propertyHourlyOperatingCost(id: string): number {
    const property = this.state().properties[id];
    if (!property) return 0;
    const power = property.machines.filter((machine) => machine.on && machine.health > 0).reduce((sum, machine) => sum + (machineDef(machine.typeId)?.power ?? 0), 0);
    const electricityMultiplier = this.state().staff.energy_manager ? 0.85 : 1;
    return hourlyElectricityCost(power) * electricityMultiplier + this.staffPayrollPerHour();
  }
  setActiveProperty(id: string): void {
    if (!this.state().ownedPropertyIds.includes(id)) return;
    this.state.update((state) => ({ ...state, activePropertyId: id }));
  }

  canBuyProperty(id: string): boolean {
    const definition = propertyDef(id);
    const state = this.state();
    return !!definition && !state.ownedPropertyIds.includes(id) && (!definition.requires || state.ownedPropertyIds.includes(definition.requires)) && state.cash >= definition.price;
  }

  buyMachine(id: string): void {
    const definition = machineDef(id);
    const state = this.state();
    if (!definition || state.cash < definition.price) return this.notify('Fonds insuffisants.', 'danger');
    const inventory = [...state.inventory];
    const existing = inventory.find((item) => item.typeId === id);
    if (existing) existing.qty++;
    else inventory.push({ typeId: id, qty: 1 });
    this.state.set({ ...state, cash: state.cash - definition.price, inventory, stats: { ...state.stats, machinesBought: state.stats.machinesBought + 1 } });
    this.notify(`${definition.name} ajouté à l’inventaire.`, 'gold');
    this.checkProgress();
  }

  buyCooling(id: string): void {
    const item = COOLING_ITEMS.find((entry) => entry.id === id);
    const state = this.state();
    const property = state.properties[state.activePropertyId];
    if (!item || !property) return this.notify('Équipement indisponible.', 'warn');
    if (property.coolingItems.includes(id)) return this.notify('Déjà installé dans cette propriété.', 'warn');
    if (state.cash < item.price) return this.notify('Fonds insuffisants.', 'danger');
    this.state.set({ ...state, cash: state.cash - item.price, properties: { ...state.properties, [state.activePropertyId]: { ...property, coolingBonus: property.coolingBonus + item.cooling, coolingItems: [...property.coolingItems, id] } } });
    this.notify(`${item.name} installé.`, 'gold');
  }

  buySecurity(): void {
    const state = this.state();
    if (state.upgrades.security) return this.notify('Déjà acquis.', 'warn');
    if (state.cash < SECURITY_ITEM.price) return this.notify('Fonds insuffisants.', 'danger');
    this.state.set({ ...state, cash: state.cash - SECURITY_ITEM.price, upgrades: { security: true } });
    this.notify('Système de sécurité activé.', 'gold');
  }

  hireStaff(id: string): void {
    const employee = STAFF_DEFS.find((entry) => entry.id === id);
    const state = this.state();
    if (!employee) return this.notify('Poste indisponible.', 'warn');
    if (state.staff[employee.id]) return this.notify('Ce poste est déjà occupé.', 'warn');
    if (state.cash < employee.price) return this.notify('Fonds insuffisants.', 'danger');
    this.state.set({ ...state, cash: state.cash - employee.price, staff: { ...state.staff, [employee.id]: true } });
    this.notify(`${employee.name} rejoint l’équipe.`, 'gold');
  }

  fireStaff(id: string): void {
    if (!(id in this.state().staff)) return;
    this.state.update((state) => ({ ...state, staff: { ...state.staff, [id]: false } }));
    this.notify('Le poste a été supprimé; la masse salariale diminue.', 'warn');
  }

  staffPayrollPerHour(): number {
    const state = this.state();
    return STAFF_DEFS.reduce((sum, employee) => sum + (state.staff[employee.id] ? employee.wagePerHour : 0), 0);
  }

  buyPowerUpgrade(id: string): void {
    const item = POWER_UPGRADES.find((entry) => entry.id === id);
    const state = this.state();
    const property = state.properties[state.activePropertyId];
    if (!item || !property) return this.notify('Équipement indisponible.', 'warn');
    if (property.powerUpgrades.includes(id)) return this.notify('Déjà installé dans cette propriété.', 'warn');
    if (state.cash < item.price) return this.notify('Fonds insuffisants.', 'danger');
    this.state.set({ ...state, cash: state.cash - item.price, properties: { ...state.properties, [state.activePropertyId]: { ...property, powerBonus: property.powerBonus + item.power, powerUpgrades: [...property.powerUpgrades, id] } } });
    this.notify(`${item.name} installé.`, 'gold');
  }

  buyProperty(id: string): void {
    const definition = propertyDef(id);
    const state = this.state();
    if (!definition || state.ownedPropertyIds.includes(id)) return this.notify('Vous possédez déjà cette propriété.', 'warn');
    if (definition.requires && !state.ownedPropertyIds.includes(definition.requires)) return this.notify('Achetez d’abord la propriété précédente.', 'warn');
    if (state.cash < definition.price) return this.notify('Fonds insuffisants pour cette propriété.', 'danger');
    this.state.set({ ...state, cash: state.cash - definition.price, ownedPropertyIds: [...state.ownedPropertyIds, id], properties: { ...state.properties, [id]: { coolingBonus: 0, powerBonus: 0, roomTemp: definition.ambient, coolingItems: [], powerUpgrades: [], machines: [] } }, activePropertyId: id });
    this.notify(`${definition.name} vous appartient désormais !`, 'gold');
    this.checkProgress();
  }

  placeMachine(propertyId: string, typeId: string): void {
    const state = this.state();
    const definition = propertyDef(propertyId);
    const property = state.properties[propertyId];
    const inventory = state.inventory.find((item) => item.typeId === typeId);
    if (!machineDef(typeId)) return this.notify('Machine inconnue.', 'danger');
    if (!definition || !property || property.machines.length >= definition.slots) return this.notify('Plus d’emplacement disponible ici.', 'danger');
    if (!inventory || inventory.qty <= 0) return this.notify('Machine indisponible en inventaire.', 'danger');
    const nextInventory = state.inventory.map((item) => item.typeId === typeId ? { ...item, qty: item.qty - 1 } : item).filter((item) => item.qty > 0);
    const machine: Machine = { uid: `m${this.uidCounter++}`, typeId, on: false, health: 1 };
    this.state.set({ ...state, inventory: nextInventory, properties: { ...state.properties, [propertyId]: { ...property, machines: [...property.machines, machine] } } });
    this.notify('Machine installée.', 'gold');
    this.checkProgress();
  }

  toggleMachine(propertyId: string, uid: string): void {
    const state = this.state();
    const property = state.properties[propertyId];
    const definition = propertyDef(propertyId);
    const machine = property?.machines.find((entry) => entry.uid === uid);
    if (!property || !definition || !machine) return;
    if (machine.health <= 0) return this.notify('Cette machine est en panne. Récupérez-la puis réinstallez-la pour la réparer.', 'warn');
    if (!machine.on) {
      const used = property.machines.filter((entry) => entry.on).reduce((sum, entry) => sum + (machineDef(entry.typeId)?.power ?? 0), 0);
      if (used + (machineDef(machine.typeId)?.power ?? 0) > definition.powerLimit + property.powerBonus) return this.notify('Puissance électrique insuffisante.', 'danger');
    }
    this.replaceProperty(propertyId, { ...property, machines: property.machines.map((entry) => entry.uid === uid ? { ...entry, on: !entry.on } : entry) });
    this.checkProgress();
  }

  pickUpMachine(propertyId: string, uid: string): void {
    const state = this.state();
    const property = state.properties[propertyId];
    const machine = property?.machines.find((entry) => entry.uid === uid);
    if (!property || !machine) return;
    const inventory = [...state.inventory];
    const existing = inventory.find((item) => item.typeId === machine.typeId);
    if (existing) existing.qty++;
    else inventory.push({ typeId: machine.typeId, qty: 1 });
    this.state.set({ ...state, inventory, properties: { ...state.properties, [propertyId]: { ...property, machines: property.machines.filter((entry) => entry.uid !== uid) } } });
    this.notify('Machine récupérée dans l’inventaire.', 'gold');
  }

  repairMachine(propertyId: string, uid: string): void {
    const state = this.state();
    const property = state.properties[propertyId];
    const machine = property?.machines.find((entry) => entry.uid === uid);
    if (!property || !machine) return;
    if (machine.health > 0.75) return this.notify('La machine doit être réparée sous 75 % de santé.', 'warn');
    const cost = Math.max(50, Math.round((machineDef(machine.typeId)?.price ?? 0) * (1 - machine.health) * 0.3));
    if (state.cash < cost) return this.notify(`Fonds insuffisants pour réparer (${cost} $).`, 'danger');
    this.state.set({ ...state, cash: state.cash - cost, properties: { ...state.properties, [propertyId]: { ...property, machines: property.machines.map((entry) => entry.uid === uid ? { ...entry, health: 1 } : entry) } } });
    this.notify(`Machine réparée pour ${cost} $.`, 'gold');
  }

  sellCrx(amount: number): void {
    const state = this.state();
    if (!Number.isFinite(amount) || amount <= 0) return this.notify('Quantité invalide.', 'warn');
    const sold = Math.min(amount, state.crx);
    if (sold <= 0) return this.notify('Rien à vendre.', 'warn');
    const gain = sold * state.crxPrice;
    this.state.set({ ...state, crx: state.crx - sold, cash: state.cash + gain, stats: { ...state.stats, salesCount: state.stats.salesCount + 1, cashEarnedFromSales: state.stats.cashEarnedFromSales + gain } });
    this.notify(`Vendu ${this.format(sold, 3)} CRX pour ${this.format0(gain)} $.`, 'gold');
    this.checkProgress();
  }

  coinFlip(choice: 'pile' | 'face', bet: number): void {
    const state = this.state();
    const wager = this.validWager(bet, state.cash);
    if (wager <= 0) return this.notify('Mise invalide.', 'warn');
    const result = Math.random() < 0.5 ? 'pile' : 'face';
    const won = result === choice;
    this.state.set({ ...state, cash: state.cash - wager + (won ? wager * 2 : 0) });
    this.notify(won ? `Vous gagnez ${this.format0(wager * 2)} $ !` : `Perdu (${this.format0(wager)} $).`, won ? 'gold' : 'danger');
    this.casinoOutcome.set(`coin:${result}`);
  }

  blackjack(bet: number): void {
    const state = this.state();
    const wager = this.validWager(bet, state.cash);
    if (wager <= 0) return this.notify('Mise invalide.', 'warn');
    const draw = () => Math.floor(Math.random() * 10) + 1;
    let player = draw() + draw();
    let dealer = draw() + draw();
    if (player < 16 && Math.random() < 0.5) player += draw();
    while (dealer < 17) dealer += draw();
    const result = player > 21 || (dealer <= 21 && dealer > player) ? 'perdu' : player === dealer ? 'égalité' : 'gagné';
    const payout = result === 'gagné' ? wager * 2 : result === 'égalité' ? wager : 0;
    this.state.set({ ...state, cash: state.cash - wager + payout });
    this.notify(result === 'gagné' ? `Blackjack gagné : +${this.format0(wager * 2)} $.` : result === 'égalité' ? 'Égalité, mise remboursée.' : `Blackjack perdu (-${this.format0(wager)} $).`, result === 'gagné' ? 'gold' : result === 'égalité' ? 'warn' : 'danger');
    this.casinoOutcome.set(`blackjack:${player}:${dealer}`);
  }

  totalMachines(): number {
    const state = this.state();
    return Object.values(state.properties).reduce((sum, property) => sum + property.machines.length, 0) + state.inventory.reduce((sum, item) => sum + item.qty, 0);
  }

  hasMachineOn(): boolean { return Object.values(this.state().properties).some((property) => property.machines.some((machine) => machine.on)); }
  hasInstalledMachine(): boolean { return Object.values(this.state().properties).some((property) => property.machines.length > 0); }

  objectiveText(): string {
    const state = this.state();
    if (state.tutorialStep < TUTORIAL_STEPS.length) return TUTORIAL_STEPS[state.tutorialStep].text;
    const next = MILESTONES.find((milestone) => !state.milestonesDone[milestone.id]);
    return next ? `${next.name} — ${next.desc}` : 'Empire CryptoCity établi : optimisez votre réseau ou visez un meilleur cours.';
  }

  progressionPhase(): string {
    const owned = this.state().ownedPropertyIds;
    if (owned.includes('large_hangar')) return 'Campus industriel';
    if (owned.includes('medium_warehouse')) return 'Ferme industrielle';
    if (owned.includes('small_warehouse')) return 'Entreprise de minage';
    if (owned.includes('garage')) return 'Petite installation';
    return 'Minage artisanal';
  }

  format(value: number, digits = 2): string { return Number(value).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  format0(value: number): string { return Math.round(value).toLocaleString('fr-FR'); }
  formatPlaytime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours ? `${hours}h` : ''}${String(minutes).padStart(2, '0')}m${String(seconds % 60).padStart(2, '0')}s`;
  }

  private tick(): void {
    if (this.modal() === 'pause') return;
    const state = this.state();
    const properties = { ...state.properties };
    let eventLog = [...state.eventLog];
    let totalHashrate = 0;
    for (const id of state.ownedPropertyIds) {
      const property = properties[id];
      const definition = propertyDef(id);
      if (!property || !definition) continue;
      const machines = property.machines.map((machine) => {
        const wear = state.staff.technician ? ECONOMY.machineWearPerSecond * 0.5 : ECONOMY.machineWearPerSecond;
        const health = machine.on ? Math.max(0, machine.health - wear) : machine.health;
        return { ...machine, health, on: health > 0 && machine.on };
      });
      let totalPower = machines.filter((machine) => machine.on && machine.health > 0).reduce((sum, machine) => sum + (machineDef(machine.typeId)?.power ?? 0), 0);
      const powerLimit = definition.powerLimit + property.powerBonus;
      if (totalPower > powerLimit) {
        let excess = totalPower - powerLimit;
        for (let index = machines.length - 1; index >= 0 && excess > 0; index--) {
          const machine = machines[index];
          if (!machine.on || machine.health <= 0) continue;
          machine.on = false;
          excess -= machineDef(machine.typeId)?.power ?? 0;
        }
        totalPower = powerLimit;
        this.notify(`Disjoncteur déclenché à ${definition.name}.`, 'danger');
        eventLog = this.appendLog(eventLog, state.playSeconds, `Disjoncteur déclenché à ${definition.name}.`);
      }
      const totalHeat = machines.filter((machine) => machine.on && machine.health > 0).reduce((sum, machine) => sum + (machineDef(machine.typeId)?.heat ?? 0), 0);
      const cooling = definition.cooling + property.coolingBonus + 3;
      const target = definition.ambient + totalHeat * 0.35 - cooling * 0.55;
      const roomTemp = property.roomTemp + (Math.max(definition.ambient, target) - property.roomTemp) * 0.06;
      const efficiency = Math.max(0.25, 1 - Math.max(0, roomTemp - 65) * 0.025);
      if (roomTemp > 95) {
        for (const machine of machines) {
          if (machine.on && machine.health > 0 && Math.random() < 0.005 * (roomTemp - 95)) {
            machine.on = false;
            machine.health = Math.max(0, machine.health - 0.25);
            this.notify(`Surchauffe critique à ${definition.name} !`, 'danger');
          }
        }
      }
      for (const machine of machines) if (machine.on && machine.health > 0) totalHashrate += (machineDef(machine.typeId)?.hashrate ?? 0) * efficiency * machine.health;
      properties[id] = { ...property, machines, roomTemp };
    }
    const mined = totalHashrate * ECONOMY.miningCrxPerHashSecond;
    const operatingPower = Object.values(properties).reduce((sum, property) => sum + property.machines.filter((machine) => machine.on && machine.health > 0).reduce((power, machine) => power + (machineDef(machine.typeId)?.power ?? 0), 0), 0);
    const electricityMultiplier = state.staff.energy_manager ? 0.85 : 1;
    const operatingCost = (hourlyElectricityCost(operatingPower) * electricityMultiplier + this.staffPayrollPerHour()) / 3600;
    let next: GameState = {
      ...state,
      properties,
      eventLog,
      playSeconds: state.playSeconds + 1,
      crx: state.crx + mined,
      cash: state.cash - operatingCost,
      crxPrice: state.crxPrice,
      priceHistory: [...state.priceHistory],
      stats: { ...state.stats, totalMined: state.stats.totalMined + mined, currentHashrate: totalHashrate },
      marketTimer: state.marketTimer - 1,
      eventTimer: state.eventTimer - 1,
      autoSaleTimer: state.staff.operator ? state.autoSaleTimer - 1 : ECONOMY.autoSaleIntervalSeconds,
    };
    if (next.marketTimer <= 0) {
      next.crxPrice = advanceMarketPrice(next.crxPrice, Math.random());
      next.priceHistory = [...next.priceHistory, Math.round(next.crxPrice * 100) / 100].slice(-24);
      next.marketTimer = ECONOMY.marketIntervalSeconds;
    }
    if (next.eventTimer <= 0) {
      next.eventTimer = ECONOMY.eventIntervalMinSeconds + Math.floor(Math.random() * (ECONOMY.eventIntervalMaxSeconds - ECONOMY.eventIntervalMinSeconds + 1));
      if (Math.random() < ECONOMY.eventProbability) next = this.triggerEvent(next);
    }
    if (next.staff.operator && next.autoSaleTimer <= 0) {
      const sold = Math.min(ECONOMY.autoSaleCrxAmount, next.crx);
      next = {
        ...next,
        crx: next.crx - sold,
        cash: next.cash + sold * next.crxPrice,
        autoSaleTimer: ECONOMY.autoSaleIntervalSeconds,
        stats: { ...next.stats, salesCount: next.stats.salesCount + (sold > 0 ? 1 : 0), cashEarnedFromSales: next.stats.cashEarnedFromSales + sold * next.crxPrice },
      };
      if (sold > 0) next = this.logEvent(next, `Opérateur : ${this.format(sold, 3)} CRX vendus automatiquement.`);
    }
    this.state.set(next);
    if (next.playSeconds % 30 === 0) this.save();
    this.checkProgress();
  }

  private triggerEvent(state: GameState): GameState {
    const event = Math.floor(Math.random() * 6);
    if (event === 0) {
      this.notify('CRASH CRYPTO : le prix du CRX chute !', 'danger');
      return { ...this.logEvent(state, 'Krach du marché : prix du CRX en forte baisse.'), crxPrice: Math.max(ECONOMY.priceFloor, state.crxPrice * 0.8) };
    }
    if (event === 1) {
      this.notify('BULL MARKET : le prix du CRX explose !', 'gold');
      return { ...this.logEvent(state, 'Bull market : prix du CRX en forte hausse.'), crxPrice: Math.min(ECONOMY.priceCeiling, state.crxPrice * 1.2) };
    }
    if (event === 5) {
      if (state.upgrades.security || state.crx <= 0) return state;
      const stolen = state.crx * 0.15;
      this.notify(`${this.format(stolen, 3)} CRX ont été volés !`, 'danger');
      return { ...this.logEvent(state, `Piratage : ${this.format(stolen, 3)} CRX volés.`), crx: state.crx - stolen };
    }
    const candidates = state.ownedPropertyIds.filter((id) => state.properties[id].machines.length > 0);
    if (!candidates.length) return state;
    const id = candidates[Math.floor(Math.random() * candidates.length)];
    const property = state.properties[id];
    if (event === 3) {
      this.notify(`Vague de chaleur à ${propertyDef(id)?.name}.`, 'warn');
      return { ...this.logEvent(state, `Surchauffe à ${propertyDef(id)?.name}.`), properties: { ...state.properties, [id]: { ...property, roomTemp: property.roomTemp + 15 } } };
    }
    const active = property.machines.filter((machine) => machine.on && machine.health > 0);
    if (!active.length) return state;
    const target = active[Math.floor(Math.random() * active.length)];
    this.notify(event === 4 ? `Incendie à ${propertyDef(id)?.name} : machines coupées !` : `Panne matérielle à ${propertyDef(id)?.name}.`, 'danger');
    const message = event === 4 ? `Incendie à ${propertyDef(id)?.name}. Machines coupées par sécurité.` : `Panne GPU à ${propertyDef(id)?.name}.`;
    return {
      ...this.logEvent(state, message),
      properties: {
        ...state.properties,
        [id]: {
          ...property,
          machines: property.machines.map((machine) => event === 4 ? { ...machine, on: false } : machine.uid === target.uid ? { ...machine, on: false, health: 0.4 } : machine),
        },
      },
    };
  }

  private checkProgress(): void {
    const state = this.state();
    let cash = state.cash;
    let tutorialStep = state.tutorialStep;
    const steps = [
      this.hasMachineOn(), state.crx >= 0.1 || state.stats.totalMined >= 0.1, state.stats.salesCount >= 1,
      state.stats.visitedShop, state.stats.machinesBought >= 1, this.installedMachineCount() >= 2,
    ];
    if (tutorialStep < steps.length && steps[tutorialStep]) {
      tutorialStep++;
      if (tutorialStep < steps.length) this.notify(`Étape terminée : ${TUTORIAL_STEPS[tutorialStep - 1].text}`, 'gold');
    }
    const completed = { ...state.milestonesDone };
    for (const milestone of MILESTONES) {
      const achieved = this.milestoneAchieved(milestone.id, state);
      if (!completed[milestone.id] && achieved) {
        completed[milestone.id] = true;
        cash += milestone.reward;
        this.notify(`Objectif atteint : ${milestone.name} (+${milestone.reward} $)`, 'gold');
      }
    }
    if (cash !== state.cash || tutorialStep !== state.tutorialStep || completed !== state.milestonesDone) this.state.update((current) => ({ ...current, cash, tutorialStep, milestonesDone: completed }));
  }

  private milestoneAchieved(id: string, state: GameState): boolean {
    switch (id) {
      case 'first_hash': return state.stats.totalMined >= 1;
      case 'first_sale': return state.stats.salesCount >= 1;
      case 'first_upgrade': return state.stats.machinesBought >= 1;
      case 'staff_team': return Object.values(state.staff).some(Boolean);
      case 'home_miner': return this.hasInstalledMachine();
      case 'hashrate_10': return state.stats.currentHashrate >= 10;
      case 'garage_owner': return state.ownedPropertyIds.includes('garage');
      case 'warehouse_owner': return state.ownedPropertyIds.some((propertyId) => propertyId.includes('warehouse') || propertyId.includes('hangar'));
      case 'mining_farm': return this.totalMachines() >= 10;
      case 'industrial_scale': return state.stats.currentHashrate >= 200;
      case 'company': return state.ownedPropertyIds.includes('medium_warehouse');
      case 'fleet_25': return this.totalMachines() >= 25;
      case 'mined_1000': return state.stats.totalMined >= 1000;
      case 'hangar_owner': return state.ownedPropertyIds.includes('large_hangar');
      case 'hashrate_1000': return state.stats.currentHashrate >= 1000;
      case 'industrial_empire': return state.ownedPropertyIds.includes('large_hangar') && state.stats.totalMined >= 10000;
      default: return false;
    }
  }

  private installedMachineCount(): number {
    return Object.values(this.state().properties).reduce((sum, property) => sum + property.machines.length, 0);
  }

  private replaceProperty(id: string, property: PropertyState): void {
    this.state.update((state) => ({ ...state, properties: { ...state.properties, [id]: property } }));
  }

  private validWager(bet: number, cash: number): number {
    return Number.isFinite(bet) && bet > 0 ? Math.min(bet, Math.max(0, cash)) : 0;
  }

  private normalizeSave(loaded: Partial<GameState>): GameState {
    const fresh = defaultState();
    const finite = (value: number | undefined, fallback: number): number => Number.isFinite(value) ? value as number : fallback;
    const ownedPropertyIds = Array.isArray(loaded.ownedPropertyIds)
      ? [...new Set(loaded.ownedPropertyIds.filter((id) => !!propertyDef(id)))]
      : fresh.ownedPropertyIds;
    if (!ownedPropertyIds.includes('old_town_studio')) ownedPropertyIds.unshift('old_town_studio');
    const properties = Object.fromEntries(ownedPropertyIds.map((id) => {
      const definition = propertyDef(id)!;
      const propertySave = loaded.properties?.[id];
      const saved = propertySave && typeof propertySave === 'object' ? propertySave : { coolingBonus: 0, powerBonus: 0, roomTemp: definition.ambient, coolingItems: [], powerUpgrades: [], machines: [] };
      const seen = new Set<string>();
      const machines = (Array.isArray(saved.machines) ? saved.machines : []).filter((machine) => {
        if (!machine || typeof machine.uid !== 'string' || !machineDef(machine.typeId) || seen.has(machine.uid)) return false;
        seen.add(machine.uid);
        return true;
      }).map((machine) => {
        const health = Math.max(0, Math.min(1, finite(machine.health, 1)));
        return { uid: machine.uid, typeId: machine.typeId, on: Boolean(machine.on) && health > 0, health };
      });
      return [id, {
        coolingBonus: Math.max(0, finite(saved.coolingBonus, 0)),
        powerBonus: Math.max(0, finite(saved.powerBonus, 0)),
        roomTemp: Math.max(0, Math.min(200, finite(saved.roomTemp, definition.ambient))),
        coolingItems: restoreInstalledIds(COOLING_ITEMS.map((item) => ({ id: item.id, amount: item.cooling })), saved.coolingItems, saved.coolingBonus),
        powerUpgrades: restoreInstalledIds(POWER_UPGRADES.map((item) => ({ id: item.id, amount: item.power })), saved.powerUpgrades, saved.powerBonus),
        machines,
      }];
    })) as GameState['properties'];
    const inventory = Array.isArray(loaded.inventory) ? loaded.inventory.filter((item) => item && !!machineDef(item.typeId) && Number.isInteger(item.qty) && item.qty > 0) : fresh.inventory;
    const stats = { ...fresh.stats, ...loaded.stats };
    stats.totalMined = Math.max(0, finite(stats.totalMined, 0));
    stats.salesCount = Math.max(0, Math.floor(finite(stats.salesCount, 0)));
    stats.machinesBought = Math.max(0, Math.floor(finite(stats.machinesBought, 0)));
    stats.currentHashrate = Math.max(0, finite(stats.currentHashrate, 0));
    stats.cashEarnedFromSales = Math.max(0, finite(stats.cashEarnedFromSales, 0));
    const normalized: GameState = {
      ...fresh,
      ...loaded,
      cash: finite(loaded.cash, fresh.cash),
      crx: Math.max(0, finite(loaded.crx, fresh.crx)),
      crxPrice: Math.max(ECONOMY.priceFloor, Math.min(ECONOMY.priceCeiling, finite(loaded.crxPrice, ECONOMY.startingPrice))),
      priceHistory: Array.isArray(loaded.priceHistory) && loaded.priceHistory.some((price) => Number.isFinite(price)) ? loaded.priceHistory.filter((price) => Number.isFinite(price)).slice(-24) : fresh.priceHistory,
      inventory,
      properties,
      ownedPropertyIds,
      upgrades: { security: Boolean(loaded.upgrades?.security) },
      milestonesDone: loaded.milestonesDone && typeof loaded.milestonesDone === 'object' ? loaded.milestonesDone : {},
      tutorialStep: Math.max(0, Math.min(TUTORIAL_STEPS.length, Math.floor(finite(loaded.tutorialStep, 0)))),
      playSeconds: Math.max(0, Math.floor(finite(loaded.playSeconds, 0))),
      marketTimer: Math.max(1, Math.min(ECONOMY.marketIntervalSeconds, Math.floor(finite(loaded.marketTimer, ECONOMY.marketIntervalSeconds)))),
      eventTimer: Math.max(1, Math.min(ECONOMY.eventIntervalMaxSeconds, Math.floor(finite(loaded.eventTimer, ECONOMY.eventIntervalMinSeconds)))),
      autoSaleTimer: Math.max(1, Math.min(ECONOMY.autoSaleIntervalSeconds, Math.floor(finite(loaded.autoSaleTimer, ECONOMY.autoSaleIntervalSeconds)))),
      staff: {
        technician: Boolean(loaded.staff?.technician),
        energy_manager: Boolean(loaded.staff?.energy_manager),
        operator: Boolean(loaded.staff?.operator),
      },
      stats,
      eventLog: Array.isArray(loaded.eventLog) ? loaded.eventLog.filter((entry) => typeof entry === 'string').slice(0, 40) : [],
      activePropertyId: ownedPropertyIds.includes(loaded.activePropertyId ?? '') ? loaded.activePropertyId! : 'old_town_studio',
    };
    const hasRecoverableMiner = normalized.inventory.length > 0 || Object.values(normalized.properties).some((property) => property.machines.some((machine) => machine.health > 0));
    if (!hasRecoverableMiner && normalized.cash < machineDef('laptop_gaming')!.price && normalized.crx <= 0) {
      normalized.inventory.push({ typeId: 'laptop_used', qty: 1 });
    }
    return normalized;
  }

  private notify(message: string, kind: ToastKind): void {
    const id = ++this.toastId;
    this.toasts.update((toasts) => [...toasts, { id, message, kind }]);
    setTimeout(() => this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id)), 4200);
  }

  private logEvent(state: GameState, message: string): GameState {
    return { ...state, eventLog: this.appendLog(state.eventLog, state.playSeconds, message) };
  }

  private appendLog(eventLog: string[], playSeconds: number, message: string): string[] {
    return [`[${this.formatPlaytime(playSeconds)}] ${message}`, ...eventLog].slice(0, 40);
  }
}
