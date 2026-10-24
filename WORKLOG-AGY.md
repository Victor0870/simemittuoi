# WORKLOG-AGY — Nhật ký của Antigravity (CDILV)

> Chỉ Antigravity được ghi vào file này.
> Cursor và Grok Bot CHỈ ĐỌC file này.

## Hướng dẫn cho Antigravity

1. **Vai trò:** cập nhật NỘI DUNG vào các khung Cursor đã dựng, ví dụ bài viết, bài hướng dẫn, câu hỏi trắc nghiệm, mẫu văn bản, dữ liệu mẫu được duyệt.
   - Không tự thay đổi cấu trúc trang, component dùng chung hay database schema.
   - Nếu cần sửa khung, ghi yêu cầu vào mục "Đề nghị gửi Cursor" bên dưới. Grok Bot sẽ chuyển cho Cursor.
2. **Trước mỗi việc:**
   - `git pull origin main`.
   - Đọc WORKLOG-CUR.md và xem bảng "Trạng thái các phần".
   - Chỉ làm ở phần có trạng thái `BÀN GIAO CHO AGY`.
3. **Ghi nhật ký:**
   - Ghi dòng "BẮT ĐẦU" khi bắt đầu, dòng "XONG" kèm mã commit khi xong.
   - Ghi theo mẫu: `2026-10-24 18:15 (UTC+7) | BẮT ĐẦU/XONG | phần | việc | commit | migration`
4. **Git:**
   - Mỗi bước làm đúng 1 commit, chạy build rồi mới push.
   - Không đụng file đang thuộc phần `CURSOR ĐANG LÀM`.
5. **Database:**
   - Chỉ thêm hoặc sửa nội dung trong phạm vi được giao.
   - Không xoá dữ liệu thật.
   - Không chạy migration nếu chưa ghi vào nhật ký và chưa được anh Thắng đồng ý.
6. **Bảo mật:**
   - Không đọc, in ra hay commit file `.env*`.
   - Không sửa `.github`.

## Đề nghị gửi Cursor
- Khi Cursor dựng trang **Soạn văn bản (`/admin/documents/compose`) & Xuất `.docx`**:
  - Các thông tin cố định của Công ty / Công đoàn (Công đoàn cấp trên, Tên CĐCS, Tên Công ty, Địa danh, Ký hiệu đuôi `/QĐ-CĐCS`, Thẩm quyền ký, Chức danh ký, Nơi nhận mặc định, Căn cứ chuẩn) đã được lưu trong `cdilv_app_settings` với `key = "document_settings"` (đọc qua `loadDocumentOrgSettings` và ghép biến qua `applyOrgSettingsToText` trong `src/lib/documents/settings.ts`).
  - Nội dung `body` của mẫu Quyết định/Quy định đã hỗ trợ tách/ghép cấu trúc `Trích yếu (V/v)`, danh sách `Căn cứ` (thêm/bớt được) và danh sách `Điều 1, Điều 2...` (thêm/bớt được) qua `parseStructuredDocument` / `serializeStructuredDocument` trong `src/lib/documents/templates.ts`. Khi làm bước Soạn văn bản, Cursor có thể cho người soạn thêm/bớt Căn cứ và Điều trực tiếp tương tự `DocumentTemplateEditor`.

## Nhật ký
2026-10-24 21:31 (UTC+7) | BẮT ĐẦU | Văn bản: Mẫu văn bản | cập nhật 4 mẫu Quyết định từ thực tế, thêm trình dựng Căn cứ/Điều thêm bớt được và cài đặt thông tin cố định của đơn vị | | không
2026-10-24 21:50 (UTC+7) | XONG | Văn bản: Mẫu văn bản | nạp 4 mẫu Quyết định thực tế vào cdilv_document_templates, thêm trình dựng Căn cứ & Điều thêm/bớt được + Cài đặt cố định đơn vị (document_settings) | HEAD | không


