import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class DesktopShortcutsWrapper extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTogglePlayPause;
  final VoidCallback? onSeekBackward;
  final VoidCallback? onSeekForward;
  final VoidCallback? onVolumeUp;
  final VoidCallback? onVolumeDown;
  final VoidCallback? onToggleMute;
  final VoidCallback? onSpeedDown;
  final VoidCallback? onSpeedUp;
  final bool isEnabled;

  const DesktopShortcutsWrapper({
    super.key,
    required this.child,
    this.onTogglePlayPause,
    this.onSeekBackward,
    this.onSeekForward,
    this.onVolumeUp,
    this.onVolumeDown,
    this.onToggleMute,
    this.onSpeedDown,
    this.onSpeedUp,
    this.isEnabled = true,
  });

  @override
  State<DesktopShortcutsWrapper> createState() => _DesktopShortcutsWrapperState();
}

class _DesktopShortcutsWrapperState extends State<DesktopShortcutsWrapper> {
  final FocusNode _focusNode = FocusNode(debugLabel: 'DesktopShortcuts');

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  bool _isInputActive() {
    final primaryFocus = FocusManager.instance.primaryFocus;
    if (primaryFocus == null || primaryFocus.context == null) {
      return false;
    }

    final ctx = primaryFocus.context!;
    if (ctx.widget is EditableText) {
      return true;
    }

    bool insideEditable = false;
    ctx.visitAncestorElements((el) {
      if (el.widget is EditableText) {
        insideEditable = true;
        return false;
      }
      return true;
    });

    return insideEditable;
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (!widget.isEnabled) return KeyEventResult.ignored;
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    // Suppress shortcuts when user is actively typing in a text field
    if (_isInputActive()) {
      return KeyEventResult.ignored;
    }

    final key = event.logicalKey;

    if (key == LogicalKeyboardKey.space) {
      widget.onTogglePlayPause?.call();
      return KeyEventResult.handled;
    }

    if (key == LogicalKeyboardKey.arrowLeft) {
      widget.onSeekBackward?.call();
      return KeyEventResult.handled;
    }

    if (key == LogicalKeyboardKey.arrowRight) {
      widget.onSeekForward?.call();
      return KeyEventResult.handled;
    }

    if (key == LogicalKeyboardKey.arrowUp) {
      widget.onVolumeUp?.call();
      return KeyEventResult.handled;
    }

    if (key == LogicalKeyboardKey.arrowDown) {
      widget.onVolumeDown?.call();
      return KeyEventResult.handled;
    }

    if (key == LogicalKeyboardKey.keyM) {
      widget.onToggleMute?.call();
      return KeyEventResult.handled;
    }

    if (key == LogicalKeyboardKey.bracketLeft) {
      widget.onSpeedDown?.call();
      return KeyEventResult.handled;
    }

    if (key == LogicalKeyboardKey.bracketRight) {
      widget.onSpeedUp?.call();
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: _handleKeyEvent,
      child: widget.child,
    );
  }
}
