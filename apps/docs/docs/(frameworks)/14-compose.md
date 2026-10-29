---
title: Jetpack Compose
description: Use free, open-source Vadivam icons in Jetpack Compose as ImageVectors and in Android Views as vector drawables.
sidebar:
  label: Compose
seo:
  title: Jetpack Compose Icons – Outline ImageVectors
related:
  - /docs/flutter
  - /docs/react-native
  - /docs/accessibility
search:
  keywords: [android, kotlin, imagevector, vector drawable, material, maven]
---

`com.praveenjuge:vadivam-compose` on Maven Central has every icon as a Compose `ImageVector` and as an Android vector drawable. It needs Android API 23 or newer.

```kotlin
dependencies {
    implementation("com.praveenjuge:vadivam-compose:<version>")
}
```

Use the version from the [latest release](https://github.com/praveenjuge/vadivam/releases/latest).

## Basic usage

Icons are extension properties on `VadivamIcons`. Import each one you use:

```kotlin
import com.praveenjuge.vadivam.VadivamIcons
import com.praveenjuge.vadivam.icons.Activity

Icon(VadivamIcons.Activity, contentDescription = null)

Icon(
    imageVector = VadivamIcons.Activity,
    contentDescription = "Activity",
    modifier = Modifier.size(20.dp),
    tint = Color(0xFF3F51B5),
)
```

`Icon` from Material tints the stroke with the current content color. Each `ImageVector` is built on first use and then cached.

## Stroke width

Icons draw with a stroke width of `2` view-box units. Use `withStrokeWidth` for a different weight, and wrap it in `remember` inside composables:

```kotlin
import com.praveenjuge.vadivam.withStrokeWidth

val thin = remember { VadivamIcons.Activity.withStrokeWidth(1.5f) }
Icon(thin, contentDescription = null)

// Keep the stroke 2 dp wide when the icon is drawn at 48 dp.
val bold = remember { VadivamIcons.Activity.withStrokeWidth(2f, absoluteSize = 48.dp) }
Icon(bold, contentDescription = null, modifier = Modifier.size(48.dp))
```

## Solid icons

Every icon has a [solid](/docs/design-guide#solid) twin with the same name on `VadivamSolidIcons`, filled instead of stroked. Import solid icons from `com.praveenjuge.vadivam.icons.solid`:

```kotlin
import com.praveenjuge.vadivam.VadivamSolidIcons
import com.praveenjuge.vadivam.icons.solid.House

Icon(VadivamSolidIcons.House, contentDescription = null)
```

`Icon` tints the fill. Solid icons have no stroke, so `withStrokeWidth` leaves them unchanged. `byName` and `names` from `com.praveenjuge.vadivam.icons.solid` work on `VadivamSolidIcons` too. To import an outline and a solid icon with the same name in one file, alias one of them, such as `import com.praveenjuge.vadivam.icons.solid.House as SolidHouse`.

## Android Views

Every icon is also a vector drawable named `vadivam_` plus the icon name with underscores, and its solid twin `vadivam_solid_` plus the name, tinted with `colorControlNormal` like Material icons:

```xml
<ImageView
    android:layout_width="24dp"
    android:layout_height="24dp"
    android:src="@drawable/vadivam_arrow_right"
    android:contentDescription="@null" />

<ImageView
    android:layout_width="24dp"
    android:layout_height="24dp"
    android:src="@drawable/vadivam_solid_house"
    android:contentDescription="@null" />
```

The same drawables are attached to each [GitHub release](https://github.com/praveenjuge/vadivam/releases/latest) as a zip for projects that don't use Gradle dependencies.

## Runtime names

```kotlin
import com.praveenjuge.vadivam.icons.byName

VadivamIcons.byName("arrow-right")?.let { Icon(it, contentDescription = null) }
```

R8 removes icons and drawables your app doesn't use. Calling `byName` keeps every icon in the app, so prefer the named properties when the icon is known. `VadivamIcons.names` lists every name.

## Accessibility

Pass `contentDescription = null` for decorative icons, and a short description for icons that carry meaning on their own. See [Accessibility](/docs/accessibility).
