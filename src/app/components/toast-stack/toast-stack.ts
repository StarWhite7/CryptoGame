import { Component } from '@angular/core';
import { GameService } from '../../game/game.service';

@Component({ selector: 'app-toast-stack', templateUrl: './toast-stack.html', styleUrl: './toast-stack.css' })
export class ToastStackComponent {
  constructor(readonly game: GameService) {}
}
