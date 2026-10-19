"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { resizeImageToBlob } from "@/lib/image-resize";
import {
  CATEGORY_BY_KEY,
  LIFE_EVENT_LIMITS,
  RELATION_LABEL,
  parseLifeEventInput,
  typesOfCategory,
  type LifeEventCategory,
  type Relation,
} from "@/lib/life-events/registry";

type Props = { category: LifeEventCategory; today: string };

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 py-2.5 text-sm outline-none focus:border-[#173A67]";

type PendingFile = { key: string; file: File; preview: string | null };

/** Nén ảnh (giữ PDF nguyên), trả về File sẵn sàng tải lên. */
export async function prepareUpload(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  const blob = await resizeImageToBlob(file, 2000, 0.85);
  if (blob === file) return file;
  const name = file.name.replace(/\.[^.]+$/, "") || "giay-to";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}

export async function uploadAttachment(eventId: string, file: File): Promise<string | null> {
  const prepared = await prepareUpload(file);
  if (prepared.size > LIFE_EVENT_LIMITS.maxFileBytes) return `${file.name}: tệp lớn hơn 4 MB.`;
  const body = new FormData();
  body.append("file", prepared);
  const res = await fetch(`/api/life-events/${eventId}/attachments`, { method: "POST", body });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return `${file.name}: ${data.error ?? "lỗi tải lên"}`;
}

export function acceptedFile(file: File): boolean {
  return file.type.startsWith("image/") || file.type === "application/pdf";
}

export function LifeEventForm({ category, today }: Props) {
  const router = useRouter();
  const cat = CATEGORY_BY_KEY[category];
  const types = useMemo(() => typesOfCategory(category), [category]);

  const [eventType, setEventType] = useState(types.length === 1 ? types[0].code : "");
  const type = types.find((t) => t.code === eventType);
  const [relation, setRelation] = useState<Relation | "">("");
  const [subjectName, setSubjectName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const effectiveRelation: Relation | "" = type?.relations.length === 1 ? type.relations[0] : relation;
  const showName = Boolean(type && effectiveRelation && effectiveRelation !== "self" && type.subjectNameLabel);

  function chooseType(code: string) {
    setEventType(code);
    const next = types.find((t) => t.code === code);
    if (next && relation && !next.relations.includes(relation)) setRelation("");
    setErrors([]);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = LIFE_EVENT_LIMITS.maxAttachments - files.length;
    const picked = [...list].filter(acceptedFile).slice(0, Math.max(0, room));
    setFiles((prev) => [
      ...prev,
      ...picked.map((file) => ({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    ]);
  }

  function removeFile(key: string) {
    setFiles((prev) => {
      const target = prev.find((f) => f.key === key);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.key !== key);
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      category,
      eventType,
      relation: effectiveRelation,
      subjectName: showName ? subjectName : "",
      eventDate,
      location,
      description,
    };
    const parsed = parseLifeEventInput(payload, today);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    setProgress("Đang gửi tin báo...");
    try {
      const res = await fetch("/api/life-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors([data.error ?? "Không gửi được tin báo."]);
        return;
      }

      const failed: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(`Đang tải ảnh ${i + 1}/${files.length}...`);
        const err = await uploadAttachment(data.id, files[i].file);
        if (err) failed.push(err);
      }
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      const query = failed.length ? `?uploadFailed=${failed.length}` : "?sent=1";
      router.push(`/life-events/${data.id}${query}`);
      router.refresh();
    } catch {
      setErrors(["Mất kết nối, vui lòng thử lại."]);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${cat.tone}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80">
          <MaterialIcon className="text-[28px]" name={cat.icon} />
        </div>
        <div>
          <h1 className="text-lg font-extrabold">{cat.label}</h1>
          <p className="text-xs opacity-80">{cat.hint}</p>
        </div>
      </div>

      {types.length > 1 ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-bold text-[#173A67]">Sự việc</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {types.map((t) => (
              <label
                key={t.code}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
                  eventType === t.code
                    ? "border-[#173A67] bg-[#173A67]/5 text-[#173A67]"
                    : "border-outline-variant bg-white hover:border-[#173A67]/50"
                }`}
              >
                <input
                  checked={eventType === t.code}
                  className="accent-[#173A67]"
                  name="eventType"
                  type="radio"
                  onChange={() => chooseType(t.code)}
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {type ? (
        <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
          {type.relations.length > 1 ? (
            <label className="block space-y-1">
              <span className="text-sm font-bold text-[#173A67]">Người liên quan</span>
              <select
                className={inputClass}
                value={relation}
                onChange={(e) => setRelation(e.target.value as Relation)}
              >
                <option value="">— Chọn —</option>
                {type.relations.map((r) => (
                  <option key={r} value={r}>
                    {RELATION_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {showName ? (
            <label className="block space-y-1">
              <span className="text-sm font-bold text-[#173A67]">
                {type.subjectNameLabel}
                {type.subjectNameOptional ? null : <span className="text-error"> *</span>}
              </span>
              <input
                className={inputClass}
                maxLength={LIFE_EVENT_LIMITS.subjectName}
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
              />
            </label>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-bold text-[#173A67]">
                {type.dateLabel}
                <span className="text-error"> *</span>
              </span>
              <input
                className={inputClass}
                max={type.category === "happy" ? undefined : today}
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </label>
            {type.locationLabel ? (
              <label className="block space-y-1">
                <span className="text-sm font-bold text-[#173A67]">{type.locationLabel}</span>
                <input
                  className={inputClass}
                  maxLength={LIFE_EVENT_LIMITS.location}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
            ) : null}
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-bold text-[#173A67]">Lời nhắn / mô tả thêm</span>
            <textarea
              className={`${inputClass} min-h-[90px]`}
              maxLength={LIFE_EVENT_LIMITS.description}
              placeholder="Không bắt buộc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

        </div>
      ) : null}

      <div className="space-y-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-[#173A67]">
          <MaterialIcon className="text-[20px]" name="attach_file" />
          Ảnh đính kèm (bằng chứng)
        </p>
        <p className="text-xs text-on-surface-variant">
          {type ? type.attachmentHint : "Ảnh giấy tờ, ảnh hiện trường hoặc giấy xác nhận liên quan"}. Chụp trực tiếp
          bằng điện thoại hoặc chọn ảnh / PDF (tối đa {LIFE_EVENT_LIMITS.maxAttachments} tệp). Chỉ Ban chấp hành xem
          được.
        </p>
        <div className="flex flex-wrap gap-2">
              {files.map((f) => (
                <div
                  key={f.key}
                  className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-white"
                >
                  {f.preview ? (
                    <img alt={f.file.name} className="h-full w-full object-cover" src={f.preview} />
                  ) : (
                    <div className="flex flex-col items-center gap-1 px-1 text-center text-[10px] text-on-surface-variant">
                      <MaterialIcon className="text-[28px] text-red-600" name="picture_as_pdf" />
                      <span className="line-clamp-2 break-all">{f.file.name}</span>
                    </div>
                  )}
                  <button
                    aria-label="Bỏ tệp"
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                    type="button"
                    onClick={() => removeFile(f.key)}
                  >
                    <MaterialIcon className="text-[16px]" name="close" />
                  </button>
                </div>
              ))}
              {files.length < LIFE_EVENT_LIMITS.maxAttachments ? (
                <>
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-outline-variant text-xs font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]">
                    <MaterialIcon className="text-[26px]" name="photo_camera" />
                    Chụp ảnh
                    <input
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      type="file"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-outline-variant text-xs font-semibold text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]">
                    <MaterialIcon className="text-[26px]" name="upload_file" />
                    Chọn tệp
                    <input
                      multiple
                      accept="image/*,application/pdf"
                      className="hidden"
                      type="file"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </>
              ) : null}
        </div>
      </div>

      {errors.length ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-on-error-container">
          {errors.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      ) : null}

      <button
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#173A67] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#1E4A7D] disabled:opacity-60"
        disabled={!type || submitting}
        type="submit"
      >
        <MaterialIcon className="text-[20px]" name={submitting ? "progress_activity" : "send"} />
        {progress ?? "Gửi tin báo"}
      </button>
    </form>
  );
}
