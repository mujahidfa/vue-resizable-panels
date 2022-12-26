import {
  defineComponent,
  h,
  onUnmounted,
  provide,
  readonly,
  ref,
  toRefs,
  watchEffect,
} from "vue";
import type { CSSProperties, PropType } from "vue";
import useUniqueId from "./composables/useUniqueId";
import { panelGroupInjectionKey, panelInjectionKey } from "./keys";
import type { Direction, PanelData, ResizeEvent } from "./types";
import { loadPanelLayout, savePanelGroupLayout } from "./utils/serialization";
import { getMovement } from "./utils/coordinates";
import {
  adjustByDelta,
  getOffset,
  getPanel,
  getResizeHandlePanelIds,
  getResizeHandlesForGroup,
  getSize,
  panelsMapToSortedArray,
} from "./utils/group";
import { PRECISION } from "./constants";

export type PanelDataMap = Map<string, PanelData>;

// TODO [panels]
// Within an active drag, remember original positions to refine more easily on expand.
// Look at what the Chrome devtools Sources does.

const PanelGroup = defineComponent({
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
    height: {
      type: Number,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
  },
  setup(props, { slots }) {
    const groupId = useUniqueId();

    const activeHandleId = ref<string | null>(null);
    const panels = ref<PanelDataMap>(new Map());

    // 0-1 values representing the relative size of each panel.
    const sizes = ref<number[]>([]);

    const { autoSaveId, direction, height, width } = toRefs(props);

    let cleanupFunctions: (() => void)[];

    // useWindowSplitterPanelGroupBehavior
    watchEffect(() => {
      const handles = getResizeHandlesForGroup(groupId.value);
      cleanupFunctions = handles.map((handle) => {
        const handleId = handle.getAttribute("data-panel-resize-handle-id");
        const panelsArray = panelsMapToSortedArray(panels.value);

        const [idBefore, idAfter] = getResizeHandlePanelIds(
          groupId.value,
          handleId as string,
          panelsArray
        );
        if (idBefore == null || idAfter == null) {
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          return () => {};
        }

        const ariaValueMax = panelsArray.reduce((difference, panel) => {
          if (panel.id !== idBefore) {
            return difference - panel.minSize;
          }
          return difference;
        }, 1);

        const ariaValueMin =
          panelsArray.find((panel) => panel.id == idBefore)?.minSize ?? 0;

        const size = getSize(
          panels.value,
          idBefore,
          direction.value,
          sizes.value,
          height.value,
          width.value
        );
        const ariaValueNow =
          size /
          (direction.value === "horizontal" ? width.value : height.value);

        handle.setAttribute(
          "aria-valuemax",
          "" + Math.round(100 * ariaValueMax)
        );
        handle.setAttribute(
          "aria-valuemin",
          "" + Math.round(100 * ariaValueMin)
        );
        handle.setAttribute(
          "aria-valuenow",
          "" + Math.round(100 * ariaValueNow)
        );

        const onKeyDown = (event: KeyboardEvent) => {
          switch (event.key) {
            case "Enter": {
              const index = panelsArray.findIndex(
                (panel) => panel.id === idBefore
              );
              if (index >= 0) {
                const panelData = panelsArray[index];
                const size = sizes.value[index];
                if (size !== null) {
                  let delta = 0;
                  if (
                    size.toPrecision(PRECISION) <=
                    panelData.minSize.toPrecision(PRECISION)
                  ) {
                    delta =
                      direction.value === "horizontal"
                        ? width.value
                        : height.value;
                  } else {
                    delta = -(direction.value === "horizontal"
                      ? width.value
                      : height.value);
                  }

                  const nextSizes = adjustByDelta(
                    panels.value,
                    idBefore,
                    idAfter,
                    delta,
                    sizes.value
                  );
                  if (sizes.value !== nextSizes) {
                    sizes.value = nextSizes;
                  }
                }
              }
              break;
            }
          }
        };

        handle.addEventListener("keydown", onKeyDown);

        const panelBefore = getPanel(idBefore);
        if (panelBefore !== null) {
          handle.setAttribute("aria-controls", panelBefore.id);
        }

        return () => {
          handle.removeAttribute("aria-valuemax");
          handle.removeAttribute("aria-valuemin");
          handle.removeAttribute("aria-valuenow");

          handle.removeEventListener("keydown", onKeyDown);

          if (panelBefore != null) {
            handle.removeAttribute("aria-controls");
          }
        };
      });
    });

    onUnmounted(() => {
      cleanupFunctions.forEach((cleanupFunction) => cleanupFunction());
    });

    // Once all panels have registered themselves,
    // Compute the initial sizes based on default weights.
    // This assumes that panels register during initial mount (no conditional rendering)!
    watchEffect(() => {
      if (sizes.value.length === panels.value.size) {
        return;
      }

      // TODO [panels]
      // Validate that the total minSize is <= 1.

      // If this panel has been configured to persist sizing information,
      // default size should be restored from local storage if possible.
      let defaultSizes: number[] | null = null;
      if (autoSaveId.value) {
        const panelIds = panelsMapToSortedArray(panels.value).map(
          (panel) => panel.id
        );
        defaultSizes = loadPanelLayout(autoSaveId.value, panelIds);
      }

      if (defaultSizes != null) {
        sizes.value = defaultSizes;
      } else {
        const panelsArray = panelsMapToSortedArray(panels.value);
        const totalWeight = panelsArray.reduce((weight, panel) => {
          return weight + panel.defaultSize;
        }, 0);

        sizes.value = panelsArray.map(
          (panel) => panel.defaultSize / totalWeight
        );
      }
    });

    watchEffect(() => {
      // If this panel has been configured to persist sizing information, save sizes to local storage.
      if (autoSaveId.value) {
        if (
          sizes.value.length === 0 ||
          sizes.value.length !== panels.value.size
        ) {
          return;
        }

        const panelIds = panelsMapToSortedArray(panels.value).map(
          (panel) => panel.id
        );
        savePanelGroupLayout(autoSaveId.value, panelIds, sizes.value);
      }
    });

    const getPanelStyle = (id: string): CSSProperties => {
      const offset = getOffset(
        panels.value,
        id,
        direction.value,
        sizes.value,
        height.value,
        width.value
      );
      const size = getSize(
        panels.value,
        id,
        direction.value,
        sizes.value,
        height.value,
        width.value
      );

      if (direction.value === "horizontal") {
        return {
          height: "100%",
          position: "absolute",
          left: offset,
          top: 0,
          width: size,
        };
      } else {
        return {
          height: size,
          position: "absolute",
          left: 0,
          top: offset,
          width: "100%",
        };
      }
    };

    const registerPanel = (id: string, panel: PanelData) => {
      if (!panels.value.has(id)) {
        const nextPanels = new Map(panels.value);
        nextPanels.set(id, panel);

        panels.value = nextPanels;
      }
    };

    const registerResizeHandle = (handleId: string) => {
      const resizeHandler = (event: ResizeEvent) => {
        event.preventDefault();

        const panelsArray = panelsMapToSortedArray(panels.value);

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
          handleId,
          { height: height.value, width: width.value },
          direction.value
        );

        const isHorizontal = direction.value === "horizontal";
        const delta = isHorizontal
          ? (movement as number) / width.value
          : (movement as number) / height.value;

        const nextSizes = adjustByDelta(
          panels.value,
          idBefore,
          idAfter,
          delta,
          sizes.value
        );
        if (sizes.value !== nextSizes) {
          sizes.value = nextSizes;
        }
      };

      return resizeHandler;
    };

    const unregisterPanel = (id: string) => {
      if (panels.value.has(id)) {
        const nextPanels = new Map(panels.value);
        nextPanels.delete(id);

        panels.value = nextPanels;
      }
    };

    provide(panelInjectionKey, readonly({ activeHandleId }));
    provide(
      panelGroupInjectionKey,
      readonly({
        direction: direction.value,
        getPanelStyle,
        groupId,
        registerPanel,
        registerResizeHandle,
        startDragging: (id: string) => (activeHandleId.value = id),
        stopDragging: () => (activeHandleId.value = null),
        unregisterPanel,
      })
    );

    return () => h("div", slots.default ? slots.default() : undefined);
  },
});

export default PanelGroup;
