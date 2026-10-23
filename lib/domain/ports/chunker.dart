import '../entities/book.dart';

class ChunkerOptions {
  final int minChars;
  final int targetChars;
  final int maxChars;
  final int safeMaxChars;
  final bool mergeShortSentences;

  const ChunkerOptions({
    this.minChars = 20,
    this.targetChars = 200,
    this.maxChars = 250,
    this.safeMaxChars = 350,
    this.mergeShortSentences = true,
  });
}

abstract interface class ITextChunkerService {
  List<TextChunk> chunkText(
    int chapterIndex,
    String text, [
    ChunkerOptions? options,
  ]);
}
