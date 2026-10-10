import { Metadata } from "next";
import { FeedbackClient } from "@/components/feedback/FeedbackClient";

export const metadata: Metadata = {
  title: "Góp ý & Nguyện vọng Đoàn viên | CDILV.VN",
  description:
    "Hòm thư tiếp nhận ý kiến đóng góp, nguyện vọng và sáng kiến xây dựng Công đoàn CDILV vững mạnh.",
};

export default function FeedbackPage() {
  return <FeedbackClient />;
}
