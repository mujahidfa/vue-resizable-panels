import type { CSSProperties, InjectionKey, Ref } from "vue";
import type { PanelData, ResizeEvent, ResizeHandler } from "./types";

export interface PanelGroupContext {
  activeHandleId: Ref<string | null>;
  collapsePanel: (id: string) => void;
  direction: Ref<"horizontal" | "vertical">;
  expandPanel: (id: string) => void;
  getPanelStyle: (id: string) => CSSProperties;
  groupId: Ref<string>;
  registerPanel: (id: string, panel: PanelData) => void;
  registerResizeHandle: (id: string) => ResizeHandler;
  resizePanel: (id: string, percentage: number) => void;
  startDragging: (id: string, event: ResizeEvent) => void;
  stopDragging: () => void;
  unregisterPanel: (id: string) => void;
}

export const panelGroupInjectionKey =
  Symbol() as InjectionKey<PanelGroupContext>;
