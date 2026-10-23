import 'dart:io';
import 'dart:typed_data';
import 'package:epub_to_audio/infrastructure/parser/epub_parser_adapter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EpubParserAdapter', () {
    const parser = EpubParserAdapter();

    test('successfully parses assets/sample-book.epub', () async {
      final file = File('assets/sample-book.epub');
      expect(file.existsSync(), isTrue,
          reason: 'assets/sample-book.epub must be present in the project');

      final bytes = await file.readAsBytes();
      final book = await parser.parse(bytes, fileName: 'sample-book.epub');

      expect(book.title.isNotEmpty, isTrue);
      expect(book.author.isNotEmpty, isTrue);
      expect(book.chapters.isNotEmpty, isTrue);
      expect(book.totalChunks, greaterThan(0));

      final firstChapter = book.chapters.first;
      expect(firstChapter.title.isNotEmpty, isTrue);
      expect(firstChapter.rawText.isNotEmpty, isTrue);
      expect(firstChapter.chunks.isNotEmpty, isTrue);

      for (final chunk in firstChapter.chunks) {
        expect(chunk.text.isNotEmpty, isTrue);
        expect(chunk.charCount, equals(chunk.text.length));
      }
    });

    test('throws FormatException on invalid or corrupted EPUB bytes', () async {
      final invalidBytes = Uint8List.fromList([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(
        () => parser.parse(invalidBytes),
        throwsA(isA<Exception>()),
      );
    });
  });
}
