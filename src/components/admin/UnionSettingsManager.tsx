"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import {
  UNION_SETTINGS_LIMITS,
  formatOfficerAttendee,
  normalizeViSearch,
  type AssignableUnionMember,
  type UnionOfficer,
  type UnionPosition,
} from "@/lib/union-settings/types";

export type UnionSettingsTab = "nhan-su" | "chuc-danh";
type ActiveFilter = "all" | "active" | "inactive";

type OfficerFormState = {
  id?: string;
  userId: string;
  fullName: string;
  positionId: string;
  displayOrder: number;
  isActive: boolean;
  term: string;
};

const baseInputClass =
  "rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-sm text-on-surface outline-none focus:border-[#173A67]";
const inputClass = `w-full ${baseInputClass}`;
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";
const controlClass =
  "h-8 rounded-lg border border-outline-variant bg-white px-2.5 text-xs text-on-surface outline-none focus:border-[#173A67]";
const iconButtonClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-[#173A67] disabled:opacity-30";

function formatMemberLabel(
  member: Pick<AssignableUnionMember, "fullName" | "employeeCode" | "department">,
): string {
  const head = member.employeeCode
    ? `${member.fullName} (${member.employeeCode})`
    : member.fullName;
  return member.department ? `${head} — ${member.department}` : head;
}

export function UnionSettingsManager({
  initialPositions,
  initialOfficers,
  members,
  initialTab = "nhan-su",
}: {
  initialPositions: UnionPosition[];
  initialOfficers: UnionOfficer[];
  members: AssignableUnionMember[];
  initialTab?: UnionSettingsTab;
}) {
  const [activeTab, setActiveTab] = useState<UnionSettingsTab>(initialTab);
  const [positions, setPositions] = useState<UnionPosition[]>(initialPositions);
  const [officers, setOfficers] = useState<UnionOfficer[]>(initialOfficers);

  // Bộ lọc danh sách cán bộ (tab Nhân sự công đoàn)
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  // Modal / Form thêm & sửa cán bộ + Combobox liên kết đoàn viên
  const [editingOfficer, setEditingOfficer] = useState<OfficerFormState | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [memberHighlightIndex, setMemberHighlightIndex] = useState(0);
  const memberInputRef = useRef<HTMLInputElement | null>(null);
  const [savingOfficer, setSavingOfficer] = useState(false);
  const [busyOfficerId, setBusyOfficerId] = useState<string | null>(null);

  // Quản lý chức danh (tab Chức danh: Thêm mới / Đổi tên / Thứ tự / Ngừng dùng)
  const [newPosName, setNewPosName] = useState("");
  const [newPosOrder, setNewPosOrder] = useState<number>(
    () => (initialPositions.reduce((max, p) => Math.max(max, p.displayOrder), 0) || 0) + 1,
  );
  const [addingPos, setAddingPos] = useState(false);
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [editingPosName, setEditingPosName] = useState("");
  const [editingPosOrder, setEditingPosOrder] = useState<number>(1);
  const [busyPosId, setBusyPosId] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Đồng bộ tab với URL (?tab=chuc-danh) khi bấm nút Back/Forward trình duyệt
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      setActiveTab(params.get("tab") === "chuc-danh" ? "chuc-danh" : "nhan-su");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function switchTab(nextTab: UnionSettingsTab) {
    clearNotice();
    setActiveTab(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (nextTab === "chuc-danh") {
        url.searchParams.set("tab", "chuc-danh");
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }

  const sortedPositions = useMemo(
    () =>
      [...positions].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt),
      ),
    [positions],
  );
  const activePositions = useMemo(
    () => sortedPositions.filter((p) => p.isActive),
    [sortedPositions],
  );

  const sortedOfficers = useMemo(
    () =>
      [...officers].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt),
      ),
    [officers],
  );

  const filteredOfficers = useMemo(() => {
    const q = normalizeViSearch(query);
    return sortedOfficers.filter((o) => {
      if (positionFilter && o.positionId !== positionFilter) return false;
      if (activeFilter === "active" && !o.isActive) return false;
      if (activeFilter === "inactive" && o.isActive) return false;
      if (!q) return true;
      const hay = normalizeViSearch(
        `${o.fullName} ${o.positionName} ${o.term ?? ""} ${o.userEmployeeCode ?? ""} ${o.userDepartment ?? ""}`,
      );
      return hay.includes(q);
    });
  }, [sortedOfficers, query, positionFilter, activeFilter]);

  const linkedMember = useMemo(() => {
    if (!editingOfficer?.userId) return null;
    return members.find((m) => m.id === editingOfficer.userId) ?? null;
  }, [editingOfficer?.userId, members]);

  const filteredMembers = useMemo(() => {
    const q = normalizeViSearch(memberSearch);
    if (!q || (linkedMember && normalizeViSearch(formatMemberLabel(linkedMember)) === q)) {
      return members.slice(0, 30);
    }
    const startsWithMatches: AssignableUnionMember[] = [];
    const includesMatches: AssignableUnionMember[] = [];

    for (const m of members) {
      const nameNorm = normalizeViSearch(m.fullName);
      const codeNorm = normalizeViSearch(m.employeeCode ?? "");
      const deptNorm = normalizeViSearch(m.department ?? "");
      const combined = `${nameNorm} ${codeNorm} ${deptNorm}`;
      if (!combined.includes(q)) continue;
      if (nameNorm.startsWith(q) || (codeNorm && codeNorm.startsWith(q))) {
        startsWithMatches.push(m);
      } else {
        includesMatches.push(m);
      }
    }
    return [...startsWithMatches, ...includesMatches].slice(0, 30);
  }, [members, memberSearch, linkedMember]);

  const safeMemberHighlight =
    filteredMembers.length > 0
      ? Math.max(0, Math.min(memberHighlightIndex, filteredMembers.length - 1))
      : 0;

  const selectablePositionsForModal = useMemo(() => {
    if (!editingOfficer) return activePositions;
    return sortedPositions.filter((p) => p.isActive || p.id === editingOfficer.positionId);
  }, [sortedPositions, activePositions, editingOfficer]);

  const activeOfficersCount = officers.filter((o) => o.isActive && o.positionIsActive).length;

  function clearNotice() {
    setMessage(null);
    setError(null);
  }

  function openNewOfficer() {
    clearNotice();
    const defaultPos = activePositions[0] ?? sortedPositions[0];
    const nextOrder =
      (officers.reduce((max, o) => Math.max(max, o.displayOrder), 0) || 0) + 1;
    setMemberSearch("");
    setMemberDropdownOpen(false);
    setMemberHighlightIndex(0);
    setEditingOfficer({
      userId: "",
      fullName: "",
      positionId: defaultPos?.id ?? "",
      displayOrder: nextOrder,
      isActive: true,
      term: "",
    });
  }

  function openEditOfficer(officer: UnionOfficer) {
    clearNotice();
    const matched = officer.userId ? members.find((m) => m.id === officer.userId) : null;
    const initialMemberText = matched
      ? formatMemberLabel(matched)
      : officer.userId
        ? formatMemberLabel({
            fullName: officer.userFullName || officer.fullName,
            employeeCode: officer.userEmployeeCode,
            department: officer.userDepartment,
          })
        : "";
    setMemberSearch(initialMemberText);
    setMemberDropdownOpen(false);
    setMemberHighlightIndex(0);
    setEditingOfficer({
      id: officer.id,
      userId: officer.userId ?? "",
      fullName: officer.fullName,
      positionId: officer.positionId,
      displayOrder: officer.displayOrder,
      isActive: officer.isActive,
      term: officer.term ?? "",
    });
  }

  function handleSelectMember(userId: string) {
    if (!editingOfficer) return;
    const picked = members.find((m) => m.id === userId);
    const prevPicked = members.find((m) => m.id === editingOfficer.userId);
    const shouldAutofillName =
      !editingOfficer.fullName.trim() ||
      (prevPicked && editingOfficer.fullName.trim() === prevPicked.fullName.trim());

    setEditingOfficer({
      ...editingOfficer,
      userId,
      fullName: picked && shouldAutofillName ? picked.fullName : editingOfficer.fullName,
    });
    setMemberSearch(picked ? formatMemberLabel(picked) : "");
    setMemberDropdownOpen(false);
    setMemberHighlightIndex(0);
  }

  function handleUnlinkMember() {
    if (!editingOfficer) return;
    setEditingOfficer({
      ...editingOfficer,
      userId: "",
    });
    setMemberSearch("");
    setMemberDropdownOpen(false);
    setMemberHighlightIndex(0);
    memberInputRef.current?.focus();
  }

  function handleMemberInputChange(value: string) {
    setMemberSearch(value);
    setMemberDropdownOpen(true);
    setMemberHighlightIndex(0);
    if (editingOfficer && editingOfficer.userId) {
      setEditingOfficer({
        ...editingOfficer,
        userId: "",
      });
    }
  }

  function handleMemberInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!memberDropdownOpen) {
        setMemberDropdownOpen(true);
        setMemberHighlightIndex(0);
        return;
      }
      if (filteredMembers.length > 0) {
        setMemberHighlightIndex((prev) => (prev + 1) % filteredMembers.length);
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!memberDropdownOpen) {
        setMemberDropdownOpen(true);
        setMemberHighlightIndex(Math.max(0, filteredMembers.length - 1));
        return;
      }
      if (filteredMembers.length > 0) {
        setMemberHighlightIndex(
          (prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length,
        );
      }
      return;
    }

    if (e.key === "Enter") {
      if (memberDropdownOpen && filteredMembers[safeMemberHighlight]) {
        e.preventDefault();
        handleSelectMember(filteredMembers[safeMemberHighlight].id);
      } else if (memberDropdownOpen) {
        e.preventDefault();
        setMemberDropdownOpen(false);
      }
      return;
    }

    if (e.key === "Escape") {
      if (memberDropdownOpen) {
        e.preventDefault();
        e.stopPropagation();
        setMemberDropdownOpen(false);
      }
    }
  }

  async function saveOfficer(e: React.FormEvent) {
    e.preventDefault();
    if (!editingOfficer || savingOfficer) return;
    const cleanName = editingOfficer.fullName.trim();
    if (!cleanName) {
      setError("Vui lòng nhập họ và tên cán bộ công đoàn.");
      return;
    }
    if (!editingOfficer.positionId) {
      setError("Vui lòng chọn chức danh công đoàn.");
      return;
    }

    setSavingOfficer(true);
    clearNotice();
    try {
      const isCreate = !editingOfficer.id;
      const res = await fetch(
        isCreate
          ? "/api/union-settings/officers"
          : `/api/union-settings/officers/${editingOfficer.id}`,
        {
          method: isCreate ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: editingOfficer.userId || null,
            fullName: cleanName,
            positionId: editingOfficer.positionId,
            displayOrder: editingOfficer.displayOrder,
            isActive: editingOfficer.isActive,
            term: editingOfficer.term.trim() || null,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        officer?: UnionOfficer;
      };
      if (!res.ok || !data.officer) {
        throw new Error(data.error || "Không lưu được thông tin cán bộ công đoàn.");
      }
      const saved = data.officer;
      setOfficers((prev) =>
        isCreate ? [...prev, saved] : prev.map((o) => (o.id === saved.id ? saved : o)),
      );
      setEditingOfficer(null);
      setMessage(
        isCreate
          ? `Đã thêm cán bộ “${saved.fullName} - ${saved.positionName}”.`
          : `Đã cập nhật thông tin cán bộ “${saved.fullName} - ${saved.positionName}”.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được thông tin cán bộ.");
    } finally {
      setSavingOfficer(false);
    }
  }

  async function toggleOfficerActive(officer: UnionOfficer) {
    clearNotice();
    setBusyOfficerId(officer.id);
    try {
      const res = await fetch(`/api/union-settings/officers/${officer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !officer.isActive }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        officer?: UnionOfficer;
      };
      if (!res.ok || !data.officer) {
        throw new Error(data.error || "Không cập nhật được trạng thái cán bộ.");
      }
      const saved = data.officer;
      setOfficers((prev) => prev.map((o) => (o.id === saved.id ? saved : o)));
      setMessage(
        saved.isActive
          ? `Đã kích hoạt cán bộ “${saved.fullName}”.`
          : `Đã ngừng kích hoạt cán bộ “${saved.fullName}”.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái cán bộ.");
    } finally {
      setBusyOfficerId(null);
    }
  }

  async function moveOfficerOrder(officer: UnionOfficer, delta: -1 | 1) {
    const idx = sortedOfficers.findIndex((o) => o.id === officer.id);
    const target = sortedOfficers[idx + delta];
    if (!target) return;

    clearNotice();
    setBusyOfficerId(officer.id);
    try {
      const newOrderA = target.displayOrder;
      const newOrderB =
        officer.displayOrder === target.displayOrder
          ? target.displayOrder + (delta < 0 ? 1 : -1)
          : officer.displayOrder;

      const [resA, resB] = await Promise.all([
        fetch(`/api/union-settings/officers/${officer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: newOrderA }),
        }),
        fetch(`/api/union-settings/officers/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: newOrderB }),
        }),
      ]);
      const dataA = (await resA.json().catch(() => ({}))) as { officer?: UnionOfficer };
      const dataB = (await resB.json().catch(() => ({}))) as { officer?: UnionOfficer };
      if (dataA.officer && dataB.officer) {
        setOfficers((prev) =>
          prev.map((o) => {
            if (o.id === dataA.officer!.id) return dataA.officer!;
            if (o.id === dataB.officer!.id) return dataB.officer!;
            return o;
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được thứ tự hiển thị.");
    } finally {
      setBusyOfficerId(null);
    }
  }

  async function removeOfficer(officer: UnionOfficer) {
    if (
      !window.confirm(
        `Xóa cán bộ “${officer.fullName} (${officer.positionName})” khỏi danh sách? (Nếu chỉ muốn tạm ẩn khi gợi ý văn bản, bạn có thể bấm “Ngừng” thay vì xóa).`,
      )
    ) {
      return;
    }
    clearNotice();
    setBusyOfficerId(officer.id);
    try {
      const res = await fetch(`/api/union-settings/officers/${officer.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Không xóa được cán bộ công đoàn.");
      setOfficers((prev) => prev.filter((o) => o.id !== officer.id));
      setMessage(`Đã xóa cán bộ “${officer.fullName}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được cán bộ công đoàn.");
    } finally {
      setBusyOfficerId(null);
    }
  }

  async function handleAddPosition(e: React.FormEvent) {
    e.preventDefault();
    const clean = newPosName.trim();
    if (!clean || addingPos) return;

    setAddingPos(true);
    clearNotice();
    try {
      const res = await fetch("/api/union-settings/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clean,
          displayOrder: newPosOrder,
          isActive: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        position?: UnionPosition;
      };
      if (!res.ok || !data.position) {
        throw new Error(data.error || "Không thêm được chức danh.");
      }
      const created = data.position;
      setPositions((prev) => [...prev, created]);
      setNewPosName("");
      setNewPosOrder(created.displayOrder + 1);
      setMessage(`Đã thêm chức danh “${created.name}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thêm được chức danh.");
    } finally {
      setAddingPos(false);
    }
  }

  function startEditPosition(pos: UnionPosition) {
    clearNotice();
    setEditingPosId(pos.id);
    setEditingPosName(pos.name);
    setEditingPosOrder(pos.displayOrder);
  }

  async function saveEditPosition(posId: string) {
    const clean = editingPosName.trim();
    if (!clean) {
      setError("Tên chức danh không được để trống.");
      return;
    }
    setBusyPosId(posId);
    clearNotice();
    try {
      const res = await fetch(`/api/union-settings/positions/${posId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clean,
          displayOrder: editingPosOrder,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        position?: UnionPosition;
      };
      if (!res.ok || !data.position) {
        throw new Error(data.error || "Không cập nhật được chức danh.");
      }
      const updated = data.position;
      setPositions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setOfficers((prev) =>
        prev.map((o) =>
          o.positionId === updated.id
            ? { ...o, positionName: updated.name, positionIsActive: updated.isActive }
            : o,
        ),
      );
      setEditingPosId(null);
      setMessage(`Đã cập nhật chức danh “${updated.name}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được chức danh.");
    } finally {
      setBusyPosId(null);
    }
  }

  async function movePositionOrder(pos: UnionPosition, delta: -1 | 1) {
    const idx = sortedPositions.findIndex((p) => p.id === pos.id);
    const target = sortedPositions[idx + delta];
    if (!target) return;

    clearNotice();
    setBusyPosId(pos.id);
    try {
      const newOrderA = target.displayOrder;
      const newOrderB =
        pos.displayOrder === target.displayOrder
          ? target.displayOrder + (delta < 0 ? 1 : -1)
          : pos.displayOrder;

      const [resA, resB] = await Promise.all([
        fetch(`/api/union-settings/positions/${pos.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: newOrderA }),
        }),
        fetch(`/api/union-settings/positions/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: newOrderB }),
        }),
      ]);
      const dataA = (await resA.json().catch(() => ({}))) as { position?: UnionPosition };
      const dataB = (await resB.json().catch(() => ({}))) as { position?: UnionPosition };
      if (dataA.position && dataB.position) {
        setPositions((prev) =>
          prev.map((p) => {
            if (p.id === dataA.position!.id) return dataA.position!;
            if (p.id === dataB.position!.id) return dataB.position!;
            return p;
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được thứ tự chức danh.");
    } finally {
      setBusyPosId(null);
    }
  }

  async function togglePositionActive(pos: UnionPosition) {
    setBusyPosId(pos.id);
    clearNotice();
    try {
      const res = await fetch(`/api/union-settings/positions/${pos.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !pos.isActive }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        position?: UnionPosition;
      };
      if (!res.ok || !data.position) {
        throw new Error(data.error || "Không đổi được trạng thái chức danh.");
      }
      const updated = data.position;
      setPositions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setOfficers((prev) =>
        prev.map((o) =>
          o.positionId === updated.id ? { ...o, positionIsActive: updated.isActive } : o,
        ),
      );
      setMessage(
        updated.isActive
          ? `Đã bật chức danh “${updated.name}”.`
          : `Đã ngừng dùng chức danh “${updated.name}”.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được trạng thái chức danh.");
    } finally {
      setBusyPosId(null);
    }
  }

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-headline-md font-extrabold text-[#173A67]">Cài đặt công đoàn</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Quản lý danh sách nhân sự công đoàn và danh mục chức danh dùng để gợi ý tự động{" "}
            <strong className="text-[#173A67]">“Họ tên - Chức danh”</strong> khi soạn thảo văn bản, biên bản họp.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#173A67] bg-white px-3 py-1.5 text-xs font-bold text-[#173A67] transition hover:bg-[#ecf4ff]"
            href="/admin/documents/compose"
          >
            <MaterialIcon className="text-[17px]" name="edit_document" />
            Soạn văn bản
          </Link>
          {activeTab === "nhan-su" ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#173A67] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#1E4A7D]"
              type="button"
              onClick={openNewOfficer}
            >
              <MaterialIcon className="text-[18px]" name="person_add" />
              Thêm cán bộ công đoàn
            </button>
          ) : null}
        </div>
      </div>

      {/* Thanh chuyển tab tách biệt: Nhân sự công đoàn & Chức danh */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d2dfe9] bg-white p-2 shadow-2xs">
        <div
          aria-label="Phân mục Cài đặt công đoàn"
          className="grid w-full grid-cols-2 gap-1.5 sm:inline-flex sm:w-auto"
          role="tablist"
        >
          <button
            aria-selected={activeTab === "nhan-su"}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
              activeTab === "nhan-su"
                ? "bg-[#173A67] text-white shadow-xs"
                : "bg-surface-container-low/60 text-on-surface-variant hover:bg-[#ecf4ff] hover:text-[#173A67]"
            }`}
            role="tab"
            type="button"
            onClick={() => switchTab("nhan-su")}
          >
            <MaterialIcon className="text-[18px]" name="groups" />
            <span>Nhân sự công đoàn</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                activeTab === "nhan-su"
                  ? "bg-white/20 text-white"
                  : "bg-white text-[#173A67]"
              }`}
            >
              {officers.length}
            </span>
          </button>

          <button
            aria-selected={activeTab === "chuc-danh"}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
              activeTab === "chuc-danh"
                ? "bg-[#173A67] text-white shadow-xs"
                : "bg-surface-container-low/60 text-on-surface-variant hover:bg-[#ecf4ff] hover:text-[#173A67]"
            }`}
            role="tab"
            type="button"
            onClick={() => switchTab("chuc-danh")}
          >
            <MaterialIcon className="text-[18px]" name="badge" />
            <span>Chức danh</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                activeTab === "chuc-danh"
                  ? "bg-white/20 text-white"
                  : "bg-white text-[#173A67]"
              }`}
            >
              {activePositions.length}/{positions.length}
            </span>
          </button>
        </div>

        {/* Chỉ số tóm tắt gọn bên phải thanh tab */}
        <div className="hidden items-center gap-3 pr-2 text-xs text-on-surface-variant md:flex">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Đang hoạt động: <strong className="text-[#173A67]">{activeOfficersCount}</strong>/{officers.length} cán bộ
          </span>
          <span className="text-outline-variant">•</span>
          <span>
            Chức danh đang dùng: <strong className="text-[#173A67]">{activePositions.length}</strong>/{positions.length}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-3.5 py-2 text-xs font-semibold text-on-error-container">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
          {message}
        </div>
      ) : null}

      {/* TAB 1: NHÂN SỰ CÔNG ĐOÀN */}
      {activeTab === "nhan-su" ? (
        <section className="flex flex-col gap-3.5 rounded-2xl border border-[#d2dfe9] bg-white p-3.5 shadow-2xs sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e3ecf3] pb-3">
            <div>
              <h2 className="text-base font-extrabold text-[#173A67]">
                Danh sách nhân sự công đoàn ({filteredOfficers.length})
              </h2>
              <p className="text-xs text-on-surface-variant">
                Cán bộ đang hoạt động sẽ hiện trong gợi ý tự động ở ô <strong>Thành phần tham gia</strong> khi soạn biên bản.
              </p>
            </div>
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-[#173A67] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1E4A7D]"
              type="button"
              onClick={openNewOfficer}
            >
              <MaterialIcon className="text-[16px]" name="add" />
              Thêm cán bộ
            </button>
          </div>

          {/* Thanh tìm kiếm & lọc */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px_160px]">
            <label className="relative min-w-0">
              <MaterialIcon
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant"
                name="search"
              />
              <input
                aria-label="Tìm cán bộ công đoàn"
                className={`${controlClass} w-full pl-8`}
                placeholder="Tìm theo họ tên, chức danh, mã NV, nhiệm kỳ..."
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Lọc theo chức danh"
              className={`${controlClass} w-full`}
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
            >
              <option value="">Tất cả chức danh</option>
              {sortedPositions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                  {pos.isActive ? "" : " (đã ẩn)"}
                </option>
              ))}
            </select>
            <select
              aria-label="Lọc theo trạng thái"
              className={`${controlClass} w-full`}
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
            >
              <option value="all">Mọi trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>

          {filteredOfficers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant px-4 py-8 text-center text-xs text-on-surface-variant">
              {officers.length === 0
                ? "Chưa có cán bộ công đoàn nào. Bấm “+ Thêm cán bộ” để khởi tạo danh sách."
                : "Không có cán bộ nào khớp điều kiện lọc."}
            </div>
          ) : (
            <>
              {/* Giao diện Bảng trên Desktop (md trở lên) */}
              <div className="hidden overflow-x-auto rounded-xl border border-[#e3ecf3] md:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#d2dfe9] bg-[#ecf4ff] text-[11px] font-bold text-[#173A67]">
                      <th className="w-20 px-2.5 py-2.5 text-center">Thứ tự</th>
                      <th className="px-3 py-2.5">Họ và tên</th>
                      <th className="px-3 py-2.5">Chức danh</th>
                      <th className="px-3 py-2.5">Nhiệm kỳ</th>
                      <th className="px-3 py-2.5">Mẫu chèn văn bản</th>
                      <th className="px-3 py-2.5 text-center">Trạng thái</th>
                      <th className="px-3 py-2.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef3f8]">
                    {filteredOfficers.map((o) => {
                      const effectiveActive = o.isActive && o.positionIsActive;
                      return (
                        <tr
                          key={o.id}
                          className={
                            effectiveActive
                              ? "bg-white hover:bg-[#f8fbff]"
                              : "bg-surface-container-low/60 opacity-75"
                          }
                        >
                          <td className="px-2.5 py-2.5 text-center tabular-nums">
                            <div className="inline-flex items-center gap-0.5">
                              <span className="min-w-[1.5rem] font-bold text-[#173A67]">
                                {o.displayOrder}
                              </span>
                              <button
                                aria-label="Đưa lên"
                                className={iconButtonClass}
                                disabled={busyOfficerId === o.id || sortedOfficers[0]?.id === o.id}
                                title="Đưa lên"
                                type="button"
                                onClick={() => void moveOfficerOrder(o, -1)}
                              >
                                <MaterialIcon className="text-[15px]" name="arrow_upward" />
                              </button>
                              <button
                                aria-label="Đưa xuống"
                                className={iconButtonClass}
                                disabled={
                                  busyOfficerId === o.id ||
                                  sortedOfficers[sortedOfficers.length - 1]?.id === o.id
                                }
                                title="Đưa xuống"
                                type="button"
                                onClick={() => void moveOfficerOrder(o, 1)}
                              >
                                <MaterialIcon className="text-[15px]" name="arrow_downward" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-[#173A67]">{o.fullName}</div>
                            {o.userId ? (
                              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-on-surface-variant">
                                <MaterialIcon className="text-[13px] text-emerald-700" name="link" />
                                <span>
                                  TK: {o.userFullName || o.fullName}
                                  {o.userEmployeeCode ? ` (${o.userEmployeeCode})` : ""}
                                  {o.userDepartment ? ` • ${o.userDepartment}` : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-on-surface-variant">Nhập trực tiếp</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1 rounded-md border border-[#d2dfe9] bg-[#f5f9ff] px-2 py-0.5 font-bold text-[#173A67]">
                              {o.positionName}
                            </span>
                            {!o.positionIsActive ? (
                              <span className="ml-1 text-[10px] font-semibold text-amber-700">
                                (chức danh đã ẩn)
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-on-surface-variant">{o.term || "—"}</td>
                          <td className="px-3 py-2.5">
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-slate-800">
                              {formatOfficerAttendee(o)}
                            </code>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                effectiveActive
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "bg-surface-container text-on-surface-variant"
                              }`}
                            >
                              {o.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant px-2 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
                                type="button"
                                onClick={() => openEditOfficer(o)}
                              >
                                <MaterialIcon className="text-[15px]" name="edit" />
                                Sửa
                              </button>
                              <button
                                className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-xs font-semibold disabled:opacity-50 ${
                                  o.isActive
                                    ? "border-outline-variant text-on-surface-variant hover:border-amber-600 hover:text-amber-800"
                                    : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                                }`}
                                disabled={busyOfficerId === o.id}
                                type="button"
                                onClick={() => void toggleOfficerActive(o)}
                              >
                                <MaterialIcon
                                  className="text-[15px]"
                                  name={o.isActive ? "visibility_off" : "visibility"}
                                />
                                {o.isActive ? "Ngừng" : "Bật"}
                              </button>
                              <button
                                aria-label={`Xóa ${o.fullName}`}
                                className="inline-flex h-7 items-center rounded-lg border border-outline-variant px-1.5 text-on-surface-variant hover:border-error hover:text-error disabled:opacity-50"
                                disabled={busyOfficerId === o.id}
                                title="Xóa cán bộ"
                                type="button"
                                onClick={() => void removeOfficer(o)}
                              >
                                <MaterialIcon className="text-[15px]" name="delete" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Giao diện Thẻ gọn (Compact Cards) trên màn hình điện thoại 390px (< md) */}
              <div className="space-y-2.5 md:hidden">
                {filteredOfficers.map((o) => {
                  const effectiveActive = o.isActive && o.positionIsActive;
                  return (
                    <div
                      key={o.id}
                      className={`rounded-xl border p-3 transition ${
                        effectiveActive
                          ? "border-[#d2dfe9] bg-white"
                          : "border-dashed border-outline-variant bg-surface-container-low/50 opacity-80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-[#ecf4ff] px-1 text-[11px] font-bold text-[#173A67] tabular-nums">
                              #{o.displayOrder}
                            </span>
                            <span className="text-sm font-extrabold text-[#173A67]">
                              {o.fullName}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="inline-flex items-center rounded-md border border-[#d2dfe9] bg-[#f5f9ff] px-2 py-0.5 text-[11px] font-bold text-[#173A67]">
                              {o.positionName}
                            </span>
                            {o.term ? (
                              <span className="text-[11px] text-on-surface-variant">
                                • Nhiệm kỳ: {o.term}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            effectiveActive
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-surface-container text-on-surface-variant"
                          }`}
                        >
                          {o.isActive ? "Đang hoạt động" : "Ngừng"}
                        </span>
                      </div>

                      {o.userId ? (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-on-surface-variant">
                          <MaterialIcon className="text-[13px] text-emerald-700" name="link" />
                          <span className="truncate">
                            TK: {o.userFullName || o.fullName}
                            {o.userEmployeeCode ? ` (${o.userEmployeeCode})` : ""}
                            {o.userDepartment ? ` • ${o.userDepartment}` : ""}
                          </span>
                        </div>
                      ) : null}

                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#eef3f8] pt-2">
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            aria-label="Đưa lên"
                            className={iconButtonClass}
                            disabled={busyOfficerId === o.id || sortedOfficers[0]?.id === o.id}
                            title="Đưa lên"
                            type="button"
                            onClick={() => void moveOfficerOrder(o, -1)}
                          >
                            <MaterialIcon className="text-[16px]" name="arrow_upward" />
                          </button>
                          <button
                            aria-label="Đưa xuống"
                            className={iconButtonClass}
                            disabled={
                              busyOfficerId === o.id ||
                              sortedOfficers[sortedOfficers.length - 1]?.id === o.id
                            }
                            title="Đưa xuống"
                            type="button"
                            onClick={() => void moveOfficerOrder(o, 1)}
                          >
                            <MaterialIcon className="text-[16px]" name="arrow_downward" />
                          </button>
                        </div>

                        <div className="inline-flex items-center gap-1.5">
                          <button
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant px-2.5 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
                            type="button"
                            onClick={() => openEditOfficer(o)}
                          >
                            <MaterialIcon className="text-[14px]" name="edit" />
                            Sửa
                          </button>
                          <button
                            className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold disabled:opacity-50 ${
                              o.isActive
                                ? "border-outline-variant text-on-surface-variant"
                                : "border-emerald-300 text-emerald-800"
                            }`}
                            disabled={busyOfficerId === o.id}
                            type="button"
                            onClick={() => void toggleOfficerActive(o)}
                          >
                            {o.isActive ? "Ngừng" : "Bật"}
                          </button>
                          <button
                            aria-label={`Xóa ${o.fullName}`}
                            className="inline-flex h-7 items-center rounded-lg border border-outline-variant px-1.5 text-on-surface-variant hover:border-error hover:text-error disabled:opacity-50"
                            disabled={busyOfficerId === o.id}
                            title="Xóa cán bộ"
                            type="button"
                            onClick={() => void removeOfficer(o)}
                          >
                            <MaterialIcon className="text-[15px]" name="delete" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* TAB 2: CHỨC DANH CÔNG ĐOÀN */}
      {activeTab === "chuc-danh" ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-[#d2dfe9] bg-white p-3.5 shadow-2xs sm:p-5">
          <div className="border-b border-[#e3ecf3] pb-3">
            <h2 className="text-base font-extrabold text-[#173A67]">
              Danh mục chức danh công đoàn ({positions.length})
            </h2>
            <p className="text-xs text-on-surface-variant">
              Mặc định gồm Chủ tịch, Phó chủ tịch, Ủy viên, Kế toán. Bạn có thể thêm chức danh mới, đổi tên, sắp xếp thứ tự hoặc ngừng dùng.
            </p>
          </div>

          {/* Form thêm chức danh mới (giữ bố cục gọn từ c84f1e2) */}
          <form
            className="flex flex-col gap-2 rounded-xl border border-[#d2dfe9] bg-[#f8fbff] p-3 sm:p-4"
            onSubmit={handleAddPosition}
          >
            <span className="text-xs font-bold text-[#173A67]">Thêm chức danh mới</span>
            <div className="grid grid-cols-[minmax(0,1fr)_88px_auto] items-end gap-2">
              <div className="min-w-0">
                <label
                  className="mb-1 block text-[11px] font-semibold text-on-surface-variant"
                  htmlFor="new-position-name"
                >
                  Tên chức danh
                </label>
                <input
                  className={inputClass}
                  id="new-position-name"
                  maxLength={UNION_SETTINGS_LIMITS.positionName}
                  placeholder="VD: Thủ quỹ, Ủy viên UBKT..."
                  value={newPosName}
                  onChange={(e) => setNewPosName(e.target.value)}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-[11px] font-semibold text-on-surface-variant"
                  htmlFor="new-position-order"
                >
                  Thứ tự
                </label>
                <input
                  aria-label="Thứ tự chức danh"
                  className={`${baseInputClass} w-full text-center tabular-nums`}
                  id="new-position-order"
                  min={1}
                  title="Thứ tự hiển thị"
                  type="number"
                  value={newPosOrder}
                  onChange={(e) => setNewPosOrder(Number(e.target.value) || 0)}
                />
              </div>
              <button
                className="inline-flex h-[34px] shrink-0 items-center justify-center gap-1 rounded-lg bg-[#173A67] px-3.5 text-xs font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-50"
                disabled={addingPos || !newPosName.trim()}
                type="submit"
              >
                <MaterialIcon className="text-[16px]" name="add" />
                Thêm
              </button>
            </div>
          </form>

          {/* Danh sách chức danh */}
          <div className="space-y-2">
            {sortedPositions.map((pos) => {
              const isEditing = editingPosId === pos.id;
              const usedCount = officers.filter((o) => o.positionId === pos.id).length;

              return (
                <div
                  key={pos.id}
                  className={`rounded-xl border p-3 transition ${
                    pos.isActive
                      ? "border-[#d2dfe9] bg-white hover:bg-[#f8fbff]"
                      : "border-dashed border-outline-variant bg-surface-container-low/50 opacity-75"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-[minmax(0,1fr)_88px] items-end gap-2">
                        <div className="min-w-0">
                          <label
                            className="mb-1 block text-[11px] font-semibold text-on-surface-variant"
                            htmlFor={`edit-pos-name-${pos.id}`}
                          >
                            Tên chức danh
                          </label>
                          <input
                            className={inputClass}
                            id={`edit-pos-name-${pos.id}`}
                            maxLength={UNION_SETTINGS_LIMITS.positionName}
                            placeholder="Tên chức danh"
                            value={editingPosName}
                            onChange={(e) => setEditingPosName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label
                            className="mb-1 block text-[11px] font-semibold text-on-surface-variant"
                            htmlFor={`edit-pos-order-${pos.id}`}
                          >
                            Thứ tự
                          </label>
                          <input
                            aria-label="Thứ tự hiển thị"
                            className={`${baseInputClass} w-full text-center tabular-nums`}
                            id={`edit-pos-order-${pos.id}`}
                            min={1}
                            title="Thứ tự"
                            type="number"
                            value={editingPosOrder}
                            onChange={(e) => setEditingPosOrder(Number(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          className="rounded-lg border border-outline-variant px-3 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                          type="button"
                          onClick={() => setEditingPosId(null)}
                        >
                          Hủy
                        </button>
                        <button
                          className="rounded-lg bg-[#173A67] px-3.5 py-1 text-xs font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-50"
                          disabled={busyPosId === pos.id || !editingPosName.trim()}
                          type="button"
                          onClick={() => void saveEditPosition(pos.id)}
                        >
                          Lưu
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-[#ecf4ff] px-1.5 text-xs font-bold text-[#173A67] tabular-nums">
                            {pos.displayOrder}
                          </span>
                          <span
                            className={`truncate text-sm font-bold ${
                              pos.isActive
                                ? "text-[#173A67]"
                                : "text-on-surface-variant line-through"
                            }`}
                          >
                            {pos.name}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              pos.isActive
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            {pos.isActive ? "Đang dùng" : "Đã ngừng dùng"}
                          </span>
                        </div>
                        <p className="mt-0.5 pl-8 text-[11px] text-on-surface-variant">
                          {usedCount > 0 ? `Đang gán cho ${usedCount} cán bộ` : "Chưa gán cán bộ nào"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          aria-label="Đưa chức danh lên"
                          className={iconButtonClass}
                          disabled={busyPosId === pos.id || sortedPositions[0]?.id === pos.id}
                          title="Đưa lên"
                          type="button"
                          onClick={() => void movePositionOrder(pos, -1)}
                        >
                          <MaterialIcon className="text-[15px]" name="arrow_upward" />
                        </button>
                        <button
                          aria-label="Đưa chức danh xuống"
                          className={iconButtonClass}
                          disabled={
                            busyPosId === pos.id ||
                            sortedPositions[sortedPositions.length - 1]?.id === pos.id
                          }
                          title="Đưa xuống"
                          type="button"
                          onClick={() => void movePositionOrder(pos, 1)}
                        >
                          <MaterialIcon className="text-[15px]" name="arrow_downward" />
                        </button>
                        <button
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-outline-variant px-2.5 text-xs font-semibold text-[#173A67] hover:border-[#173A67]"
                          title="Đổi tên hoặc sửa thứ tự chức danh"
                          type="button"
                          onClick={() => startEditPosition(pos)}
                        >
                          <MaterialIcon className="text-[14px]" name="edit" />
                          Đổi tên
                        </button>
                        <button
                          className={`inline-flex h-7 items-center rounded-lg border px-2.5 text-xs font-semibold disabled:opacity-50 ${
                            pos.isActive
                              ? "border-outline-variant text-on-surface-variant hover:border-amber-600 hover:text-amber-800"
                              : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                          }`}
                          disabled={busyPosId === pos.id}
                          title={
                            pos.isActive
                              ? "Ngừng dùng chức danh này"
                              : "Kích hoạt lại chức danh này"
                          }
                          type="button"
                          onClick={() => void togglePositionActive(pos)}
                        >
                          {pos.isActive ? "Ngừng" : "Bật"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* MODAL THÊM / SỬA CÁN BỘ CÔNG ĐOÀN */}
      {editingOfficer ? (
        <div
          aria-labelledby="officer-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3"
          role="dialog"
        >
          <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#d2dfe9] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3.5">
              <div className="flex items-center gap-2">
                <MaterialIcon className="text-[22px] text-[#173A67]" name="badge" />
                <h3 id="officer-modal-title" className="text-base font-extrabold text-[#173A67]">
                  {editingOfficer.id ? "Cập nhật cán bộ công đoàn" : "Thêm cán bộ công đoàn"}
                </h3>
              </div>
              <button
                aria-label="Đóng"
                className={iconButtonClass}
                type="button"
                onClick={() => setEditingOfficer(null)}
              >
                <MaterialIcon className="text-[20px]" name="close" />
              </button>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveOfficer}>
              <div className="space-y-3.5 overflow-y-auto p-5">
                {/* 1. Liên kết tài khoản đoàn viên (1 ô combobox / autocomplete duy nhất, không bắt buộc) */}
                <div className="rounded-xl border border-[#d2dfe9] bg-[#f8fbff] p-3">
                  <label className={labelClass} htmlFor="officer-user-link">
                    Liên kết tài khoản đoàn viên{" "}
                    <span className="font-normal text-on-surface-variant">(không bắt buộc)</span>
                  </label>
                  <div className="relative">
                    <MaterialIcon
                      className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[17px] ${
                        editingOfficer.userId ? "text-emerald-700" : "text-on-surface-variant"
                      }`}
                      name={editingOfficer.userId ? "link" : "person_search"}
                    />
                    <input
                      ref={memberInputRef}
                      aria-autocomplete="list"
                      aria-controls="officer-member-listbox"
                      aria-expanded={memberDropdownOpen}
                      autoComplete="off"
                      className={`${inputClass} pl-8 pr-8 ${
                        editingOfficer.userId
                          ? "border-emerald-400 bg-emerald-50/40 font-semibold text-[#173A67]"
                          : ""
                      }`}
                      id="officer-user-link"
                      placeholder="Gõ tên hoặc mã nhân viên để tìm và chọn (hoặc bỏ trống)..."
                      role="combobox"
                      type="text"
                      value={memberSearch}
                      onBlur={() => setMemberDropdownOpen(false)}
                      onChange={(e) => handleMemberInputChange(e.target.value)}
                      onFocus={() => setMemberDropdownOpen(true)}
                      onKeyDown={handleMemberInputKeyDown}
                    />
                    {editingOfficer.userId || memberSearch ? (
                      <button
                        aria-label="Bỏ liên kết tài khoản đoàn viên"
                        className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant hover:bg-slate-200/70 hover:text-error"
                        title="Không liên kết (giữ họ tên để nhập trực tiếp)"
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleUnlinkMember();
                        }}
                      >
                        <MaterialIcon className="text-[16px]" name="close" />
                      </button>
                    ) : null}

                    {memberDropdownOpen ? (
                      <div
                        className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[#c5d6e6] bg-white p-1 shadow-xl"
                        id="officer-member-listbox"
                        role="listbox"
                      >
                        {filteredMembers.length === 0 ? (
                          <div className="px-3 py-2.5 text-xs text-on-surface-variant">
                            Không tìm thấy đoàn viên khớp từ khóa. Bạn có thể nhập họ tên cán bộ trực tiếp ở ô bên dưới.
                          </div>
                        ) : (
                          filteredMembers.map((m, idx) => {
                            const active = idx === safeMemberHighlight;
                            const isSelected = editingOfficer.userId === m.id;
                            return (
                              <button
                                key={m.id}
                                aria-selected={isSelected}
                                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                                  active
                                    ? "bg-[#173A67] text-white"
                                    : isSelected
                                      ? "bg-emerald-50 font-semibold text-emerald-950"
                                      : "text-on-surface hover:bg-[#ecf4ff]"
                                }`}
                                role="option"
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectMember(m.id);
                                }}
                                onMouseEnter={() => setMemberHighlightIndex(idx)}
                              >
                                <div className="min-w-0 truncate">
                                  <span className="font-bold">{m.fullName}</span>
                                  {m.employeeCode ? (
                                    <span
                                      className={`ml-1.5 ${
                                        active ? "text-sky-100" : "text-on-surface-variant"
                                      }`}
                                    >
                                      ({m.employeeCode})
                                    </span>
                                  ) : null}
                                  {m.department ? (
                                    <span
                                      className={`ml-1.5 ${
                                        active ? "text-sky-100" : "text-on-surface-variant"
                                      }`}
                                    >
                                      — {m.department}
                                    </span>
                                  ) : null}
                                </div>
                                <span
                                  className={`shrink-0 text-[10px] font-semibold ${
                                    active ? "text-sky-100" : "text-[#173A67]"
                                  }`}
                                >
                                  {isSelected ? "Đang chọn" : "Chọn ↵"}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[11px] text-on-surface-variant">
                    {editingOfficer.userId ? (
                      <span className="font-semibold text-emerald-800">
                        Đã liên kết tài khoản đoàn viên • Bấm dấu × bên phải ô nếu muốn hủy liên kết.
                      </span>
                    ) : (
                      "Không liên kết: gõ tên hoặc mã NV để chọn nhanh, hoặc để trống và nhập họ tên trực tiếp bên dưới."
                    )}
                  </p>
                </div>

                {/* 2. Họ và tên */}
                <div>
                  <label className={labelClass} htmlFor="officer-full-name">
                    Họ và tên cán bộ <span className="text-error">*</span>
                  </label>
                  <input
                    required
                    className={inputClass}
                    id="officer-full-name"
                    maxLength={UNION_SETTINGS_LIMITS.officerName}
                    placeholder="VD: Nguyễn Văn A"
                    value={editingOfficer.fullName}
                    onChange={(e) =>
                      setEditingOfficer({ ...editingOfficer, fullName: e.target.value })
                    }
                  />
                </div>

                {/* 3. Chức danh & Thứ tự */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                  <div>
                    <label className={labelClass} htmlFor="officer-position">
                      Chức danh công đoàn <span className="text-error">*</span>
                    </label>
                    <select
                      required
                      className={inputClass}
                      id="officer-position"
                      value={editingOfficer.positionId}
                      onChange={(e) =>
                        setEditingOfficer({ ...editingOfficer, positionId: e.target.value })
                      }
                    >
                      <option value="">— Chọn chức danh —</option>
                      {selectablePositionsForModal.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.isActive ? "" : " (đã ngừng dùng)"}
                        </option>
                      ))}
                    </select>
                    {selectablePositionsForModal.length === 0 ? (
                      <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                        Chưa có chức danh nào đang dùng.{" "}
                        <button
                          className="font-bold text-[#173A67] underline hover:no-underline"
                          type="button"
                          onClick={() => {
                            setEditingOfficer(null);
                            switchTab("chuc-danh");
                          }}
                        >
                          Mở mục Chức danh để thêm/bật →
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="officer-order">
                      Thứ tự
                    </label>
                    <input
                      className={`${baseInputClass} w-full text-center tabular-nums`}
                      id="officer-order"
                      min={1}
                      type="number"
                      value={editingOfficer.displayOrder}
                      onChange={(e) =>
                        setEditingOfficer({
                          ...editingOfficer,
                          displayOrder: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                {/* 4. Nhiệm kỳ (không bắt buộc) */}
                <div>
                  <label className={labelClass} htmlFor="officer-term">
                    Nhiệm kỳ <span className="font-normal text-on-surface-variant">(tùy chọn)</span>
                  </label>
                  <input
                    className={inputClass}
                    id="officer-term"
                    maxLength={UNION_SETTINGS_LIMITS.term}
                    placeholder="VD: 2023 - 2028"
                    value={editingOfficer.term}
                    onChange={(e) => setEditingOfficer({ ...editingOfficer, term: e.target.value })}
                  />
                </div>

                {/* 5. Cờ đang hoạt động */}
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#d2dfe9] bg-surface-container-lowest p-3 text-sm font-semibold text-on-surface select-none">
                  <input
                    checked={editingOfficer.isActive}
                    className="h-4 w-4 rounded border-slate-300 text-[#173A67]"
                    type="checkbox"
                    onChange={(e) =>
                      setEditingOfficer({ ...editingOfficer, isActive: e.target.checked })
                    }
                  />
                  <div>
                    <div>Đang hoạt động</div>
                    <p className="text-xs font-normal text-on-surface-variant">
                      Hiển thị trong danh sách gợi ý khi gõ tên ở mục Thành phần tham gia của văn bản.
                    </p>
                  </div>
                </label>

                {/* Xem trước định dạng chèn vào văn bản */}
                {editingOfficer.fullName.trim() ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-950">
                    <span className="font-semibold">Định dạng khi chọn trong biên bản họp: </span>
                    <strong className="font-bold">
                      {formatOfficerAttendee({
                        fullName: editingOfficer.fullName,
                        positionName:
                          positions.find((p) => p.id === editingOfficer.positionId)?.name ??
                          "Chủ tịch",
                      })}
                    </strong>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-outline-variant bg-white px-5 py-3">
                <button
                  className="rounded-lg border border-outline-variant px-4 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                  disabled={savingOfficer}
                  type="button"
                  onClick={() => setEditingOfficer(null)}
                >
                  Hủy
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#173A67] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1E4A7D] disabled:opacity-50"
                  disabled={
                    savingOfficer ||
                    !editingOfficer.fullName.trim() ||
                    !editingOfficer.positionId
                  }
                  type="submit"
                >
                  <MaterialIcon className="text-[16px]" name="save" />
                  {savingOfficer ? "Đang lưu…" : "Lưu cán bộ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
