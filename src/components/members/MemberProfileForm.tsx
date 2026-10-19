"use client";

import { useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  GENDER_LABEL,
  ID_ISSUE_PLACE_SUGGESTIONS,
  MARITAL_STATUS_LABEL,
  MAX_CHILDREN,
  PROFILE_POINTS_PER_ITEM,
  ageAt,
  formatDateVi,
  normalizeChildren,
  normalizeDetails,
  profileCompleteness,
  validateProfile,
  type Gender,
  type MaritalStatus,
  type MemberChild,
  type MemberDetails,
  type MemberProfileData,
} from "@/lib/members/profile-shared";

type Props = {
  initial: MemberProfileData;
  /** Có giá trị khi người quản lý xem/sửa hồ sơ của đoàn viên khác. */
  targetUserId?: string;
  readOnly?: boolean;
};

type ChildDraft = MemberChild & { key: string };

const BANK_SUGGESTIONS = [
  "Vietcombank",
  "VietinBank",
  "BIDV",
  "Agribank",
  "Techcombank",
  "MB Bank",
  "ACB",
  "VPBank",
  "TPBank",
  "Sacombank",
  "HDBank",
  "VIB",
  "SHB",
  "OCB",
  "MSB",
  "SeABank",
  "Eximbank",
  "LPBank",
  "Nam A Bank",
  "Bac A Bank",
];

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-[#173A67] disabled:bg-surface-container-low disabled:text-on-surface-variant";
const labelClass = "mb-1 block text-label-md font-semibold text-on-surface";
const sectionClass = "rounded-2xl border border-outline-variant bg-surface-container-lowest p-5";

function toDrafts(children: MemberChild[]): ChildDraft[] {
  return children.map((c, i) => ({ ...c, key: c.id ?? `new-${i}` }));
}

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function MemberProfileForm({ initial, targetUserId, readOnly = false }: Props) {
  const [profile, setProfile] = useState(initial);
  const [details, setDetails] = useState<MemberDetails>(initial.details);
  const [children, setChildren] = useState<ChildDraft[]>(toDrafts(initial.children));
  const [idNumber, setIdNumber] = useState("");
  const [issueDate, setIssueDate] = useState(initial.identity.issue_date ?? "");
  const [issuePlace, setIssuePlace] = useState(initial.identity.issue_place ?? "");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const isSelf = !targetUserId;
  const needConsent = isSelf && !profile.consentAt && !readOnly;
  const hasStoredId = Boolean(profile.identity.masked);
  const today = todayIso();

  const completeness = useMemo(
    () =>
      profileCompleteness(
        normalizeDetails(details),
        hasStoredId || idNumber.trim().length === 12,
        children.filter((c) => c.full_name.trim() && c.date_of_birth).length,
      ),
    [details, hasStoredId, idNumber, children],
  );

  function setField<K extends keyof MemberDetails>(field: K, value: MemberDetails[K]) {
    setDetails((prev) => ({ ...prev, [field]: value }));
  }

  function updateChild(key: string, patch: Partial<MemberChild>) {
    setChildren((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function addChild() {
    setField("no_children", false);
    setChildren((prev) => [
      ...prev,
      { key: `new-${Date.now()}`, full_name: "", date_of_birth: "", gender: null, note: null },
    ]);
  }

  function removeChild(child: ChildDraft) {
    if (child.id && !window.confirm(`Xóa thông tin con "${child.full_name}"?`)) return;
    setChildren((prev) => prev.filter((c) => c.key !== child.key));
  }

  async function handleSave() {
    setSuccess(null);
    const payloadDetails = normalizeDetails(details);
    const payloadChildren = normalizeChildren(children.map(({ key: _key, ...c }) => c));
    const identity = {
      id_number: idNumber.replace(/\s+/g, ""),
      issue_date: issueDate || null,
      issue_place: issuePlace.trim() || null,
    };

    const clientErrors = validateProfile(payloadDetails, payloadChildren, identity, hasStoredId);
    if (needConsent && !consent) {
      clientErrors.unshift("Vui lòng tick đồng ý cho Công đoàn lưu trữ và sử dụng thông tin cá nhân.");
    }
    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      return;
    }

    setErrors([]);
    setSaving(true);
    try {
      const res = await fetch("/api/members/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          details: payloadDetails,
          children: payloadChildren,
          identity,
          consent: needConsent ? consent : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        errors?: string[];
        changed?: number;
        awardedPoints?: number;
        awardedLabels?: string[];
        profile?: MemberProfileData;
      };
      if (!res.ok) {
        setErrors(data.errors?.length ? data.errors : [data.error || "Không lưu được hồ sơ."]);
        return;
      }
      if (data.profile) {
        setProfile(data.profile);
        setDetails(data.profile.details);
        setChildren(toDrafts(data.profile.children));
        setIssueDate(data.profile.identity.issue_date ?? "");
        setIssuePlace(data.profile.identity.issue_place ?? "");
      }
      setIdNumber("");
      const base = data.changed ? "Đã lưu hồ sơ." : "Không có thay đổi nào cần lưu.";
      const bonus = data.awardedPoints
        ? ` ${isSelf ? "Bạn" : "Đoàn viên"} được cộng ${data.awardedPoints} điểm thi đua (${(data.awardedLabels ?? []).join(", ")}).`
        : "";
      setSuccess(base + bonus);
    } catch {
      setErrors(["Mất kết nối, vui lòng thử lại."]);
    } finally {
      setSaving(false);
    }
  }

  const percent = Math.round((completeness.done / completeness.total) * 100);
  const awardedSet = new Set(profile.awardedItems);
  const earnedPoints = profile.awardedItems.length * PROFILE_POINTS_PER_ITEM;
  const maxPoints = completeness.total * PROFILE_POINTS_PER_ITEM;

  return (
    <div className="space-y-5">
      {/* Tổng quan */}
      <div className={sectionClass}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-fixed text-xl font-extrabold text-[#173A67]">
            {profile.user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={profile.user.full_name} className="h-full w-full object-cover" src={profile.user.avatar_url} />
            ) : (
              profile.user.full_name.slice(0, 1)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-[#173A67]">{profile.user.full_name}</p>
            <p className="text-sm text-on-surface-variant">
              {[profile.user.employee_code && `Mã NV: ${profile.user.employee_code}`, profile.user.department]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
          <div className="w-full sm:w-56">
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span>Mức độ hoàn thiện</span>
              <span className={percent === 100 ? "text-[#1B7F5C]" : "text-amber-700"}>
                {completeness.done}/{completeness.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className={`h-full rounded-full ${percent === 100 ? "bg-[#1B7F5C]" : "bg-amber-500"}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-surface-container-low p-3">
          <p className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#173A67]">
            <span className="flex items-center gap-1">
              <MaterialIcon className="text-[16px]" name="military_tech" />
              Điểm thi đua hoàn thiện hồ sơ: +{PROFILE_POINTS_PER_ITEM} điểm mỗi mục
            </span>
            <span>
              Đã nhận {earnedPoints}/{maxPoints} điểm
            </span>
          </p>
          <ul className="flex flex-wrap gap-2">
            {completeness.items.map((item) => {
              const awarded = awardedSet.has(item.key);
              const tone = awarded
                ? "border-[#1B7F5C]/40 bg-[#D9F2EC] text-[#1B7F5C]"
                : item.done
                  ? "border-[#173A67]/40 bg-primary-fixed text-[#173A67]"
                  : "border-amber-300 bg-amber-50 text-amber-800";
              const hint = awarded ? "đã nhận" : item.done ? "lưu để nhận" : "chưa khai";
              return (
                <li
                  key={item.key}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
                  title={hint}
                >
                  <MaterialIcon
                    className="text-[14px]"
                    name={awarded ? "check_circle" : item.done ? "schedule" : "radio_button_unchecked"}
                  />
                  {item.label} · +{PROFILE_POINTS_PER_ITEM}đ
                  <span className="font-normal opacity-80">({hint})</span>
                </li>
              );
            })}
          </ul>
        </div>
        {readOnly ? (
          <p className="mt-3 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
            Bạn đang ở chế độ chỉ xem.
          </p>
        ) : null}
      </div>

      {/* Thông tin cá nhân */}
      <section className={sectionClass}>
        <h2 className="mb-4 flex items-center gap-2 text-title-md font-bold text-[#173A67]">
          <MaterialIcon className="text-[22px]" name="person" />
          Thông tin cá nhân
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="dob">Ngày sinh</label>
            <input
              className={inputClass}
              disabled={readOnly}
              id="dob"
              max={today}
              type="date"
              value={details.date_of_birth ?? ""}
              onChange={(e) => setField("date_of_birth", e.target.value || null)}
            />
          </div>
          <div>
            <span className={labelClass}>Giới tính</span>
            <div className="flex gap-4 py-2">
              {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm">
                  <input
                    checked={details.gender === g}
                    className="h-4 w-4 accent-[#173A67]"
                    disabled={readOnly}
                    name="gender"
                    type="radio"
                    onChange={() => setField("gender", g)}
                  />
                  {GENDER_LABEL[g]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="phone">Số điện thoại</label>
            <input
              className={inputClass}
              disabled={readOnly}
              id="phone"
              inputMode="tel"
              placeholder="vd. 0912345678"
              value={details.phone ?? ""}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="marital">Tình trạng hôn nhân</label>
            <select
              className={inputClass}
              disabled={readOnly}
              id="marital"
              value={details.marital_status ?? ""}
              onChange={(e) => setField("marital_status", (e.target.value || null) as MaritalStatus | null)}
            >
              <option value="">— Chọn —</option>
              {(Object.keys(MARITAL_STATUS_LABEL) as MaritalStatus[]).map((m) => (
                <option key={m} value={m}>
                  {MARITAL_STATUS_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="permAddr">Địa chỉ thường trú</label>
            <input
              className={inputClass}
              disabled={readOnly}
              id="permAddr"
              placeholder="Số nhà, đường/thôn, xã/phường, tỉnh/thành phố"
              value={details.permanent_address ?? ""}
              onChange={(e) => setField("permanent_address", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="text-label-md font-semibold text-on-surface" htmlFor="curAddr">
                Địa chỉ hiện tại
              </label>
              {!readOnly ? (
                <button
                  className="text-xs font-semibold text-[#173A67] hover:underline"
                  type="button"
                  onClick={() => setField("current_address", details.permanent_address)}
                >
                  Giống địa chỉ thường trú
                </button>
              ) : null}
            </div>
            <input
              className={inputClass}
              disabled={readOnly}
              id="curAddr"
              value={details.current_address ?? ""}
              onChange={(e) => setField("current_address", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Gia đình & con */}
      <section className={sectionClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-title-md font-bold text-[#173A67]">
            <MaterialIcon className="text-[22px]" name="family_restroom" />
            Thông tin con ({children.length})
          </h2>
          {!readOnly && children.length < MAX_CHILDREN ? (
            <button
              className="flex items-center gap-1 rounded-xl border border-[#173A67] px-3 py-1.5 text-sm font-bold text-[#173A67] hover:bg-[#D9F2EC]"
              type="button"
              onClick={addChild}
            >
              <MaterialIcon className="text-[18px]" name="add" />
              Thêm con
            </button>
          ) : null}
        </div>
        {children.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">
              Thông tin này dùng để Công đoàn lập danh sách tặng quà cho các cháu. Nếu chưa có con,
              vui lòng tick xác nhận bên dưới để hoàn thành mục này.
            </p>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                checked={details.no_children}
                className="h-4 w-4 accent-[#173A67]"
                disabled={readOnly}
                type="checkbox"
                onChange={(e) => setField("no_children", e.target.checked)}
              />
              {isSelf ? "Tôi chưa có con" : "Đoàn viên chưa có con"}
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child, index) => (
              <div key={child.key} className="rounded-xl border border-outline-variant p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#173A67]">
                    Con thứ {index + 1}
                    {child.date_of_birth && child.date_of_birth <= today
                      ? ` · ${ageAt(child.date_of_birth, today)} tuổi`
                      : ""}
                  </span>
                  {!readOnly ? (
                    <button
                      className="text-xs font-bold text-error hover:underline"
                      type="button"
                      onClick={() => removeChild(child)}
                    >
                      Xóa
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_170px_140px]">
                  <input
                    aria-label="Họ tên con"
                    className={inputClass}
                    disabled={readOnly}
                    maxLength={100}
                    placeholder="Họ và tên"
                    value={child.full_name}
                    onChange={(e) => updateChild(child.key, { full_name: e.target.value })}
                  />
                  <input
                    aria-label="Ngày sinh con"
                    className={inputClass}
                    disabled={readOnly}
                    max={today}
                    type="date"
                    value={child.date_of_birth}
                    onChange={(e) => updateChild(child.key, { date_of_birth: e.target.value })}
                  />
                  <select
                    aria-label="Giới tính con"
                    className={inputClass}
                    disabled={readOnly}
                    value={child.gender ?? ""}
                    onChange={(e) => updateChild(child.key, { gender: (e.target.value || null) as Gender | null })}
                  >
                    <option value="">Giới tính</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CCCD */}
      <section className={sectionClass}>
        <h2 className="mb-1 flex items-center gap-2 text-title-md font-bold text-[#173A67]">
          <MaterialIcon className="text-[22px]" name="badge" />
          Căn cước công dân
        </h2>
        <p className="mb-4 text-xs text-on-surface-variant">
          Số CCCD được mã hóa khi lưu, không hiển thị đầy đủ trên website và chỉ dùng để in biểu mẫu
          khi Công đoàn cấp trên yêu cầu.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="idNumber">
              Số CCCD {hasStoredId ? <span className="font-normal text-on-surface-variant">(đã lưu: {profile.identity.masked})</span> : null}
            </label>
            {readOnly ? (
              <p className="py-2 text-sm">{profile.identity.masked ?? "Chưa khai"}</p>
            ) : (
              <input
                autoComplete="off"
                className={inputClass}
                id="idNumber"
                inputMode="numeric"
                maxLength={14}
                placeholder={hasStoredId ? "Để trống nếu không đổi số CCCD" : "12 chữ số"}
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.replace(/[^\d\s]/g, ""))}
              />
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="issueDate">Ngày cấp</label>
            <input
              className={inputClass}
              disabled={readOnly}
              id="issueDate"
              max={today}
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="issuePlace">Nơi cấp</label>
            <input
              className={inputClass}
              disabled={readOnly}
              id="issuePlace"
              list="idIssuePlaces"
              value={issuePlace}
              onChange={(e) => setIssuePlace(e.target.value)}
            />
            <datalist id="idIssuePlaces">
              {ID_ISSUE_PLACE_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        </div>
      </section>

      {/* Ngân hàng */}
      <section className={sectionClass}>
        <h2 className="mb-4 flex items-center gap-2 text-title-md font-bold text-[#173A67]">
          <MaterialIcon className="text-[22px]" name="account_balance" />
          Tài khoản ngân hàng
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="bankNo">Số tài khoản</label>
            <input
              autoComplete="off"
              className={inputClass}
              disabled={readOnly}
              id="bankNo"
              inputMode="numeric"
              value={details.bank_account_no ?? ""}
              onChange={(e) => setField("bank_account_no", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="bankName">Ngân hàng</label>
            <input
              className={inputClass}
              disabled={readOnly}
              id="bankName"
              list="bankNames"
              value={details.bank_name ?? ""}
              onChange={(e) => setField("bank_name", e.target.value)}
            />
            <datalist id="bankNames">
              {BANK_SUGGESTIONS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass} htmlFor="bankBranch">Chi nhánh (không bắt buộc)</label>
            <input
              className={inputClass}
              disabled={readOnly}
              id="bankBranch"
              value={details.bank_branch ?? ""}
              onChange={(e) => setField("bank_branch", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="bankHolder">Chủ tài khoản</label>
            <input
              className={`${inputClass} uppercase`}
              disabled={readOnly}
              id="bankHolder"
              placeholder="NGUYEN VAN A"
              value={details.bank_account_holder ?? ""}
              onChange={(e) => setField("bank_account_holder", e.target.value)}
            />
          </div>
        </div>
      </section>

      {!readOnly ? (
        <div className={`${sectionClass} space-y-3`}>
          {needConsent ? (
            <label className="flex items-start gap-3 text-sm">
              <input
                checked={consent}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#173A67]"
                type="checkbox"
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Tôi đồng ý cho Công đoàn lưu trữ và sử dụng các thông tin cá nhân trên cho mục đích
                hành chính công đoàn (lập danh sách, biểu mẫu, thăm hỏi, tặng quà). Thông tin chỉ người
                được phân quyền mới xem được.
              </span>
            </label>
          ) : null}

          {errors.length > 0 ? (
            <ul className="space-y-1 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
              {errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          ) : null}
          {success ? (
            <p className="rounded-xl bg-[#D9F2EC] px-4 py-2 text-sm text-[#173A67]">{success}</p>
          ) : null}

          <button
            className="w-full rounded-xl bg-[#173A67] px-5 py-3 font-bold text-white transition hover:shadow-md disabled:opacity-60"
            disabled={saving}
            type="button"
            onClick={() => void handleSave()}
          >
            {saving ? "Đang lưu..." : "Lưu hồ sơ"}
          </button>
        </div>
      ) : null}

      {/* Lịch sử */}
      <section className={sectionClass}>
        <button
          className="flex w-full items-center justify-between font-bold text-[#173A67]"
          type="button"
          onClick={() => setShowHistory((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <MaterialIcon className="text-[20px]" name="history" />
            Lịch sử thay đổi ({profile.history.length})
          </span>
          <MaterialIcon className="text-[20px]" name={showHistory ? "expand_less" : "expand_more"} />
        </button>
        {showHistory ? (
          profile.history.length === 0 ? (
            <p className="mt-3 text-sm text-on-surface-variant">Chưa có thay đổi nào.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {profile.history.map((h) => (
                <li key={h.id} className="rounded-xl bg-surface-container-low px-3 py-2 text-sm">
                  <p className="text-xs text-on-surface-variant">
                    {new Date(h.created_at).toLocaleString("vi-VN")} ·{" "}
                    {h.is_self ? "Tự cập nhật" : `Cập nhật bởi ${h.changed_by_name ?? "quản trị"}`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {h.changes.map((c, i) => (
                      <li key={i}>
                        <strong>{c.label}:</strong> {c.old ?? "—"} → {c.new ?? "—"}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
      <p className="text-center text-xs text-on-surface-variant">
        Cập nhật lần cuối: {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString("vi-VN") : "chưa có"}
        {profile.consentAt ? ` · Đã đồng ý xử lý dữ liệu ngày ${formatDateVi(profile.consentAt.slice(0, 10))}` : ""}
      </p>
    </div>
  );
}
