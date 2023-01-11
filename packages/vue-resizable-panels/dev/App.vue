<script setup lang="ts">
import { Panel, PanelGroup } from "../src";
import ResizeHandle from "./ResizeHandle.vue";
</script>

<template>
  <div class="PanelGroupWrapper">
    <PanelGroup class="PanelGroup" direction="horizontal">
      <Panel class="PanelRow" :defaultSize="20" :minSize="20">
        <div class="Centered">left</div>
      </Panel>
      <ResizeHandle class="ResizeHandle" />
      <Panel class="PanelRow" :minSize="30">
        <div class="Centered">middle</div>
      </Panel>
      <ResizeHandle class="ResizeHandle" />
      <Panel class="PanelRow" :defaultSize="20" :minSize="20">
        <div class="Centered">right</div>
      </Panel>
    </PanelGroup>
  </div>
</template>

<style scoped>
.PanelGroupWrapper {
  height: 20rem;
  background-color: grey;
}

.PanelGroup {
  font-size: 2rem;
}

.Panel {
  display: flex;
  flex-direction: row;
  font-size: 2rem;
}

.PanelColumn,
.PanelRow {
  display: flex;
}
.PanelColumn {
  flex-direction: column;
}
.PanelRow {
  flex-direction: row;
}

.Centered {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-panel-background);
  border-radius: 0.5rem;
  overflow: auto;
  font-size: 1rem;
  padding: 0.5rem;
  word-break: break-all;
}

.ResizeHandle {
  background-color: red;
}

.Overflow {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 1rem;

  /* Firefox fixes */
  scrollbar-width: thin;
  scrollbar-color: var(--color-scroll-thumb) transparent;
}

.Button,
.ButtonDisabled {
  background-color: var(--color-button-background);
  color: var(--color-default);
  border: none;
  border-radius: 0.5rem;
  padding: 0.25rem 0.5rem;
}
.Button:hover {
  background-color: var(--color-button-background-hover);
}
.ButtonDisabled {
  opacity: 0.5;
}

.Buttons {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1ch;
  margin-bottom: 1rem;
}

.Capitalize {
  text-transform: capitalize;
}

.WarningBlock {
  display: inline-block;
  background: var(--color-warning-background);
  padding: 0.25em 1ch;
  border-radius: 0.5rem;
}
</style>
