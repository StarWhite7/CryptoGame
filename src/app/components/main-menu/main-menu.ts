import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({ selector: 'app-main-menu', templateUrl: './main-menu.html', styleUrl: './main-menu.css' })
export class MainMenuComponent {
  @Input() hasSave = false;
  @Output() newGame = new EventEmitter<void>();
  @Output() continueGame = new EventEmitter<void>();
  @Output() openSettings = new EventEmitter<void>();
  @Output() quit = new EventEmitter<void>();
}
