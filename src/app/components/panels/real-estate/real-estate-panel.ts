import { Component } from '@angular/core';
import { GameService } from '../../../game/game.service';

@Component({ selector: 'app-real-estate-panel', templateUrl: './real-estate-panel.html', styleUrl: './real-estate-panel.css' })
export class RealEstatePanelComponent {
  constructor(readonly game: GameService) {}
  get districts(): string[] { return [...new Set(this.game.propertyDefs.map((property) => property.district))]; }
}
