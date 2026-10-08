-- Sau khi tạo user admin đầu tiên trên Supabase Auth (Users → Add user)
-- hoặc đăng ký qua /register bằng mã NV thật, chạy SQL này (thay email).
-- Dùng bảng cdilv_profiles (không phải public.profiles của BizMate POS).

update public.cdilv_profiles p
set
  role = 'admin',
  approval_status = 'approved',
  approved_at = now()
from auth.users u
where p.id = u.id
  and u.email = 'EMAIL_ADMIN_CUA_BAN@example.com';

-- Kiểm tra:
-- select id, full_name, employee_code, role, approval_status from public.cdilv_profiles;
