import '../../domain/entities/book.dart';
import '../../domain/ports/chunker.dart';

const int defaultMinChars = 20;
const int defaultOptimalMinChars = 150;
const int defaultOptimalMaxChars = 250;
const int defaultSafeMaxChars = 350;

final _hasAlphanumeric = RegExp(r'[\p{L}\p{N}]', unicode: true);
final _sentenceRegex = RegExp(r'[^.!?…\n]+(?:[.!?…]+["' "'" r'”’]?|$)', unicode: true);
final _clauseRegex = RegExp(r'[^,;:—\n]+(?:[,;:—]+["' "'" r'”’]?|$)', unicode: true);

class _UnitWithMeta {
  final String text;
  final bool isParagraphEnd;

  const _UnitWithMeta({
    required this.text,
    required this.isParagraphEnd,
  });
}

class SentenceBoundaryChunker implements ITextChunkerService {
  const SentenceBoundaryChunker();

  @override
  List<TextChunk> chunkText(
    int chapterIndex,
    String text, [
    ChunkerOptions? options,
  ]) {
    final minChars = options?.minChars ?? defaultMinChars;
    final maxChars = options?.maxChars ?? defaultOptimalMaxChars;
    final safeMaxChars = options?.safeMaxChars ?? defaultSafeMaxChars;
    final mergeShort = options?.mergeShortSentences ?? true;

    final cleanText = text
        .replaceAll('\r\n', '\n')
        .replaceAll(RegExp(r'[ \t]+'), ' ')
        .trim();

    if (cleanText.isEmpty || !_hasAlphanumeric.hasMatch(cleanText)) {
      return const [];
    }

    // 1. Split text into paragraphs by newline boundaries (\n+) and filter out non-speech paragraphs
    final rawParagraphs = cleanText
        .split(RegExp(r'\n+'))
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty && _hasAlphanumeric.hasMatch(p))
        .toList();

    if (rawParagraphs.isEmpty) {
      return const [];
    }

    final List<_UnitWithMeta> allUnits = [];

    for (final paragraph in rawParagraphs) {
      // 2. Break paragraph into sentences using terminators (. ? ! … and optional quotes)
      final rawSentences = _sentenceRegex
          .allMatches(paragraph)
          .map((m) => m.group(0)!)
          .where((s) => s.trim().isNotEmpty)
          .toList();

      final effectiveSentences =
          rawSentences.isEmpty ? [paragraph] : rawSentences;
      final List<String> atomicUnits = [];

      for (final rawSentence in effectiveSentences) {
        final sentence = rawSentence.trim();
        if (sentence.isEmpty || !_hasAlphanumeric.hasMatch(sentence)) continue;

        if (sentence.length <= maxChars) {
          atomicUnits.add(sentence);
        } else {
          // Overly long sentence (> maxChars): split by clause delimiters (,, ;, :, —)
          final rawClauses = _clauseRegex
              .allMatches(sentence)
              .map((m) => m.group(0)!)
              .where((c) => c.trim().isNotEmpty)
              .toList();

          final effectiveClauses =
              rawClauses.isEmpty ? [sentence] : rawClauses;

          for (final rawClause in effectiveClauses) {
            final clause = rawClause.trim();
            if (clause.isEmpty || !_hasAlphanumeric.hasMatch(clause)) continue;

            if (clause.length <= maxChars) {
              atomicUnits.add(clause);
            } else {
              // Overly long clause: split by words up to maxChars
              final words = clause.split(' ');
              String wordAcc = '';
              for (final word in words) {
                final candidate = wordAcc.isEmpty ? word : '$wordAcc $word';
                if (candidate.length > maxChars) {
                  if (wordAcc.trim().isNotEmpty &&
                      _hasAlphanumeric.hasMatch(wordAcc)) {
                    atomicUnits.add(wordAcc.trim());
                  }
                  wordAcc = word;
                } else {
                  wordAcc = candidate;
                }
              }
              if (wordAcc.trim().isNotEmpty &&
                  _hasAlphanumeric.hasMatch(wordAcc)) {
                atomicUnits.add(wordAcc.trim());
              }
            }
          }
        }
      }

      if (atomicUnits.isEmpty) continue;

      // 3. Merge ultra-short sentences (< minChars, e.g. 20 chars like "Vâng.", "Thật sao?") within paragraph
      List<String> processedUnits = [];
      if (mergeShort && atomicUnits.length > 1) {
        for (int i = 0; i < atomicUnits.length; i++) {
          final current = atomicUnits[i];
          if (current.length < minChars) {
            // Merge backward into previous unit if it fits within safeMaxChars
            if (processedUnits.isNotEmpty) {
              final prev = processedUnits.last;
              if ((prev.length + 1 + current.length) <= safeMaxChars) {
                processedUnits[processedUnits.length - 1] = '$prev $current';
                continue;
              }
            }
            // Otherwise merge forward into next unit if next unit exists
            if (i + 1 < atomicUnits.length) {
              atomicUnits[i + 1] = '$current ${atomicUnits[i + 1]}';
              continue;
            }
          }
          processedUnits.add(current);
        }
      } else {
        processedUnits = atomicUnits;
      }

      for (int i = 0; i < processedUnits.length; i++) {
        allUnits.add(_UnitWithMeta(
          text: processedUnits[i],
          isParagraphEnd: i == processedUnits.length - 1,
        ));
      }
    }

    if (allUnits.isEmpty) {
      return const [];
    }

    // 4. Assemble units into optimal chunks (150-250 chars) with cross-paragraph accumulation
    final List<TextChunk> chunks = [];
    int chunkIdx = 0;
    String currentChunkText = '';
    bool currentChunkEndsParagraph = false;

    for (final unit in allUnits) {
      if (currentChunkText.isEmpty) {
        currentChunkText = unit.text;
        currentChunkEndsParagraph = unit.isParagraphEnd;
        continue;
      }

      // If current chunk ended at a paragraph boundary and already reached optimal min length (>= 150 chars),
      // respect paragraph boundary and close chunk.
      if (currentChunkEndsParagraph &&
          currentChunkText.length >= defaultOptimalMinChars) {
        chunks.add(TextChunk(
          id: 'ch-$chapterIndex-ck-$chunkIdx',
          index: chunkIdx,
          text: currentChunkText.trim(),
          charCount: currentChunkText.trim().length,
          isParagraphEnd: true,
        ));
        chunkIdx++;
        currentChunkText = unit.text;
        currentChunkEndsParagraph = unit.isParagraphEnd;
        continue;
      }

      // If mergeShort is false and we hit a paragraph end, do not accumulate across paragraphs
      if (!mergeShort && currentChunkEndsParagraph) {
        chunks.add(TextChunk(
          id: 'ch-$chapterIndex-ck-$chunkIdx',
          index: chunkIdx,
          text: currentChunkText.trim(),
          charCount: currentChunkText.trim().length,
          isParagraphEnd: true,
        ));
        chunkIdx++;
        currentChunkText = unit.text;
        currentChunkEndsParagraph = unit.isParagraphEnd;
        continue;
      }

      final separator = currentChunkEndsParagraph ? '\n' : ' ';
      final candidate = '$currentChunkText$separator${unit.text}';

      final fitsInMax = candidate.length <= maxChars;
      final fitsInSafe = mergeShort &&
          currentChunkText.length < minChars &&
          candidate.length <= safeMaxChars;

      if (fitsInMax || fitsInSafe) {
        currentChunkText = candidate;
        currentChunkEndsParagraph = unit.isParagraphEnd;
      } else {
        chunks.add(TextChunk(
          id: 'ch-$chapterIndex-ck-$chunkIdx',
          index: chunkIdx,
          text: currentChunkText.trim(),
          charCount: currentChunkText.trim().length,
          isParagraphEnd: currentChunkEndsParagraph,
        ));
        chunkIdx++;
        currentChunkText = unit.text;
        currentChunkEndsParagraph = unit.isParagraphEnd;
      }
    }

    if (currentChunkText.trim().isNotEmpty) {
      // If trailing chunk is ultra-short, attempt to merge into previous chunk if within safeMaxChars
      if (mergeShort &&
          chunks.isNotEmpty &&
          currentChunkText.trim().length < minChars) {
        final prevChunk = chunks.last;
        final separator = prevChunk.isParagraphEnd ? '\n' : ' ';
        final combined =
            '${prevChunk.text}$separator${currentChunkText.trim()}';
        if (combined.length <= safeMaxChars) {
          chunks[chunks.length - 1] = prevChunk.copyWith(
            text: combined,
            charCount: combined.length,
            isParagraphEnd: currentChunkEndsParagraph,
          );
        } else {
          chunks.add(TextChunk(
            id: 'ch-$chapterIndex-ck-$chunkIdx',
            index: chunkIdx,
            text: currentChunkText.trim(),
            charCount: currentChunkText.trim().length,
            isParagraphEnd: currentChunkEndsParagraph,
          ));
        }
      } else {
        chunks.add(TextChunk(
          id: 'ch-$chapterIndex-ck-$chunkIdx',
          index: chunkIdx,
          text: currentChunkText.trim(),
          charCount: currentChunkText.trim().length,
          isParagraphEnd: currentChunkEndsParagraph,
        ));
      }
    }

    return chunks;
  }
}
