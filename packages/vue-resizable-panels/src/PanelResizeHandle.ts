import {
  computed,
  defineComponent,
  h,
  inject,
  ref,
  watch,
  type CSSProperties,
  type PropType,
} from "vue";
import useUniqueId from "./composables/useUniqueId";

import { useWindowSplitterResizeHandlerBehavior } from "./composables/useWindowSplitterBehavior";
import { panelGroupInjectionKey } from "./PanelContexts";
import type { ResizeHandler, ResizeEvent } from "./types";
import { getCursorStyle } from "./utils/cursor";

export type PanelResizeHandleProps = {
  disabled?: boolean;
  id?: string | null;
  tagName?: string;
};

export const PanelResizeHandle = defineComponent({
  name: "PanelResizeHandle",
  props: {
    disabled: {
      type: Boolean,
      default: false,
      required: false,
    },
    id: {
      type: null as unknown as PropType<string | null>,
      default: null,
      required: false,
      validator: (v) => typeof v === "string" || v === null,
    },
    tagName: {
      type: String,
      default: "div",
      required: false,
    },
  },
  setup(props, { slots }) {
    const divElementRef = ref<HTMLDivElement | null>(null);

    const panelGroupContext = inject(panelGroupInjectionKey);

    if (panelGroupContext === undefined) {
      throw Error(
        `PanelResizeHandle components must be rendered within a PanelGroup container`
      );
    }

    const {
      activeHandleId,
      direction,
      groupId,
      registerResizeHandle,
      startDragging,
      stopDragging,
    } = panelGroupContext;

    const resizeHandleId = useUniqueId(props.id);
    const isDragging = computed(
      () => activeHandleId.value === resizeHandleId.value
    );

    const isFocused = ref(false);

    const resizeHandler = ref<ResizeHandler | null>(null);

    const stopDraggingAndBlur = () => {
      // Clicking on the drag handle shouldn't leave it focused;
      // That would cause the PanelGroup to think it was still active.
      divElementRef.value?.blur();

      stopDragging();
    };

    watch(
      [
        () => props.disabled,
        resizeHandleId,
        // registerResizeHandle
      ],
      () => {
        if (props.disabled) {
          resizeHandler.value = null;
        } else {
          const localResizeHandler = registerResizeHandle(resizeHandleId.value);

          resizeHandler.value = localResizeHandler;
        }
      },
      { immediate: true }
    );

    watch(
      [
        direction,
        () => props.disabled,
        isDragging,
        resizeHandler,
        // stopDraggingAndBlur,
      ],
      (newValue, oldValue, onCleanup) => {
        if (
          props.disabled ||
          resizeHandler.value == null ||
          !isDragging.value
        ) {
          return;
        }

        const onMove = (event: ResizeEvent) => {
          resizeHandler.value?.(event);
        };

        document.body.addEventListener("contextmenu", stopDraggingAndBlur);
        document.body.addEventListener("mousemove", onMove);
        document.body.addEventListener("touchmove", onMove);
        window.addEventListener("mouseup", stopDraggingAndBlur);
        window.addEventListener("touchend", stopDraggingAndBlur);

        onCleanup(() => {
          document.body.removeEventListener("contextmenu", stopDraggingAndBlur);
          document.body.removeEventListener("mousemove", onMove);
          document.body.removeEventListener("touchmove", onMove);
          window.removeEventListener("mouseup", stopDraggingAndBlur);
          window.removeEventListener("touchend", stopDraggingAndBlur);
        });
      },
      { immediate: true }
    );

    const computedDisabled = computed(() => props.disabled);

    useWindowSplitterResizeHandlerBehavior({
      disabled: computedDisabled,
      handleId: resizeHandleId,
      resizeHandler,
    });

    const style = computed<CSSProperties>(() => ({
      cursor: getCursorStyle(direction.value),
      touchAction: "none",
      userSelect: "none",
    }));

    return () =>
      h(
        props.tagName,
        {
          "data-resize-handle-active": isDragging.value
            ? "pointer"
            : isFocused.value
            ? "keyboard"
            : undefined,
          "data-panel-group-direction": direction.value,
          "data-panel-group-id": groupId.value,
          "data-panel-resize-handle-enabled": !props.disabled,
          "data-panel-resize-handle-id": resizeHandleId.value,
          onBlur: () => {
            isFocused.value = false;
          },
          onFocus: () => {
            isFocused.value = true;
          },
          onMousedown: (event: MouseEvent) =>
            startDragging(resizeHandleId.value, event),
          onMouseup: stopDraggingAndBlur,
          onTouchcancel: stopDraggingAndBlur,
          onTouchend: stopDraggingAndBlur,
          onTouchstart: (event: TouchEvent) =>
            startDragging(resizeHandleId.value, event),
          ref: divElementRef,
          role: "separator",
          style: style.value,
          tabIndex: 0,
        },
        slots.default?.()
      );
  },
});
