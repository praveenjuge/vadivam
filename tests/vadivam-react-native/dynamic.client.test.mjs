import "./mock.mjs";
import { describe, expect, test } from "bun:test";
import React from "react";
import { render, waitFor } from "@testing-library/react";
import DynamicIcon, { iconNames } from "vadivam-react-native/dynamic";
import { readIcons } from "../../scripts/icons.mjs";

describe("vadivam-react-native DynamicIcon", () => {
  test("covers every generated icon", async () => {
    expect(iconNames).toHaveLength((await readIcons()).length);
  });

  test("renders a fallback for an unknown name", () => {
    const { getByText, queryByTestId } = render(
      React.createElement(DynamicIcon, {
        name: "definitely-not-an-icon",
        fallback: React.createElement("span", null, "missing"),
        testID: "dynamic",
      }),
    );
    expect(getByText("missing")).toBeDefined();
    expect(queryByTestId("dynamic")).toBeNull();
  });

  test("loads a valid icon and forwards native props", async () => {
    const { getByTestId } = render(
      React.createElement(DynamicIcon, {
        name: "activity",
        fallback: React.createElement("span", null, "loading"),
        size: 40,
        color: "purple",
        testID: "dynamic",
      }),
    );
    await waitFor(() => expect(getByTestId("dynamic")).toBeDefined());
    expect(getByTestId("dynamic").getAttribute("width")).toBe("40");
    expect(getByTestId("dynamic").getAttribute("stroke")).toBe("purple");
  });
});
