import { Injectable, signal } from '@angular/core';
import { COOLING_ITEMS, MACHINE_DEFS, MILESTONES, POWER_UPGRADES, PROPERTY_DEFS, SECURITY_ITEM, TUTORIAL_STEPS, machineDef, propertyDef } from './game-data';
import { GamePanel, GameState, GameToast, Machine, PropertyState, ToastKind } from './game.models';

const SAVE_KEY = 'cryptocity_save_v1';

function defaultState(): GameState {
  return {
    cash: 150,
    crx: 0,
    crxPrice: 100,
    priceHistory: [100],
    inventory: [{ typeId: 'laptop_used', qty: 1 }],
    properties: { old_town_studio: { coolingBonus: 0, powerBonus: 0, roomTemp: 22, machines: [] } },
    ownedPropertyIds: ['old_town_studio'],
    upgrades: { security: false },
    milestonesDone: {},
    tutorialStep: 0,
    playSeconds: 0,
    marketTimer: 45,
    eventTimer: 75,
    stats: { totalMined: 0, salesCount: 0, machinesBought: 0, visitedShop: false, currentHashrate: 0, cashEarnedFromSales: 0 },
    eventLog: [],
    activePropertyId: 'old_town_studio',
  };
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
      const loaded = JSON.parse(raw) as Partial<GameState>;
      const fresh = defaultState();
      const merged = { ...fresh, ...loaded, stats: { ...fresh.stats, ...loaded.stats }, upgrades: { ...fresh.upgrades, ...loaded.upgrades } };
      if (!merged.properties || !merged.ownedPropertyIds || !merged.inventory) return false;
      this.state.set(merged);
      this.uidCounter = Math.max(0, ...Object.values(merged.properties).flatMap((property) => property.machines.map((machine) => Number(machine.uid.replace('m', '')) || 0))) + 1;
      this.activePanel.set('home');
      this.start();
      this.notify('Partie chargée.', 'gold');
      return true;
    } catch { return false; }
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
  setActiveProperty(id: string): void { this.state.update((state) => ({ ...state, activePropertyId: id })); }

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
    if (!item || state.cash < item.price) return this.notify('Fonds insuffisants.', 'danger');
    const property = state.properties[state.activePropertyId];
    this.state.set({ ...state, cash: state.cash - item.price, properties: { ...state.properties, [state.activePropertyId]: { ...property, coolingBonus: property.coolingBonus + item.cooling } } });
    this.notify(`${item.name} installé.`, 'gold');
  }

  buySecurity(): void {
    const state = this.state();
    if (state.upgrades.security) return this.notify('Déjà acquis.', 'warn');
    if (state.cash < SECURITY_ITEM.price) return this.notify('Fonds insuffisants.', 'danger');
    this.state.set({ ...state, cash: state.cash - SECURITY_ITEM.price, upgrades: { security: true } });
    this.notify('Système de sécurité activé.', 'gold');
  }

  buyPowerUpgrade(id: string): void {
    const item = POWER_UPGRADES.find((entry) => entry.id === id);
    const state = this.state();
    if (!item || state.cash < item.price) return this.notify('Fonds insuffisants.', 'danger');
    const property = state.properties[state.activePropertyId];
    this.state.set({ ...state, cash: state.cash - item.price, properties: { ...state.properties, [state.activePropertyId]: { ...property, powerBonus: property.powerBonus + item.power } } });
    this.notify(`${item.name} installé.`, 'gold');
  }

  buyProperty(id: string): void {
    const definition = propertyDef(id);
    const state = this.state();
    if (!definition || state.ownedPropertyIds.includes(id)) return this.notify('Vous possédez déjà cette propriété.', 'warn');
    if (state.cash < definition.price) return this.notify('Fonds insuffisants pour cette propriété.', 'danger');
    this.state.set({ ...state, cash: state.cash - definition.price, ownedPropertyIds: [...state.ownedPropertyIds, id], properties: { ...state.properties, [id]: { coolingBonus: 0, powerBonus: 0, roomTemp: definition.ambient, machines: [] } }, activePropertyId: id });
    this.notify(`${definition.name} vous appartient désormais !`, 'gold');
    this.checkProgress();
  }

  placeMachine(propertyId: string, typeId: string): void {
    const state = this.state();
    const definition = propertyDef(propertyId);
    const property = state.properties[propertyId];
    const inventory = state.inventory.find((item) => item.typeId === typeId);
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
    const cost = Math.round((machineDef(machine?.typeId ?? '')?.price ?? 0) * 0.15) || 50;
    if (!property || !machine) return;
    if (state.cash < cost) return this.notify(`Fonds insuffisants pour réparer (${cost} $).`, 'danger');
    this.state.set({ ...state, cash: state.cash - cost, properties: { ...state.properties, [propertyId]: { ...property, machines: property.machines.map((entry) => entry.uid === uid ? { ...entry, health: 1 } : entry) } } });
    this.notify(`Machine réparée pour ${cost} $.`, 'gold');
  }

  sellCrx(amount: number): void {
    const state = this.state();
    const sold = Math.min(amount, state.crx);
    if (sold <= 0) return this.notify('Rien à vendre.', 'warn');
    const gain = sold * state.crxPrice;
    this.state.set({ ...state, crx: state.crx - sold, cash: state.cash + gain, stats: { ...state.stats, salesCount: state.stats.salesCount + 1, cashEarnedFromSales: state.stats.cashEarnedFromSales + gain } });
    this.notify(`Vendu ${this.format(sold, 3)} CRX pour ${this.format0(gain)} $.`, 'gold');
    this.checkProgress();
  }

  coinFlip(choice: 'pile' | 'face', bet: number): void {
    const state = this.state();
    const wager = Math.max(0, Math.min(bet, state.cash));
    if (wager <= 0) return this.notify('Mise invalide.', 'warn');
    const result = Math.random() < 0.5 ? 'pile' : 'face';
    const won = result === choice;
    this.state.set({ ...state, cash: state.cash - wager + (won ? wager * 2 : 0) });
    this.notify(won ? `Vous gagnez ${this.format0(wager * 2)} $ !` : `Perdu (${this.format0(wager)} $).`, won ? 'gold' : 'danger');
    this.casinoOutcome.set(`coin:${result}`);
  }

  blackjack(bet: number): void {
    const state = this.state();
    const wager = Math.max(0, Math.min(bet, state.cash));
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
    return next ? `${next.name} — ${next.desc}` : 'Continuez à agrandir votre empire de minage !';
  }

  format(value: number, digits = 2): string { return Number(value).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  format0(value: number): string { return Math.round(value).toLocaleString('fr-FR'); }
  formatPlaytime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours ? `${hours}h` : ''}${String(minutes).padStart(2, '0')}m${String(seconds % 60).padStart(2, '0')}s`;
  }

  private tick(): void {
    const state = this.state();
    const properties = { ...state.properties };
    let eventLog = [...state.eventLog];
    let totalHashrate = 0;
    for (const id of state.ownedPropertyIds) {
      const property = properties[id];
      const definition = propertyDef(id);
      if (!property || !definition) continue;
      const machines = property.machines.map((machine) => ({ ...machine }));
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
      const efficiency = roomTemp > 90 ? 0.4 : roomTemp > 70 ? 1 - ((roomTemp - 70) / 40) * 0.6 : 1;
      if (roomTemp > 90) {
        for (const machine of machines) {
          if (machine.on && machine.health > 0 && Math.random() < 0.01 * (roomTemp - 90)) {
            machine.on = false;
            machine.health = 0.5;
            this.notify(`Surchauffe critique à ${definition.name} !`, 'danger');
          }
        }
      }
      for (const machine of machines) if (machine.on && machine.health > 0) totalHashrate += (machineDef(machine.typeId)?.hashrate ?? 0) * efficiency * machine.health;
      properties[id] = { ...property, machines, roomTemp };
    }
    const mined = totalHashrate * 0.005;
    let next: GameState = {
      ...state,
      properties,
      eventLog,
      playSeconds: state.playSeconds + 1,
      crx: state.crx + mined,
      crxPrice: state.crxPrice,
      priceHistory: [...state.priceHistory],
      stats: { ...state.stats, totalMined: state.stats.totalMined + mined, currentHashrate: totalHashrate },
      marketTimer: state.marketTimer - 1,
      eventTimer: state.eventTimer - 1,
    };
    if (next.marketTimer <= 0) {
      const moves = [-0.1, -0.05, 0, 0.05, 0.1];
      next.crxPrice = Math.max(20, Math.min(600, next.crxPrice * (1 + moves[Math.floor(Math.random() * moves.length)])));
      next.priceHistory = [...next.priceHistory, Math.round(next.crxPrice * 100) / 100].slice(-24);
      next.marketTimer = 45;
    }
    if (next.eventTimer <= 0) {
      next.eventTimer = 70 + Math.floor(Math.random() * 70);
      if (Math.random() < 0.55) next = this.triggerEvent(next);
    }
    this.state.set(next);
    this.checkProgress();
  }

  private triggerEvent(state: GameState): GameState {
    const event = Math.floor(Math.random() * 6);
    if (event === 0) {
      this.notify('CRASH CRYPTO : le prix du CRX chute !', 'danger');
      return { ...this.logEvent(state, 'Krach du marché : prix du CRX en forte baisse.'), crxPrice: Math.max(20, state.crxPrice * 0.7) };
    }
    if (event === 1) {
      this.notify('BULL MARKET : le prix du CRX explose !', 'gold');
      return { ...this.logEvent(state, 'Bull market : prix du CRX en forte hausse.'), crxPrice: Math.min(600, state.crxPrice * 1.3) };
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
      this.hasMachineOn(), state.crx >= 1 || state.stats.totalMined >= 1, state.stats.salesCount >= 1,
      state.stats.visitedShop, state.stats.machinesBought >= 1, this.totalMachines() >= 2,
    ];
    if (tutorialStep < steps.length && steps[tutorialStep]) {
      tutorialStep++;
      if (tutorialStep < steps.length) this.notify(`Étape terminée : ${TUTORIAL_STEPS[tutorialStep - 1].text}`, 'gold');
    }
    const completed = { ...state.milestonesDone };
    for (const milestone of MILESTONES) {
      const achieved = milestone.id === 'first_hash' ? state.stats.totalMined >= 1
        : milestone.id === 'first_sale' ? state.stats.salesCount >= 1
        : milestone.id === 'first_upgrade' ? state.stats.machinesBought >= 1
        : milestone.id === 'home_miner' ? this.hasInstalledMachine()
        : milestone.id === 'hashrate_10' ? state.stats.currentHashrate >= 10
        : milestone.id === 'warehouse_owner' ? state.ownedPropertyIds.some((id) => id.includes('warehouse') || id.includes('hangar'))
        : milestone.id === 'mining_farm' ? this.totalMachines() >= 10
        : state.stats.currentHashrate >= 200;
      if (!completed[milestone.id] && achieved) {
        completed[milestone.id] = true;
        cash += milestone.reward;
        this.notify(`Objectif atteint : ${milestone.name} (+${milestone.reward} $)`, 'gold');
      }
    }
    if (cash !== state.cash || tutorialStep !== state.tutorialStep || completed !== state.milestonesDone) this.state.update((current) => ({ ...current, cash, tutorialStep, milestonesDone: completed }));
  }

  private replaceProperty(id: string, property: PropertyState): void {
    this.state.update((state) => ({ ...state, properties: { ...state.properties, [id]: property } }));
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
