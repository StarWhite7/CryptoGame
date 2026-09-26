import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../../game/game.service';

@Component({ selector: 'app-power-panel', imports: [FormsModule], templateUrl: './power-panel.html', styleUrl: './power-panel.css' })
export class PowerPanelComponent {
  selectedPropertyId: string;
  constructor(readonly game: GameService) { this.selectedPropertyId = game.state().activePropertyId; }
  selectProperty(id: string): void { this.selectedPropertyId = id; this.game.setActiveProperty(id); }
  get property() { return this.game.property(this.selectedPropertyId); }
  get definition() { return this.game.propertyDefinition(this.selectedPropertyId); }
}
