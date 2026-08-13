"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/client";

type ValidateResult = {
  ok: boolean;
  message?: string;
  employee_code?: string;
  full_name?: string;
  department?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validatedCode, setValidatedCode] = useState<string | null>(null);

  async function validateCode() {
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "validate_employee_for_signup",
      { p_code: employeeCode },
    );

    if (rpcError) {
      setError(rpcError.message);
      setValidatedCode(null);
      return null;
    }

    const result = data as ValidateResult;
    if (!result?.ok) {
      setError(result?.message ?? "Mã nhân viên không hợp lệ.");
      setValidatedCode(null);
      return null;
    }

    setValidatedCode(result.employee_code ?? employeeCode.trim());
    if (result.full_name) setFullName(result.full_name);
    if (result.department) setDepartment(result.department);
    return result;
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const validated = await validateCode();
    if (!validated?.ok) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const code = validated.employee_code ?? employeeCode.trim();
    const name = fullName.trim() || validated.full_name || "";
    const dept = department.trim() || validated.department || "";

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name,
          employee_code: code,
          department: dept,
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    router.push("/pending");
    router.refresh();
  }

  return (
    <AppShell activeHref="/register">
      <div className="mx-auto max-w-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <h1 className="mb-2 text-headline-md text-[#173A67]">Đăng ký đoàn viên</h1>
        <p className="mb-6 text-body-md text-on-surface-variant">
          Nhập mã nhân viên Si Mê Mít Tươi. Tài khoản sẽ chờ admin phê duyệt trước
          khi vào hệ thống.
        </p>

        <form className="space-y-4" onSubmit={handleRegister}>
          <div>
            <label className="mb-1 block text-label-md" htmlFor="employeeCode">
              Mã nhân viên
            </label>
            <div className="flex gap-2">
              <input
                required
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 outline-none focus:border-[#173A67]"
                id="employeeCode"
                value={employeeCode}
                onChange={(e) => {
                  setEmployeeCode(e.target.value);
                  setValidatedCode(null);
                }}
              />
              <button
                className="shrink-0 rounded-xl border-2 border-tertiary px-3 py-2 text-sm font-bold text-on-tertiary-container"
                type="button"
                onClick={() => void validateCode()}
              >
                Kiểm tra
              </button>
            </div>
            {validatedCode ? (
              <p className="mt-1 text-xs text-[#173A67]">
                Mã hợp lệ: {validatedCode}
                {department ? ` — ${department}` : ""}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-label-md" htmlFor="fullName">
              Họ và tên
            </label>
            <input
              required
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 outline-none focus:border-[#173A67]"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-label-md" htmlFor="email">
              Email
            </label>
            <input
              required
              autoComplete="email"
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 outline-none focus:border-[#173A67]"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-label-md" htmlFor="password">
              Mật khẩu
            </label>
            <input
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 outline-none focus:border-[#173A67]"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="w-full rounded-xl bg-tertiary px-4 py-3 font-bold text-on-tertiary transition-shadow hover:shadow-md disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-on-surface-variant">
          Đã có tài khoản?{" "}
          <Link className="font-bold text-[#173A67] hover:underline" href="/login">
            Đăng nhập
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
