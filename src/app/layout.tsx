import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "vietnamese"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Si Mê Mít Tươi - Trung Tâm Gắn Kết Đoàn Viên",
  description:
    "Website công đoàn báo cáo hoạt động, quản lý điểm và bảng xếp hạng đoàn viên.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="light" lang="vi">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${manrope.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
