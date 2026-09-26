import { Component } from '@angular/core';
import { GameService } from '../../../game/game.service';

@Component({ selector: 'app-shop-panel', templateUrl: './shop-panel.html', styleUrl: './shop-panel.css' })
export class ShopPanelComponent {
  tab: 'computer' | 'general' = 'computer';
  constructor(readonly game: GameService) {}
}
