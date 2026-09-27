import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../../game/game.service';

@Component({ selector: 'app-bank-panel', imports: [FormsModule], templateUrl: './bank-panel.html', styleUrl: './bank-panel.css' })
export class BankPanelComponent {
  amount = 0;
  constructor(readonly game: GameService) {}
  sell(): void { this.game.sellCrx(Number(this.amount) || 0); }
  get history(): number[] { return this.game.state().priceHistory.slice(-24); }
  get maxPrice(): number { return Math.max(1, ...this.history); }
}
