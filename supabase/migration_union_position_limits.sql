-- Cài đặt công đoàn (Union settings): Giới hạn số người tối đa (max_holders) cho từng chức danh.
-- - max_holders integer null: null = không giới hạn, khi đặt phải >= 1.
-- - Chỉ thêm cột + ràng buộc, không xóa gì; chạy lại nhiều lần không đổi dữ liệu.
-- - Giá trị mặc định chỉ gán đúng một lần, ngay khi cột vừa được thêm (chạy lại không ghi đè giới hạn
--   quản trị viên đã sửa), theo tên chức danh hiện có (kể cả khi đã thêm hậu tố "Công Đoàn" / "BCH"):
--   + Chủ tịch, Phó chủ tịch, Kế toán -> 1
--   + Ủy viên và các chức danh khác   -> null (không giới hạn)
-- - Không tự động sửa hay xóa dữ liệu cán bộ trong cdilv_union_officers (dữ liệu cũ vượt giới hạn
--   chỉ hiện cảnh báo trên trang /admin/union-settings).

begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cdilv_union_positions'
      and column_name = 'max_holders'
  ) then
    alter table public.cdilv_union_positions
      add column max_holders integer;

    update public.cdilv_union_positions
    set max_holders = 1
    where lower(btrim(name)) in (
      lower('Chủ tịch'), lower('Chủ tịch Công Đoàn'), lower('Chủ tịch BCH'), lower('Chủ tịch BCH Công Đoàn'),
      lower('Phó chủ tịch'), lower('Phó chủ tịch Công Đoàn'), lower('Phó chủ tịch BCH'),
      lower('Phó chủ tịch BCH Công Đoàn'),
      lower('Kế toán'), lower('Kế toán Công Đoàn')
    );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cdilv_union_positions_max_holders_check'
      and conrelid = 'public.cdilv_union_positions'::regclass
  ) then
    alter table public.cdilv_union_positions
      add constraint cdilv_union_positions_max_holders_check
      check (max_holders is null or max_holders >= 1);
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
