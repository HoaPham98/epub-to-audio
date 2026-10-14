/* eslint-disable */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function createSampleEpub() {
  const zip = new JSZip();

  // 1. mimetype (must be first and uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. OEBPS/content.opf
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Hoàng Tử Bé (Bản Trải Nghiệm Mẫu)</dc:title>
    <dc:creator>Antoine de Saint-Exupéry</dc:creator>
    <dc:language>vi</dc:language>
    <dc:identifier id="BookID">sample-prince-001</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter3" href="chapter3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
    <itemref idref="chapter3"/>
  </spine>
</package>`
  );

  // 4. OEBPS/toc.ncx
  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="sample-prince-001"/>
  </head>
  <docTitle>
    <text>Hoàng Tử Bé (Bản Trải Nghiệm Mẫu)</text>
  </docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>Chương 1: Bức Tranh Con Trăn Khổng Lồ</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-2" playOrder="2">
      <navLabel><text>Chương 2: Gặp Gỡ Hoàng Tử Bé Giữa Sa Mạc</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-3" playOrder="3">
      <navLabel><text>Chương 3: Hành Tinh Của Những Cây Bao Báp</text></navLabel>
      <content src="chapter3.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`
  );

  // 5. Chapters
  zip.file(
    'OEBPS/chapter1.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chương 1: Bức Tranh Con Trăn Khổng Lồ</title></head>
<body>
  <h1>Chương 1: Bức Tranh Con Trăn Khổng Lồ</h1>
  <p>Khi tôi sáu tuổi, một lần nọ tôi nhìn thấy một bức tranh tuyệt đẹp trong một cuốn sách viết về rừng nguyên sinh có tên là "Những câu chuyện có thật".</p>
  <p>Bức tranh vẽ một con trăn khổng lồ đang nuốt chửng một con thú dữ. Cuốn sách viết: "Những con trăn nuốt trọn con mồi mà không cần nhai. Sau đó, chúng không thể nhúc nhích được nữa và phải ngủ liền trong sáu tháng để tiêu hóa hết thức ăn".</p>
  <p>Thế là tôi suy nghĩ rất nhiều về những cuộc phiêu lưu nơi rừng rậm, và đến lượt mình, tôi đã thành công trong việc dùng bút chì màu vẽ nên bức vẽ đầu tiên của đời mình. Đó là bức vẽ số một của tôi.</p>
</body>
</html>`
  );

  zip.file(
    'OEBPS/chapter2.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chương 2: Gặp Gỡ Hoàng Tử Bé Giữa Sa Mạc</title></head>
<body>
  <h1>Chương 2: Gặp Gỡ Hoàng Tử Bé Giữa Sa Mạc</h1>
  <p>Tôi đã sống cô độc như thế, không có ai để thực sự trò chuyện, cho đến một lần máy bay của tôi bị hỏng ở giữa sa mạc Sahara, cách đây sáu năm.</p>
  <p>Có một bộ phận nào đó trong động cơ bị vỡ. Và vì không có thợ máy cũng như không có hành khách đi cùng, tôi phải tự mình gánh vác một việc sửa chữa khó khăn đến mức một mất một còn. Tôi chỉ còn đủ nước uống cho khoảng tám ngày.</p>
  <p>Đêm đầu tiên, tôi ngủ thiếp đi trên cát, cách xa mọi nơi có người ở hàng ngàn dặm. Thế rồi, vào lúc rạng đông, tôi bị đánh thức bởi một giọng nói kỳ lạ, khe khẽ: "Làm ơn... vẽ giúp em một con cừu!".</p>
</body>
</html>`
  );

  zip.file(
    'OEBPS/chapter3.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chương 3: Hành Tinh Của Những Cây Bao Báp</title></head>
<body>
  <h1>Chương 3: Hành Tinh Của Những Cây Bao Báp</h1>
  <p>Mỗi ngày tôi lại biết thêm một điều gì đó về hành tinh của cậu, về chuyến ra đi, và cuộc hành trình của cậu. Những thông tin ấy đến một cách rất từ tốn, tình cờ qua những câu chuyện.</p>
  <p>Và đến ngày thứ ba, tôi được biết về thảm kịch của loài cây bao báp. Lần này cũng lại nhờ con cừu, bởi vì hoàng tử bé bất chợt hỏi tôi với vẻ lo lắng nghiêm túc: "Cừu có ăn những bụi cây nhỏ không anh?".</p>
  <p>Tôi đáp: "Có, đúng thế đấy!". Cậu bé reo lên: "A! Em mừng quá!". Tôi không hiểu vì sao chuyện con cừu ăn những bụi cây nhỏ lại quan trọng đến thế.</p>
</body>
</html>`
  );

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  const outPath = path.join(__dirname, 'public', 'sample-book.epub');
  fs.writeFileSync(outPath, content);
  console.log('Sample EPUB generated successfully at:', outPath);
}

createSampleEpub().catch(console.error);
