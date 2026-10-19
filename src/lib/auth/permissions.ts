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
  albumsManage: "albums.manage",
  postsManage: "posts.manage",
  pollsManage: "polls.manage",
  giftsChildren: "gifts.children",
  lifeEventsView: "life_events.view",
  lifeEventsHandle: "life_events.handle",
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
          "Xem mọi tin vui / tin buồn / tin ốm đoàn viên gửi lên, kèm ảnh giấy tờ, và nhận thông báo khi có tin mới.",
      },
      {
        code: PERMISSIONS.lifeEventsHandle,
        name: "Tiếp nhận & ghi chú",
        description: "Bấm “Tiếp nhận” (đoàn viên được báo lại), ghi chú xử lý, bổ sung ảnh giấy tờ.",
        requires: [PERMISSIONS.lifeEventsView],
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

/** Công cụ hiển thị ở trang "Khu vực quản lý" (/office), lọc theo quyền. */
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
    href: "/office/members",
    title: "Hồ sơ đoàn viên",
    description: "Tra cứu hồ sơ, tình trạng khai báo, thông tin con của đoàn viên.",
    icon: "contact_page",
    permission: PERMISSIONS.membersView,
  },
  {
    href: "/office/gifts/children",
    title: "Quà thiếu nhi",
    description: "Một nút lọc con đoàn viên dưới 16 tuổi theo mốc ngày, in danh sách ký nhận và xuất Excel.",
    icon: "redeem",
    permission: PERMISSIONS.giftsChildren,
  },
  {
    href: "/office/life-events",
    title: "Tin báo của đoàn viên",
    description: "Tin vui, tin buồn, tin ốm đoàn viên gửi lên: xem giấy tờ, tiếp nhận, ghi chú.",
    icon: "campaign",
    permission: PERMISSIONS.lifeEventsView,
  },
  {
    href: "/albums",
    title: "Quản lý album ảnh",
    description: "Tạo album, cài đặt thời gian và điểm thưởng đăng ảnh, kiểm duyệt ảnh và bình luận.",
    icon: "photo_library",
    permission: PERMISSIONS.albumsManage,
  },
  {
    href: "/posts",
    title: "Đăng & sửa bài viết",
    description: "Đăng bài viết mới, sửa bài, đánh dấu thông báo quan trọng, ẩn / hiện bài.",
    icon: "newspaper",
    permission: PERMISSIONS.postsManage,
  },
  {
    href: "/admin/polls",
    title: "Quản lý bình chọn",
    description: "Tạo, sửa, mở / đóng chương trình bình chọn và tổng kết trao điểm.",
    icon: "how_to_vote",
    permission: PERMISSIONS.pollsManage,
  },
];

/** Các trang trong /admin mở cho người có quyền (trang /admin khác vẫn chỉ dành cho admin). */
export const ADMIN_ROUTE_PERMISSIONS: { prefix: string; permission: PermissionCode }[] = [
  { prefix: "/admin/employees", permission: PERMISSIONS.employeesView },
  { prefix: "/admin/polls", permission: PERMISSIONS.pollsManage },
];

export function findAdminRoutePermission(pathname: string): PermissionCode | null {
  const match = ADMIN_ROUTE_PERMISSIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return match?.permission ?? null;
}
