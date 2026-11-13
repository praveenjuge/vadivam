import { mock } from "bun:test";
import React, { forwardRef } from "react";

// Renders each react-native-svg primitive as its DOM element. Props that only
// React Native understands become attributes of their own, so tests see what
// the package passed rather than anything the mock filled in. Only the
// components react-native-svg really exports are mocked.
function primitive(tag) {
  const Component = forwardRef(({ children, testID, accessible, accessibilityLabel, accessibilityRole, ...props }, ref) =>
    React.createElement(
      tag,
      {
        ...props,
        "data-rn-test-id": testID,
        "data-rn-accessible": accessible,
        "data-rn-label": accessibilityLabel,
        "data-rn-role": accessibilityRole,
        ref,
      },
      children,
    ),
  );
  Component.displayName = `NativeSvg.${tag}`;
  return Component;
}

mock.module("react-native-svg", () => ({
  Svg: primitive("svg"),
  Circle: primitive("circle"),
  Ellipse: primitive("ellipse"),
  Line: primitive("line"),
  Path: primitive("path"),
  Polygon: primitive("polygon"),
  Polyline: primitive("polyline"),
  Rect: primitive("rect"),
}));
