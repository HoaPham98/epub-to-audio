import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'presentation/screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const EpubToAudioApp());
}

class EpubToAudioApp extends StatelessWidget {
  const EpubToAudioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EPUB to Audio - VieNeu-TTS',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      builder: (context, child) {
        // Exclude semantics on Windows desktop to avoid Chromium AXTree corruption
        // and access violation crashes in flutter_windows.dll during modal/dropdown transitions.
        if (!kIsWeb && defaultTargetPlatform == TargetPlatform.windows) {
          return ExcludeSemantics(child: child ?? const SizedBox.shrink());
        }
        return child ?? const SizedBox.shrink();
      },
      theme: ThemeData(
        brightness: Brightness.light,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1),
          brightness: Brightness.dark,
          surface: const Color(0xFF1E293B),
        ),
        cardColor: const Color(0xFF1E293B),
        dividerColor: const Color(0xFF334155),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}
