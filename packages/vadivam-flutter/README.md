# Vadivam for Flutter

Pixel-perfect 24px outline and solid icons for Flutter, drawn as vectors.

[Browse icons](https://vadivam.praveenjuge.com) · [Flutter docs](https://vadivam.praveenjuge.com/docs/flutter) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam-flutter) · [GitHub](https://github.com/praveenjuge/vadivam)

![All Vadivam icons](https://raw.githubusercontent.com/praveenjuge/vadivam/main/apps/docs/public/preview.png?v=0.0.74)

```sh
flutter pub add vadivam
```

```dart
import 'package:vadivam/vadivam.dart';

VadivamIcon(VadivamIcons.activity, size: 20, color: Colors.indigo)
```

- Size and color follow the surrounding `IconTheme`, like `Icon`
- Adjustable stroke width, with `absoluteStrokeWidth` to keep strokes the same width at any size
- Decorative by default; pass `semanticLabel` for icons that carry meaning
- No dependencies beyond Flutter, and unused icons are tree-shaken from release builds

Every icon also has a solid twin with the same name in `VadivamSolidIcons`, filled with `color` instead of stroked:

```dart
VadivamIcon(VadivamSolidIcons.activity, size: 20, color: Colors.indigo)
```

Package family: [SVG and JavaScript](https://www.npmjs.com/package/vadivam) · [React](https://www.npmjs.com/package/vadivam-react) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Preact](https://www.npmjs.com/package/vadivam-preact) · [Qwik](https://www.npmjs.com/package/vadivam-qwik) · [Lit](https://www.npmjs.com/package/vadivam-lit) · [Jetpack Compose](https://central.sonatype.com/artifact/com.praveenjuge/vadivam-compose) · [MCP server](https://www.npmjs.com/package/vadivam-mcp)

[Issues](https://github.com/praveenjuge/vadivam/issues)
