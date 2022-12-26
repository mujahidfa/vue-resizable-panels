import type { CSSProperties, InjectionKey } from "vue";
import type { PanelData, ResizeHandler } from "./types";

export interface PanelInjection {
  activeHandleId: string | null;
}

export interface PanelGroupInjection {
  direction: "horizontal" | "vertical";
  getPanelStyle: (id: string) => CSSProperties;
  groupId: string;
  registerPanel: (id: string, panel: PanelData) => void;
  registerResizeHandle: (id: string) => ResizeHandler;
  startDragging: (id: string) => void;
  stopDragging: () => void;
  unregisterPanel: (id: string) => void;
}

export const panelInjectionKey = Symbol() as InjectionKey<PanelInjection>;
export const panelGroupInjectionKey =
  Symbol() as InjectionKey<PanelGroupInjection>;
