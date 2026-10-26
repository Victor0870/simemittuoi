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
| Văn bản: Soạn văn bản | BÀN GIAO CHO AGY | khung xong (0f0a69c); /admin/documents/compose, bản nháp ở bảng cdilv_documents (status nhap); chưa làm bước ban hành |
| Văn bản: Sổ văn bản | BÀN GIAO CHO AGY | khung xong (e8d86f2); /admin/documents/registry, bản scan ở bucket riêng tư cdilv-documents; cờ cong_khai chỉ lưu, chưa có trang đoàn viên |
| Văn bản: Số văn bản tự động | BÀN GIAO CHO AGY | khung xong (40d0c5a, 41c0de1); cấu hình ở bảng cdilv_document_number_series (nút Cấu hình số trong Sổ văn bản), số bắt đầu theo kỳ ở cdilv_document_number_counters.start_value, số cấp bằng hàm cdilv_document_issue |
| Bình chọn: Vote theo point | BÀN GIAO CHO AGY | khung xong (a5d3e17), sửa theo người dự thi (d5e1a09); điểm mỗi người một ngân sách: người dự thi (có tên trong bài đã duyệt) hoặc người không dự thi, cộng điểm admin; không còn điểm chung theo đội; lưu điểm bằng hàm cdilv_poll_points_allocate (hàm cdilv_poll_points_save cũ chỉ trả lỗi); Chế độ nộp bài Admin nhập / Người chơi nộp bài (duyệt ở nút Duyệt bài dự thi); dự đoán: tổng điểm bài hạng Nhất, lệch ít nhất thắng, bảng xếp hạng dự đoán sau khi đóng (e7c42b1); hình thức cũ giữ nguyên |

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
2026-10-25 06:59 (UTC+7) | BẮT ĐẦU | Văn bản | Soạn văn bản | | migration_documents.sql (bảng cdilv_documents, không có dữ liệu mẫu)
2026-10-25 07:12 (UTC+7) | XONG | Văn bản | Soạn văn bản: trang /admin/documents/compose (chọn mẫu đang dùng, form theo trường mẫu, xem trước, Lưu nháp, Xuất .docx bằng thư viện docx, danh sách bản nháp Mở lại / Xóa); quyền posts.manage; nút hub đã bật | 0f0a69c | migration_documents.sql (đã chạy, bảng cdilv_documents trống)
2026-10-25 07:43 (UTC+7) | BẮT ĐẦU | Văn bản | Sổ văn bản | | migration_document_registry.sql (bucket riêng tư cdilv-documents cho bản scan, thêm cột cong_khai; không đổi dữ liệu)
2026-10-25 13:27 (UTC+7) | XONG | Văn bản | Sổ văn bản: trang /admin/documents/registry (Đã ban hành / Chờ ban hành, lọc loại – năm – số/tiêu đề, công khai, xem bản scan qua link 60 giây, tải lại .docx); Đánh dấu đã ban hành ở bản nháp (số, ngày, bản scan); Hủy ban hành chỉ admin (về bản nháp, xóa bản scan); quyền posts.manage | e8d86f2 | migration_document_registry.sql (đã chạy; bucket cdilv-documents riêng tư 10 MB, cột cong_khai)
2026-10-25 13:40 (UTC+7) | BẮT ĐẦU | Văn bản | Số văn bản tự động: cấu hình mẫu số và chu kỳ đếm theo loại, cấp số phía máy chủ khi ban hành | | migration_document_numbering.sql (bảng cấu hình mẫu số, bảng bộ đếm, hàm cấp số khóa dòng; không đổi số đã ban hành)
2026-10-25 14:20 (UTC+7) | XONG | Văn bản | Số văn bản tự động: nút Cấu hình số ở /admin/documents/registry (mẫu số {so}-{yy}/QĐ-CĐCS…, số chữ số, đếm lại theo năm hoặc tháng; quyền posts.manage); số cấp ở máy chủ lúc ban hành bằng hàm cdilv_document_issue (khóa bộ đếm, bỏ qua số đã dùng, không cấp cho bản nháp); hộp thoại ban hành xem trước số dự kiến, Quản trị viên được nhập số thủ công (vẫn chịu ràng buộc số duy nhất) | 40d0c5a | migration_document_numbering.sql (đã chạy; bảng cdilv_document_number_series 4 dòng mặc định, cdilv_document_number_counters trống)
2026-10-25 17:20 (UTC+7) | BẮT ĐẦU | Văn bản | Số văn bản tự động: thêm "Bắt đầu từ số" theo loại cho kỳ đếm hiện tại (nối tiếp số văn bản giấy), không cho lùi số | | migration_document_number_start.sql (thêm cột start_value vào bộ đếm, cập nhật hàm cấp số; không đổi dữ liệu)
2026-10-25 17:55 (UTC+7) | XONG | Văn bản | Số văn bản tự động: thêm ô "Bắt đầu từ số" trong Cấu hình số (mỗi loại, số nguyên ≥ 1, mặc định 1, áp dụng cho năm/tháng đang đếm); hiển thị số đã cấp gần nhất trong kỳ và số tiếp theo; số tiếp theo = max(số bắt đầu, số đã cấp gần nhất + 1), số đã cấp gần nhất gồm cả số nhập tay khớp mẫu số; nhập số bắt đầu ≤ số đã cấp thì cảnh báo và không lưu (kiểm tra cả ở máy chủ, dưới khóa bộ đếm); nhập số thủ công của Quản trị viên giữ nguyên | 41c0de1 | migration_document_number_start.sql (đã chạy; thêm cột start_value mặc định 1, hàm cdilv_document_number_last_issued / _state / _configure, thay thân hàm _preview và cdilv_document_issue; không đổi dữ liệu)
2026-10-25 22:10 (UTC+7) | BẮT ĐẦU | Bình chọn | thêm hình thức Vote theo point (mỗi người/đội có ngân sách điểm, admin cộng điểm có lý do, tùy chọn tự vote cho đội mình, BGK như hình thức cũ) | | migration_poll_vote_points.sql (thêm cột vào cdilv_polls, bảng phân bổ điểm, bảng cộng điểm, hàm lưu điểm khóa theo người bầu; không đổi dữ liệu)
2026-10-25 22:18 (UTC+7) | XONG | Bình chọn | thêm hình thức "Vote theo point" (chọn theo từng chương trình, hình thức cũ không đổi): cài đặt điểm mỗi người bình chọn, điểm mỗi đội chơi, cho/không cho tự vote cho đội/bài thi của mình; người bầu chia điểm nguyên cho một hay nhiều bài thi, thấy số điểm còn lại, sửa/rút khi còn mở; thành viên đội dùng chung điểm của đội; nút Cộng điểm (quyền polls.manage) cộng cho người (mã NV) hoặc đội kèm lý do, lưu ai cộng, lúc nào, bao nhiêu; BGK dùng điểm cá nhân, trọng số BGK như cũ (tỉ lệ theo tổng điểm từng nhóm); kết quả và Đóng & Trao giải xếp theo tổng điểm; kiểm tra ngân sách, tự vote, ghi điểm đều ở máy chủ trong một hàm khóa theo người bầu | a5d3e17 | migration_poll_vote_points.sql (đã chạy; thêm cột vote_mode/points_per_voter/points_per_team/allow_self_vote vào cdilv_polls, chương trình cũ = standard; bảng cdilv_poll_point_allocations, cdilv_poll_point_grants; hàm cdilv_poll_points_save; không đổi dữ liệu)
2026-10-26 06:23 (UTC+7) | BẮT ĐẦU | Bình chọn | sửa Vote theo point: bỏ điểm chung theo đội, mỗi người một ngân sách theo người dự thi / không dự thi; thêm Chế độ nộp bài (Admin nhập / Người chơi nộp bài, duyệt hoặc từ chối, hạn nộp) | | migration_poll_points_participation.sql (thêm cột vào cdilv_polls và cdilv_poll_options, bài cũ = đã duyệt; hàm tính ngân sách và lưu điểm mới; chặn đọc công khai bài chưa duyệt; không đổi dữ liệu)
2026-10-26 07:05 (UTC+7) | XONG | Bình chọn | sửa Vote theo point: bỏ điểm chung theo đội, mỗi người đúng một ngân sách mỗi chương trình (Điểm cho người dự thi nếu có tên trong ít nhất một bài đã duyệt, Điểm cho người không dự thi nếu không), cộng điểm admin chỉ theo người; tùy chọn tự vote = không cho điểm bài có tên mình, kiểm tra trong hàm khóa ở máy chủ; thêm Chế độ nộp bài: Admin nhập (như cũ) hoặc Người chơi nộp bài (đăng nhập, nộp tên, mô tả, tối đa 3 ảnh, thành viên theo mã NV; chờ duyệt; sửa/rút khi chờ duyệt; hạn nộp tùy chọn); admin duyệt hoặc từ chối có lý do (quyền polls.manage); chỉ bài đã duyệt hiện trong bình chọn, kết quả, đóng & trao giải và tính người dự thi | d5e1a09 | migration_poll_points_participation.sql (đã chạy sau khi thử trong giao dịch rollback 15 trường hợp; thêm points_per_participant/points_per_non_participant/submission_mode/submission_deadline vào cdilv_polls, approval_status và thông tin duyệt vào cdilv_poll_options, 13 bài cũ = đã duyệt, chương trình cũ = Admin nhập; hàm cdilv_poll_points_budget và cdilv_poll_points_allocate; policy chặn đọc công khai bài chưa duyệt; cột và dữ liệu đội cũ giữ nguyên, không đổi dữ liệu)
2026-10-26 07:20 (UTC+7) | BẮT ĐẦU | Bình chọn | Vote theo point: đổi câu hỏi dự đoán thành tổng điểm bài hạng Nhất (nhập số nguyên), người thắng = lệch tuyệt đối ít nhất, bằng nhau thì gửi sớm hơn; hiện bảng xếp hạng dự đoán sau khi đóng; hình thức cũ giữ nguyên | | không (dùng bảng cdilv_poll_predictions sẵn có)
2026-10-26 07:45 (UTC+7) | XONG | Bình chọn | Vote theo point: câu hỏi dự đoán cố định "Bài thi đạt hạng Nhất sẽ được tổng cộng bao nhiêu điểm?" (nhập số nguyên 0 đến 1.000.000.000, gửi cùng điểm bình chọn, bắt buộc khi có cho điểm, sửa được khi còn mở, rút hết điểm thì hủy dự đoán, giữ thời điểm gửi nếu không đổi số); người thắng = lệch tuyệt đối ít nhất so với tổng điểm thực tế của bài hạng Nhất (điểm công khai + điểm BGK cộng thẳng, không nhân trọng số; trọng số BGK chỉ dùng để xác định bài hạng Nhất), bằng nhau thì gửi sớm hơn; bảng xếp hạng dự đoán hiện sau khi đóng; quyền, hạn và người được dự đoán như cũ; hình thức theo phiếu không đổi | e7c42b1 | không (dùng bảng cdilv_poll_predictions sẵn có)
2026-10-26 07:55 (UTC+7) | BẮT ĐẦU | Bình chọn | bỏ chữ về hoa (cắm hoa, các loại hoa...) còn sót từ chương trình mẫu cắm hoa, đổi sang lời chung cho mọi cuộc thi | | không
2026-10-26 08:05 (UTC+7) | XONG | Bình chọn | rà khu vực bình chọn (trang, component, API, nội dung mặc định, mặc định cột DB, cài đặt): chỉ còn chữ về hoa ở 3 placeholder và 1 nhãn trong PollEditorModal, đã đổi sang lời chung (bài dự thi, cuộc thi); không đổi dữ liệu chương trình đã có, không có mặc định DB nào nhắc hoa | f3a91c0 | không
2026-10-26 08:15 (UTC+7) | BẮT ĐẦU | Bình chọn | đổi chữ "tác phẩm" thành "bài thi" ở mọi chữ hiển thị trong khu vực bình chọn (nhãn, nút, tiêu đề, gợi ý, thông báo, lỗi API, mặc định cho chương trình mới) | | không
2026-10-26 08:25 (UTC+7) | XONG | Bình chọn | đổi "tác phẩm" thành "bài thi" (giữ đúng chữ hoa: Tác phẩm thành Bài thi, Tác Phẩm thành Bài Thi) ở nhãn, nút, tiêu đề, gợi ý, thông báo, lỗi API và câu hỏi dự đoán mặc định / tên bài mặc định cho chương trình mới, trong 12 file khu vực bình chọn; không đổi dữ liệu chương trình đã có, tên bảng/cột, tên biến, chú thích code | b4a17c2 | không
2026-10-26 08:30 (UTC+7) | BẮT ĐẦU | Hệ thống: Cài đặt công đoàn | thống nhất quyền: trang, API ghi, đường dẫn và ô menu cùng yêu cầu forms.settings; người soạn văn bản (posts.manage) chỉ được đọc danh sách cán bộ đang hoạt động (họ tên, chức danh) | | không
2026-10-26 08:45 (UTC+7) | XONG | Hệ thống: Cài đặt công đoàn | quy tắc chung: trang /admin/union-settings, mọi API ghi (thêm/sửa/xóa cán bộ, thêm/sửa chức danh) và GET quản lý (/api/union-settings, /positions) chỉ cho quản trị viên hoặc forms.settings (canManageUnionSettings, khớp ADMIN_ROUTE_PERMISSIONS và ô Cài đặt công đoàn trong permissions.ts); GET /api/union-settings/officers chỉ đọc cho thêm người có posts.manage (mở được Soạn văn bản) nhưng chỉ trả cán bộ đang hoạt động và bỏ thông tin tài khoản liên kết; trang Soạn văn bản cũng chỉ gửi họ tên/chức danh/nhiệm kỳ; ô Cài đặt công đoàn ở trang Hành chính, Văn bản và nút liên kết trong Mẫu văn bản, Soạn văn bản chỉ hiện cho người có forms.settings | c51d2e8 | không
2026-10-26 09:17 (UTC+7) | BẮT ĐẦU | Bình chọn | trang bình chọn công khai tải từng bài thi một: danh sách chỉ chữ (không ảnh), xem chi tiết một bài có thư viện ảnh tải dần, nút trước/sau, chọn bài, link ?entry=; API danh sách nhẹ + API chi tiết một bài + đường dẫn ảnh có cache; áp dụng cho cả phiếu và Vote theo point, mọi chương trình | | không
2026-10-26 09:22 (UTC+7) | XONG | Bình chọn | trang bình chọn (cả phiếu và Vote theo point, mọi chương trình kể cả đã đóng) chỉ hiện một bài thi mỗi lần: khung chi tiết có ảnh tải từng tấm (vuốt hoặc nút), nút bài trước/sau, ô chọn bài, link ?entry= giữ bài khi tải lại/chia sẻ, nút bình chọn hoặc ô cho điểm ngay trong khung, thanh tóm tắt bài đã chọn/điểm còn lại; danh sách bài chỉ chữ (số, tên, tác giả, trạng thái), 24 bài/trang, có ô tìm khi dài; chương trình đã đóng chỉ xem; API mới GET /api/polls/[id]/entries (danh sách nhẹ) và /entries/[entryId] (một bài) cache public 60 giây trên CDN, /entries/[entryId]/images/[index] trả ảnh base64 thành file (cache 1 năm theo ?v=), dữ liệu riêng (điểm của tôi, bài của tôi, API quản trị) private no-store; trang chỉ gửi ảnh đầu cho bục vinh danh, không gửi mô tả; form sửa trên trang tải bản đầy đủ khi mở; đo chương trình cắm hoa 20-10 (13 bài, 39 ảnh): trước HTML 122 KB + 39 ảnh 3,0 MB, sau HTML 72 KB + 4 ảnh 0,36 MB | e50a1f0 | không
