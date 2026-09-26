import { Component } from '@angular/core';
import { GameService } from '../../game/game.service';
import { BankPanelComponent } from '../panels/bank/bank-panel';
import { CasinoPanelComponent } from '../panels/casino/casino-panel';
import { HomePanelComponent } from '../panels/home/home-panel';
import { ObjectivesPanelComponent } from '../panels/objectives/objectives-panel';
import { PowerPanelComponent } from '../panels/power/power-panel';
import { RealEstatePanelComponent } from '../panels/real-estate/real-estate-panel';
import { ShopPanelComponent } from '../panels/shop/shop-panel';
import { GameHudComponent } from '../game-hud/game-hud';
import { GameNavComponent } from '../game-nav/game-nav';
import { ToastStackComponent } from '../toast-stack/toast-stack';

@Component({
  selector: 'app-game-screen',
  imports: [GameHudComponent, GameNavComponent, HomePanelComponent, ShopPanelComponent, BankPanelComponent, RealEstatePanelComponent, PowerPanelComponent, CasinoPanelComponent, ObjectivesPanelComponent, ToastStackComponent],
  templateUrl: './game-screen.html',
  styleUrl: './game-screen.css',
})
export class GameScreenComponent {
  constructor(readonly game: GameService) {}
}
