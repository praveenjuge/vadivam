package com.praveenjuge.vadivam

import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.PathNode
import androidx.compose.ui.graphics.vector.VectorPath
import androidx.compose.ui.unit.dp
import com.praveenjuge.vadivam.icons.Activity
import com.praveenjuge.vadivam.icons.byName
import com.praveenjuge.vadivam.icons.names
import com.praveenjuge.vadivam.icons.solid.Activity as SolidActivity
import com.praveenjuge.vadivam.icons.solid.byName as solidByName
import com.praveenjuge.vadivam.icons.solid.names as solidNames
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class VadivamIconsTest {
    @Test
    fun everyIconIsAStroked24pxVector() {
        assertTrue(VadivamIcons.names.size > 1000)
        for (name in VadivamIcons.names) {
            val icon = VadivamIcons.byName(name)!!
            assertEquals(name, 24.dp, icon.defaultWidth)
            assertEquals(name, 24f, icon.viewportWidth)
            val path = icon.root.single() as VectorPath
            assertEquals(name, 2f, path.strokeLineWidth)
            assertEquals(name, StrokeCap.Round, path.strokeLineCap)
            assertEquals(name, StrokeJoin.Round, path.strokeLineJoin)
            assertTrue(name, path.pathData.first() is PathNode.MoveTo)
        }
    }

    @Test
    fun iconsAreCachedAndLookedUpByName() {
        assertSame(VadivamIcons.Activity, VadivamIcons.Activity)
        assertSame(VadivamIcons.Activity, VadivamIcons.byName("activity"))
        assertNull(VadivamIcons.byName("not-an-icon"))
    }

    @Test
    fun withStrokeWidthCopiesGeometry() {
        val original = VadivamIcons.Activity.root.single() as VectorPath
        val thin = VadivamIcons.Activity.withStrokeWidth(1.5f).root.single() as VectorPath
        assertEquals(1.5f, thin.strokeLineWidth)
        assertEquals(original.pathData, thin.pathData)
        val absolute = VadivamIcons.Activity.withStrokeWidth(2f, absoluteSize = 48.dp).root.single() as VectorPath
        assertEquals(1f, absolute.strokeLineWidth)
    }

    @Test
    fun everyIconHasAFilledSolidTwin() {
        assertEquals(VadivamIcons.names, VadivamSolidIcons.solidNames)
        for (name in VadivamSolidIcons.solidNames) {
            val icon = VadivamSolidIcons.solidByName(name)!!
            assertEquals(name, 24.dp, icon.defaultWidth)
            assertEquals(name, 24f, icon.viewportWidth)
            val path = icon.root.single() as VectorPath
            assertNotNull(name, path.fill)
            assertNull(name, path.stroke)
            assertEquals(name, PathFillType.EvenOdd, path.pathFillType)
            assertTrue(name, path.pathData.first() is PathNode.MoveTo)
        }
        assertSame(VadivamSolidIcons.SolidActivity, VadivamSolidIcons.solidByName("activity"))
    }
}
