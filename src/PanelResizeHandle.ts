import {
  computed,
  defineComponent,
  h,
  inject,
  onUnmounted,
  ref,
  toRefs,
  watchEffect,
} from "vue";

import useUniqueId from "./composables/useUniqueId";
import { panelGroupInjectionKey, panelInjectionKey } from "./keys";
import type { ResizeHandler, ResizeEvent } from "./types";
import {
  getResizeHandle,
  getResizeHandleIndex,
  getResizeHandles,
} from "./utils/group";

const PanelResizeHandle = defineComponent({
  name: "PanelResizeHandle",
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    id: {
      type: String,
      default: null,
    },
  },
  setup(props, { slots }) {
    const divElementRef = ref<HTMLDivElement | null>(null);

    const panelInjection = inject(panelInjectionKey);
    const panelGroupInjection = inject(panelGroupInjectionKey);
    if (!panelInjection || !panelGroupInjection) {
      throw Error(
        `PanelResizeHandle components must be rendered within a PanelGroup container`
      );
    }

    const id = useUniqueId(props.id);

    const { disabled } = toRefs(props);

    const { activeHandleId } = panelInjection;
    const {
      direction,
      groupId,
      registerResizeHandle,
      startDragging,
      stopDragging,
    } = panelGroupInjection;

    const isDragging = computed(() => activeHandleId === id.value);

    const resizeHandler = ref<ResizeHandler | null>(null);

    const stopDraggingAndBlur = () => {
      // Clicking on the drag handle shouldn't leave it focused;
      // That would cause the PanelGroup to think it was still active.
      divElementRef.value?.blur();

      stopDragging();
    };

    watchEffect(() => {
      if (disabled.value) {
        resizeHandler.value = null;
      } else {
        const newResizeHandler = registerResizeHandle(id.value);
        resizeHandler.value = newResizeHandler;
      }
    });

    watchEffect(() => {
      if (
        disabled.value ||
        resizeHandler === null ||
        resizeHandler.value === null ||
        !isDragging.value
      ) {
        return;
      }

      document.body.style.cursor =
        direction === "horizontal" ? "ew-resize" : "ns-resize";

      const onMove = (event: ResizeEvent) => {
        resizeHandler.value?.(event);
      };

      document.body.addEventListener("mouseleave", stopDraggingAndBlur);
      document.body.addEventListener("mousemove", onMove);
      document.body.addEventListener("touchmove", onMove);
      document.body.addEventListener("mouseup", stopDraggingAndBlur);

      return () => {
        document.body.style.cursor = "";

        document.body.removeEventListener("mouseleave", stopDraggingAndBlur);
        document.body.removeEventListener("mousemove", onMove);
        document.body.removeEventListener("touchmove", onMove);
        document.body.removeEventListener("mouseup", stopDraggingAndBlur);
      };
    });

    // useWindowSplitterResizeHandlerBehavior
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
          const index = getResizeHandleIndex(id.value);

          const nextIndex = event.shiftKey
            ? (index as number) > 0
              ? (index as number) - 1
              : handles.length - 1
            : (index as number) + 1 < handles.length
            ? (index as number) + 1
            : 0;

          const nextHandle = handles[nextIndex] as HTMLDivElement;
          nextHandle.focus();

          break;
        }
      }
    };

    const handleElement = ref<HTMLDivElement | null>(null);

    watchEffect(() => {
      if (disabled.value || resizeHandler.value === null) {
        return;
      }

      handleElement.value = getResizeHandle(id.value);
      if (handleElement.value === null) {
        return;
      }

      handleElement.value.addEventListener("keydown", onKeyDown);
    });

    onUnmounted(() => {
      handleElement.value?.removeEventListener("keydown", onKeyDown);
    });

    return () =>
      h(
        "div",
        {
          "data-panel-group-id": groupId,
          "data-panel-resize-handle-enabled": !disabled,
          "data-panel-resize-handle-id": id.value,
          onMouseDown: () => startDragging(id.value),
          onMouseUp: stopDraggingAndBlur,
          onTouchCancel: stopDraggingAndBlur,
          onTouchEnd: stopDraggingAndBlur,
          onTouchStart: () => startDragging(id.value),
          ref: divElementRef,
          role: "separator",
          style: {
            cursor: direction === "horizontal" ? "ew-resize" : "ns-resize",
            touchAction: "none",
          },
          tabIndex: 0,
        },
        slots.default ? slots.default() : undefined
      );
  },
});

export default PanelResizeHandle;
