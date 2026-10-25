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
2026-10-24 21:50 (UTC+7) | XONG | Văn bản: Mẫu văn bản | nạp 4 mẫu Quyết định thực tế vào cdilv_document_templates, thêm trình dựng Căn cứ & Điều thêm/bớt được + Cài đặt cố định đơn vị (document_settings) | f8f3aa2 | không
2026-10-25 07:28 (UTC+7) | BẮT ĐẦU | Văn bản: Mẫu văn bản | sửa regex nhận diện dòng Căn cứ trong parseStructuredDocument | | không
2026-10-25 07:29 (UTC+7) | XONG | Văn bản: Mẫu văn bản | đổi regex /^Căn cứ\b/i thành /^Căn cứ(\s|$)/i trong src/lib/documents/templates.ts để đếm và giữ đúng các dòng Căn cứ tiếng Việt | e34c643 | không
2026-10-25 08:30 (UTC+7) | BẮT ĐẦU | Văn bản: Mẫu văn bản | phân loại Mẫu tùy chỉnh & bổ sung bộ Mẫu chuẩn theo QĐ 933/QĐ-TLĐ, hỗ trợ sửa Mẫu chuẩn và lưu chuyển thành Mẫu tùy chỉnh | | không
2026-10-25 08:39 (UTC+7) | XONG | Văn bản: Mẫu văn bản | đổi tên 5 mẫu đã nạp thành Mẫu tùy chỉnh, bổ sung 12 Mẫu chuẩn theo QĐ 933/QĐ-TLĐ (Mẫu 1.1 đến 1.10) từ thư mục mau van ban CD, hỗ trợ lọc Mẫu chuẩn/Mẫu tùy chỉnh và chuyển Mẫu chuẩn thành Mẫu tùy chỉnh | c085330 | không
2026-10-25 08:50 (UTC+7) | BẮT ĐẦU | Văn bản: Mẫu văn bản | tạo thẻ màu nhẹ (pastel tags, thẻ lọc nhanh và màu nền dòng nhẹ) để phân biệt trực quan Mẫu chuẩn (QĐ 933) và Mẫu tùy chỉnh | | không
2026-10-25 08:55 (UTC+7) | XONG | Văn bản: Mẫu văn bản | thêm thẻ màu pastel nhẹ (xanh sky cho Mẫu chuẩn QĐ 933, vàng amber cho Mẫu tùy chỉnh), thanh chỉ thị màu đầu dòng và nền dòng nhẹ trong bảng Mẫu văn bản | e8d86f2 | không
2026-10-25 13:25 (UTC+7) | BẮT ĐẦU | Tài chính: Tổng hợp thu chi | dựng trang Tổng hợp thu chi (/admin/finance/summary), quản lý số dư đầu kỳ kết chuyển theo kỳ, nhập và xuất Excel (.xlsx) | | không
2026-10-25 13:38 (UTC+7) | XONG | Tài chính: Tổng hợp thu chi | thêm trang /admin/finance/summary liên kết từ /admin/finance, 2 bảng Tổng hợp thu & Tổng hợp chi theo danh mục (lọc tháng/quý/năm), số dư đầu kỳ kết chuyển từ sổ cũ (cdilv_app_settings.finance_opening_balances), nhập Excel có file mẫu & xem trước lỗi và xuất Excel (.xlsx) | 8e41dfe | không
2026-10-25 17:15 (UTC+7) | BẮT ĐẦU | Tài chính: Tổng hợp thu & Tổng hợp chi | tách trang /admin/finance/summary thành 2 trang riêng /admin/finance/income (Tổng hợp thu) và /admin/finance/expense (Tổng hợp chi), mẫu nhập/xuất Excel riêng cho từng loại, redirect /admin/finance/summary sang /admin/finance/income | | không
2026-10-25 17:27 (UTC+7) | XONG | Tài chính: Tổng hợp thu & Tổng hợp chi | tách /admin/finance/summary thành 2 trang /admin/finance/income (Tổng hợp thu) và /admin/finance/expense (Tổng hợp chi), dùng chung helper/component, mỗi trang có mẫu Excel + nhập/xuất Excel riêng cho Thu hoặc Chi, redirect /admin/finance/summary sang /admin/finance/income | HEAD | không
