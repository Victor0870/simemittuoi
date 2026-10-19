"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  PERMISSION_MODULES,
  dependentPermissions,
  getPermissionLabel,
  normalizePermissionCodes,
} from "@/lib/auth/permissions";
import type { PermissionLogRow, RoleWithDetails } from "@/lib/data/roles";

export type AssignableMember = {
  id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  role: string;
};

type Props = {
  roles: RoleWithDetails[];
  members: AssignableMember[];
  logs: PermissionLogRow[];
};

const NEW_ROLE = "__new__";

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-[#173A67]";

const LOG_ACTION_LABEL: Record<string, string> = {
  "role.create": "Tạo cấp",
  "role.update": "Cập nhật cấp",
  "role.delete": "Xóa cấp",
  "user.grant": "Gán cấp",
  "user.revoke": "Gỡ cấp",
};

function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

async function callApi(url: string, init: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
  if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra, vui lòng thử lại.");
  return data;
}

export function AdminRolesManager({ roles, members, logs }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(roles[0]?.id ?? NEW_ROLE);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const isCreating = selectedId === NEW_ROLE;
  const selectedRole = roles.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    setSelectedId((current) =>
      current === NEW_ROLE || roles.some((r) => r.id === current)
        ? current
        : (roles[0]?.id ?? NEW_ROLE),
    );
  }, [roles]);

  useEffect(() => {
    setDraftName(selectedRole?.name ?? "");
    setDraftDescription(selectedRole?.description ?? "");
    setDraftPermissions(selectedRole?.permissions ?? []);
    setMemberQuery("");
  }, [selectedRole]);

  const isDirty =
    isCreating ||
    (selectedRole !== null &&
      (draftName.trim() !== selectedRole.name ||
        draftDescription.trim() !== (selectedRole.description ?? "") ||
        !sameSet(draftPermissions, selectedRole.permissions)));

  const memberIdsInRole = useMemo(
    () => new Set(selectedRole?.members.map((m) => m.id) ?? []),
    [selectedRole],
  );

  const memberMatches = useMemo(() => {
    const q = removeVietnameseTones(memberQuery.trim());
    if (!q) return [];
    return members
      .filter((m) => !memberIdsInRole.has(m.id))
      .filter(
        (m) =>
          removeVietnameseTones(m.full_name).includes(q) ||
          (m.employee_code ?? "").toLowerCase().includes(q) ||
          removeVietnameseTones(m.department ?? "").includes(q),
      )
      .slice(0, 8);
  }, [members, memberQuery, memberIdsInRole]);

  function togglePermission(code: string, checked: boolean) {
    setDraftPermissions((prev) => {
      if (checked) return normalizePermissionCodes([...prev, code]);
      const drop = new Set([code, ...dependentPermissions(code)]);
      return prev.filter((c) => !drop.has(c));
    });
  }

  function resetMessages() {
    setError(null);
    setSuccess(null);
  }

  async function run(action: () => Promise<string>) {
    resetMessages();
    setBusy(true);
    try {
      const message = await action();
      setSuccess(message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  function handleSave() {
    const name = draftName.trim();
    if (!name) {
      setError("Vui lòng nhập tên cấp.");
      return;
    }
    const payload = {
      name,
      description: draftDescription.trim(),
      permissions: draftPermissions,
    };

    if (isCreating) {
      void run(async () => {
        const data = await callApi("/api/admin/roles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (data.id) setSelectedId(data.id);
        return `Đã tạo cấp "${name}". Giờ bạn có thể gán thành viên vào cấp này.`;
      });
      return;
    }

    if (!selectedRole) return;
    void run(async () => {
      await callApi(`/api/admin/roles/${selectedRole.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return `Đã lưu cấp "${name}".`;
    });
  }

  function handleDelete() {
    if (!selectedRole) return;
    const count = selectedRole.members.length;
    const warning =
      count > 0
        ? `Xóa cấp "${selectedRole.name}"? ${count} thành viên đang thuộc cấp này sẽ mất các quyền tương ứng.`
        : `Xóa cấp "${selectedRole.name}"?`;
    if (!window.confirm(warning)) return;

    void run(async () => {
      await callApi(`/api/admin/roles/${selectedRole.id}`, { method: "DELETE" });
      setSelectedId(NEW_ROLE);
      return `Đã xóa cấp "${selectedRole.name}".`;
    });
  }

  function handleAddMember(member: AssignableMember) {
    if (!selectedRole) return;
    void run(async () => {
      await callApi(`/api/admin/roles/${selectedRole.id}/members`, {
        method: "POST",
        body: JSON.stringify({ userId: member.id }),
      });
      setMemberQuery("");
      return `Đã gán ${member.full_name} vào cấp "${selectedRole.name}".`;
    });
  }

  function handleRemoveMember(memberId: string, memberName: string) {
    if (!selectedRole) return;
    if (!window.confirm(`Gỡ ${memberName} khỏi cấp "${selectedRole.name}"?`)) return;
    void run(async () => {
      await callApi(
        `/api/admin/roles/${selectedRole.id}/members?userId=${encodeURIComponent(memberId)}`,
        { method: "DELETE" },
      );
      return `Đã gỡ ${memberName} khỏi cấp "${selectedRole.name}".`;
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl bg-error-container px-4 py-2 text-sm text-on-error-container" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-[#D9F2EC] px-4 py-2 text-sm text-[#173A67]">{success}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* Danh sách cấp */}
        <aside className="space-y-2.5">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <MaterialIcon className="text-[20px] text-amber-600" name="shield" />
              Quản trị viên (Chủ tịch)
            </div>
            <p className="mt-1 text-xs text-amber-900/80">
              Luôn có toàn quyền, không chỉnh sửa tại đây.
            </p>
          </div>

          {roles.map((role) => {
            const active = role.id === selectedId;
            return (
              <button
                key={role.id}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-[#173A67] bg-[#173A67] text-white shadow-sm"
                    : "border-outline-variant bg-surface-container-lowest hover:border-[#173A67]"
                }`}
                type="button"
                onClick={() => {
                  resetMessages();
                  setSelectedId(role.id);
                }}
              >
                <p className="font-bold">{role.name}</p>
                <p className={`mt-1 text-xs ${active ? "text-white/80" : "text-on-surface-variant"}`}>
                  {role.members.length} thành viên · {role.permissions.length} quyền
                </p>
              </button>
            );
          })}

          <button
            className={`flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-3 font-bold transition ${
              isCreating
                ? "border-[#173A67] bg-[#D9F2EC] text-[#173A67]"
                : "border-outline-variant text-on-surface-variant hover:border-[#173A67] hover:text-[#173A67]"
            }`}
            type="button"
            onClick={() => {
              resetMessages();
              setSelectedId(NEW_ROLE);
            }}
          >
            <MaterialIcon className="text-[20px]" name="add" />
            Tạo cấp mới
          </button>
        </aside>

        {/* Chi tiết cấp */}
        <section className="space-y-5">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <h2 className="mb-4 flex items-center gap-2 text-title-md font-bold text-[#173A67]">
              <MaterialIcon className="text-[22px]" name={isCreating ? "add_moderator" : "tune"} />
              {isCreating ? "Tạo cấp mới" : `Cấp: ${selectedRole?.name ?? ""}`}
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-label-md" htmlFor="roleName">
                  Tên cấp
                </label>
                <input
                  className={inputClass}
                  id="roleName"
                  maxLength={60}
                  placeholder="vd. Ủy viên, Support"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-label-md" htmlFor="roleDescription">
                  Mô tả (không bắt buộc)
                </label>
                <input
                  className={inputClass}
                  id="roleDescription"
                  placeholder="Nhiệm vụ của cấp này"
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                />
              </div>
            </div>

            <h3 className="mt-6 mb-3 text-label-lg font-bold text-on-surface">Quyền của cấp</h3>
            <div className="space-y-3">
              {PERMISSION_MODULES.map((mod) => (
                <div key={mod.key} className="rounded-xl border border-outline-variant p-4">
                  <p className="mb-2 flex items-center gap-2 font-bold text-[#173A67]">
                    <MaterialIcon className="text-[20px]" name={mod.icon} />
                    {mod.name}
                  </p>
                  <div className="space-y-2">
                    {mod.permissions.map((perm) => (
                      <label key={perm.code} className="flex cursor-pointer items-start gap-3">
                        <input
                          checked={draftPermissions.includes(perm.code)}
                          className="mt-1 h-4 w-4 accent-[#173A67]"
                          type="checkbox"
                          onChange={(e) => togglePermission(perm.code, e.target.checked)}
                        />
                        <span>
                          <span className="block text-sm font-semibold">{perm.name}</span>
                          <span className="block text-xs text-on-surface-variant">
                            {perm.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              {!isCreating && selectedRole ? (
                <button
                  className="rounded-xl border border-error px-4 py-2 text-sm font-bold text-error transition hover:bg-error-container disabled:opacity-50"
                  disabled={busy}
                  type="button"
                  onClick={handleDelete}
                >
                  Xóa cấp
                </button>
              ) : (
                <span />
              )}
              <button
                className="rounded-xl bg-[#173A67] px-5 py-2 font-bold text-white transition hover:shadow-md disabled:opacity-50"
                disabled={busy || !isDirty}
                type="button"
                onClick={handleSave}
              >
                {busy ? "Đang lưu..." : isCreating ? "Tạo cấp" : "Lưu thay đổi"}
              </button>
            </div>
          </div>

          {!isCreating && selectedRole ? (
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
              <h2 className="mb-4 flex items-center gap-2 text-title-md font-bold text-[#173A67]">
                <MaterialIcon className="text-[22px]" name="group" />
                Thành viên thuộc cấp ({selectedRole.members.length})
              </h2>

              <div className="relative mb-4">
                <MaterialIcon
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-on-surface-variant/60"
                  name="person_search"
                />
                <input
                  className={`${inputClass} pl-9`}
                  placeholder="Tìm theo tên, mã NV hoặc bộ phận để gán vào cấp..."
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                />
                {memberMatches.length > 0 ? (
                  <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-outline-variant bg-white shadow-lg">
                    {memberMatches.map((m) => (
                      <li key={m.id}>
                        <button
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-container-low disabled:opacity-50"
                          disabled={busy}
                          type="button"
                          onClick={() => handleAddMember(m)}
                        >
                          <span>
                            <span className="font-semibold">{m.full_name}</span>
                            <span className="ml-2 text-xs text-on-surface-variant">
                              {[m.employee_code, m.department].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <MaterialIcon className="text-[18px] text-[#173A67]" name="person_add" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : memberQuery.trim() ? (
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Không có thành viên phù hợp (hoặc đã thuộc cấp này).
                  </p>
                ) : null}
              </div>

              {selectedRole.members.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Chưa có thành viên nào thuộc cấp này.</p>
              ) : (
                <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
                  {selectedRole.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold">{m.full_name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {[m.employee_code, m.department].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <button
                        className="rounded-lg border border-error px-3 py-1 text-xs font-bold text-error disabled:opacity-50"
                        disabled={busy}
                        type="button"
                        onClick={() => handleRemoveMember(m.id, m.full_name)}
                      >
                        Gỡ
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      </div>

      {/* Bảng tổng hợp quyền */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <h2 className="mb-4 flex items-center gap-2 text-title-md font-bold text-[#173A67]">
          <MaterialIcon className="text-[22px]" name="table_view" />
          Bảng tổng hợp quyền
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#D9F2EC] text-[#173A67]">
              <tr>
                <th className="px-3 py-2 font-bold">Quyền</th>
                <th className="px-3 py-2 text-center font-bold whitespace-nowrap">Quản trị viên</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-3 py-2 text-center font-bold whitespace-nowrap">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MODULES.flatMap((mod) =>
                mod.permissions.map((perm) => (
                  <tr key={perm.code} className="border-t border-outline-variant">
                    <td className="px-3 py-2">{getPermissionLabel(perm.code)}</td>
                    <td className="px-3 py-2 text-center text-[#173A67]">✔</td>
                    {roles.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-center text-[#173A67]">
                        {r.permissions.includes(perm.code) ? "✔" : ""}
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nhật ký phân quyền */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <button
          className="flex w-full items-center justify-between text-title-md font-bold text-[#173A67]"
          type="button"
          onClick={() => setShowLogs((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <MaterialIcon className="text-[22px]" name="history" />
            Nhật ký phân quyền ({logs.length} thay đổi gần nhất)
          </span>
          <MaterialIcon className="text-[22px]" name={showLogs ? "expand_less" : "expand_more"} />
        </button>
        {showLogs ? (
          logs.length === 0 ? (
            <p className="mt-3 text-sm text-on-surface-variant">Chưa có thay đổi nào.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {logs.map((log) => {
                const added = (log.detail?.added as string[] | undefined) ?? [];
                const removed = (log.detail?.removed as string[] | undefined) ?? [];
                const created = (log.detail?.permissions as string[] | undefined) ?? [];
                const renamedFrom = log.detail?.renamed_from as string | undefined;
                return (
                  <li key={log.id} className="rounded-xl bg-surface-container-low px-3 py-2 text-sm">
                    <p>
                      <span className="text-xs text-on-surface-variant">
                        {new Date(log.created_at).toLocaleString("vi-VN")}
                      </span>{" "}
                      · <strong>{log.actor_name ?? "Không rõ"}</strong>{" "}
                      {LOG_ACTION_LABEL[log.action] ?? log.action}{" "}
                      <strong>{log.role_name ?? ""}</strong>
                      {log.target_name ? (
                        <>
                          {" "}
                          {log.action === "user.revoke" ? "khỏi" : "cho"} <strong>{log.target_name}</strong>
                        </>
                      ) : null}
                    </p>
                    {renamedFrom ? (
                      <p className="text-xs text-on-surface-variant">Tên cũ: {renamedFrom}</p>
                    ) : null}
                    {created.length > 0 ? (
                      <p className="text-xs text-on-surface-variant">
                        Quyền: {created.map(getPermissionLabel).join(", ")}
                      </p>
                    ) : null}
                    {added.length > 0 ? (
                      <p className="text-xs text-[#173A67]">+ {added.map(getPermissionLabel).join(", ")}</p>
                    ) : null}
                    {removed.length > 0 ? (
                      <p className="text-xs text-error">− {removed.map(getPermissionLabel).join(", ")}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}
