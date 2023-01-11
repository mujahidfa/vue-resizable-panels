import { watch, type Ref } from "vue";
import { PRECISION } from "../constants";

import type { CommittedValues, PanelDataMap } from "../PanelGroup";
import type { ResizeHandler } from "../types";
import {
  adjustByDelta,
  getPanel,
  getPanelGroup,
  getResizeHandle,
  getResizeHandleIndex,
  getResizeHandlePanelIds,
  getResizeHandles,
  getResizeHandlesForGroup,
  getFlexGrow,
  panelsMapToSortedArray,
} from "../utils/group";

// https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/

export function useWindowSplitterPanelGroupBehavior({
  committedValuesRef,
  groupId,
  panels,
  sizes,
  panelSizeBeforeCollapse,
}: {
  committedValuesRef: Ref<CommittedValues>;
  groupId: Ref<string>;
  panels: Ref<PanelDataMap>;
  sizes: Ref<number[]>;
  panelSizeBeforeCollapse: Ref<Map<string, number>>;
}): void {
  watch([groupId, panels, sizes], (newValue, oldValue, onCleanup) => {
    const { direction, panels } = committedValuesRef.value;

    const groupElement = getPanelGroup(groupId.value);
    const { height, width } = (
      groupElement as HTMLDivElement
    ).getBoundingClientRect();

    const handles = getResizeHandlesForGroup(groupId.value);
    const cleanupFunctions = handles.map((handle) => {
      const handleId = handle.getAttribute("data-panel-resize-handle-id");
      const panelsArray = panelsMapToSortedArray(panels);

      const [idBefore, idAfter] = getResizeHandlePanelIds(
        groupId.value,
        handleId as string,
        panelsArray
      );
      if (idBefore == null || idAfter == null) {
        return () => {};
      }

      let minSize = 0;
      let maxSize = 100;
      let totalMinSize = 0;
      let totalMaxSize = 0;

      // A panel's effective min/max sizes also need to account for other panel's sizes.
      panelsArray.forEach((panelData) => {
        if (panelData.id === idBefore) {
          maxSize = panelData.maxSize;
          minSize = panelData.minSize;
        } else {
          totalMinSize += panelData.minSize;
          totalMaxSize += panelData.maxSize;
        }
      });

      const ariaValueMax = Math.min(maxSize, 100 - totalMinSize);
      const ariaValueMin = Math.max(
        minSize,
        (panelsArray.length - 1) * 100 - totalMaxSize
      );

      const flexGrow = getFlexGrow(panels, idBefore, sizes.value);

      handle.setAttribute("aria-valuemax", "" + Math.round(ariaValueMax));
      handle.setAttribute("aria-valuemin", "" + Math.round(ariaValueMin));
      handle.setAttribute("aria-valuenow", "" + Math.round(parseInt(flexGrow)));

      // TODO check the correct casing for onkeydown in Vue
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
                  delta = direction === "horizontal" ? width : height;
                } else {
                  delta = -(direction === "horizontal" ? width : height);
                }

                const nextSizes = adjustByDelta(
                  panels,
                  idBefore,
                  idAfter,
                  delta,
                  sizes.value,
                  panelSizeBeforeCollapse.value
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
      if (panelBefore != null) {
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

    onCleanup(() => {
      cleanupFunctions.forEach((cleanupFunction) => cleanupFunction());
    });
  });
}

export function useWindowSplitterResizeHandlerBehavior({
  disabled,
  handleId,
  resizeHandler,
}: {
  disabled: Ref<boolean>;
  handleId: Ref<string>;
  resizeHandler: Ref<ResizeHandler | null>;
}): void {
  watch(
    [disabled, handleId, resizeHandler],
    (newValue, oldValue, onCleanup) => {
      if (disabled.value || resizeHandler.value == null) {
        return;
      }

      const handleElement = getResizeHandle(handleId.value);
      if (handleElement == null) {
        return;
      }

      const onKeyDown = (event: KeyboardEvent) => {
        switch (event.key) {
          case "ArrowDown":
          case "ArrowLeft":
          case "ArrowRight":
          case "ArrowUp":
          case "End":
          case "Home": {
            resizeHandler.value?.(event);
            break;
          }
          case "F6": {
            const handles = getResizeHandles();
            const index = getResizeHandleIndex(handleId.value) as number;

            const nextIndex = event.shiftKey
              ? index > 0
                ? index - 1
                : handles.length - 1
              : index + 1 < handles.length
              ? index + 1
              : 0;

            const nextHandle = handles[nextIndex] as HTMLDivElement;
            nextHandle.focus();

            break;
          }
        }
      };

      handleElement.addEventListener("keydown", onKeyDown);
      onCleanup(() => {
        handleElement.removeEventListener("keydown", onKeyDown);
      });
    },
    { immediate: true }
  );
}
