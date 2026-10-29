---
title: Figma plugin
description: Search every Vadivam icon inside Figma, place it as an editable local component, and swap Lucide icons in a design to Vadivam in one step.
seo:
  title: Figma Plugin – Vadivam Icons for Figma
related:
  - /docs/migrate-from-lucide
  - /docs/categories
  - /docs/design-guide
search:
  keywords: [figma, figma plugin, figma community, design, components, swap lucide]
---

The [Vadivam Icons plugin](https://www.figma.com/community/plugin/1661323620355050204/vadivam-icons) puts the full icon set inside Figma. It places icons as editable local components, so designers work with the same drawings that ship in the packages. Prefer a library? The [Vadivam Icons Community file](https://www.figma.com/community/file/1661416202515574840/vadivam-icons) holds every icon as one component set.

## Install

Open the [plugin page](https://www.figma.com/community/plugin/1661323620355050204/vadivam-icons) on Figma Community and choose **Open in…** or **Save**. Then run **Vadivam Icons** from **Plugins** in any design file.

## Search and insert

- Search by icon name, by synonym from the icon's tags, or by category title. These are the same matches the [website](/) uses. The category menu narrows the grid.
- Click an icon, or press <kbd>Enter</kbd> for the first result, to place it in the middle of the viewport. Icons you place one after another line up in a row.
- Each icon arrives as a 24×24 local component with a 2px centerline stroke, so you can resize it, recolor it, and change its stroke weight like any vector.
- Every component carries a short description with its categories, tags, and a link to its icon page, so Figma's asset search finds it by those words later.

To change an icon you placed earlier, select it and pick another icon. The size and stroke color stay the same. Select the component to redraw it and every instance of it, after you confirm; select one instance to change only that use. Figma also shows a **Replace icon** button on placed icons, which reopens the plugin.

## Swap Lucide icons

Select a frame that holds Lucide icons, or select the icons themselves, and the plugin offers to swap them to Vadivam. Each Lucide icon becomes the Vadivam drawing of the same name. Icons Lucide added after Vadivam's latest batch are left as they are.

- It recognizes square, stroke-only layers named after a Lucide icon, such as `arrow-right`, `ArrowRight`, `lucide/arrow-right`, or a deprecated name such as `home`. Layers with filled shapes, such as buttons and tiles, are left alone.
- Each swapped icon keeps its size, stroke color, stroke weight, and position in auto layout.
- Repeats of the same icon become instances of one new component.
- A local Lucide component is redrawn in place, so its existing instances update with it.
- The whole swap is one undo step.

Moving the code as well? See [Migrate from Lucide](/docs/migrate-from-lucide) for the codemod.

## Privacy

The icon catalog is bundled inside the plugin, so it works offline and makes no network requests. It requests no permissions and collects no personal data. The only data it stores is a schema version and the icon's name, on components it creates, so a placed icon can be replaced later.
