import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Path commands in [VadivamIconData.commands]. Each opcode is followed by its
/// absolute coordinates in the 24 by 24 view box.
abstract final class VadivamPathOp {
  /// `moveTo(x, y)`.
  static const double move = 0;

  /// `lineTo(x, y)`.
  static const double line = 1;

  /// `cubicTo(x1, y1, x2, y2, x, y)`.
  static const double cubic = 2;

  /// `quadraticBezierTo(x1, y1, x, y)`.
  static const double quad = 3;

  /// SVG arc: `rx, ry, rotation, largeArc, sweep, x, y`.
  static const double arc = 4;

  /// `close()`.
  static const double close = 5;
}

/// The geometry of one Vadivam icon: stroked centerlines in a 24 by 24 view box.
@immutable
class VadivamIconData {
  /// Creates icon data from [VadivamPathOp] commands.
  const VadivamIconData(this.name, this.commands);

  /// The kebab-case icon name, such as `arrow-right`.
  final String name;

  /// Flat [VadivamPathOp] opcodes, each followed by its coordinates.
  final List<double> commands;

  static final Expando<Path> _paths = Expando<Path>();

  // Built once per icon and shared by every widget that paints it.
  Path get _cachedPath => _paths[this] ??= _buildPath(commands);

  /// A copy of the icon geometry as a Flutter [Path] in the 24 by 24 view box,
  /// safe to transform or extend.
  Path get path => Path.from(_cachedPath);

  @override
  String toString() => 'VadivamIconData($name)';
}

Path _buildPath(List<double> commands) {
  final path = Path();
  var i = 0;
  while (i < commands.length) {
    final op = commands[i++];
    if (op == VadivamPathOp.move) {
      path.moveTo(commands[i++], commands[i++]);
    } else if (op == VadivamPathOp.line) {
      path.lineTo(commands[i++], commands[i++]);
    } else if (op == VadivamPathOp.cubic) {
      path.cubicTo(commands[i++], commands[i++], commands[i++], commands[i++],
          commands[i++], commands[i++]);
    } else if (op == VadivamPathOp.quad) {
      path.quadraticBezierTo(
          commands[i++], commands[i++], commands[i++], commands[i++]);
    } else if (op == VadivamPathOp.arc) {
      final radius = Radius.elliptical(commands[i++], commands[i++]);
      final rotation = commands[i++];
      final largeArc = commands[i++] == 1;
      final clockwise = commands[i++] == 1;
      path.arcToPoint(Offset(commands[i++], commands[i++]),
          radius: radius,
          rotation: rotation,
          largeArc: largeArc,
          clockwise: clockwise);
    } else if (op == VadivamPathOp.close) {
      path.close();
    } else {
      throw ArgumentError.value(op, 'commands', 'Unknown path opcode');
    }
  }
  return path;
}

/// Default stroke settings for [VadivamIcon] widgets below it. Size and color
/// come from the surrounding [IconTheme].
class VadivamIconTheme extends InheritedWidget {
  /// Applies [strokeWidth] and [absoluteStrokeWidth] to descendant icons.
  const VadivamIconTheme({
    super.key,
    this.strokeWidth,
    this.absoluteStrokeWidth,
    required super.child,
  });

  /// Stroke width in view-box units. Defaults to 2.
  final double? strokeWidth;

  /// Keeps the stroke [strokeWidth] logical pixels wide at every size.
  final bool? absoluteStrokeWidth;

  /// The closest theme, or null when there is none.
  static VadivamIconTheme? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<VadivamIconTheme>();

  @override
  bool updateShouldNotify(VadivamIconTheme oldWidget) =>
      strokeWidth != oldWidget.strokeWidth ||
      absoluteStrokeWidth != oldWidget.absoluteStrokeWidth;
}

/// Draws a Vadivam icon with round caps and joins.
///
/// Size and color default to the surrounding [IconTheme], like [Icon]. Without
/// a [semanticLabel] the icon is excluded from the semantics tree.
class VadivamIcon extends StatelessWidget {
  /// Creates an icon widget for [icon].
  const VadivamIcon(
    this.icon, {
    super.key,
    this.size,
    this.color,
    this.strokeWidth,
    this.absoluteStrokeWidth,
    this.semanticLabel,
  });

  /// The icon to draw.
  final VadivamIconData icon;

  /// Width and height in logical pixels. Defaults to [IconThemeData.size], then 24.
  final double? size;

  /// Stroke color. Defaults to [IconThemeData.color].
  final Color? color;

  /// Stroke width in view-box units. Defaults to 2.
  final double? strokeWidth;

  /// Keeps the stroke [strokeWidth] logical pixels wide at every size.
  final bool? absoluteStrokeWidth;

  /// Accessible description announced by screen readers.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final iconTheme = IconTheme.of(context);
    final vadivamTheme = VadivamIconTheme.maybeOf(context);
    final resolvedSize = size ?? iconTheme.size ?? 24;
    var resolvedColor = color ?? iconTheme.color ?? const Color(0xFF000000);
    final opacity = iconTheme.opacity ?? 1;
    if (opacity != 1) {
      resolvedColor = resolvedColor.withValues(alpha: resolvedColor.a * opacity);
    }
    var stroke = strokeWidth ?? vadivamTheme?.strokeWidth ?? 2;
    if ((absoluteStrokeWidth ?? vadivamTheme?.absoluteStrokeWidth ?? false) &&
        resolvedSize > 0) {
      stroke = stroke * 24 / resolvedSize;
    }
    final painted = SizedBox.square(
      dimension: resolvedSize,
      child: CustomPaint(
        painter: _VadivamPainter(icon, resolvedColor, stroke),
      ),
    );
    if (semanticLabel == null) return ExcludeSemantics(child: painted);
    return Semantics(label: semanticLabel, image: true, child: painted);
  }
}

class _VadivamPainter extends CustomPainter {
  _VadivamPainter(this.icon, this.color, this.strokeWidth);

  final VadivamIconData icon;
  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width, size.height) / 24;
    if (scale <= 0) return;
    canvas.scale(scale);
    canvas.drawPath(
      icon._cachedPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..color = color
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..isAntiAlias = true,
    );
  }

  @override
  bool shouldRepaint(_VadivamPainter oldDelegate) =>
      !identical(oldDelegate.icon, icon) ||
      oldDelegate.color != color ||
      oldDelegate.strokeWidth != strokeWidth;
}
