import 'dart:typed_data';
import '../entities/book.dart';

abstract interface class IEpubParser {
  Future<EpubBook> parse(
    Uint8List bytes, {
    String? fileName,
  });
}
