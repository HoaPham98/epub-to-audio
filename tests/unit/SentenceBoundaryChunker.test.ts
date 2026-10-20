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

  it('splits paragraphs by newline boundaries when each is sufficiently long', () => {
    const p1 =
      'Đoạn văn thứ nhất có nội dung vừa phải và đầy đủ ý tứ miêu tả chi tiết khung cảnh buổi sớm tinh mơ ở vùng ngoại ô yên bình, nơi những giọt sương mai còn long lanh trên cành lá non.';
    const p2 =
      'Đoạn văn thứ hai tiếp nối mạch truyện với không khí nhộn nhịp dần lên của phiên chợ sớm bên bờ sông, từng tốp thuyền buôn tấp nập cập bến mang theo đầy ắp tôm cá tươi ngon.';
    const chunks = chunker.chunkText(0, `${p1}\n\n${p2}`);

    expect(chunks.length).toBe(2);
    expect(chunks[0].text).toBe(p1);
    expect(chunks[0].isParagraphEnd).toBe(true);
    expect(chunks[1].text).toBe(p2);
    expect(chunks[1].isParagraphEnd).toBe(true);
  });

  it('filters out non-speech punctuation lines and scene breaks', () => {
    const text = 'Hắn nhìn về phía chân trời xa xăm.\n\n...\n\n. . .\n\n* * *\n\n---\n\nBóng chiều đã buông xuống thung lũng.';
    const chunks = chunker.chunkText(0, text);

    expect(chunks.length).toBe(1);
    expect(chunks[0].text).not.toContain('* * *');
    expect(chunks[0].text).not.toContain('---');
    expect(chunks[0].text).toBe('Hắn nhìn về phía chân trời xa xăm.\nBóng chiều đã buông xuống thung lũng.');
  });

  it('accumulates short dialogue lines across paragraphs into optimal chunks', () => {
    const dialogue = '- Cậu đến rồi à?\n\n- Ừ, vừa mới tới thôi.\n\n- Mau vào nhà đi, ngoài trời đang lạnh lắm.';
    const chunks = chunker.chunkText(0, dialogue);

    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe('- Cậu đến rồi à?\n- Ừ, vừa mới tới thôi.\n- Mau vào nhà đi, ngoài trời đang lạnh lắm.');
    expect(chunks[0].isParagraphEnd).toBe(true);
  });

  it('does not accumulate across paragraphs when mergeShortSentences is false', () => {
    const dialogue = '- Cậu đến rồi à?\n\n- Ừ, vừa mới tới thôi.';
    const chunks = chunker.chunkText(0, dialogue, { mergeShortSentences: false });

    expect(chunks.length).toBe(2);
    expect(chunks[0].text).toBe('- Cậu đến rồi à?');
    expect(chunks[0].isParagraphEnd).toBe(true);
    expect(chunks[1].text).toBe('- Ừ, vừa mới tới thôi.');
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
