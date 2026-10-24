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
(Antigravity ghi các yêu cầu sửa khung ở đây)

## Nhật ký
(chưa có)
