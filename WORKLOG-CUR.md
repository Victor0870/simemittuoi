# WORKLOG-CUR — Nhật ký của Cursor (CDILV)

> Chỉ Cursor (và Grok Bot thay mặt Cursor) được ghi vào file này.
> Antigravity CHỈ ĐỌC file này, ghi vào WORKLOG-AGY.md.

## Quy tắc làm việc song song

**Phân vai**
- **Cursor**: dựng khung (giao diện, trang, bảng dữ liệu, API, migration) cho từng phần.
- **Grok Bot**: kiểm tra giao diện, duyệt commit, yêu cầu Cursor sửa lỗi.
- **Antigravity**: cập nhật nội dung vào khung Cursor đã dựng xong.

**Khoá theo phần**
- Mỗi phần chỉ có một bên làm tại một thời điểm.
- Antigravity chỉ vào một phần khi phần đó có trạng thái `BÀN GIAO CHO AGY` ở bảng dưới, tức là Cursor đã chuyển sang phần khác.
- Phần nào có trạng thái `CURSOR ĐANG LÀM` thì Antigravity không sửa file, trang hay dữ liệu thuộc phần đó.

**Trước khi bắt đầu mỗi việc**
1. `git pull origin main`.
2. Đọc file nhật ký của bên kia: Cursor đọc WORKLOG-AGY.md, Antigravity đọc WORKLOG-CUR.md.
3. Ghi một dòng "BẮT ĐẦU" vào file của mình.

**Khi xong việc**
- Ghi một dòng "XONG" kèm mã commit.
- Mỗi bước làm đúng 1 commit, chạy build rồi mới push.

**Database**
- Chỉ một bên chạy migration tại một thời điểm.
- Ghi tên file migration vào nhật ký trước khi chạy.
- Không xoá hay sửa dữ liệu thật nếu chưa có lệnh của anh Thắng.

**Bảo mật**
- Không đọc, không in ra, không commit các file `.env*`.
- Không sửa `.github`.

**Mẫu một dòng nhật ký**
`2026-10-24 18:15 (UTC+7) | BẮT ĐẦU/XONG | phần | việc | commit | migration`

## Trạng thái các phần

| Phần | Trạng thái | Ghi chú |
|---|---|---|
| Hoạt động thi đua: Trắc nghiệm (chương trình, giao diện) | BÀN GIAO CHO AGY | khung xong (52e7249, be06338, 714362c) |
| Bài viết / Hướng dẫn sử dụng | BÀN GIAO CHO AGY | khung xong; AGY có thể viết thêm bài hướng dẫn |
| Hoạt động công đoàn (hẹn giờ) | BÀN GIAO CHO AGY | khung xong (6014a49) |
| Tài chính công đoàn | CHƯA BẮT ĐẦU | Cursor sẽ dựng khung trước |
| Tài chính: Quy chế chi tiêu | BÀN GIAO CHO AGY | khung xong, AGY điền nội dung; chỉ admin xem (/admin/finance/regulations, bc57233) |
| Mẫu văn bản (.docx) | CHƯA BẮT ĐẦU | Cursor sẽ dựng khung trước |
| Văn bản: Mẫu văn bản | BÀN GIAO CHO AGY | khung xong (237e1da); AGY điền nội dung mẫu tại /admin/documents/templates (bảng cdilv_document_templates) |

## Nhật ký
2026-10-24 17:38 (UTC+7) | XONG | Hoạt động công đoàn | hẹn giờ active | 6014a49 | migration hẹn giờ hoạt động
2026-10-24 17:50 (UTC+7) | XONG | Trắc nghiệm | chương trình trắc nghiệm (phần 1) | 52e7249 | migration_quiz_programs.sql
2026-10-24 18:11 (UTC+7) | XONG | Trắc nghiệm | trang riêng cho từng chương trình (phần 2) | be06338 | không
2026-10-24 18:11 (UTC+7) | BẮT ĐẦU | Trắc nghiệm | làm gọn giao diện trắc nghiệm | | không
2026-10-24 18:45 (UTC+7) | BẮT ĐẦU | Tài chính: Quy chế chi tiêu | dựng khung trang quản trị + trang đoàn viên | | migration_spending_regulation.sql (thêm 1 dòng trống vào cdilv_app_settings)
2026-10-24 18:55 (UTC+7) | XONG | Tài chính: Quy chế chi tiêu | khung quản trị /admin/finance/regulations + trang đoàn viên /quy-che-chi-tieu; nội dung lưu ở cdilv_app_settings, key spending_regulation | c9ca6bc | migration_spending_regulation.sql (đã chạy)
2026-10-24 19:40 (UTC+7) | BẮT ĐẦU | Văn bản: Mẫu văn bản | dựng hub Văn bản công đoàn + trang Mẫu văn bản | | migration_document_templates.sql (bảng mẫu văn bản + 4 mẫu trống)
2026-10-24 19:48 (UTC+7) | XONG | Văn bản: Mẫu văn bản | hub /admin/documents + trang /admin/documents/templates (quyền posts.manage) | 237e1da | migration_document_templates.sql (đã chạy)
2026-10-24 19:52 (UTC+7) | BẮT ĐẦU | Tài chính: Quy chế chi tiêu | ẩn trang đoàn viên (chỉ admin / finance.manage xem tại /admin/finance/regulations) | | không
2026-10-24 19:56 (UTC+7) | XONG | Tài chính: Quy chế chi tiêu | ẩn trang đoàn viên: /quy-che-chi-tieu trả 404, bỏ khỏi menu; chỉ admin / finance.manage xem; nội dung giữ nguyên | bc57233 | không
