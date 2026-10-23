class TextChunk {
  final String id;
  final int index;
  final String text;
  final int charCount;
  final bool isParagraphEnd;

  const TextChunk({
    required this.id,
    required this.index,
    required this.text,
    required this.charCount,
    this.isParagraphEnd = false,
  });

  TextChunk copyWith({
    String? id,
    int? index,
    String? text,
    int? charCount,
    bool? isParagraphEnd,
  }) {
    return TextChunk(
      id: id ?? this.id,
      index: index ?? this.index,
      text: text ?? this.text,
      charCount: charCount ?? this.charCount,
      isParagraphEnd: isParagraphEnd ?? this.isParagraphEnd,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'index': index,
        'text': text,
        'charCount': charCount,
        'isParagraphEnd': isParagraphEnd,
      };

  factory TextChunk.fromJson(Map<String, dynamic> json) => TextChunk(
        id: json['id'] as String,
        index: json['index'] as int,
        text: json['text'] as String,
        charCount: json['charCount'] as int,
        isParagraphEnd: json['isParagraphEnd'] as bool? ?? false,
      );
}

class EpubChapter {
  final String id;
  final int index;
  final String title;
  final String href;
  final String contentHtml;
  final String rawText;
  final List<TextChunk> chunks;

  const EpubChapter({
    required this.id,
    required this.index,
    required this.title,
    required this.href,
    required this.contentHtml,
    required this.rawText,
    required this.chunks,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'index': index,
        'title': title,
        'href': href,
        'contentHtml': contentHtml,
        'rawText': rawText,
        'chunks': chunks.map((c) => c.toJson()).toList(),
      };

  factory EpubChapter.fromJson(Map<String, dynamic> json) => EpubChapter(
        id: json['id'] as String,
        index: json['index'] as int,
        title: json['title'] as String,
        href: json['href'] as String,
        contentHtml: json['contentHtml'] as String,
        rawText: json['rawText'] as String,
        chunks: (json['chunks'] as List<dynamic>)
            .map((c) => TextChunk.fromJson(c as Map<String, dynamic>))
            .toList(),
      );
}

class EpubBook {
  final String id;
  final String title;
  final String author;
  final String? coverUrl;
  final List<EpubChapter> chapters;
  final int totalChunks;
  final String fileName;
  final int fileSize;
  final int uploadedAt;

  const EpubBook({
    required this.id,
    required this.title,
    required this.author,
    this.coverUrl,
    required this.chapters,
    required this.totalChunks,
    required this.fileName,
    required this.fileSize,
    required this.uploadedAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'author': author,
        'coverUrl': coverUrl,
        'chapters': chapters.map((c) => c.toJson()).toList(),
        'totalChunks': totalChunks,
        'fileName': fileName,
        'fileSize': fileSize,
        'uploadedAt': uploadedAt,
      };

  factory EpubBook.fromJson(Map<String, dynamic> json) => EpubBook(
        id: json['id'] as String,
        title: json['title'] as String,
        author: json['author'] as String,
        coverUrl: json['coverUrl'] as String?,
        chapters: (json['chapters'] as List<dynamic>)
            .map((c) => EpubChapter.fromJson(c as Map<String, dynamic>))
            .toList(),
        totalChunks: json['totalChunks'] as int,
        fileName: json['fileName'] as String,
        fileSize: json['fileSize'] as int,
        uploadedAt: json['uploadedAt'] as int,
      );
}
