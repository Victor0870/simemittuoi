-- =============================================================================
-- Migration: Bảng Quy chế chi tiêu (Regulation Documents & Sections)
-- - cdilv_regulation_documents: lưu văn bản quy chế (title, year, status...)
-- - cdilv_regulation_sections: lưu từng điều khoản (document_id, order, heading, body_text...)
-- - Phân quyền RLS: chỉ admin được select, insert, update
-- =============================================================================

begin;

create table if not exists public.cdilv_regulation_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  year integer not null,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  document_number text,
  issue_date text,
  preamble text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cdilv_regulation_sections (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.cdilv_regulation_documents(id) on delete cascade,
  "order" integer not null default 0,
  order_index integer not null default 0,
  chapter text not null default '',
  article_number text not null default '',
  heading text not null,
  body_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.cdilv_profiles(id) on delete set null
);

create index if not exists cdilv_regulation_documents_year_status_idx
  on public.cdilv_regulation_documents (year desc, status);

create index if not exists cdilv_regulation_sections_doc_order_idx
  on public.cdilv_regulation_sections (document_id, order_index);

-- Enable RLS
alter table public.cdilv_regulation_documents enable row level security;
alter table public.cdilv_regulation_sections enable row level security;

-- Policies for cdilv_regulation_documents
drop policy if exists "cdilv_regulation_documents_admin_select" on public.cdilv_regulation_documents;
create policy "cdilv_regulation_documents_admin_select" on public.cdilv_regulation_documents
  for select to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_regulation_documents_admin_insert" on public.cdilv_regulation_documents;
create policy "cdilv_regulation_documents_admin_insert" on public.cdilv_regulation_documents
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_regulation_documents_admin_update" on public.cdilv_regulation_documents;
create policy "cdilv_regulation_documents_admin_update" on public.cdilv_regulation_documents
  for update to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

-- Policies for cdilv_regulation_sections
drop policy if exists "cdilv_regulation_sections_admin_select" on public.cdilv_regulation_sections;
create policy "cdilv_regulation_sections_admin_select" on public.cdilv_regulation_sections
  for select to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_regulation_sections_admin_insert" on public.cdilv_regulation_sections;
create policy "cdilv_regulation_sections_admin_insert" on public.cdilv_regulation_sections
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

drop policy if exists "cdilv_regulation_sections_admin_update" on public.cdilv_regulation_sections;
create policy "cdilv_regulation_sections_admin_update" on public.cdilv_regulation_sections
  for update to authenticated
  using (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.cdilv_profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.approval_status = 'approved'
    )
  );

revoke all on public.cdilv_regulation_documents from anon;
revoke all on public.cdilv_regulation_sections from anon;

grant select, insert, update on public.cdilv_regulation_documents to authenticated;
grant select, insert, update on public.cdilv_regulation_sections to authenticated;

grant select, insert, update, delete on public.cdilv_regulation_documents to service_role;
grant select, insert, update, delete on public.cdilv_regulation_sections to service_role;

-- -----------------------------------------------------------------------------
-- Seed dữ liệu Quy chế chi tiêu tài chính 2026
-- -----------------------------------------------------------------------------
do $$
declare
  v_doc_id uuid;
begin
  select id into v_doc_id
  from public.cdilv_regulation_documents
  where year = 2026 and title = 'Quy chế chi tiêu tài chính 2026'
  limit 1;

  if v_doc_id is null then
    insert into public.cdilv_regulation_documents (
      title,
      year,
      status,
      document_number,
      issue_date,
      preamble
    ) values (
      'Quy chế chi tiêu tài chính 2026',
      2026,
      'active',
      '2026-01/QC-CĐ',
      '26/02/2026',
      E'- Căn cứ các quy định về tài chính của Nhà nước và Tổng Liên đoàn Lao động Việt Nam;\n- Căn cứ kết quả phiên họp ngày 12/2/2026 của BCH Công đoàn Công ty về việc ban hành quy chế thu chi công đoàn. Ban chấp hành Công đoàn công ty dầu nhờn Idemitsu Việt Nam ban hành quy chế thu chi Ngân sách Công đoàn nhiệm kỳ 2026-2030 như sau:'
    ) returning id into v_doc_id;

    -- Điều 1
    insert into public.cdilv_regulation_sections (
      document_id, "order", order_index, chapter, article_number, heading, body_text
    ) values (
      v_doc_id, 1, 1, 'Chương I: Nguồn thu', 'Điều 1', 'Chương I - Điều 1: Kinh phí cấp trên cấp',
      'Công đoàn Khu kinh tế sẽ cấp 75% KPCĐ cho CĐCS (Sau khi doanh nghiệp đóng 2% KPCĐ về CĐ Khu kinh tế hoặc Tổng Liên đoàn).'
    );

    -- Điều 2
    insert into public.cdilv_regulation_sections (
      document_id, "order", order_index, chapter, article_number, heading, body_text
    ) values (
      v_doc_id, 2, 2, 'Chương I: Nguồn thu', 'Điều 2', 'Chương I - Điều 2: Đoàn phí công đoàn',
      'Mức thu 20.000 đồng/người/tháng, trích qua lương do đoàn viên công đoàn đóng.'
    );

    -- Điều 3
    insert into public.cdilv_regulation_sections (
      document_id, "order", order_index, chapter, article_number, heading, body_text
    ) values (
      v_doc_id, 3, 3, 'Chương I: Nguồn thu', 'Điều 3', 'Chương I - Điều 3: Thu khác',
      'Doanh nghiệp hoặc các tổ chức, cá nhân hỗ trợ kinh phí hoạt động; Thu lãi từ tiền gửi ngân hàng, thu quỹ Mái ấm Công đoàn và các quỹ xã hội khác, tiền thưởng từ việc tham gia các cuộc thi của công đoàn cấp trên.'
    );

    -- Điều 4
    insert into public.cdilv_regulation_sections (
      document_id, "order", order_index, chapter, article_number, heading, body_text
    ) values (
      v_doc_id, 4, 4, 'Chương II: Nội dung chi', 'Điều 4', 'Chương II - Điều 4: Kinh phí được chi tại công đoàn công ty',
      E'Theo Quyết định 3226/QĐ-TLĐ ngày 20/9/2021 của Tổng LĐLĐ Việt Nam và Hướng dẫn xây dựng dự toán 16/HD-LĐLĐ ngày 25/10/2021 của Liên đoàn lao động TP.\nSố được chi tại cơ sở = (KPCĐ cấp trên cấp hoặc 75% x KPCĐ) + (60% x ĐPCĐ) + thu khác\n\nSố kinh phí được sử dụng cho các hoạt động:\n- Phụ cấp CBCĐ\n- Thăm hỏi đoàn viên\n- Chăm lo, bảo vệ, đào tạo\n- Tuyên truyền, vận động\n- Quản lý hành chính\n- Các hoạt động khác'
    );

    -- Điều 5
    insert into public.cdilv_regulation_sections (
      document_id, "order", order_index, chapter, article_number, heading, body_text
    ) values (
      v_doc_id, 5, 5, 'Chương II: Nội dung chi', 'Điều 5', 'Chương II - Điều 5: Phụ cấp cán bộ công đoàn',
      E'* Nguyên tắc chi phụ cấp:\n- Mức chi theo Quyết định 3226/QĐ-TLĐ ngày 25/10/2021 của Tổng LĐLĐ VN.\n- Khi có quy định hoặc thay đổi từ quy định của Nhà nước hoặc Tổng LĐLĐ VN thì chủ tịch CĐ cập nhật lại quyết định chi phụ cấp theo quy định mới.\n\nChứng từ gồm: Quyết định chi phụ cấp, đề nghị thanh toán, danh sách ký nhận ( nếu chuyển tiền mặt ).'
    );

    -- Điều 6
    insert into public.cdilv_regulation_sections (
      document_id, "order", order_index, chapter, article_number, heading, body_text
    ) values (
      v_doc_id, 6, 6, 'Chương II: Nội dung chi', 'Điều 6', 'Chương II - Điều 6: Chi quản lý hành chính',
      E'2.1. Nguyên tắc: Chi hành chính không quá 15% số kinh phí công đoàn cơ sở được sử dụng (15% * 75% * KPCĐ).\n\n2.2. Nội dung chi:\n- Chi Đại hội công đoàn công ty, hội nghị giữa nhiệm kỳ: 50.000đ đồng/người/cuộc.\n- Chi hội nghị Ban thường vụ, Ban Chấp hành: 150.000đ -:- 300.000đ/người/cuộc.\n- Họp với tổ trưởng công đoàn: 50.000đ -:- 150.000đ/người/cuộc.\n- Công tác phí cho cán bộ công đoàn đi thẩm định, khảo sát gia đình đoàn viên có hoàn cảnh khó khăn: mức chi công tác phí: 200.000đ/người/ngày, hỗ trợ tiền ăn: 50.000đ/người/bữa (Nếu công ty không bố trí xe hoặc Công đoàn không thuê xe thì cán bộ công đoàn sẽ tự túc và cung cấp hóa đơn đúng luật để được thanh toán tiền công tác phí).\n- Công tác phí cho cán bộ công đoàn tham dự các hội nghị, học tập,.. do công đoàn cấp trên triệu tập theo mức: ½ ngày 250.000đ/người , 1 ngày 500.000đ/người.\n\n2.3. Chi phí hành chính khác gồm: Trang trí khánh tiết, in tài liệu, chi mua văn phòng phẩm, công tác phí, nước uống, tiếp khách: Chi theo thực tế.\n\nChứng từ gồm: Phê duyệt mức chi của Chủ tịch CĐ ( theo email hoặc văn bản cho từng trường hợp cụ thể ), Danh sách ký nhận bồi dưỡng, hoá đơn tài chính.'
    );

    -- Điều 7
    insert into public.cdilv_regulation_sections (
      document_id, "order", order_index, chapter, article_number, heading, body_text
    ) values (
      v_doc_id, 7, 7, 'Chương II: Nội dung chi', 'Điều 7', 'Chương II - Điều 7: Chi chăm lo cho đoàn viên, người lao động và chi hoạt động khác',
      E'3.1. Nguyên tắc: Chi thăm hỏi (40% x 60% x ĐPCĐ) + Chi hoạt động (15% x 60% x ĐPCĐ) + Chi chăm lo, bảo vệ, đào tạo (60% x 75% x KPCĐ) + chi tuyên truyền (25% x 75% x KPCĐ).\n- Chi các hoạt động tuyên truyền: Chi giảng viên, âm thanh loa máy, khánh tiết theo thực tế; chi bồi dưỡng CNLĐ tham dự.\n- Chi tổ chức hoạt động đại diện, bảo vệ quyền, lợi ích hợp pháp chính đáng của đoàn viên và người lao động: Bồi dưỡng tư vấn, luật sư, thuê luật sư bảo vệ,.... Mức chi theo thực tế.\n- Chi tổ chức các phong trào thi đua: Chi phí tổ chức hội nghị, khen thưởng tập thể và cá nhân đạt thành tích xuất sắc trong phong trào thi đua.\n- Chi tập huấn: Giảng viên và các chi phí lớp học theo thực tế; Học viên\n- Các hội thi, hoạt động văn hoá, thể thao: Hỗ trợ các đội thi, âm thanh loa máy, khánh tiết và giải thưởng các đội thi,.....\n\n3.2. Các hoạt động chi bao gồm:\n- Tặng quà sinh nhật\n- Tặng quà Tết\n- Thăm hỏi ốm đau\n- Sinh con\n- Kết hôn\n- Ma chay\n- Trợ cấp khó khăn (Cao hơn thăm hỏi và chỉ chi 01 lần/ năm)\n- Tặng quà ngày Quốc tế phụ nữ 8/3\n- Tặng quà ngày phụ nữ Việt Nam 20/10\n- Tặng quà Tết thiếu nhi 1/6\n- Khen thưởng\n\nChứng từ gồm: Quyết định mức chi mới nhất đối với các hạng mục, đề nghị thanh toán, danh sách ký nhận, hợp đồng, hoá đơn tài chính theo quy định nếu mua bán hoặc sử dụng dịch vụ bên thứ 3'
    );

    -- Điều 8
    insert into public.cdilv_regulation_sections (
      document_id, "order", order_index, chapter, article_number, heading, body_text
    ) values (
      v_doc_id, 8, 8, 'Chương II: Nội dung chi', 'Điều 8', 'Chương II - Điều 8: Chi đối ngoại và chi khác',
      E'- Chế độ chi tiếp khách: Chủ tịch Công đoàn Công ty căn cứ tình hình thực tế để quyết định chi tặng phẩm, phòng nghỉ, ăn uống, đi lại… cho phù hợp với phong tục tập quán của khách và điều kiện thực tế của công ty.\n- Chi thăm hỏi, phúng viếng các cá nhân, đoàn viên các đơn vị khác đã có mối quan hệ với công đoàn công ty: Mức chi do Chủ tịch Công đoàn Công ty xem xét, quyết định.\n- Các khoản chi khác không quy định trong Quy chế này được thực hiện theo Quy định của Nhà nước, Tổng LĐLĐ Việt Nam hoặc Chủ tịch Công đoàn công ty căn cứ trên tình hình thực tế quyết định mức chi cho phù hợp.\n- Chứng từ bao gồm quyết định chi của Chủ tịch công đoàn thông qua email hoặc văn bản nếu có.'
    );

    -- Điều 9
    insert into public.cdilv_regulation_sections (
      document_id, "order", order_index, chapter, article_number, heading, body_text
    ) values (
      v_doc_id, 9, 9, 'Chương III: Tổ chức thực hiện', 'Điều 9', 'Chương III - Điều 9: Thủ tục và thẩm quyền',
      E'- Khi gặp vấn đề cần chi tiêu ở lĩnh vực nào thì người phụ trách ở lĩnh vực đó lập văn bản (Kế hoạch, danh sách, phiếu thăm hỏi, đề nghị thanh toán… tùy theo từng nội dung) đề nghị, kế toán công đoàn rà soát các mức chi, chứng từ cần thiết, Chủ tịch Công đoàn công ty xem xét quyết định và thủ quỹ chi tiền.\n- Về thẩm quyền quyết định mức chi: Chủ tịch CĐCS được quyền quyết định duyệt chi tất cả các nội dung quy chế thu chi này. Trong trường hợp Chủ tịch công đoàn đi công tác, nghỉ ốm dài ngày… thì phải làm Giấy ủy quyền cho Phó Chủ tịch công đoàn chi.'
    );

    -- Điều 10
    insert into public.cdilv_regulation_sections (
      document_id, "order", order_index, chapter, article_number, heading, body_text
    ) values (
      v_doc_id, 10, 10, 'Chương III: Tổ chức thực hiện', 'Điều 10', 'Chương III - Điều 10: Hiệu lực thi hành',
      E'Trong quá trình thực hiện, nếu cần sửa đổi, bổ sung Ban Chấp hành Công đoàn Công ty sẽ họp để điều chỉnh.\nQuy chế này có hiệu lực kể từ ngày ký.\n\nTM. BAN CHẤP HÀNH\nCHỦ TỊCH'
    );
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
