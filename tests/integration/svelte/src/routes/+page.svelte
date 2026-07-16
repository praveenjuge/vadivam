<script lang="ts">
  import { Activity, Icon, VadivamProvider, createVadivamIcon } from "vadivam-svelte";
  import AArrowDown from "vadivam-svelte/a-arrow-down";
  import DynamicIcon from "vadivam-svelte/dynamic";
  const factory = createVadivamIcon("factory", [["line", { x1: "2", y1: "12", x2: "22", y2: "12" }]]);
</script>

<VadivamProvider size={48} color="navy" strokeWidth={2} class="context-icon">
  <Activity id="static" absoluteStrokeWidth title="Activity chart" class="consumer-icon context-icon" data-custom="yes" />
  <AArrowDown id="direct" />
  <DynamicIcon id="dynamic" name="airplay" />
  <Icon id="factory" {...factory} />
</VadivamProvider>
