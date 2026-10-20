import { describe, expect, it } from 'vitest';
import { SentenceBoundaryChunker } from '@/infrastructure/chunker/SentenceBoundaryChunker';

describe('SentenceBoundaryChunker', () => {
  const chunker = new SentenceBoundaryChunker();

  it('returns empty array for empty or whitespace-only text', () => {
    expect(chunker.chunkText(0, '')).toEqual([]);
    expect(chunker.chunkText(0, '   \n\n   ')).toEqual([]);
  });

  it('keeps normal sentences intact within optimal length', () => {
    const text = 'Hôm nay trời rất đẹp. Gió mát nhẹ và mây trắng lơ lửng trên bầu trời xanh biếc.';
    const chunks = chunker.chunkText(0, text);

    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].isParagraphEnd).toBe(true);
    expect(chunks[0].charCount).toBe(text.length);
  });

  it('splits paragraphs by newline boundaries and marks isParagraphEnd correctly', () => {
    const text = 'Đoạn văn thứ nhất có nội dung vừa phải.\n\nĐoạn văn thứ hai cũng có một câu ngắn.';
    const chunks = chunker.chunkText(0, text);

    expect(chunks.length).toBe(2);
    expect(chunks[0].text).toBe('Đoạn văn thứ nhất có nội dung vừa phải.');
    expect(chunks[0].isParagraphEnd).toBe(true);
    expect(chunks[1].text).toBe('Đoạn văn thứ hai cũng có một câu ngắn.');
    expect(chunks[1].isParagraphEnd).toBe(true);
  });

  it('merges ultra-short sentences (< 20 chars) into adjacent sentence', () => {
    const text = 'Thật sao? Đúng vậy, chuyến xe khởi hành lúc năm giờ sáng mai.';
    // "Thật sao?" is 9 chars (< 20)
    const chunks = chunker.chunkText(0, text);

    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain('Thật sao? Đúng vậy');
    expect(chunks[0].charCount).toBeGreaterThanOrEqual(20);
  });

  it('merges trailing short exclamation into previous chunk in same paragraph', () => {
    const text =
      'Chúng tôi đã chuẩn bị đầy đủ hành trang cho chuyến đi dài ngày qua những cánh rừng rậm rạp và những con suối róc rách suốt ngày đêm. Vâng.';
    // "Vâng." is 5 chars (< 20)
    const chunks = chunker.chunkText(0, text);

    expect(chunks.length).toBe(1);
    expect(chunks[0].text.endsWith('Vâng.')).toBe(true);
    expect(chunks[0].charCount).toBeGreaterThan(20);
  });

  it('splits long sentences (> 250 chars) along clause delimiters (, ; : —) before word boundaries', () => {
    const longSentence =
      'Mặt trời từ từ nhô lên từ phía chân trời xa xôi phía đông, toả những tia nắng ấm áp đầu tiên xuống thung lũng còn đẫm sương mai mát lạnh, khiến cho ngàn hoa khoe sắc rực rỡ dưới ánh bình minh tươi sáng, chim chóc trong lùm cây cũng bắt đầu cất lên những tiếng hót ríu rít chào đón một ngày mới tràn đầy niềm tin và hy vọng.';
    expect(longSentence.length).toBeGreaterThan(250);

    const chunks = chunker.chunkText(0, longSentence, { maxChars: 250, safeMaxChars: 350 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.charCount).toBeLessThanOrEqual(250);
      // Ensure words are not sliced mid-character
      expect(chunk.text).not.toMatch(/[a-zA-Zà-ỹÀ-Ỹ]-[a-zA-Zà-ỹÀ-Ỹ]/);
    }
  });

  it('respects safeMaxChars ceiling and handles single ultra-short text in chapter gracefully', () => {
    const shortText = 'Chương 1.';
    const chunks = chunker.chunkText(1, shortText);

    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe('Chương 1.');
    expect(chunks[0].isParagraphEnd).toBe(true);
  });
});
