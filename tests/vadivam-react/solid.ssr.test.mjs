import { describe, expect, spyOn, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { readIcons, styles } from "../../scripts/icons.mjs";
import { House as OutlineHouse } from "vadivam-react";
import * as solid from "vadivam-react/solid";
import SolidHouse from "vadivam-react/solid/icons/house";
import { DynamicIcon } from "vadivam-react/solid/dynamic";
import dynamicIconImports from "vadivam-react/solid/dynamicIconImports";

const solidIcons = await readIcons(styles.solid);

describe("vadivam-react/solid", () => {
  test("renders a filled icon with no stroke", () => {
    const html = renderToStaticMarkup(createElement(solid.House, null));
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('fill-rule="evenodd"');
    expect(html).not.toContain("stroke");
    expect(html).toContain('aria-hidden="true"');
  });

  test("paints the fill with color and ignores stroke props", () => {
    const errorSpy = spyOn(console, "error");
    const html = renderToString(
      createElement(solid.House, { color: "red", size: 32, strokeWidth: 3, absoluteStrokeWidth: true }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    expect(html).toContain('fill="red"');
    expect(html).toContain('width="32"');
    expect(html).not.toContain("stroke");
  });

  test("shares the provider with the outline icons", () => {
    const html = renderToStaticMarkup(
      createElement(
        solid.VadivamProvider,
        { color: "blue", size: 20 },
        createElement(solid.House, null),
        createElement(OutlineHouse, null),
      ),
    );
    expect(html).toContain('fill="blue"');
    expect(html).toContain('stroke="blue"');
    expect(html.match(/width="20"/g)).toHaveLength(2);
  });

  test("draws the solid artwork, not the outline", () => {
    const icon = solidIcons.find(({ name }) => name === "house");
    const html = renderToStaticMarkup(createElement(SolidHouse, null));
    expect(html).toContain(`d="${icon.iconNode[0][1].d}"`);
  });

  test("exports every icon and dynamic import", () => {
    expect(Object.keys(solid.icons)).toHaveLength(solidIcons.length);
    expect(Object.keys(dynamicIconImports)).toHaveLength(solidIcons.length);
    expect(SolidHouse).toBe(solid.House);
    expect(solid.HouseIcon).toBe(solid.House);
    expect(solid.VadivamHouse).toBe(solid.House);
    expect(solid.House).not.toBe(OutlineHouse);
  });

  test("renders a dynamic solid icon's fallback during SSR", () => {
    const html = renderToStaticMarkup(createElement(DynamicIcon, { name: "house", fallback: createElement("span", null, "…") }));
    expect(html).toBe("<span>…</span>");
  });
});
