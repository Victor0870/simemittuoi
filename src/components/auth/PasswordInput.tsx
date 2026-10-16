"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type PasswordInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
};

export function PasswordInput({ id, value, onChange, autoComplete, minLength }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        required
        id={id}
        type={visible ? "text" : "password"}
        minLength={minLength}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-xl border border-outline-variant bg-surface py-3 pr-12 pl-4 outline-none focus:border-[#173A67]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={visible}
        title={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu để kiểm tra"}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-on-surface-variant transition hover:text-[#173A67]"
      >
        <MaterialIcon className="text-[22px]" name={visible ? "visibility_off" : "visibility"} />
      </button>
    </div>
  );
}
