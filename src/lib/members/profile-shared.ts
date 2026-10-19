/** Kiểu dữ liệu + kiểm tra hồ sơ đoàn viên, dùng chung cho form (client) và API (server). */

export type Gender = "male" | "female";
export type MaritalStatus = "single" | "married";

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
};

export const MARITAL_STATUS_LABEL: Record<MaritalStatus, string> = {
  single: "Độc thân",
  married: "Có gia đình",
};

export const ID_ISSUE_PLACE_SUGGESTIONS = [
  "Cục Cảnh sát quản lý hành chính về trật tự xã hội",
  "Bộ Công an",
];

export type MemberDetails = {
  date_of_birth: string | null;
  gender: Gender | null;
  phone: string | null;
  permanent_address: string | null;
  current_address: string | null;
  marital_status: MaritalStatus | null;
  no_children: boolean;
  bank_account_no: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_holder: string | null;
};

export const EMPTY_DETAILS: MemberDetails = {
  date_of_birth: null,
  gender: null,
  phone: null,
  permanent_address: null,
  current_address: null,
  marital_status: null,
  no_children: false,
  bank_account_no: null,
  bank_name: null,
  bank_branch: null,
  bank_account_holder: null,
};

export const DETAIL_FIELD_LABEL: Record<keyof MemberDetails, string> = {
  date_of_birth: "Ngày sinh",
  gender: "Giới tính",
  phone: "Số điện thoại",
  permanent_address: "Địa chỉ thường trú",
  current_address: "Địa chỉ hiện tại",
  marital_status: "Tình trạng hôn nhân",
  no_children: "Chưa có con",
  bank_account_no: "Số tài khoản ngân hàng",
  bank_name: "Ngân hàng",
  bank_branch: "Chi nhánh",
  bank_account_holder: "Chủ tài khoản",
};

export type MemberChild = {
  id?: string;
  full_name: string;
  date_of_birth: string;
  gender: Gender | null;
  note: string | null;
};

export type MemberIdentityView = {
  masked: string | null;
  issue_date: string | null;
  issue_place: string | null;
};

export type ProfileChange = { label: string; old: string | null; new: string | null };

export type ProfileHistoryEntry = {
  id: string;
  created_at: string;
  changed_by_name: string | null;
  is_self: boolean;
  changes: ProfileChange[];
};

export type MemberProfileData = {
  user: {
    id: string;
    full_name: string;
    employee_code: string | null;
    department: string | null;
    avatar_url: string | null;
  };
  details: MemberDetails;
  children: MemberChild[];
  identity: MemberIdentityView;
  consentAt: string | null;
  updatedAt: string | null;
  history: ProfileHistoryEntry[];
  /** Các mục đã được cộng điểm hoàn thiện hồ sơ. */
  awardedItems: ProfileItemKey[];
};

export type IdentityInput = {
  /** Để trống = giữ nguyên số đã lưu. */
  id_number?: string;
  issue_date: string | null;
  issue_place: string | null;
};

export type SaveProfilePayload = {
  userId?: string;
  details: MemberDetails;
  children: MemberChild[];
  identity: IdentityInput;
  consent?: boolean;
};

export const MAX_CHILDREN = 20;

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function ageAt(dateOfBirth: string, at: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ay, am, ad] = at.split("-").map(Number);
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age -= 1;
  return age;
}

const clean = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

/** Chuẩn hóa (bỏ khoảng trắng thừa, chuỗi rỗng → null, số điện thoại/STK chỉ giữ chữ số). */
export function normalizeDetails(input: Partial<MemberDetails>): MemberDetails {
  const digits = (v: string | null | undefined) => {
    const t = clean(v);
    return t ? t.replace(/[\s.\-]/g, "") : null;
  };
  return {
    date_of_birth: clean(input.date_of_birth),
    gender: input.gender === "male" || input.gender === "female" ? input.gender : null,
    phone: digits(input.phone),
    permanent_address: clean(input.permanent_address),
    current_address: clean(input.current_address),
    marital_status:
      input.marital_status && input.marital_status in MARITAL_STATUS_LABEL
        ? input.marital_status
        : null,
    no_children: input.no_children === true,
    bank_account_no: digits(input.bank_account_no),
    bank_name: clean(input.bank_name),
    bank_branch: clean(input.bank_branch),
    bank_account_holder: clean(input.bank_account_holder)?.toLocaleUpperCase("vi-VN") ?? null,
  };
}

export function normalizeChildren(input: MemberChild[]): MemberChild[] {
  return input.map((c) => ({
    ...(c.id ? { id: c.id } : {}),
    full_name: (c.full_name ?? "").trim().replace(/\s+/g, " "),
    date_of_birth: (c.date_of_birth ?? "").trim(),
    gender: c.gender === "male" || c.gender === "female" ? c.gender : null,
    note: clean(c.note),
  }));
}

/** Trả về danh sách lỗi (rỗng = hợp lệ). `hasStoredId`: đã có số CCCD lưu trước đó. */
export function validateProfile(
  details: MemberDetails,
  children: MemberChild[],
  identity: IdentityInput,
  hasStoredId: boolean,
): string[] {
  const errors: string[] = [];
  const today = todayIso();

  if (details.date_of_birth) {
    if (!isValidDate(details.date_of_birth)) errors.push("Ngày sinh không hợp lệ.");
    else if (ageAt(details.date_of_birth, today) < 15 || details.date_of_birth < "1940-01-01") {
      errors.push("Ngày sinh không hợp lệ (đoàn viên phải từ 15 tuổi trở lên).");
    }
  }
  if (details.phone && !/^0\d{9}$/.test(details.phone)) {
    errors.push("Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.");
  }
  if (details.bank_account_no && !/^\d{6,20}$/.test(details.bank_account_no)) {
    errors.push("Số tài khoản ngân hàng chỉ gồm chữ số (6–20 số).");
  }
  if (details.bank_account_no && !details.bank_name) {
    errors.push("Vui lòng nhập tên ngân hàng cho số tài khoản.");
  }
  for (const [field, max] of [
    ["permanent_address", 300],
    ["current_address", 300],
    ["bank_name", 100],
    ["bank_branch", 100],
    ["bank_account_holder", 100],
  ] as const) {
    const value = details[field];
    if (value && value.length > max) {
      errors.push(`${DETAIL_FIELD_LABEL[field]} tối đa ${max} ký tự.`);
    }
  }

  if (children.length > MAX_CHILDREN) errors.push(`Tối đa ${MAX_CHILDREN} con.`);
  if (details.no_children && children.length > 0) {
    errors.push('Đã nhập thông tin con, vui lòng bỏ chọn "Chưa có con".');
  }
  children.forEach((c, i) => {
    const label = `Con thứ ${i + 1}`;
    if (!c.full_name) errors.push(`${label}: vui lòng nhập họ tên.`);
    else if (c.full_name.length > 100) errors.push(`${label}: họ tên tối đa 100 ký tự.`);
    if (!c.date_of_birth || !isValidDate(c.date_of_birth)) {
      errors.push(`${label}: ngày sinh không hợp lệ.`);
    } else if (c.date_of_birth > today) {
      errors.push(`${label}: ngày sinh không được ở tương lai.`);
    }
  });

  const idNumber = (identity.id_number ?? "").replace(/\s+/g, "");
  if (idNumber && !/^\d{12}$/.test(idNumber)) {
    errors.push("Số CCCD phải gồm đúng 12 chữ số.");
  }
  if (!idNumber && !hasStoredId && (identity.issue_date || identity.issue_place)) {
    errors.push("Vui lòng nhập số CCCD.");
  }
  if (identity.issue_date) {
    if (!isValidDate(identity.issue_date)) errors.push("Ngày cấp CCCD không hợp lệ.");
    else if (identity.issue_date > today) errors.push("Ngày cấp CCCD không được ở tương lai.");
  }
  if (identity.issue_place && identity.issue_place.length > 200) {
    errors.push("Nơi cấp CCCD tối đa 200 ký tự.");
  }

  return errors;
}

export type ProfileItemKey =
  | "date_of_birth"
  | "gender"
  | "phone"
  | "permanent_address"
  | "marital_status"
  | "children"
  | "identity"
  | "bank";

export type ProfileItemStatus = { key: ProfileItemKey; label: string; done: boolean };

/** Điểm thưởng cho mỗi mục hồ sơ bắt buộc, chỉ cộng một lần / mục / người. */
export const PROFILE_POINTS_PER_ITEM = 5;

const PROFILE_AWARD_PREFIX = "profile_item_";

export function profileAwardLabel(key: ProfileItemKey): string {
  return `${PROFILE_AWARD_PREFIX}${key}`;
}

export function profileItemFromAwardLabel(label: string | null | undefined): ProfileItemKey | null {
  if (!label?.startsWith(PROFILE_AWARD_PREFIX)) return null;
  return label.slice(PROFILE_AWARD_PREFIX.length) as ProfileItemKey;
}

/** Các mục bắt buộc để coi là "đã khai đủ hồ sơ". "Thông tin con" đạt khi có ít nhất 1 con hoặc xác nhận chưa có con. */
export function profileCompleteness(
  details: MemberDetails,
  hasIdentity: boolean,
  childrenCount: number,
): { done: number; total: number; missing: string[]; items: ProfileItemStatus[] } {
  const items: ProfileItemStatus[] = [
    { key: "date_of_birth", label: DETAIL_FIELD_LABEL.date_of_birth, done: Boolean(details.date_of_birth) },
    { key: "gender", label: DETAIL_FIELD_LABEL.gender, done: Boolean(details.gender) },
    { key: "phone", label: DETAIL_FIELD_LABEL.phone, done: Boolean(details.phone) },
    {
      key: "permanent_address",
      label: DETAIL_FIELD_LABEL.permanent_address,
      done: Boolean(details.permanent_address),
    },
    { key: "marital_status", label: DETAIL_FIELD_LABEL.marital_status, done: Boolean(details.marital_status) },
    { key: "children", label: "Thông tin con", done: childrenCount > 0 || details.no_children },
    { key: "identity", label: "Số CCCD", done: hasIdentity },
    { key: "bank", label: "Tài khoản ngân hàng", done: Boolean(details.bank_account_no && details.bank_name) },
  ];
  return {
    done: items.filter((i) => i.done).length,
    total: items.length,
    missing: items.filter((i) => !i.done).map((i) => i.label),
    items,
  };
}

export const PROFILE_ITEM_COUNT = profileCompleteness(EMPTY_DETAILS, false, 0).total;

export function formatDateVi(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}
