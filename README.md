# vue-resizable-panels

An intuitive resizable panel groups/layouts components for Vue.

Based on [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels).

## Installation

Install the package:

```sh
npm install vue-resizable-panels
# or
pnpm install vue-resizable-panels
# or
yarn add vue-resizable-panels
```

Import the components directly:

```vue
<script setup lang="ts">
import { Panel, PanelGroup, PanelResizeHandle } from "vue-resizable-panels";
</script>

<template>
  <div>
    <PanelGroup direction="horizontal">
      <Panel :defaultSize="20" :minSize="20">
        <div>left</div>
      </Panel>
      <PanelResizeHandle />
      <Panel :minSize="30">
        <div>middle</div>
      </Panel>
      <PanelResizeHandle />
      <Panel :defaultSize="20" :minSize="20">
        <div>right</div>
      </Panel>
    </PanelGroup>
  </div>
</template>
```

For more examples, check out the [demo](./packages/demo/src/App.vue).

For API reference, check out the [react-resizable-panels's docs](https://github.com/bvaughn/react-resizable-panels/tree/main/packages/react-resizable-panels). The API is almost exactly the same, with minor differences as follows:

- No `children` prop. This is taken care of by [slots in Vue](https://vuejs.org/guide/components/slots.html).
- No `className` prop. You can freely pass CSS classes via the `class` attribute as Vue inherits attributes by default.

## Development

```sh
pnpm install

cd packages/vue-resizable-panels/
pnpm dev

pnpm build
cd ../demo/
pnpm dev
```

## Credits

This project was heavily inspired by the [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) library so please give some love to the library as well!

Credits to [@bvaughn](https://twitter.com/brian_d_vaughn) ([GitHub](https://github.com/bvaughn)) for creating [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)!
