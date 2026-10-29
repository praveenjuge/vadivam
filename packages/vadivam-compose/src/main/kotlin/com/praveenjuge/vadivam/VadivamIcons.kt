package com.praveenjuge.vadivam

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.VectorGroup
import androidx.compose.ui.graphics.vector.VectorPath
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Every Vadivam icon, as an extension property such as `VadivamIcons.Activity`.
 *
 * Icons are 24 by 24 [ImageVector]s with a black 2-unit stroke. Draw them with
 * `Icon(VadivamIcons.Activity, contentDescription = null)`, which tints the
 * stroke, or with `Image` and a `ColorFilter`.
 */
public object VadivamIcons

/**
 * The solid twin of every Vadivam icon, as an extension property such as
 * `VadivamSolidIcons.Activity` from `com.praveenjuge.vadivam.icons.solid`.
 *
 * Solid icons are 24 by 24 [ImageVector]s filled black by the even-odd rule,
 * with no stroke. `Icon` tints the fill like any other vector.
 */
public object VadivamSolidIcons

/** Builds one icon. Used by the generated `VadivamIcons` properties. */
public fun vadivamIcon(name: String, pathBuilder: PathBuilder.() -> Unit): ImageVector =
    ImageVector.Builder(
        name = "Vadivam.$name",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    ).path(
        stroke = SolidColor(Color.Black),
        strokeLineWidth = 2f,
        strokeLineCap = StrokeCap.Round,
        strokeLineJoin = StrokeJoin.Round,
        pathBuilder = pathBuilder,
    ).build()

/** Builds one solid icon. Used by the generated `VadivamSolidIcons` properties. */
public fun vadivamSolidIcon(name: String, pathBuilder: PathBuilder.() -> Unit): ImageVector =
    ImageVector.Builder(
        name = "Vadivam.Solid.$name",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    ).path(
        fill = SolidColor(Color.Black),
        pathFillType = PathFillType.EvenOdd,
        pathBuilder = pathBuilder,
    ).build()

/**
 * Returns a copy of a Vadivam icon with a different stroke width in view-box
 * units. Wrap the call in `remember` inside composables.
 *
 * Set [absoluteSize] to the size the icon is drawn at to keep the stroke
 * [strokeWidth] dp wide at any size, like `absoluteStrokeWidth` on the web.
 */
public fun ImageVector.withStrokeWidth(
    strokeWidth: Float,
    absoluteSize: Dp? = null,
): ImageVector {
    val width = if (absoluteSize != null && absoluteSize.value > 0f) {
        strokeWidth * viewportWidth / absoluteSize.value
    } else {
        strokeWidth
    }
    val builder = ImageVector.Builder(
        name = name,
        defaultWidth = defaultWidth,
        defaultHeight = defaultHeight,
        viewportWidth = viewportWidth,
        viewportHeight = viewportHeight,
        tintColor = tintColor,
        tintBlendMode = tintBlendMode,
        autoMirror = autoMirror,
    )
    fun copy(group: VectorGroup) {
        for (node in group) {
            when (node) {
                is VectorPath -> builder.addPath(
                    pathData = node.pathData,
                    pathFillType = node.pathFillType,
                    name = node.name,
                    fill = node.fill,
                    fillAlpha = node.fillAlpha,
                    stroke = node.stroke,
                    strokeAlpha = node.strokeAlpha,
                    strokeLineWidth = width,
                    strokeLineCap = node.strokeLineCap,
                    strokeLineJoin = node.strokeLineJoin,
                    strokeLineMiter = node.strokeLineMiter,
                )
                is VectorGroup -> {
                    builder.addGroup(
                        name = node.name,
                        rotate = node.rotation,
                        pivotX = node.pivotX,
                        pivotY = node.pivotY,
                        scaleX = node.scaleX,
                        scaleY = node.scaleY,
                        translationX = node.translationX,
                        translationY = node.translationY,
                        clipPathData = node.clipPathData,
                    )
                    copy(node)
                    builder.clearGroup()
                }
            }
        }
    }
    copy(root)
    return builder.build()
}
