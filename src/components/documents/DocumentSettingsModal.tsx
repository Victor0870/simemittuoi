"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  DEFAULT_DOCUMENT_ORG_SETTINGS,
  DOC_SETTING_ITEM_LIMIT,
  DOC_SETTING_LIST_LIMIT,
  DOC_SETTING_TEXT_LIMIT,
  SYSTEM_SETTING_TOKENS,
  type DocumentOrgSettings,
} from "@/lib/documents/settings";

type Props = {
  initial: DocumentOrgSettings;
  onClose: () => void;
  onSaved: (settings: DocumentOrgSettings) => void;
};

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#173A67]";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";
const iconButton =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-[#173A67] disabled:opacity-30";

export function DocumentSettingsModal({ initial, onClose, onSaved }: Props) {
  const [values, setValues] = useState<DocumentOrgSettings>(initial);
  const [newBase, setNewBase] = useState("");
  const [newRecipient, setNewRecipient] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateBase(index: number, text: string) {
    setValues((v) => ({
      ...v,
      defaultBases: v.defaultBases.map((item, i) => (i === index ? text : item)),
    }));
  }

  function removeBase(index: number) {
    setValues((v) => ({
      ...v,
      defaultBases: v.defaultBases.filter((_, i) => i !== index),
    }));
  }

  function addBase() {
    const trimmed = newBase.trim();
    const item = trimmed
      ? /^căn cứ/i.test(trimmed)
        ? trimmed
        : `Căn cứ ${trimmed}`
      : "Căn cứ ";
    setValues((v) => ({
      ...v,
      defaultBases: [...v.defaultBases, item],
    }));
    setNewBase("");
  }

  function updateRecipient(index: number, text: string) {
    setValues((v) => ({
      ...v,
      defaultRecipients: v.defaultRecipients.map((item, i) => (i === index ? text : item)),
    }));
  }

  function removeRecipient(index: number) {
    setValues((v) => ({
      ...v,
      defaultRecipients: v.defaultRecipients.filter((_, i) => i !== index),
    }));
  }

  function addRecipient() {
    const trimmed = newRecipient.trim() || "Đơn vị nhận;";
    setValues((v) => ({
      ...v,
      defaultRecipients: [...v.defaultRecipients, trimmed],
    }));
    setNewRecipient("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/documents/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: DocumentOrgSettings;
      };
      if (!res.ok || !data.settings) {
        throw new Error(data.error || "Không lưu được cài đặt văn bản.");
      }
      onSaved(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được cài đặt văn bản.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      aria-labelledby="doc-settings-title"
      aria-modal="true"
      className="fixed inset-0 z-[130] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-bg shadow-xl sm:h-auto sm:max-h-[94dvh] sm:max-w-4xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant bg-white px-4 py-2.5">
          <MaterialIcon className="text-[22px] text-[#173A67]" name="settings" />
          <div>
            <h2 id="doc-settings-title" className="text-base font-extrabold text-[#173A67]">
              Cài đặt thông tin cố định của Đơn vị / Công đoàn
            </h2>
            <p className="text-[11px] text-on-surface-variant">
              Dùng chung cho tất cả mẫu văn bản; dễ dàng đổi sang Công ty / CĐCS khác mà không cần sửa từng mẫu.
            </p>
          </div>
          <button aria-label="Đóng" className={`${iconButton} ml-auto`} type="button" onClick={onClose}>
            <MaterialIcon className="text-[20px]" name="close" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
          <section className="rounded-xl border border-[#d2dfe9] bg-white p-3.5">
            <h3 className="mb-2.5 text-sm font-bold text-[#173A67]">
              1. Thông tin Công đoàn & Công ty (Phần tiêu đề cố định)
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Công đoàn cấp trên (Dòng 1 góc trái)</label>
                <input
                  className={inputClass}
                  maxLength={DOC_SETTING_TEXT_LIMIT}
                  placeholder="VD: CÔNG ĐOÀN KHU KINH TẾ HẢI PHÒNG"
                  value={values.parentUnionName}
                  onChange={(e) => setValues({ ...values, parentUnionName: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Tên CĐCS in hoa (Dòng 2 góc trái)</label>
                <input
                  className={inputClass}
                  maxLength={DOC_SETTING_TEXT_LIMIT}
                  placeholder="VD: CĐCS: CÔNG TY TNHH DẦU NHỜN IDEMITSU VIỆT NAM"
                  value={values.unionHeaderName}
                  onChange={(e) => setValues({ ...values, unionHeaderName: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Tên đầy đủ CĐCS (Dùng trong nội dung)</label>
                <input
                  className={inputClass}
                  maxLength={DOC_SETTING_TEXT_LIMIT}
                  placeholder="VD: Công đoàn cơ sở Công ty TNHH Dầu Nhờn Idemitsu Việt Nam"
                  value={values.unionFullName}
                  onChange={(e) => setValues({ ...values, unionFullName: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Tên Công ty (Dùng trong nội dung)</label>
                <input
                  className={inputClass}
                  maxLength={DOC_SETTING_TEXT_LIMIT}
                  placeholder="VD: Công ty TNHH Dầu Nhờn Idemitsu Việt Nam"
                  value={values.companyName}
                  onChange={(e) => setValues({ ...values, companyName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Địa danh mặc định</label>
                  <input
                    className={inputClass}
                    maxLength={80}
                    placeholder="VD: Hải Phòng"
                    value={values.defaultLocation}
                    onChange={(e) => setValues({ ...values, defaultLocation: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Đuôi ký hiệu QĐ</label>
                  <input
                    className={inputClass}
                    maxLength={60}
                    placeholder="VD: /QĐ-CĐCS"
                    value={values.decisionCodeSuffix}
                    onChange={(e) => setValues({ ...values, decisionCodeSuffix: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelClass}>Thẩm quyền ký</label>
                  <input
                    className={inputClass}
                    maxLength={120}
                    placeholder="TM. BCH CÔNG ĐOÀN"
                    value={values.signAuthority}
                    onChange={(e) => setValues({ ...values, signAuthority: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Chức danh ký</label>
                  <input
                    className={inputClass}
                    maxLength={120}
                    placeholder="CHỦ TỊCH"
                    value={values.signerTitle}
                    onChange={(e) => setValues({ ...values, signerTitle: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Họ tên người ký mặc định</label>
                  <input
                    className={inputClass}
                    maxLength={120}
                    placeholder="Để trống hoặc nhập tên"
                    value={values.signerName}
                    onChange={(e) => setValues({ ...values, signerName: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-[#ecf4ff] px-3 py-2 text-[11px] text-[#173A67]">
              <strong>Các biến cố định tự động thay thế trong mẫu:</strong>{" "}
              {SYSTEM_SETTING_TOKENS.map((t) => (
                <code key={t.token} className="mr-2 inline-block rounded bg-white px-1 py-0.5 font-mono">
                  {t.token}
                </code>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#d2dfe9] bg-white p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#173A67]">
                  2. Thư viện Căn cứ pháp lý & nội bộ mặc định ({values.defaultBases.length})
                </h3>
                <p className="text-[11px] text-on-surface-variant">
                  Danh sách các câu “Căn cứ…” chuẩn để bấm chèn nhanh (thêm/bớt) khi tạo hoặc sửa bất kỳ mẫu Quyết định nào.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              {values.defaultBases.map((base, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="w-5 text-center text-xs font-bold text-on-surface-variant">{idx + 1}</span>
                  <input
                    className={inputClass}
                    maxLength={DOC_SETTING_ITEM_LIMIT}
                    value={base}
                    onChange={(e) => updateBase(idx, e.target.value)}
                  />
                  <button
                    aria-label="Xóa căn cứ"
                    className={`${iconButton} hover:text-error`}
                    type="button"
                    onClick={() => removeBase(idx)}
                  >
                    <MaterialIcon className="text-[18px]" name="delete" />
                  </button>
                </div>
              ))}
              {values.defaultBases.length < DOC_SETTING_LIST_LIMIT ? (
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    className={inputClass}
                    maxLength={DOC_SETTING_ITEM_LIMIT}
                    placeholder="Nhập thêm câu Căn cứ chuẩn mới (VD: Căn cứ Luật Công đoàn...)"
                    value={newBase}
                    onChange={(e) => setNewBase(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBase();
                      }
                    }}
                  />
                  <button
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#173A67] px-2.5 py-1.5 text-xs font-bold text-[#173A67] hover:bg-[#ecf4ff]"
                    type="button"
                    onClick={addBase}
                  >
                    <MaterialIcon className="text-[16px]" name="add" />
                    Thêm căn cứ
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-[#d2dfe9] bg-white p-3.5">
            <h3 className="mb-1 text-sm font-bold text-[#173A67]">
              3. Nơi nhận mặc định ({values.defaultRecipients.length})
            </h3>
            <p className="mb-2 text-[11px] text-on-surface-variant">
              Các dòng trong mục “Nơi nhận:” ở góc trái cuối văn bản Quyết định.
            </p>
            <div className="space-y-1.5">
              {values.defaultRecipients.map((rec, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="w-5 text-center text-xs font-bold text-on-surface-variant">-</span>
                  <input
                    className={inputClass}
                    maxLength={DOC_SETTING_ITEM_LIMIT}
                    value={rec}
                    onChange={(e) => updateRecipient(idx, e.target.value)}
                  />
                  <button
                    aria-label="Xóa nơi nhận"
                    className={`${iconButton} hover:text-error`}
                    type="button"
                    onClick={() => removeRecipient(idx)}
                  >
                    <MaterialIcon className="text-[18px]" name="delete" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  className={inputClass}
                  maxLength={DOC_SETTING_ITEM_LIMIT}
                  placeholder="Thêm nơi nhận mặc định (VD: Ban Giám đốc Công ty;)"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                />
                <button
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#173A67] px-2.5 py-1.5 text-xs font-bold text-[#173A67] hover:bg-[#ecf4ff]"
                  type="button"
                  onClick={addRecipient}
                >
                  <MaterialIcon className="text-[16px]" name="add" />
                  Thêm nơi nhận
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-outline-variant bg-white px-4 py-2.5">
          <button
            className="text-xs font-semibold text-[#4a6b82] hover:text-[#173A67] hover:underline"
            type="button"
            onClick={() => setValues(DEFAULT_DOCUMENT_ORG_SETTINGS)}
          >
            Khôi phục mặc định (CDILV)
          </button>
          {error ? <p className="ml-2 text-xs font-semibold text-error">{error}</p> : null}
          <div className="ml-auto flex items-center gap-2">
            <button
              className="rounded-lg border border-outline-variant px-4 py-1.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
              type="button"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#173A67] px-4 py-1.5 text-sm font-bold text-white transition hover:bg-[#1E4A7D] disabled:opacity-60"
              disabled={saving}
              type="button"
              onClick={() => void save()}
            >
              <MaterialIcon className="text-[18px]" name="save" />
              {saving ? "Đang lưu…" : "Lưu cài đặt đơn vị"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
