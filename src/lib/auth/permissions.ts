/**
 * Danh mục quyền theo module. Module mới chỉ cần thêm một mục vào PERMISSION_MODULES
 * (và kiểm tra quyền ở API/RLS) — admin sẽ thấy ngay để tick cho từng cấp.
 * Mã quyền đã lưu trong database: đổi mã ở đây sẽ làm mất quyền đã cấp.
 */

export type PermissionDef = {
  code: string;
  name: string;
  description: string;
  /** Quyền bắt buộc đi kèm (tự tick khi chọn quyền này). */
  requires?: string[];
};

export type PermissionModule = {
  key: string;
  name: string;
  icon: string;
  permissions: PermissionDef[];
};

export const PERMISSIONS = {
  employeesView: "employees.view",
  employeesManage: "employees.manage",
  membersView: "members.view",
  membersEdit: "members.edit",
  membersExport: "members.export",
  membersImport: "members.import",
  albumsManage: "albums.manage",
  postsManage: "posts.manage",
  pollsManage: "polls.manage",
  giftsChildren: "gifts.children",
  lifeEventsView: "life_events.view",
  lifeEventsHandle: "life_events.handle",
  popupsManage: "popups.manage",
  rewardsPayout: "rewards.payout",
  visitsView: "visits.view",
  visitsCreate: "visits.create",
  visitsApprove: "visits.approve",
  visitsPay: "visits.pay",
  formsSettings: "forms.settings",
  paymentsView: "payments.view",
  paymentsCreate: "payments.create",
  paymentsApprove: "payments.approve",
  paymentsPay: "payments.pay",
  financeView: "finance.view",
  financeRecord: "finance.record",
  financeManage: "finance.manage",
  reportsView: "reports.view",
  catalogsManage: "catalogs.manage",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: "employees",
    name: "Danh sách nhân viên",
    icon: "badge",
    permissions: [
      {
        code: PERMISSIONS.employeesView,
        name: "Xem danh sách",
        description: "Xem danh sách nhân viên được phép đăng ký và trạng thái tài khoản.",
      },
      {
        code: PERMISSIONS.employeesManage,
        name: "Thêm / sửa / ngừng",
        description: "Thêm nhân viên mới, sửa họ tên và bộ phận, ngừng hoặc kích hoạt lại mã.",
        requires: [PERMISSIONS.employeesView],
      },
    ],
  },
  {
    key: "members",
    name: "Hồ sơ đoàn viên",
    icon: "contact_page",
    permissions: [
      {
        code: PERMISSIONS.membersView,
        name: "Xem hồ sơ",
        description:
          "Xem danh sách và chi tiết hồ sơ đoàn viên (ngày sinh, địa chỉ, ngân hàng, con cái). Số CCCD luôn được che.",
      },
      {
        code: PERMISSIONS.membersEdit,
        name: "Sửa hồ sơ hộ đoàn viên",
        description: "Cập nhật hồ sơ thay cho đoàn viên (mọi thay đổi đều được ghi lịch sử).",
        requires: [PERMISSIONS.membersView],
      },
      {
        code: PERMISSIONS.membersExport,
        name: "Xuất danh sách Excel",
        description: "Tải danh sách hồ sơ đoàn viên ra file Excel (số CCCD luôn được che).",
        requires: [PERMISSIONS.membersView],
      },
      {
        code: PERMISSIONS.membersImport,
        name: "Nhập hồ sơ từ Excel",
        description:
          "Tải file Excel để cập nhật hàng loạt hồ sơ đoàn viên theo mã NV, có xem trước và xác nhận.",
        requires: [PERMISSIONS.membersView, PERMISSIONS.membersEdit],
      },
    ],
  },
  {
    key: "albums",
    name: "Album ảnh",
    icon: "photo_library",
    permissions: [
      {
        code: PERMISSIONS.albumsManage,
        name: "Quản lý album",
        description:
          "Tạo / sửa / ẩn / xóa album; cài đặt ai được đăng, số ảnh, điểm thưởng, thời gian đăng ảnh; xóa ảnh và bình luận của người khác; đăng ảnh không giới hạn.",
      },
    ],
  },
  {
    key: "posts",
    name: "Bài viết",
    icon: "newspaper",
    permissions: [
      {
        code: PERMISSIONS.postsManage,
        name: "Đăng & sửa bài viết",
        description:
          "Đăng bài viết mới, sửa nội dung / phân loại, đánh dấu thông báo quan trọng, ẩn / hiện bài và xem bài đang ẩn.",
      },
    ],
  },
  {
    key: "polls",
    name: "Bình chọn (vote)",
    icon: "how_to_vote",
    permissions: [
      {
        code: PERMISSIONS.pollsManage,
        name: "Tạo & quản lý bình chọn",
        description:
          "Tạo chương trình bình chọn, sửa lựa chọn và cơ cấu điểm, mở / đóng, kết thúc và tự động trao điểm thưởng.",
      },
    ],
  },
  {
    key: "rewards",
    name: "Thanh toán thưởng",
    icon: "payments",
    permissions: [
      {
        code: PERMISSIONS.rewardsPayout,
        name: "Xem, in & xuất danh sách nhận thưởng",
        description:
          "Xem danh sách nhận thưởng của các chương trình bình chọn đã kết thúc (mã NV, họ tên, số tài khoản, ngân hàng, số tiền), in và xuất Excel để làm phiếu chi, chuyển khoản.",
      },
    ],
  },
  {
    key: "gifts",
    name: "Quà thiếu nhi",
    icon: "redeem",
    permissions: [
      {
        code: PERMISSIONS.giftsChildren,
        name: "Lọc, in & xuất danh sách",
        description:
          "Lọc con của đoàn viên dưới độ tuổi quy định tại mốc ngày chọn (họ tên, ngày sinh, giới tính cháu; họ tên, mã NV, bộ phận của bố/mẹ), in và xuất Excel.",
      },
    ],
  },
  {
    key: "life_events",
    name: "Tin báo của đoàn viên",
    icon: "campaign",
    permissions: [
      {
        code: PERMISSIONS.lifeEventsView,
        name: "Xem tin báo",
        description:
          "Xem mọi tin vui / tin ốm / tin khó khăn đoàn viên gửi lên, kèm ảnh giấy tờ, và nhận thông báo khi có tin mới.",
      },
      {
        code: PERMISSIONS.lifeEventsHandle,
        name: "Tiếp nhận & ghi chú",
        description: "Bấm “Tiếp nhận” (đoàn viên được báo lại), ghi chú xử lý, bổ sung ảnh giấy tờ.",
        requires: [PERMISSIONS.lifeEventsView],
      },
    ],
  },
  {
    key: "visits",
    name: "Đề nghị thăm hỏi",
    icon: "volunteer_activism",
    permissions: [
      {
        code: PERMISSIONS.visitsView,
        name: "Xem & in phiếu",
        description: "Xem danh sách phiếu đề nghị thăm hỏi, lịch sử xử lý và tải phiếu thăm hỏi (Excel theo mẫu C11-TLĐ).",
      },
      {
        code: PERMISSIONS.visitsCreate,
        name: "Lập đề nghị",
        description: "Lập phiếu đề nghị thăm hỏi (từ tin báo hoặc trực tiếp), sửa / hủy phiếu khi chưa duyệt.",
        requires: [PERMISSIONS.visitsView],
      },
      {
        code: PERMISSIONS.visitsApprove,
        name: "Duyệt / từ chối",
        description: "Duyệt hoặc từ chối đề nghị thăm hỏi, nhận thông báo khi có đề nghị mới.",
        requires: [PERMISSIONS.visitsView],
      },
      {
        code: PERMISSIONS.visitsPay,
        name: "Xác nhận đã chi",
        description: "Đánh dấu đề nghị đã duyệt là đã chi tiền (kế toán / thủ quỹ).",
        requires: [PERMISSIONS.visitsView],
      },
    ],
  },
  {
    key: "payments",
    name: "Đề nghị thanh toán",
    icon: "request_quote",
    permissions: [
      {
        code: PERMISSIONS.paymentsView,
        name: "Xem & in phiếu",
        description: "Xem các giấy đề nghị thanh toán, lịch sử xử lý và tải Giấy đề nghị thanh toán (Excel theo mẫu).",
      },
      {
        code: PERMISSIONS.paymentsCreate,
        name: "Lập đề nghị",
        description:
          "Lập giấy đề nghị thanh toán (nhập từng dòng chi hoặc gom phiếu thăm hỏi đã duyệt, kèm số tài khoản người nhận), sửa / hủy khi chưa duyệt.",
        requires: [PERMISSIONS.paymentsView],
      },
      {
        code: PERMISSIONS.paymentsApprove,
        name: "Duyệt / từ chối",
        description: "Duyệt hoặc từ chối đề nghị thanh toán, nhận thông báo khi có đề nghị mới.",
        requires: [PERMISSIONS.paymentsView],
      },
      {
        code: PERMISSIONS.paymentsPay,
        name: "Xác nhận đã chi",
        description:
          "Đánh dấu đề nghị đã duyệt là đã chi tiền; các phiếu thăm hỏi gom trong đề nghị tự chuyển sang “Đã chi”.",
        requires: [PERMISSIONS.paymentsView],
      },
    ],
  },
  {
    key: "finance",
    name: "Sổ quỹ công đoàn",
    icon: "account_balance_wallet",
    permissions: [
      {
        code: PERMISSIONS.financeView,
        name: "Xem sổ quỹ",
        description: "Xem số dư các quỹ, sổ quỹ thu – chi theo kỳ, chi tiết từng phiếu và xuất Excel.",
      },
      {
        code: PERMISSIONS.financeRecord,
        name: "Ghi sổ",
        description:
          "Lập phiếu thu, phiếu chi, chuyển tiền giữa các quỹ; sửa hoặc hủy (có lý do) bút toán thuộc kỳ chưa khóa sổ.",
        requires: [PERMISSIONS.financeView],
      },
      {
        code: PERMISSIONS.financeManage,
        name: "Quản lý quỹ & khóa sổ",
        description: "Khai báo quỹ, số dư đầu kỳ và khóa / mở khóa sổ theo kỳ.",
        requires: [PERMISSIONS.financeView],
      },
    ],
  },
  {
    key: "catalogs",
    name: "Quản lý danh mục",
    icon: "category",
    permissions: [
      {
        code: PERMISSIONS.catalogsManage,
        name: "Thêm & sửa danh mục",
        description:
          "Thêm, sửa, ẩn danh mục thu – chi và danh mục đối tượng (công ty, cá nhân: mã số, tên, địa chỉ, MST, số tài khoản, ngân hàng) dùng khi ghi sổ và lập đề nghị thanh toán.",
      },
    ],
  },
  {
    key: "reports",
    name: "Báo cáo",
    icon: "monitoring",
    permissions: [
      {
        code: PERMISSIONS.reportsView,
        name: "Xem & xuất báo cáo tổng hợp",
        description:
          "Xem báo cáo thu – chi theo danh mục, số dư các quỹ, tổng hợp thăm hỏi và đề nghị thanh toán theo tháng / quý / năm, xuất Excel. Chỉ số liệu gộp, không có thông tin cá nhân đoàn viên.",
      },
    ],
  },
  {
    key: "forms",
    name: "Biểu mẫu in",
    icon: "print",
    permissions: [
      {
        code: PERMISSIONS.formsSettings,
        name: "Cài đặt biểu mẫu & mức chi",
        description:
          "Sửa tên đơn vị, họ tên người ký trên phiếu in (Chủ tịch, Kế toán, Người lập) và mức chi thăm hỏi mặc định theo từng loại sự việc.",
      },
    ],
  },
  {
    key: "popups",
    name: "Popup thông báo",
    icon: "notification_important",
    permissions: [
      {
        code: PERMISSIONS.popupsManage,
        name: "Đăng & quản lý popup",
        description:
          "Đăng tin gấp dạng popup nội dung ngắn, hẹn giờ hiện / hết hạn, chọn đối tượng và tần suất hiện, bật / tắt, xem số người đã xem.",
      },
    ],
  },
];

const PERMISSION_INDEX = new Map(
  PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => [p.code, p] as const)),
);

const PERMISSION_MODULE_INDEX = new Map(
  PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => [p.code, m] as const)),
);

export function isKnownPermission(code: string): boolean {
  return PERMISSION_INDEX.has(code);
}

/** "Danh sách nhân viên: Xem danh sách" — mã không còn trong danh mục thì trả nguyên mã. */
export function getPermissionLabel(code: string): string {
  const def = PERMISSION_INDEX.get(code);
  const mod = PERMISSION_MODULE_INDEX.get(code);
  return def && mod ? `${mod.name}: ${def.name}` : code;
}

/** Lọc mã không có trong danh mục và bổ sung các quyền bắt buộc đi kèm. */
export function normalizePermissionCodes(codes: readonly string[]): string[] {
  const result = new Set<string>();
  const visit = (code: string) => {
    const def = PERMISSION_INDEX.get(code);
    if (!def || result.has(code)) return;
    result.add(code);
    def.requires?.forEach(visit);
  };
  codes.forEach(visit);
  return [...result].sort();
}

/** Các quyền phụ thuộc vào `code` (bỏ tick `code` thì bỏ luôn các quyền này). */
export function dependentPermissions(code: string): string[] {
  const result = new Set<string>();
  const visit = (target: string) => {
    for (const def of PERMISSION_INDEX.values()) {
      if (def.requires?.includes(target) && !result.has(def.code)) {
        result.add(def.code);
        visit(def.code);
      }
    }
  };
  visit(code);
  return [...result];
}

export type AccessRole = { id: string; name: string };

export type AccessInfo = {
  isAdmin: boolean;
  isApproved: boolean;
  permissions: string[];
  roles: AccessRole[];
};

export const EMPTY_ACCESS: AccessInfo = {
  isAdmin: false,
  isApproved: false,
  permissions: [],
  roles: [],
};

export function parseAccess(raw: unknown): AccessInfo {
  if (!raw || typeof raw !== "object") return EMPTY_ACCESS;
  const data = raw as Record<string, unknown>;
  return {
    isAdmin: data.is_admin === true,
    isApproved: data.is_approved === true,
    permissions: Array.isArray(data.permissions)
      ? data.permissions.filter((p): p is string => typeof p === "string")
      : [],
    roles: Array.isArray(data.roles) ? (data.roles as AccessRole[]) : [],
  };
}

export function hasPermission(access: AccessInfo, code: PermissionCode): boolean {
  if (!access.isApproved) return false;
  return access.isAdmin || access.permissions.includes(code);
}

/** Công cụ hiển thị ở trang tổng quan /admin của cấp quản lý (không phải admin), lọc theo quyền. */
export type OfficeTool = {
  href: string;
  title: string;
  description: string;
  icon: string;
  permission: PermissionCode;
};

export const OFFICE_TOOLS: OfficeTool[] = [
  {
    href: "/admin/employees",
    title: "Danh sách nhân viên",
    description: "Tra cứu nhân viên được phép đăng ký và trạng thái tài khoản.",
    icon: "badge",
    permission: PERMISSIONS.employeesView,
  },
  {
    href: "/admin/members",
    title: "Hồ sơ đoàn viên",
    description: "Tra cứu hồ sơ, tình trạng khai báo, thông tin con của đoàn viên.",
    icon: "contact_page",
    permission: PERMISSIONS.membersView,
  },
  {
    href: "/admin/administration/gifts/children",
    title: "Quà thiếu nhi",
    description: "Một nút lọc con đoàn viên dưới 16 tuổi theo mốc ngày, in danh sách ký nhận và xuất Excel.",
    icon: "redeem",
    permission: PERMISSIONS.giftsChildren,
  },
  {
    href: "/admin/administration/rewards",
    title: "Thanh toán thưởng",
    description: "Danh sách nhận thưởng của chương trình bình chọn đã kết thúc: số tài khoản, số tiền, in và xuất Excel.",
    icon: "payments",
    permission: PERMISSIONS.rewardsPayout,
  },
  {
    href: "/admin/administration/life-events",
    title: "Tin báo của đoàn viên",
    description: "Tin vui, tin ốm, khó khăn đoàn viên gửi lên: xem giấy tờ, tiếp nhận, ghi chú.",
    icon: "campaign",
    permission: PERMISSIONS.lifeEventsView,
  },
  {
    href: "/admin/administration/visits",
    title: "Đề nghị thăm hỏi",
    description: "Lập đề nghị thăm hỏi từ tin báo, duyệt, xác nhận đã chi và in phiếu thăm hỏi theo mẫu C11-TLĐ.",
    icon: "volunteer_activism",
    permission: PERMISSIONS.visitsView,
  },
  {
    href: "/admin/administration/payments",
    title: "Đề nghị thanh toán",
    description: "Lập giấy đề nghị thanh toán (gom phiếu thăm hỏi đã duyệt), duyệt, xác nhận đã chi và tải phiếu Excel theo mẫu.",
    icon: "request_quote",
    permission: PERMISSIONS.paymentsView,
  },
  {
    href: "/admin/finance/ledger",
    title: "Sổ quỹ công đoàn",
    description: "Số dư quỹ tiền mặt / ngân hàng, phiếu thu – chi, chuyển quỹ, khóa sổ và xuất sổ quỹ Excel.",
    icon: "account_balance_wallet",
    permission: PERMISSIONS.financeView,
  },
  {
    href: "/admin/finance/catalogs",
    title: "Quản lý danh mục",
    description: "Danh mục thu – chi và danh mục đối tượng (công ty, cá nhân: MST, số tài khoản, ngân hàng) dùng cho sổ quỹ và đề nghị thanh toán.",
    icon: "category",
    permission: PERMISSIONS.catalogsManage,
  },
  {
    href: "/admin/finance/reports",
    title: "Báo cáo tổng hợp",
    description: "Thu – chi theo danh mục, số dư quỹ, thăm hỏi và đề nghị thanh toán theo tháng / quý / năm, xuất Excel.",
    icon: "monitoring",
    permission: PERMISSIONS.reportsView,
  },
  {
    href: "/admin/finance/regulations",
    title: "Quy chế chi tiêu",
    description: "Soạn và cập nhật Quy chế chi tiêu theo Chương / Điều (chỉ quản trị và người có quyền quản lý quỹ xem).",
    icon: "gavel",
    permission: PERMISSIONS.financeManage,
  },
  {
    href: "/admin/administration/print-settings",
    title: "Cài đặt biểu mẫu in",
    description: "Tên đơn vị, người ký trên phiếu in và mức chi thăm hỏi mặc định.",
    icon: "print",
    permission: PERMISSIONS.formsSettings,
  },
  {
    href: "/admin/union-settings",
    title: "Cài đặt công đoàn",
    description: "Danh sách cán bộ công đoàn, chức danh và nhiệm kỳ dùng trong văn bản, biên bản họp.",
    icon: "badge",
    permission: PERMISSIONS.formsSettings,
  },
  {
    href: "/admin/content/albums",
    title: "Quản lý album ảnh",
    description: "Tạo album, cài đặt thời gian và điểm thưởng đăng ảnh, kiểm duyệt ảnh và bình luận.",
    icon: "photo_library",
    permission: PERMISSIONS.albumsManage,
  },
  {
    href: "/admin/content/posts",
    title: "Đăng & sửa bài viết",
    description: "Đăng bài viết mới, sửa bài, đánh dấu thông báo quan trọng, ẩn / hiện bài.",
    icon: "newspaper",
    permission: PERMISSIONS.postsManage,
  },
  {
    href: "/admin/documents/templates",
    title: "Mẫu văn bản",
    description: "Thư viện mẫu Quyết định, Quy định, Biên bản làm việc, Biên bản cuộc họp với các chỗ trống cần điền.",
    icon: "description",
    permission: PERMISSIONS.postsManage,
  },
  {
    href: "/admin/documents/compose",
    title: "Soạn văn bản",
    description: "Chọn mẫu, điền thông tin theo form, lưu nháp và xuất file Word (.docx).",
    icon: "edit_document",
    permission: PERMISSIONS.postsManage,
  },
  {
    href: "/admin/documents/registry",
    title: "Sổ văn bản",
    description: "Văn bản đã ban hành: số, ngày ban hành, bản scan đã ký, tải lại .docx.",
    icon: "menu_book",
    permission: PERMISSIONS.postsManage,
  },
  {
    href: "/admin/polls",
    title: "Quản lý bình chọn",
    description: "Tạo, sửa, mở / đóng chương trình bình chọn và tổng kết trao điểm.",
    icon: "how_to_vote",
    permission: PERMISSIONS.pollsManage,
  },
  {
    href: "/admin/popups",
    title: "Popup thông báo",
    description: "Đăng tin gấp nội dung ngắn hiện dạng popup, hẹn giờ hiện và hết hạn, xem số người đã xem.",
    icon: "notification_important",
    permission: PERMISSIONS.popupsManage,
  },
];

export type AdminRoutePermission = {
  prefix: string;
  /** Chỉ cần một trong các quyền này. */
  permissions: PermissionCode[];
  /** Chỉ áp dụng đúng đường dẫn prefix, không áp dụng cho trang con. */
  exact?: boolean;
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionCode[];

/** Các trang trong /admin mở cho người có quyền (trang /admin khác vẫn chỉ dành cho admin). Khớp đường dẫn dài nhất. */
export const ADMIN_ROUTE_PERMISSIONS: AdminRoutePermission[] = [
  // Trang tổng quan và trang hub: chỉ là lối vào, mỗi ô bên trong vẫn lọc theo quyền riêng
  { prefix: "/admin", permissions: ALL_PERMISSIONS, exact: true },
  {
    prefix: "/admin/members-hub",
    permissions: [PERMISSIONS.membersView, PERMISSIONS.employeesView],
    exact: true,
  },
  { prefix: "/admin/competition", permissions: [PERMISSIONS.pollsManage], exact: true },
  {
    prefix: "/admin/content",
    permissions: [PERMISSIONS.postsManage, PERMISSIONS.albumsManage, PERMISSIONS.popupsManage],
    exact: true,
  },
  {
    prefix: "/admin/administration",
    permissions: [
      PERMISSIONS.lifeEventsView,
      PERMISSIONS.visitsView,
      PERMISSIONS.paymentsView,
      PERMISSIONS.rewardsPayout,
      PERMISSIONS.giftsChildren,
      PERMISSIONS.formsSettings,
    ],
    exact: true,
  },
  {
    prefix: "/admin/finance",
    permissions: [
      PERMISSIONS.financeView,
      PERMISSIONS.reportsView,
      PERMISSIONS.catalogsManage,
      PERMISSIONS.financeManage,
    ],
    exact: true,
  },
  { prefix: "/admin/system", permissions: [PERMISSIONS.formsSettings], exact: true },
  { prefix: "/admin/employees", permissions: [PERMISSIONS.employeesView] },
  { prefix: "/admin/members", permissions: [PERMISSIONS.membersView] },
  { prefix: "/admin/polls", permissions: [PERMISSIONS.pollsManage] },
  { prefix: "/admin/popups", permissions: [PERMISSIONS.popupsManage] },
  { prefix: "/admin/content/guides", permissions: [PERMISSIONS.postsManage] },
  { prefix: "/admin/content/posts", permissions: [PERMISSIONS.postsManage] },
  // Tổng hợp ảnh dự thi trong bình luận: như trước, chỉ admin
  { prefix: "/admin/content/posts/submissions", permissions: [] },
  { prefix: "/admin/content/albums", permissions: [PERMISSIONS.albumsManage] },
  { prefix: "/admin/administration/life-events", permissions: [PERMISSIONS.lifeEventsView] },
  { prefix: "/admin/administration/visits", permissions: [PERMISSIONS.visitsView] },
  { prefix: "/admin/administration/payments", permissions: [PERMISSIONS.paymentsView] },
  { prefix: "/admin/administration/rewards", permissions: [PERMISSIONS.rewardsPayout] },
  { prefix: "/admin/administration/gifts", permissions: [PERMISSIONS.giftsChildren] },
  { prefix: "/admin/administration/print-settings", permissions: [PERMISSIONS.formsSettings] },
  { prefix: "/admin/finance/ledger", permissions: [PERMISSIONS.financeView] },
  { prefix: "/admin/finance/settings", permissions: [PERMISSIONS.financeManage] },
  { prefix: "/admin/finance/reports", permissions: [PERMISSIONS.reportsView] },
  { prefix: "/admin/finance/catalogs", permissions: [PERMISSIONS.catalogsManage] },
  { prefix: "/admin/finance/regulations", permissions: [PERMISSIONS.financeManage] },
  { prefix: "/admin/documents", permissions: [PERMISSIONS.postsManage] },
  { prefix: "/admin/union-settings", permissions: [PERMISSIONS.formsSettings] },
];

/** Quyền (một trong số) mở được trang /admin này cho người không phải admin; null = chỉ admin. */
export function findAdminRoutePermissions(pathname: string): PermissionCode[] | null {
  const match = ADMIN_ROUTE_PERMISSIONS.filter((r) =>
    r.exact ? pathname === r.prefix : pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.permissions ?? null;
}

/** Cùng quy tắc với middleware: admin vào mọi trang /admin, người khác theo ADMIN_ROUTE_PERMISSIONS. */
export function canAccessAdminPath(access: AccessInfo, pathname: string): boolean {
  if (!access.isApproved) return false;
  if (access.isAdmin) return true;
  const path = pathname.split(/[?#]/)[0];
  const permissions = findAdminRoutePermissions(path);
  return permissions !== null && permissions.some((code) => hasPermission(access, code));
}

/** Ô trên trang hub / tổng quan: còn quyền riêng của ô và (nếu là trang /admin) mở được trang đó. */
export function visibleAdminLinks<T extends { href: string; allowed: boolean }>(access: AccessInfo, items: T[]): T[] {
  return items.filter(
    (item) =>
      item.allowed &&
      (!/^\/admin(\/|$|\?|#)/.test(item.href) || canAccessAdminPath(access, item.href)),
  );
}
