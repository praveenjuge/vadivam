---
title: Flutter
description: Use free, open-source Vadivam icons in Flutter as vector widgets with adjustable size, color, and stroke width.
seo:
  title: Flutter Icons – 24px Outline Icon Widgets
related:
  - /docs/compose
  - /docs/react-native
  - /docs/accessibility
search:
  keywords: [dart, pub.dev, widget, ios, android, mobile, iconData]
---

The `vadivam` package on [pub.dev](https://pub.dev/packages/vadivam) draws every icon as vector strokes with a `CustomPainter`. It depends only on Flutter.

```sh
flutter pub add vadivam
```

## Basic usage

```dart
import 'package:vadivam/vadivam.dart';

VadivamIcon(VadivamIcons.activity)

VadivamIcon(
  VadivamIcons.search,
  size: 20,
  color: Colors.indigo,
  strokeWidth: 1.5,
  semanticLabel: 'Search',
)
```

Icon names are lowerCamelCase versions of the kebab-case names, such as `arrowRight` for `arrow-right`.

`size` and `color` default to the surrounding `IconTheme`, like Flutter's `Icon`, so icons in app bars, buttons, and list tiles pick up the right size and color. Without a theme, icons are 24 pixels and black.

## Stroke width

`strokeWidth` is in view-box units and defaults to `2`. Set `absoluteStrokeWidth: true` to keep the stroke `strokeWidth` logical pixels wide at any size.

Set defaults for a subtree with `VadivamIconTheme`:

```dart
VadivamIconTheme(
  strokeWidth: 1.5,
  child: Row(children: [
    VadivamIcon(VadivamIcons.activity),
    VadivamIcon(VadivamIcons.search),
  ]),
)
```

## Accessibility

Icons are left out of the semantics tree unless you pass `semanticLabel`. Give a label to icons that carry meaning on their own, and leave it out when nearby text already says the same thing. See [Accessibility](/docs/accessibility).

## Runtime names

```dart
final icon = VadivamIcons.all['arrow-right'];
if (icon != null) VadivamIcon(icon);
```

Release builds tree-shake icons you don't reference. Using `VadivamIcons.all` keeps every icon in the app, so prefer the named constants when the icon is known.

The `VadivamIconData.path` getter returns the geometry as a Flutter `Path` in a 24 by 24 box, for custom painting.
