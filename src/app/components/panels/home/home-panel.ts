import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../../game/game.service';

@Component({ selector: 'app-home-panel', imports: [CommonModule, FormsModule], templateUrl: './home-panel.html', styleUrl: './home-panel.css' })
export class HomePanelComponent {
  selectedPropertyId: string;
  constructor(readonly game: GameService) { this.selectedPropertyId = game.state().activePropertyId; }
  get propertyDefinition() { return this.game.propertyDefinition(this.selectedPropertyId); }
  get property() { return this.game.property(this.selectedPropertyId); }
  get slots(): number[] { return Array.from({ length: this.propertyDefinition?.slots ?? 0 }, (_, index) => index); }
  get powerUsed(): number { return this.property?.machines.filter((machine) => machine.on).reduce((sum, machine) => sum + (this.game.machineDefinition(machine.typeId)?.power ?? 0), 0) ?? 0; }
  get powerLimit(): number { return (this.propertyDefinition?.powerLimit ?? 0) + (this.property?.powerBonus ?? 0); }
  selectProperty(id: string): void { this.selectedPropertyId = id; this.game.setActiveProperty(id); }
  openPlace(): void { this.game.modal.set('place'); }
  inspect(uid: string): void { this.game.modal.set(`inspect:${uid}`); }
}
