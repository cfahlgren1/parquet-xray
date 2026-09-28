import { getContext, setContext } from "svelte";
import type { ParquetModel, Piece, RowGroupInfo } from "./parquet/model";

export interface Popover {
  piece: Piece;
  x: number;
  y: number;
  /** Whether clicking where the pointer is opens the piece's row group. */
  opensRowGroup: boolean;
}

/** The loaded file plus everything the user has selected in it. */
export class Inspector {
  readonly model: ParquetModel;
  /** The remote URL being shown; local files have no shareable link. */
  readonly source: string | null;
  /** How much was downloaded to open the file, e.g. "read 512 KB of 4.7 MB · 1 request · 30 ms". */
  readonly loadSummary: string;

  selectedRg = $state<number | null>(null);
  selectedLeaf = $state<number | null>(null);
  showAllRowGroups = $state(false);
  /** Row group hovered in the list, outlined in the file map. */
  hoveredRg = $state.raw<RowGroupInfo | null>(null);
  /** Bumped when a row group is selected from outside the list, so the list scrolls to it. */
  revealTick = $state(0);
  /** Whether the last reveal should also scroll the page, when the list may be off screen. Read untracked. */
  revealInPage = false;
  popover = $state.raw<Popover | null>(null);

  constructor(
    model: ParquetModel,
    source: string | null,
    initial: { rg: number | null; col: string | null },
    loadSummary: string,
  ) {
    this.model = model;
    this.source = source;
    this.loadSummary = loadSummary;
    this.selectedRg = initial.rg !== null && model.rowGroups[initial.rg] ? initial.rg : null;
    const leaf = model.leaves.findIndex((l) => l.path === initial.col);
    this.selectedLeaf = leaf === -1 ? null : leaf;
    if (this.selectedRg !== null) this.revealTick += 1;
  }

  toggleRowGroup(rg: number, { reveal = false } = {}): void {
    this.selectedRg = this.selectedRg === rg ? null : rg;
    if (reveal) this.reveal(false);
  }

  openRowGroup(rg: number): void {
    this.selectedRg = rg;
    this.reveal(true);
  }

  private reveal(inPage: boolean): void {
    this.revealInPage = inPage;
    this.revealTick += 1;
  }

  toggleLeaf(leaf: number): void {
    this.selectedLeaf = this.selectedLeaf === leaf ? null : leaf;
    this.showAllRowGroups = false;
  }

  showPopover(piece: Piece | null, event: MouseEvent, opensRowGroup = false): void {
    this.popover = piece ? { piece, x: event.clientX, y: event.clientY, opensRowGroup } : null;
  }

  hidePopover(): void {
    this.popover = null;
  }
}

const KEY = Symbol("inspector");

export function setInspector(inspector: Inspector): void {
  setContext(KEY, inspector);
}

export function getInspector(): Inspector {
  return getContext<Inspector>(KEY);
}
