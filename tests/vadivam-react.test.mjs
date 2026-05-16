import { describe, expect, test } from "bun:test";
import { Activity, dynamicIconImports } from "vadivam-react";
import ActivitySubpath from "vadivam-react/activity";
import ActivityIconSubpath from "vadivam-react/icons/activity";
import DynamicIconImportsDefault from "vadivam-react/dynamicIconImports";

describe("vadivam-react package", () => {
  test("exports named and per-icon components", () => {
    expect(Activity.displayName).toBe("Activity");
    expect(ActivitySubpath.displayName).toBe("Activity");
    expect(ActivityIconSubpath.displayName).toBe("Activity");
  });

  test("exports dynamic icon imports", async () => {
    expect(DynamicIconImportsDefault).toBe(dynamicIconImports);
    expect(typeof dynamicIconImports.activity).toBe("function");
    const activityModule = await dynamicIconImports.activity();
    expect(activityModule.default.displayName).toBe("Activity");
  });
});
