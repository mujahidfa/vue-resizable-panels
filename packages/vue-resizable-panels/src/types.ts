export type Direction = "horizontal" | "vertical";

export type PanelGroupOnLayout = (sizes: number[]) => void;
export type PanelOnCollapse = (collapsed: boolean) => void;
export type PanelOnResize = (size: number) => void;

export type PanelData = {
  callbacksRef: {
    onCollapse: PanelOnCollapse | null;
    onResize: PanelOnResize | null;
  };
  collapsible: boolean;
  defaultSize: number | null;
  id: string;
  maxSize: number;
  minSize: number;
  order: number | null;
};

export type ResizeEvent = KeyboardEvent | MouseEvent | TouchEvent;
export type ResizeHandler = (event: ResizeEvent) => void;
