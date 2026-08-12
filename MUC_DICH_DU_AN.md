# Mục đích dự án website công đoàn

## 1. Mục đích

Dự án nhằm triển khai một website cho công đoàn để:

- Báo cáo và công bố các hoạt động của công đoàn.
- Quản lý bảng điểm tương ứng với từng hoạt động công đoàn.
- Theo dõi điểm số của từng đoàn viên.
- Hiển thị bảng xếp hạng điểm số của đoàn viên theo từng mốc xếp hạng.

Website giúp công đoàn có một kênh thông tin tập trung, minh bạch và dễ tra cứu về hoạt động, điểm thi đua và lịch sử cộng điểm.

## 2. Tính năng cần có

### Quản lý bài viết

- Admin có thể đăng bài viết về các hoạt động công đoàn.
- Bài viết có thể gồm tiêu đề, nội dung, ngày đăng, hình ảnh và thông tin liên quan đến hoạt động.
- Người dùng có thể xem danh sách bài viết và chi tiết từng bài viết.

### Quản lý điểm số

- Admin có thể cập nhật điểm số cho mọi đoàn viên.
- Mỗi lần cộng điểm cần gắn với một hoạt động cụ thể.
- Hệ thống cần lưu lại lịch sử cộng điểm để đảm bảo minh bạch.

### Lịch sử cộng điểm

- Mỗi đoàn viên có bảng lịch sử cộng điểm riêng.
- Lịch sử nên bao gồm: ngày cộng điểm, tên hoạt động, số điểm được cộng, người cập nhật và ghi chú nếu có.
- Người dùng có thể click vào tên của đoàn viên khác để xem lịch sử điểm của người đó.

### Đăng nhập và trang cá nhân

- Mỗi đoàn viên có thể đăng nhập để xem điểm hiện tại của mình.
- Mỗi đoàn viên có thể xem hạng hiện tại của mình trên bảng xếp hạng.
- Trang cá nhân nên hiển thị tổng điểm, hạng hiện tại và lịch sử cộng điểm.

### Bảng xếp hạng

- Hiển thị bảng xếp hạng Top 10.
- Hiển thị bảng xếp hạng Top 45.
- Có thể click vào tên đoàn viên trong bảng xếp hạng để xem lịch sử điểm của người đó.

## 3. Gợi ý công nghệ

Có hai phương án chính:

### Phương án 1: GitHub Pages + Firebase

Phù hợp nếu website chủ yếu là frontend tĩnh, cần triển khai đơn giản và muốn dùng hệ sinh thái Firebase cho đăng nhập, database và hosting bổ sung.

Ưu điểm:

- Dễ bắt đầu, phù hợp với dự án nhỏ.
- Firebase Authentication hỗ trợ đăng nhập nhanh.
- Firestore có thể lưu bài viết, điểm số và lịch sử cộng điểm.
- Không cần quản lý server riêng.

Hạn chế:

- GitHub Pages chỉ phù hợp với frontend tĩnh, không linh hoạt bằng Vercel khi cần SSR, API route hoặc xử lý backend nhẹ.
- Firestore là NoSQL, việc truy vấn bảng xếp hạng, lịch sử và quan hệ dữ liệu cần thiết kế cẩn thận.
- Quyền truy cập phụ thuộc nhiều vào Firebase Security Rules, nếu viết không chặt chẽ có thể khó bảo trì.

### Phương án 2: GitHub + Vercel + Supabase

Đây là phương án nên chọn cho dự án này.

Lý do:

- Vercel phù hợp để triển khai website hiện đại như Next.js.
- Supabase dùng PostgreSQL, rất phù hợp với dữ liệu có quan hệ rõ ràng: đoàn viên, bài viết, hoạt động, điểm số, lịch sử cộng điểm, vai trò admin.
- Dễ viết truy vấn bảng xếp hạng Top 10, Top 45 và hạng hiện tại của từng đoàn viên.
- Supabase Authentication và Row Level Security hỗ trợ phân quyền admin/người dùng tốt.
- Dễ mở rộng nếu sau này cần lọc theo năm, theo đợt thi đua, theo đơn vị hoặc xuất báo cáo.

## 4. Khuyến nghị

Nên dùng GitHub + Vercel + Supabase.

Kiến trúc đề xuất:

- GitHub: lưu mã nguồn và quản lý phiên bản.
- Vercel: triển khai frontend, nên dùng Next.js.
- Supabase: quản lý database PostgreSQL, đăng nhập, phân quyền và lưu trữ dữ liệu.

Mô hình dữ liệu nên có:

- `users`: thông tin đoàn viên, vai trò admin/user.
- `posts`: bài viết hoạt động công đoàn.
- `activities`: danh sách hoạt động có điểm tương ứng.
- `score_events`: lịch sử cộng điểm cho từng đoàn viên.
- `rankings`: có thể tính trực tiếp từ tổng điểm trong `score_events`, không nhất thiết phải lưu thành bảng riêng.

Hướng tiếp cận ưu tiên:

1. Xây dựng trang công khai hiển thị bài viết và bảng xếp hạng.
2. Xây dựng đăng nhập cho đoàn viên.
3. Xây dựng trang cá nhân xem điểm và lịch sử.
4. Xây dựng trang admin để đăng bài và cập nhật điểm.
5. Thêm phân quyền để chỉ admin mới được cập nhật điểm và bài viết.
