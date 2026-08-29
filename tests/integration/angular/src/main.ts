import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { Activity, DynamicIcon, Icon, createVadivamIcon, provideVadivamConfig } from "vadivam-angular";
import { AArrowDown } from "vadivam-angular/a-arrow-down";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [Activity, AArrowDown, DynamicIcon, Icon],
  template: `
    <svg id="static" class="consumer-icon context-icon" data-custom="yes" vadivamActivity absoluteStrokeWidth title="Activity chart"></svg>
    <svg id="direct" vadivamAArrowDown></svg>
    <svg id="dynamic" [vadivamDynamicIcon]="'airplay'"></svg>
    <svg id="factory" [vadivamIcon]="factory"></svg>
    <svg id="security" [vadivamIcon]="security"></svg>
  `,
})
class App {
  readonly factory = createVadivamIcon("factory", [["line", { x1: "2", y1: "12", x2: "22", y2: "12" }]]);
  readonly security = createVadivamIcon("security", [
    ["script", { href: "data:text/javascript,alert(1)" }],
    ["animate", { onbegin: "alert(1)", attributeName: "href" }],
    ["path", { d: "M2 2h2", onclick: "alert(1)", innerHTML: "<script>alert(1)</script>" }],
  ] as any);
}

bootstrapApplication(App, {
  providers: [
    provideVadivamConfig({ size: 48, color: "navy", strokeWidth: 2, class: "context-icon" }),
  ],
});
