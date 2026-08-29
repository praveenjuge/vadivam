<script lang="ts">
  import { Activity, Icon, VadivamProvider, createVadivamIcon } from "vadivam-svelte";
  import AArrowDown from "vadivam-svelte/a-arrow-down";
  import DynamicIcon from "vadivam-svelte/dynamic";
  const factory = createVadivamIcon("factory", [["line", { x1: "2", y1: "12", x2: "22", y2: "12" }]]);
  const rawScript = "<script>alert(1)</scr" + "ipt>";
  const security = createVadivamIcon("security", [
    ["script", { href: "data:text/javascript,alert(1)" }],
    ["animate", { onbegin: "alert(1)", attributeName: "href" }],
    ["path", { d: "M2 2h2", onclick: "alert(1)", innerHTML: rawScript }],
  ] as any);
  const unsafeRootProps = { color: "url(https://example.com/paint.svg#x)", innerHTML: rawScript, onload: "alert(1)" } as any;
</script>

<VadivamProvider size={48} color="navy" strokeWidth={2} class="context-icon">
  <Activity id="static" absoluteStrokeWidth title="Activity chart" class="consumer-icon context-icon" data-custom="yes" onclick={() => (globalThis as any).__vadivamFunctionEventCount = ((globalThis as any).__vadivamFunctionEventCount ?? 0) + 1} />
  <AArrowDown id="direct" />
  <DynamicIcon id="dynamic" name="airplay" />
  <Icon id="factory" {...factory} />
  <Icon id="security" {...security} {...unsafeRootProps} />
</VadivamProvider>
