import 'package:flutter/foundation.dart';
import '../../domain/domain.dart';

/// Resolves an API target URL, prepending the configured CORS proxy prefix
/// when running on Flutter Web and `useCorsProxy` is enabled.
String resolveTTSUrl(
  String targetUrl,
  TTSSettings settings, {
  bool? isWebOverride,
}) {
  final isWeb = isWebOverride ?? kIsWeb;
  if (isWeb && settings.useCorsProxy && settings.corsProxyUrl.trim().isNotEmpty) {
    final proxy = settings.corsProxyUrl.trim();
    final cleanTarget = targetUrl.trim();
    if (proxy.endsWith('?') || proxy.endsWith('/')) {
      return '$proxy$cleanTarget';
    }
    return '$proxy/$cleanTarget';
  }
  return targetUrl;
}
