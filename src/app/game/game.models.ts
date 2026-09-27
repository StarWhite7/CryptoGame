export interface MachineDefinition {
  id: string;
  name: string;
  price: number;
  hashrate: number;
  power: number;
  heat: number;
  icon: string;
  tier: number;
}

export interface PropertyDefinition {
  id: string;
  name: string;
  district: string;
  price: number;
  powerLimit: number;
  slots: number;
  ambient: number;
  cooling: number;
  requires?: string;
  desc: string;
}

export interface Machine {
  uid: string;
  typeId: string;
  on: boolean;
  health: number;
}

export interface PropertyState {
  coolingBonus: number;
  powerBonus: number;
  roomTemp: number;
  coolingItems: string[];
  powerUpgrades: string[];
  machines: Machine[];
}

export interface InventoryItem {
  typeId: string;
  qty: number;
}

export interface GameState {
  cash: number;
  crx: number;
  crxPrice: number;
  priceHistory: number[];
  inventory: InventoryItem[];
  properties: Record<string, PropertyState>;
  ownedPropertyIds: string[];
  upgrades: { security: boolean };
  milestonesDone: Record<string, boolean>;
  tutorialStep: number;
  playSeconds: number;
  marketTimer: number;
  eventTimer: number;
  autoSaleTimer: number;
  staff: { technician: boolean; energy_manager: boolean; operator: boolean };
  stats: {
    totalMined: number;
    salesCount: number;
    machinesBought: number;
    visitedShop: boolean;
    currentHashrate: number;
    cashEarnedFromSales: number;
  };
  eventLog: string[];
  activePropertyId: string;
}

export type GamePanel = 'home' | 'shop' | 'bank' | 'realestate' | 'power' | 'casino' | 'objectives';
export type ToastKind = 'gold' | 'warn' | 'danger';

export interface GameToast {
  id: number;
  message: string;
  kind: ToastKind;
}
