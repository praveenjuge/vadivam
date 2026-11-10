import "./mock.mjs";
import { describe, expect, test } from "bun:test";
import React from "react";
import { render, waitFor } from "@testing-library/react";
import DynamicIcon, { iconNames } from "vadivam-react-native/dynamic";
import { iconNames as sourceIconNames } from "../../scripts/icon-source.mjs";

describe("vadivam-react-native DynamicIcon", () => {
  test("covers every icon", async () => {
    expect(iconNames).toEqual(await sourceIconNames());
  });

  test("renders a fallback for an unknown name", async () => {
    // A valid icon beside it shows when lazy loads have had time to finish.
    const { getByTestId, getByText, queryByTestId } = render(
      React.createElement(
        "div",
        null,
        React.createElement(DynamicIcon, {
          name: "definitely-not-an-icon",
          fallback: React.createElement("span", null, "missing"),
          testID: "unknown",
        }),
        React.createElement(DynamicIcon, { name: "activity", testID: "valid" }),
      ),
    );
    await waitFor(() => expect(getByTestId("valid")).toBeDefined());
    expect(getByText("missing")).toBeDefined();
    expect(queryByTestId("unknown")).toBeNull();
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
