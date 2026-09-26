import { Component } from '@angular/core';
import { GamePanel } from '../../game/game.models';
import { GameService } from '../../game/game.service';

@Component({ selector: 'app-game-nav', templateUrl: './game-nav.html', styleUrl: './game-nav.css' })
export class GameNavComponent {
  readonly items: { id: GamePanel; icon: string; label: string }[] = [
    { id: 'home', icon: '⌂', label: 'Ma propriété' }, { id: 'shop', icon: '▣', label: 'Magasin' },
    { id: 'bank', icon: '↗', label: 'Banque' }, { id: 'realestate', icon: '⌂', label: 'Immobilier' },
    { id: 'power', icon: 'ϟ', label: 'Électricité' }, { id: 'casino', icon: '◇', label: 'Casino' },
    { id: 'objectives', icon: '☷', label: 'Objectifs' },
  ];
  constructor(readonly game: GameService) {}
}
