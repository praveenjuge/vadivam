import assert from "node:assert/strict";
import { icons, iconsByName, iconNames } from "vadivam";
import { Activity, dynamicIconImports } from "vadivam-react";
import ActivitySubpath from "vadivam-react/activity";
import ActivityIconSubpath from "vadivam-react/icons/activity";
import DynamicIconImportsDefault from "vadivam-react/dynamicIconImports";

assert.equal(icons.length, iconNames.length);
assert.equal(iconsByName.activity.componentName, "Activity");
assert.equal(Activity.displayName, "Activity");
assert.equal(ActivitySubpath.displayName, "Activity");
assert.equal(ActivityIconSubpath.displayName, "Activity");
assert.equal(typeof dynamicIconImports.activity, "function");
assert.equal(DynamicIconImportsDefault, dynamicIconImports);

const resolvedSvg = import.meta.resolve("vadivam/icons/activity.svg");
assert.ok(resolvedSvg.endsWith("/packages/vadivam/dist/icons/activity.svg"));

console.log("Package export smoke tests passed.");
