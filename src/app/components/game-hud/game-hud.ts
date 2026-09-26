import { Component } from '@angular/core';
import { GameService } from '../../game/game.service';

@Component({ selector: 'app-game-hud', templateUrl: './game-hud.html', styleUrl: './game-hud.css' })
export class GameHudComponent {
  constructor(readonly game: GameService) {}
  openInventory(): void { this.game.modal.set('inventory'); }
  pause(): void { this.game.modal.set('pause'); }
}
