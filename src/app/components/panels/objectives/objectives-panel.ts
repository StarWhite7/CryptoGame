import { Component } from '@angular/core';
import { GameService } from '../../../game/game.service';

@Component({ selector: 'app-objectives-panel', templateUrl: './objectives-panel.html', styleUrl: './objectives-panel.css' })
export class ObjectivesPanelComponent {
  constructor(readonly game: GameService) {}
}
