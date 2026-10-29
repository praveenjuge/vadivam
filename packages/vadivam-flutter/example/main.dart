import 'package:flutter/material.dart';
import 'package:vadivam/vadivam.dart';

void main() => runApp(const ExampleApp());

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(
          title: const Text('Vadivam'),
          actions: [
            IconButton(
              tooltip: 'Search',
              onPressed: () {},
              icon: const VadivamIcon(VadivamIcons.search),
            ),
          ],
        ),
        body: const Center(
          child: VadivamIconTheme(
            strokeWidth: 1.5,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 16,
              children: [
                VadivamIcon(VadivamIcons.activity, size: 32),
                VadivamIcon(VadivamIcons.heart, size: 32, color: Colors.pink),
                VadivamIcon(
                  VadivamIcons.bell,
                  size: 32,
                  semanticLabel: 'Notifications',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
