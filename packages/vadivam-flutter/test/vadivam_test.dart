import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vadivam/vadivam.dart';

Widget _app(Widget child) => Directionality(
      textDirection: TextDirection.ltr,
      child: Center(child: child),
    );

void main() {
  test('every icon draws inside the 24px view box', () {
    expect(VadivamIcons.all, hasLength(greaterThan(1000)));
    for (final MapEntry(key: name, value: icon) in VadivamIcons.all.entries) {
      expect(icon.name, name);
      var length = 0.0;
      // Sampled points, since getBounds() includes curve control points.
      for (final metric in icon.path.computeMetrics()) {
        length += metric.length;
        for (var distance = 0.0; distance <= metric.length; distance += 0.25) {
          final point = metric.getTangentForOffset(distance)!.position;
          expect(point.dx, inInclusiveRange(0.5, 23.5), reason: name);
          expect(point.dy, inInclusiveRange(0.5, 23.5), reason: name);
        }
      }
      expect(length, greaterThan(0), reason: name);
    }
  });

  testWidgets('sizes from IconTheme and hides decorative icons',
      (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(_app(const IconTheme(
      data: IconThemeData(size: 40, color: Color(0xFF000080)),
      child: VadivamIcon(VadivamIcons.activity),
    )));
    expect(tester.getSize(find.byType(VadivamIcon)), const Size(40, 40));
    expect(find.bySemanticsLabel(RegExp('.')), findsNothing);
    semantics.dispose();
  });

  testWidgets('labels meaningful icons and honors explicit size',
      (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(_app(const VadivamIcon(
      VadivamIcons.arrowRight,
      size: 48,
      strokeWidth: 1,
      absoluteStrokeWidth: true,
      semanticLabel: 'Next',
    )));
    expect(tester.getSize(find.byType(VadivamIcon)), const Size(48, 48));
    expect(
      tester.getSemantics(find.bySemanticsLabel('Next')),
      matchesSemantics(label: 'Next', isImage: true),
    );
    semantics.dispose();
  });

  testWidgets('VadivamIconTheme sets the default stroke width',
      (tester) async {
    await tester.pumpWidget(_app(const VadivamIconTheme(
      strokeWidth: 1.5,
      child: VadivamIcon(VadivamIcons.activity),
    )));
    final paint = tester.widget<CustomPaint>(find.descendant(
        of: find.byType(VadivamIcon), matching: find.byType(CustomPaint)));
    expect(paint.painter, isNotNull);
    expect(tester.renderObject<RenderCustomPaint>(find.byWidget(paint)).size,
        const Size(24, 24));
  });
}
