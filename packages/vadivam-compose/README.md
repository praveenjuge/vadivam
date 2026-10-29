# Vadivam for Jetpack Compose

Pixel-perfect 24px outline and solid icons for Jetpack Compose and Android Views.

[Browse icons](https://vadivam.praveenjuge.com) · [Compose docs](https://vadivam.praveenjuge.com/docs/compose) · [Source](https://github.com/praveenjuge/vadivam/tree/main/packages/vadivam-compose) · [GitHub](https://github.com/praveenjuge/vadivam)

```kotlin
dependencies {
    implementation("com.praveenjuge:vadivam-compose:0.0.77")
}
```

```kotlin
import com.praveenjuge.vadivam.VadivamIcons
import com.praveenjuge.vadivam.icons.Activity

Icon(VadivamIcons.Activity, contentDescription = null)
```

- Every icon as an `ImageVector`, built once on first use
- `withStrokeWidth()` for thinner or thicker strokes, including absolute stroke widths
- Android vector drawables such as `R.drawable.vadivam_activity` for Views and XML layouts
- Unused icons and drawables are removed by R8 and resource shrinking

Every icon also has a solid twin with the same name on `VadivamSolidIcons`, filled instead of stroked, and a `vadivam_solid_` vector drawable:

```kotlin
import com.praveenjuge.vadivam.VadivamSolidIcons
import com.praveenjuge.vadivam.icons.solid.Activity

Icon(VadivamSolidIcons.Activity, contentDescription = null)
```

Package family: [SVG and JavaScript](https://www.npmjs.com/package/vadivam) · [React](https://www.npmjs.com/package/vadivam-react) · [React Native](https://www.npmjs.com/package/vadivam-react-native) · [Vue](https://www.npmjs.com/package/vadivam-vue) · [Svelte](https://www.npmjs.com/package/vadivam-svelte) · [Solid](https://www.npmjs.com/package/vadivam-solid) · [Angular](https://www.npmjs.com/package/vadivam-angular) · [Astro](https://www.npmjs.com/package/vadivam-astro) · [Preact](https://www.npmjs.com/package/vadivam-preact) · [Qwik](https://www.npmjs.com/package/vadivam-qwik) · [Lit](https://www.npmjs.com/package/vadivam-lit) · [Flutter](https://pub.dev/packages/vadivam) · [MCP server](https://www.npmjs.com/package/vadivam-mcp)

[Issues](https://github.com/praveenjuge/vadivam/issues)
