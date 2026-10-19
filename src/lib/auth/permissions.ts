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
];

/** Các trang trong /admin mở cho người có quyền (trang /admin khác vẫn chỉ dành cho admin). */
export const ADMIN_ROUTE_PERMISSIONS: { prefix: string; permission: PermissionCode }[] = [
  { prefix: "/admin/employees", permission: PERMISSIONS.employeesView },
];

export function findAdminRoutePermission(pathname: string): PermissionCode | null {
  const match = ADMIN_ROUTE_PERMISSIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return match?.permission ?? null;
}
