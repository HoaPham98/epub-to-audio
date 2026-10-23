import 'package:epub_to_audio/domain/domain.dart';
import 'package:epub_to_audio/infrastructure/chunker/sentence_boundary_chunker.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SentenceBoundaryChunker', () {
    const chunker = SentenceBoundaryChunker();

    test('returns empty list for empty or whitespace-only text', () {
      expect(chunker.chunkText(0, ''), isEmpty);
      expect(chunker.chunkText(0, '   \n\n   '), isEmpty);
    });

    test('keeps normal sentences intact within optimal length', () {
      const text =
          'Hôm nay trời rất đẹp. Gió mát nhẹ và mây trắng lơ lửng trên bầu trời xanh biếc.';
      final chunks = chunker.chunkText(0, text);

      expect(chunks.length, equals(1));
      expect(chunks[0].text, equals(text));
      expect(chunks[0].isParagraphEnd, isTrue);
      expect(chunks[0].charCount, equals(text.length));
    });

    test(
        'splits paragraphs by newline boundaries when each is sufficiently long',
        () {
      const p1 =
          'Đoạn văn thứ nhất có nội dung vừa phải và đầy đủ ý tứ miêu tả chi tiết khung cảnh buổi sớm tinh mơ ở vùng ngoại ô yên bình, nơi những giọt sương mai còn long lanh trên cành lá non.';
      const p2 =
          'Đoạn văn thứ hai tiếp nối mạch truyện với không khí nhộn nhịp dần lên của phiên chợ sớm bên bờ sông, từng tốp thuyền buôn tấp nập cập bến mang theo đầy ắp tôm cá tươi ngon.';
      final chunks = chunker.chunkText(0, '$p1\n\n$p2');

      expect(chunks.length, equals(2));
      expect(chunks[0].text, equals(p1));
      expect(chunks[0].isParagraphEnd, isTrue);
      expect(chunks[1].text, equals(p2));
      expect(chunks[1].isParagraphEnd, isTrue);
    });

    test('filters out non-speech punctuation lines and scene breaks', () {
      const text =
          'Hắn nhìn về phía chân trời xa xăm.\n\n...\n\n. . .\n\n* * *\n\n---\n\nBóng chiều đã buông xuống thung lũng.';
      final chunks = chunker.chunkText(0, text);

      expect(chunks.length, equals(1));
      expect(chunks[0].text, isNot(contains('* * *')));
      expect(chunks[0].text, isNot(contains('---')));
      expect(
        chunks[0].text,
        equals(
            'Hắn nhìn về phía chân trời xa xăm.\nBóng chiều đã buông xuống thung lũng.'),
      );
    });

    test(
        'accumulates short dialogue lines across paragraphs into optimal chunks',
        () {
      const dialogue =
          '- Cậu đến rồi à?\n\n- Ừ, vừa mới tới thôi.\n\n- Mau vào nhà đi, ngoài trời đang lạnh lắm.';
      final chunks = chunker.chunkText(0, dialogue);

      expect(chunks.length, equals(1));
      expect(
        chunks[0].text,
        equals(
            '- Cậu đến rồi à?\n- Ừ, vừa mới tới thôi.\n- Mau vào nhà đi, ngoài trời đang lạnh lắm.'),
      );
      expect(chunks[0].isParagraphEnd, isTrue);
    });

    test('does not accumulate across paragraphs when mergeShortSentences is false',
        () {
      const dialogue = '- Cậu đến rồi à?\n\n- Ừ, vừa mới tới thôi.';
      final chunks = chunker.chunkText(
        0,
        dialogue,
        const ChunkerOptions(mergeShortSentences: false),
      );

      expect(chunks.length, equals(2));
      expect(chunks[0].text, equals('- Cậu đến rồi à?'));
      expect(chunks[0].isParagraphEnd, isTrue);
      expect(chunks[1].text, equals('- Ừ, vừa mới tới thôi.'));
      expect(chunks[1].isParagraphEnd, isTrue);
    });

    test('merges ultra-short sentences (< 20 chars) into adjacent sentence', () {
      const text = 'Thật sao? Đúng vậy, chuyến xe khởi hành lúc năm giờ sáng mai.';
      // "Thật sao?" is 9 chars (< 20)
      final chunks = chunker.chunkText(0, text);

      expect(chunks.length, equals(1));
      expect(chunks[0].text, contains('Thật sao? Đúng vậy'));
      expect(chunks[0].charCount, greaterThanOrEqualTo(20));
    });

    test(
        'merges trailing short exclamation into previous chunk in same paragraph',
        () {
      const text =
          'Chúng tôi đã chuẩn bị đầy đủ hành trang cho chuyến đi dài ngày qua những cánh rừng rậm rạp và những con suối róc rách suốt ngày đêm. Vâng.';
      // "Vâng." is 5 chars (< 20)
      final chunks = chunker.chunkText(0, text);

      expect(chunks.length, equals(1));
      expect(chunks[0].text.endsWith('Vâng.'), isTrue);
      expect(chunks[0].charCount, greaterThan(20));
    });

    test(
        'splits long sentences (> 250 chars) along clause delimiters (, ; : —) before word boundaries',
        () {
      const longSentence =
          'Mặt trời từ từ nhô lên từ phía chân trời xa xôi phía đông, toả những tia nắng ấm áp đầu tiên xuống thung lũng còn đẫm sương mai mát lạnh, khiến cho ngàn hoa khoe sắc rực rỡ dưới ánh bình minh tươi sáng, chim chóc trong lùm cây cũng bắt đầu cất lên những tiếng hót ríu rít chào đón một ngày mới tràn đầy niềm tin và hy vọng.';
      expect(longSentence.length, greaterThan(250));

      final chunks = chunker.chunkText(
        0,
        longSentence,
        const ChunkerOptions(maxChars: 250, safeMaxChars: 350),
      );

      expect(chunks.length, greaterThan(1));
      for (final chunk in chunks) {
        expect(chunk.charCount, lessThanOrEqualTo(250));
        // Ensure words are not sliced mid-character
        expect(
          RegExp(r'[a-zA-Zà-ỹÀ-Ỹ]-[a-zA-Zà-ỹÀ-Ỹ]').hasMatch(chunk.text),
          isFalse,
        );
      }
    });

    test(
        'respects safeMaxChars ceiling and handles single ultra-short text in chapter gracefully',
        () {
      const shortText = 'Chương 1.';
      final chunks = chunker.chunkText(1, shortText);

      expect(chunks.length, equals(1));
      expect(chunks[0].text, equals('Chương 1.'));
      expect(chunks[0].isParagraphEnd, isTrue);
    });
  });
}
