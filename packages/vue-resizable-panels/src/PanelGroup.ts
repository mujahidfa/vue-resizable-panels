import {
  computed,
  defineComponent,
  h,
  provide,
  ref,
  watch,
  type CSSProperties,
  type PropType,
} from "vue";

import { panelGroupInjectionKey } from "./PanelContexts";
import type {
  Direction,
  PanelData,
  PanelGroupOnLayout,
  ResizeEvent,
} from "./types";
import { loadPanelLayout, savePanelGroupLayout } from "./utils/serialization";
import { getDragOffset, getMovement } from "./utils/coordinates";
import {
  adjustByDelta,
  callPanelCallbacks,
  getBeforeAndAfterIds,
  getFlexGrow,
  getPanelGroup,
  getResizeHandlePanelIds,
  panelsMapToSortedArray,
} from "./utils/group";
import useUniqueId from "./composables/useUniqueId";
import { resetGlobalCursorStyle, setGlobalCursorStyle } from "./utils/cursor";
import debounce from "./utils/debounce";
import { useWindowSplitterPanelGroupBehavior } from "./composables/useWindowSplitterBehavior";

// Limit the frequency of localStorage updates.
const savePanelGroupLayoutDebounced = debounce(savePanelGroupLayout, 100);

export type CommittedValues = {
  direction: Direction;
  panels: Map<string, PanelData>;
  sizes: number[];
};

export type PanelDataMap = Map<string, PanelData>;

// TODO
// Within an active drag, remember original positions to refine more easily on expand.
// Look at what the Chrome devtools Sources does.

export type PanelGroupProps = {
  autoSaveId?: string;
  direction: Direction;
  id?: string | null;
  onLayout?: PanelGroupOnLayout;
  tagName?: string;
};

export const PanelGroup = defineComponent({
  name: "PanelGroup",
  props: {
    autoSaveId: {
      type: String,
      required: false,
    },
    direction: {
      type: String as PropType<Direction>,
      required: true,
    },
    id: {
      type: null as unknown as PropType<string | null>,
      default: null,
      required: false,
      validator: (v) => typeof v === "string" || v === null,
    },
    onLayout: {
      type: null as unknown as PropType<PanelGroupOnLayout | null>,
      default: null,
      required: false,
    },
    tagName: {
      type: String,
      default: "div",
      required: false,
    },
  },
  setup(props, { slots }) {
    const groupId = useUniqueId(props.id);

    const activeHandleId = ref<string | null>(null);
    const panels = ref<PanelDataMap>(new Map());

    // Use a ref to guard against users passing inline props
    const callbacksRef = computed<{
      onLayout: PanelGroupOnLayout | null;
    }>(() => ({ onLayout: props.onLayout }));

    // 0-1 values representing the relative size of each panel.
    const sizes = ref<number[]>([]);

    // Resize is calculated by the distance between the current pointer event and the resize handle being "dragged"
    // This value accounts for the initial offset when the touch/click starts, so the handle doesn't appear to "jump"
    const dragOffsetRef = ref<number>(0);

    // Used to support imperative collapse/expand API.
    const panelSizeBeforeCollapse = ref<Map<string, number>>(new Map());

    // Store committed values to avoid unnecessarily re-running memoization/effects functions.
    const committedValuesRef = computed<CommittedValues>(() => ({
      direction: props.direction,
      panels: panels.value,
      sizes: sizes.value,
    }));

    useWindowSplitterPanelGroupBehavior({
      committedValuesRef,
      groupId,
      panels,
      sizes,
      panelSizeBeforeCollapse,
    });

    // Notify external code when sizes have changed.
    watch(
      sizes,
      () => {
        const { onLayout } = callbacksRef.value;
        if (onLayout) {
          const { sizes } = committedValuesRef.value;

          // Don't commit layout until all panels have registered and re-rendered with their actual sizes.
          if (sizes.length > 0) {
            onLayout(sizes);
          }
        }
      },
      { immediate: true }
    );

    // Notify Panel listeners about their initial sizes and collapsed state after mount.
    // Subsequent changes will be called by the resizeHandler.
    const didNotifyCallbacksAfterMountRef = ref(false);
    watch(
      [sizes],
      () => {
        if (didNotifyCallbacksAfterMountRef.value) {
          return;
        }

        const { panels, sizes } = committedValuesRef.value;
        if (sizes.length > 0) {
          didNotifyCallbacksAfterMountRef.value = true;

          const panelsArray = panelsMapToSortedArray(panels);
          callPanelCallbacks(panelsArray, [], sizes);
        }
      },
      { immediate: true }
    );

    // Once all panels have registered themselves,
    // Compute the initial sizes based on default weights.
    // This assumes that panels register during initial mount (no conditional rendering)!
    watch(
      [() => props.autoSaveId, panels],
      () => {
        const localSizes = committedValuesRef.value.sizes;
        if (localSizes.length === panels.value.size) {
          // Only compute (or restore) default sizes once per panel configuration.
          return;
        }

        // If this panel has been configured to persist sizing information,
        // default size should be restored from local storage if possible.
        let defaultSizes: number[] | null = null;
        if (props.autoSaveId) {
          const panelsArray = panelsMapToSortedArray(panels.value);
          defaultSizes = loadPanelLayout(props.autoSaveId, panelsArray);
        }

        if (defaultSizes !== null) {
          sizes.value = defaultSizes;
        } else {
          const panelsArray = panelsMapToSortedArray(panels.value);

          let panelsWithNullDefaultSize = 0;
          let totalDefaultSize = 0;
          let totalMinSize = 0;

          // TODO
          // Implicit default size calculations below do not account for inferred min/max size values.
          // e.g. if Panel A has a maxSize of 40 then Panels A and B can't both have an implicit default size of 50.
          // For now, these logic edge cases are left to the user to handle via props.

          panelsArray.forEach((panel) => {
            totalMinSize += panel.minSize;

            if (panel.defaultSize === null) {
              panelsWithNullDefaultSize++;
            } else {
              totalDefaultSize += panel.defaultSize;
            }
          });

          if (totalDefaultSize > 100) {
            throw new Error(
              `The sum of the defaultSize of all panels in a group cannot exceed 100.`
            );
          } else if (totalMinSize > 100) {
            throw new Error(
              `The sum of the minSize of all panels in a group cannot exceed 100.`
            );
          }

          sizes.value = panelsArray.map((panel) => {
            if (panel.defaultSize === null) {
              return (100 - totalDefaultSize) / panelsWithNullDefaultSize;
            }

            return panel.defaultSize;
          });
        }
      },
      { immediate: true }
    );

    watch(
      [() => props.autoSaveId, panels, sizes],
      () => {
        // If this panel has been configured to persist sizing information, save sizes to local storage.
        if (props.autoSaveId) {
          if (
            sizes.value.length === 0 ||
            sizes.value.length !== panels.value.size
          ) {
            return;
          }

          const panelsArray = panelsMapToSortedArray(panels.value);

          savePanelGroupLayoutDebounced(
            props.autoSaveId,
            panelsArray,
            sizes.value
          );
        }
      },
      { immediate: true }
    );

    const getPanelStyle = (id: string): CSSProperties => {
      const { panels } = committedValuesRef.value;

      // Before mounting, Panels will not yet have registered themselves.
      // This includes server rendering.
      // At this point the best we can do is render everything with the same size.
      if (panels.size === 0) {
        return {
          flexBasis: "auto",
          flexGrow: 1,
          flexShrink: 1,

          // Without this, Panel sizes may be unintentionally overridden by their content.
          overflow: "hidden",
        };
      }

      const flexGrow = getFlexGrow(panels, id, sizes.value);

      return {
        flexBasis: 0,
        flexGrow: +flexGrow,
        flexShrink: 1,

        // Without this, Panel sizes may be unintentionally overridden by their content.
        overflow: "hidden",

        // Disable pointer events inside of a panel during resize.
        // This avoid edge cases like nested iframes.
        pointerEvents: activeHandleId.value !== null ? "none" : undefined,
      };
    };

    const registerPanel = (id: string, panel: PanelData) => {
      const prevPanels = panels.value;

      if (prevPanels.has(id)) {
        // panels.value = prevPanels;
      } else {
        const nextPanels = new Map(prevPanels);
        nextPanels.set(id, panel);

        panels.value = nextPanels;
      }
    };

    const registerResizeHandle = (handleId: string) => {
      const resizeHandler = (event: ResizeEvent) => {
        event.preventDefault();

        const {
          direction,
          panels,
          sizes: prevSizes,
        } = committedValuesRef.value;

        const panelsArray = panelsMapToSortedArray(panels);

        const [idBefore, idAfter] = getResizeHandlePanelIds(
          groupId.value,
          handleId,
          panelsArray
        );
        if (idBefore == null || idAfter == null) {
          return;
        }

        const movement = getMovement(
          event,
          groupId.value,
          handleId,
          panelsArray,
          direction,
          prevSizes,
          dragOffsetRef.value
        );
        if (movement === 0) {
          return;
        }

        const groupElement = getPanelGroup(groupId.value);
        const rect = (groupElement as HTMLDivElement).getBoundingClientRect();
        const isHorizontal = direction === "horizontal";
        const size = isHorizontal ? rect.width : rect.height;
        const delta = (movement / size) * 100;

        const nextSizes = adjustByDelta(
          panels,
          idBefore,
          idAfter,
          delta,
          prevSizes,
          panelSizeBeforeCollapse.value
        );
        if (prevSizes === nextSizes) {
          // If the pointer has moved too far to resize the panel any further,
          // update the cursor style for a visual clue.
          // This mimics VS Code behavior.
          if (isHorizontal) {
            setGlobalCursorStyle(
              movement < 0 ? "horizontal-min" : "horizontal-max"
            );
          } else {
            setGlobalCursorStyle(
              movement < 0 ? "vertical-min" : "vertical-max"
            );
          }
        } else {
          // Reset the cursor style to the the normal resize cursor.
          setGlobalCursorStyle(isHorizontal ? "horizontal" : "vertical");

          // If resize change handlers have been declared, this is the time to call them.
          callPanelCallbacks(panelsArray, prevSizes, nextSizes);

          sizes.value = nextSizes;
        }
      };

      return resizeHandler;
    };

    const unregisterPanel = (id: string) => {
      const prevPanels = panels.value;

      if (!prevPanels.has(id)) {
        // panels.value = prevPanels;
      } else {
        const nextPanels = new Map(prevPanels);
        nextPanels.delete(id);

        panels.value = nextPanels;
      }
    };

    const collapsePanel = (id: string) => {
      const { panels, sizes: prevSizes } = committedValuesRef.value;

      const panel = panels.get(id);
      if (panel == null || !panel.collapsible) {
        return;
      }

      const panelsArray = panelsMapToSortedArray(panels);

      const index = panelsArray.indexOf(panel);
      if (index < 0) {
        return;
      }

      const currentSize = prevSizes[index];
      if (currentSize === 0) {
        // Panel is already collapsed.
        return;
      }

      panelSizeBeforeCollapse.value.set(id, currentSize);

      const [idBefore, idAfter] = getBeforeAndAfterIds(id, panelsArray);
      if (idBefore == null || idAfter == null) {
        return;
      }

      const isLastPanel = index === panelsArray.length - 1;
      const delta = isLastPanel ? currentSize : 0 - currentSize;

      const nextSizes = adjustByDelta(
        panels,
        idBefore,
        idAfter,
        delta,
        prevSizes,
        panelSizeBeforeCollapse.value
      );
      if (prevSizes !== nextSizes) {
        // If resize change handlers have been declared, this is the time to call them.
        callPanelCallbacks(panelsArray, prevSizes, nextSizes);

        sizes.value = nextSizes;
      }
    };

    const expandPanel = (id: string) => {
      const { panels, sizes: prevSizes } = committedValuesRef.value;

      const panel = panels.get(id);
      if (panel == null) {
        return;
      }

      const sizeBeforeCollapse =
        panelSizeBeforeCollapse.value.get(id) || panel.minSize;
      if (!sizeBeforeCollapse) {
        return;
      }

      const panelsArray = panelsMapToSortedArray(panels);

      const index = panelsArray.indexOf(panel);
      if (index < 0) {
        return;
      }

      const currentSize = prevSizes[index];
      if (currentSize !== 0) {
        // Panel is already expanded.
        return;
      }

      const [idBefore, idAfter] = getBeforeAndAfterIds(id, panelsArray);
      if (idBefore == null || idAfter == null) {
        return;
      }

      const isLastPanel = index === panelsArray.length - 1;
      const delta = isLastPanel ? 0 - sizeBeforeCollapse : sizeBeforeCollapse;

      const nextSizes = adjustByDelta(
        panels,
        idBefore,
        idAfter,
        delta,
        prevSizes,
        panelSizeBeforeCollapse.value
      );
      if (prevSizes !== nextSizes) {
        // If resize change handlers have been declared, this is the time to call them.
        callPanelCallbacks(panelsArray, prevSizes, nextSizes);

        sizes.value = nextSizes;
      }
    };

    const resizePanel = (id: string, nextSize: number) => {
      const { panels, sizes: prevSizes } = committedValuesRef.value;

      const panel = panels.get(id);
      if (panel == null) {
        return;
      }

      const panelsArray = panelsMapToSortedArray(panels);

      const index = panelsArray.indexOf(panel);
      if (index < 0) {
        return;
      }

      const currentSize = prevSizes[index];
      if (currentSize === nextSize) {
        return;
      }

      const [idBefore, idAfter] = getBeforeAndAfterIds(id, panelsArray);
      if (idBefore == null || idAfter == null) {
        return;
      }

      const isLastPanel = index === panelsArray.length - 1;
      const delta = isLastPanel
        ? currentSize - nextSize
        : nextSize - currentSize;

      const nextSizes = adjustByDelta(
        panels,
        idBefore,
        idAfter,
        delta,
        prevSizes,
        panelSizeBeforeCollapse.value
      );
      if (prevSizes !== nextSizes) {
        // If resize change handlers have been declared, this is the time to call them.
        callPanelCallbacks(panelsArray, prevSizes, nextSizes);

        sizes.value = nextSizes;
      }
    };

    const startDragging = (id: string, event: ResizeEvent) => {
      activeHandleId.value = id;

      dragOffsetRef.value = getDragOffset(event, id, props.direction);
    };

    const stopDragging = () => {
      resetGlobalCursorStyle();
      activeHandleId.value = null;
    };

    const computedDirection = computed(() => props.direction);

    provide(panelGroupInjectionKey, {
      activeHandleId,
      collapsePanel,
      direction: computedDirection,
      expandPanel,
      getPanelStyle,
      groupId,
      registerPanel,
      registerResizeHandle,
      resizePanel,
      startDragging,
      stopDragging,
      unregisterPanel,
    });

    const style = computed<CSSProperties>(() => ({
      display: "flex",
      flexDirection: props.direction === "horizontal" ? "row" : "column",
      height: "100%",
      overflow: "hidden",
      width: "100%",
    }));

    return () =>
      h(
        props.tagName,
        {
          "data-panel-group-direction": props.direction,
          "data-panel-group-id": groupId.value,
          style: style.value,
        },
        slots.default?.()
      );
  },
});
