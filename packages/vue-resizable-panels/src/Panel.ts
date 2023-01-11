import {
  computed,
  defineComponent,
  h,
  inject,
  onUnmounted,
  watch,
  type CSSProperties,
  type PropType,
} from "vue";
import useUniqueId from "./composables/useUniqueId";
import { panelGroupInjectionKey } from "./PanelContexts";
import type { PanelOnCollapse, PanelOnResize } from "./types";

export type PanelProps = {
  collapsible?: boolean;
  defaultSize?: number | null;
  id?: string | null;
  maxSize?: number;
  minSize?: number;
  onCollapse?: PanelOnCollapse | null;
  onResize?: PanelOnResize | null;
  order?: number | null;
  style?: CSSProperties;
  tagName?: string;
};

export type ImperativePanelHandle = {
  collapse: () => void;
  expand: () => void;
  getCollapsed(): boolean;
  getSize(): number;
  resize: (percentage: number) => void;
};

export const Panel = defineComponent({
  // eslint-disable-next-line vue/multi-word-component-names
  name: "Panel",
  props: {
    collapsible: {
      type: Boolean,
      default: false,
      required: false,
    },
    defaultSize: {
      type: null as unknown as PropType<number | null>,
      default: null,
      required: false,
      validator: (defaultSize: number | null) =>
        (typeof defaultSize === "number" &&
          !(defaultSize < 0 || defaultSize > 100)) ||
        defaultSize === null,
    },
    maxSize: {
      type: Number,
      default: 100,
      required: false,
      validator: (maxSize: number) => !(maxSize < 0 || maxSize > 100),
    },
    minSize: {
      type: Number,
      default: 10,
      required: false,
      validator: (minSize: number) => !(minSize < 0 || minSize > 100),
    },
    onCollapse: {
      type: null as unknown as PropType<PanelOnCollapse | null>,
      default: null,
      required: false,
    },
    onResize: {
      type: null as unknown as PropType<PanelOnResize | null>,
      default: null,
      required: false,
    },
    order: {
      type: null as unknown as PropType<number | null>,
      default: null,
      required: false,
      validator: (v) => typeof v === "number" || v === null,
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
  setup(props, { slots, expose }) {
    if (
      props.defaultSize !== null &&
      props.minSize > props.defaultSize &&
      !props.collapsible
    ) {
      throw Error(
        `Panel minSize ${props.minSize} cannot be greater than defaultSize ${props.defaultSize}`
      );
    }

    const context = inject(panelGroupInjectionKey);
    if (context === undefined) {
      throw Error(
        `Panel components must be rendered within a PanelGroup container`
      );
    }

    const panelId = useUniqueId(props.id);

    const {
      collapsePanel,
      expandPanel,
      getPanelStyle,
      registerPanel,
      resizePanel,
      unregisterPanel,
    } = context;

    // Use a ref to guard against users passing inline props
    const callbacksRef = computed<{
      onCollapse: PanelOnCollapse | null;
      onResize: PanelOnResize | null;
    }>(() => ({ onCollapse: props.onCollapse, onResize: props.onResize }));

    watch(
      [
        () => props.collapsible,
        () => props.defaultSize,
        panelId,
        () => props.maxSize,
        () => props.minSize,
        () => props.order,
      ],
      (newValue, oldValue, onCleanup) => {
        const panel = {
          callbacksRef: callbacksRef.value,
          collapsible: props.collapsible,
          defaultSize: props.defaultSize,
          id: panelId.value,
          maxSize: props.maxSize,
          minSize: props.minSize,
          order: props.order,
        };

        registerPanel(panelId.value, panel);

        onCleanup(() => {
          unregisterPanel(panelId.value);
        });
      },
      { immediate: true }
    );

    onUnmounted(() => {
      unregisterPanel(panelId.value);
    });

    const style = computed(() => getPanelStyle(panelId.value));

    const committedValuesRef = computed<{
      size: number;
    }>(() => ({
      size: parseSizeFromStyle(style.value),
    }));

    expose({
      collapse: () => collapsePanel(panelId.value),
      expand: () => expandPanel(panelId.value),
      getCollapsed() {
        return committedValuesRef.value.size === 0;
      },
      getSize() {
        return committedValuesRef.value.size;
      },
      resize: (percentage: number) => resizePanel(panelId.value, percentage),
    });

    return () =>
      h(
        props.tagName,
        {
          "data-panel": "",
          "data-panel-collapsible": props.collapsible || undefined,
          "data-panel-id": panelId.value,
          "data-panel-size": parseFloat("" + style.value.flexGrow).toFixed(1),
          id: `data-panel-id-${panelId.value}`,
          style: style.value,
        },
        slots.default?.()
      );
  },
});

// HACK
function parseSizeFromStyle(style: CSSProperties): number {
  const { flexGrow } = style;
  if (flexGrow === undefined) {
    throw Error("flexGrow is undefined");
  }
  if (typeof flexGrow === "string") {
    return parseFloat(flexGrow);
  } else {
    return flexGrow;
  }
}
