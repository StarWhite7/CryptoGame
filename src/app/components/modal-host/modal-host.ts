import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../game/game.service';

@Component({ selector: 'app-modal-host', imports: [CommonModule], templateUrl: './modal-host.html', styleUrl: './modal-host.css' })
export class ModalHostComponent {
  @Output() backToMenu = new EventEmitter<void>();
  @Output() quit = new EventEmitter<void>();
  constructor(readonly game: GameService) {}
  close(): void { this.game.modal.set(null); }
  save(): void { this.game.save(true); }
  continueToMenu(): void { this.close(); this.backToMenu.emit(); }
  resetSave(): void {
    if (!window.confirm('Effacer définitivement votre sauvegarde ?')) return;
    this.game.resetSave();
    this.close();
  }
  place(typeId: string): void {
    this.game.placeMachine(this.game.state().activePropertyId, typeId);
    this.close();
  }
  get inspectUid(): string { return this.game.modal()?.startsWith('inspect:') ? this.game.modal()!.slice(8) : ''; }
  get inspectedMachine() { return this.game.property()?.machines.find((machine) => machine.uid === this.inspectUid); }
  get inspectedDefinition() { return this.inspectedMachine ? this.game.machineDefinition(this.inspectedMachine.typeId) : undefined; }
}
