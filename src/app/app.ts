import { Component, HostListener, signal } from '@angular/core';
import { GameScreenComponent } from './components/game-screen/game-screen';
import { MainMenuComponent } from './components/main-menu/main-menu';
import { ModalHostComponent } from './components/modal-host/modal-host';
import { GameService } from './game/game.service';

@Component({ imports: [GameScreenComponent, MainMenuComponent, ModalHostComponent], selector: 'app-root', styleUrl: './app.css', templateUrl: './app.html' })
export class App {
  readonly inGame = signal(false);
  constructor(readonly game: GameService) {}
  startNewGame(): void {
    if (this.game.hasSave() && !window.confirm('Une sauvegarde existe déjà. La nouvelle partie la remplacera. Continuer ?')) return;
    this.game.newGame();
    this.inGame.set(true);
  }
  continueGame(): void { if (this.game.continueGame()) this.inGame.set(true); }
  backToMenu(): void {
    if (!window.confirm('Retourner au menu principal ? Pensez à sauvegarder avant.')) return;
    this.game.stop();
    this.game.modal.set(null);
    this.inGame.set(false);
  }
  quitGame(): void {
    if (!window.confirm('Quitter CryptoCity ? Votre progression sera sauvegardée.')) return;
    if (this.inGame()) this.game.save();
    this.game.stop();
    this.game.modal.set(null);
    this.inGame.set(false);
  }
  @HostListener('window:beforeunload')
  saveOnExit(): void { if (this.inGame()) this.game.save(); }
  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (!this.inGame()) return;
    if (event.key === 'Escape') this.game.modal.set(this.game.modal() ? null : 'pause');
    else if (event.key.toLowerCase() === 'i') this.game.modal.set(this.game.modal() === 'inventory' ? null : 'inventory');
  }
}
