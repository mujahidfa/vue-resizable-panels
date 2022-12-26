import {
  defineComponent,
  h,
  inject,
  onUnmounted,
  toRefs,
  watchEffect,
} from "vue";
import { panelGroupInjectionKey } from "./keys";

// TODO [panels]
// Support min pixel size too.
// PanelGroup should warn if total width is less min pixel widths.
const Panel = defineComponent({
  name: "Panel",
  props: {
    defaultSize: {
      type: Number,
      default: 0.1,
    },
    id: {
      type: String,
      required: true,
    },
    minSize: {
      type: Number,
      default: 0.1,
    },
    order: {
      type: Number,
      default: null,
    },
  },
  setup(props, { slots }) {
    const injection = inject(panelGroupInjectionKey);
    if (!injection) {
      throw Error(
        `Panel components must be rendered within a PanelGroup container`
      );
    }

    const { minSize, defaultSize, id, order } = toRefs(props);

    if (minSize.value > defaultSize.value) {
      console.error(
        `Panel minSize ${minSize.value} cannot be greater than defaultSize ${defaultSize.value}`
      );

      defaultSize.value = minSize.value;
    }

    const { getPanelStyle, registerPanel, unregisterPanel } = injection;

    watchEffect(() => {
      registerPanel(id.value, {
        defaultSize: defaultSize.value,
        id: id.value,
        minSize: minSize.value,
        order: order.value,
      });
    });

    onUnmounted(() => {
      unregisterPanel(id.value);
    });

    const style = getPanelStyle(id.value);

    return () =>
      h(
        "div",
        {
          "data-panel-id": id.value,
          id: `data-panel-id-${id.value}`,
          style: style,
        },
        slots.default ? slots.default() : undefined
      );
  },
});

export default Panel;
