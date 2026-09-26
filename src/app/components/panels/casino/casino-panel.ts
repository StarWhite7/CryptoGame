import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../../game/game.service';

@Component({ selector: 'app-casino-panel', imports: [FormsModule], templateUrl: './casino-panel.html', styleUrl: './casino-panel.css' })
export class CasinoPanelComponent {
  coinBet = 50;
  blackjackBet = 50;
  coinResult = '?';
  blackjackResult = 'Vous : — · Croupier : —';
  constructor(readonly game: GameService) {}
  flip(choice: 'pile' | 'face'): void {
    this.game.coinFlip(choice, Number(this.coinBet) || 0);
    const result = this.game.casinoOutcome();
    if (result?.startsWith('coin:')) this.coinResult = result.slice(5).toUpperCase();
  }
  playBlackjack(): void {
    this.game.blackjack(Number(this.blackjackBet) || 0);
    const result = this.game.casinoOutcome();
    if (result?.startsWith('blackjack:')) {
      const [, player, dealer] = result.split(':');
      this.blackjackResult = `Vous : ${player} · Croupier : ${dealer}`;
    }
  }
}
