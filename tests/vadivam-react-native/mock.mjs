import { mock } from "bun:test";
import React, { forwardRef } from "react";

function primitive(tag) {
  const Component = forwardRef(
    ({ children, testID, accessibilityLabel, ...props }, ref) =>
      React.createElement(
        tag,
        {
          ...props,
          ...(testID && !props["data-testid"] ? { "data-testid": testID } : {}),
          ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
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
