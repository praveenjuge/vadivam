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
  `,
})
class App {
  readonly factory = createVadivamIcon("factory", [["line", { x1: "2", y1: "12", x2: "22", y2: "12" }]]);
}

bootstrapApplication(App, {
  providers: [
    provideVadivamConfig({ size: 48, color: "navy", strokeWidth: 2, class: "context-icon" }),
  ],
});
