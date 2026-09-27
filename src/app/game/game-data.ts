import { MachineDefinition, PropertyDefinition } from './game.models';

export const ECONOMY = {
  startingPrice: 100,
  startingCash: 350,
  priceFloor: 60,
  priceCeiling: 160,
  miningCrxPerHashSecond: 0.0005,
  electricityCostPerKwHour: 1800,
  machineWearPerSecond: 0.0000025,
  marketIntervalSeconds: 300,
  marketVolatility: 0.02,
  marketMeanReversion: 0.04,
  eventIntervalMinSeconds: 300,
  eventIntervalMaxSeconds: 480,
  eventProbability: 0.3,
  autoSaleIntervalSeconds: 300,
  autoSaleCrxAmount: 0.5,
} as const;

export const MACHINE_DEFS: MachineDefinition[] = [
  { id: 'laptop_used', name: 'Laptop Usagé', price: 0, hashrate: 1, power: 0.05, heat: 2, icon: '💻', tier: 1 },
  { id: 'laptop_gaming', name: 'Laptop Gaming', price: 400, hashrate: 3, power: 0.15, heat: 4, icon: '💻', tier: 2 },
  { id: 'pc_basic', name: 'PC Basic', price: 1800, hashrate: 8, power: 0.35, heat: 8, icon: '🖥️', tier: 3 },
  { id: 'pc_gaming', name: 'PC Gaming', price: 4200, hashrate: 15, power: 0.6, heat: 14, icon: '🖥️', tier: 4 },
  { id: 'rig_t1', name: 'Mining Rig T1', price: 11000, hashrate: 35, power: 1.2, heat: 26, icon: '⚙️', tier: 5 },
  { id: 'rig_t2', name: 'Mining Rig T2', price: 27000, hashrate: 80, power: 2.5, heat: 48, icon: '⚙️', tier: 6 },
  { id: 'rig_t3', name: 'Mining Rig T3', price: 65000, hashrate: 180, power: 5, heat: 85, icon: '🏭', tier: 7 },
  { id: 'asic_t1', name: 'ASIC T1', price: 150000, hashrate: 400, power: 10, heat: 150, icon: '🏭', tier: 8 },
];

export const PROPERTY_DEFS: PropertyDefinition[] = [
  { id: 'old_town_studio', name: 'Studio — Old Town', district: 'Old Town', price: 0, powerLimit: 2, slots: 2, ambient: 22, cooling: 3, desc: 'Votre point de départ : un petit studio miteux mais fonctionnel.' },
  { id: 'garage', name: 'Garage', district: 'Residential District', price: 3200, powerLimit: 5, slots: 4, ambient: 20, cooling: 4, requires: 'old_town_studio', desc: 'Un garage privé avec un peu plus de place et de puissance disponible.' },
  { id: 'small_warehouse', name: 'Petit Entrepôt', district: 'Industrial District', price: 16000, powerLimit: 20, slots: 10, ambient: 18, cooling: 6, requires: 'garage', desc: 'Votre premier vrai pas vers l’industrie du minage.' },
  { id: 'medium_warehouse', name: 'Entrepôt Moyen', district: 'Industrial District', price: 62000, powerLimit: 50, slots: 25, ambient: 17, cooling: 10, requires: 'small_warehouse', desc: 'De quoi monter une véritable ferme de minage.' },
  { id: 'large_hangar', name: 'Grand Hangar Industriel', district: 'Industrial District', price: 260000, powerLimit: 200, slots: 60, ambient: 15, cooling: 20, requires: 'medium_warehouse', desc: 'Le sommet : une ferme de minage massive à l’échelle industrielle.' },
];

export const COOLING_ITEMS = [
  { id: 'fan', name: 'Ventilateur', price: 220, cooling: 5, desc: '+5 refroidissement' },
  { id: 'ac_unit', name: 'Climatiseur', price: 1300, cooling: 15, desc: '+15 refroidissement' },
  { id: 'industrial_cooling', name: 'Refroidissement Industriel', price: 6500, cooling: 40, desc: '+40 refroidissement' },
];

export const SECURITY_ITEM = { id: 'security_system', name: 'Système de Sécurité', price: 1600, desc: 'Protège toutes vos propriétés contre le piratage informatique.' };

export const STAFF_DEFS = [
  { id: 'technician', name: 'Technicien de maintenance', price: 4000, wagePerHour: 90, desc: 'Réduit de moitié l’usure des machines de toutes vos propriétés.' },
  { id: 'energy_manager', name: 'Responsable énergie', price: 8000, wagePerHour: 180, desc: 'Réduit de 15 % la facture électrique de votre réseau.' },
  { id: 'operator', name: 'Opérateur de salle', price: 12000, wagePerHour: 250, desc: 'Vend automatiquement jusqu’à 0,5 CRX toutes les cinq minutes.' },
] as const;

export const POWER_UPGRADES = [
  { id: 'breaker_t1', name: 'Tableau Électrique T1', price: 1100, power: 5, desc: '+5 kW de capacité électrique' },
  { id: 'breaker_t2', name: 'Tableau Électrique T2', price: 5200, power: 20, desc: '+20 kW de capacité électrique' },
  { id: 'transformer', name: 'Transformateur Industriel', price: 21000, power: 80, desc: '+80 kW de capacité électrique' },
];

export const TUTORIAL_STEPS = [
  { text: 'Installez le laptop de départ, puis allumez-le dans « Ma propriété ».', key: 'machineOn' },
  { text: 'Extrayez au moins 0,1 CRX.', key: 'firstMine' },
  { text: 'Vendez du CRX à la banque.', key: 'firstSale' },
  { text: 'Visitez le magasin informatique.', key: 'visitShop' },
  { text: 'Achetez votre première mise à niveau.', key: 'buyMachine' },
  { text: 'Installez une deuxième machine.', key: 'twoMachines' },
];

export const MILESTONES = [
  { id: 'first_hash', name: 'FIRST HASH', desc: 'Miner votre premier CRX.', reward: 20 },
  { id: 'first_sale', name: 'FIRST SALE', desc: 'Vendre du CRX.', reward: 30 },
  { id: 'first_upgrade', name: 'UPGRADE', desc: 'Acheter votre première nouvelle machine.', reward: 50 },
    { id: 'staff_team', name: 'PREMIER RECRUTEMENT', desc: 'Embaucher votre premier membre du personnel.', reward: 300 },
  { id: 'home_miner', name: 'HOME MINER', desc: 'Installer une machine chez vous.', reward: 40 },
  { id: 'hashrate_10', name: '10 H/s', desc: 'Atteindre un hashrate total de 10 H/s.', reward: 80 },
  { id: 'garage_owner', name: 'ATELIER', desc: 'Ouvrir votre premier garage.', reward: 150 },
  { id: 'warehouse_owner', name: 'WAREHOUSE OWNER', desc: 'Acheter un entrepôt.', reward: 200 },
  { id: 'mining_farm', name: 'MINING FARM', desc: 'Posséder 10 machines.', reward: 400 },
  { id: 'industrial_scale', name: 'INDUSTRIAL SCALE', desc: 'Atteindre un hashrate de 200 H/s.', reward: 1000 },
  { id: 'company', name: 'SOCIÉTÉ DE MINAGE', desc: 'Installer votre activité dans un entrepôt moyen.', reward: 2500 },
  { id: 'fleet_25', name: 'FLOTTE DE 25', desc: 'Posséder 25 machines en activité ou en réserve.', reward: 5000 },
  { id: 'mined_1000', name: '1000 CRX MINÉS', desc: 'Miner 1000 CRX au total.', reward: 5000 },
  { id: 'hangar_owner', name: 'CAMPUS INDUSTRIEL', desc: 'Acheter le grand hangar industriel.', reward: 12000 },
  { id: 'hashrate_1000', name: '1000 H/s', desc: 'Atteindre un hashrate total de 1000 H/s.', reward: 15000 },
  { id: 'industrial_empire', name: 'EMPIRE CRYPTOCITY', desc: 'Établir le hangar et miner 10000 CRX au total.', reward: 30000 },
];

export function machineDef(id: string): MachineDefinition | undefined {
  return MACHINE_DEFS.find((machine) => machine.id === id);
}

export function propertyDef(id: string): PropertyDefinition | undefined {
  return PROPERTY_DEFS.find((property) => property.id === id);
}
