import type { PaymentSlipData } from "@/lib/payments/slip-data";

/**
 * Giấy đề nghị thanh toán dạng HTML, dựng theo vùng in A1:I36 của mẫu de_nghi_thanh_toan.xlsx
 * (chữ cố định chép từ mẫu; dữ liệu lấy từ mapPaymentSlip – cùng nguồn với file Excel).
 */

/** Độ rộng cột A–I của mẫu (đơn vị ký tự Excel). */
const COLUMN_WIDTHS = [9.2, 18.2, 2.4, 16.4, 8.8, 19.8, 2.2, 17.8, 18];
const TOTAL_WIDTH = COLUMN_WIDTHS.reduce((a, b) => a + b, 0);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const num = new Intl.NumberFormat("vi-VN");

/** Định dạng ngày d-mmm-yy của ô D4. */
function slipDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d}-${MONTHS[m - 1]}-${String(y).slice(-2)}`;
}

/** Định dạng kế toán của mẫu: 0 hiện “-”, số âm trong ngoặc. */
function accounting(value: number | null): string {
  if (value === null) return "";
  if (value === 0) return "-";
  return value < 0 ? `(${num.format(-value)})` : num.format(value);
}

function amount(value: number | null): string {
  return value === null ? "" : num.format(value);
}

const cell = "border border-black px-1 py-0.5 align-middle";

function Colgroup({ widths }: { widths: number[] }) {
  const total = widths.reduce((a, b) => a + b, 0);
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${(w / total) * 100}%` }} />
      ))}
    </colgroup>
  );
}

export function PaymentSlipPreview({ data }: { data: PaymentSlipData }) {
  return (
    <div className="space-y-4">
      <div
        className="mx-auto w-full max-w-[820px] bg-white p-2 font-[Arial,Helvetica,sans-serif] text-[9px] leading-snug text-black shadow-md sm:p-6 sm:text-[12px]"
      >
        <table className="w-full table-fixed border-collapse">
          <Colgroup widths={COLUMN_WIDTHS} />
          <tbody>
            <tr>
              <td className="h-[48px] align-top sm:h-[96px]" colSpan={9}>
                <img
                  alt="Logo"
                  className="h-[40px] w-auto sm:h-[84px]"
                  src="/print/payment-slip-logo.png"
                  style={{ maxWidth: `${((COLUMN_WIDTHS[0] + COLUMN_WIDTHS[1]) / TOTAL_WIDTH) * 100}%` }}
                />
              </td>
            </tr>
            <tr>
              <td className="pb-3 text-center" colSpan={9}>
                <div className="text-[13px] font-bold sm:text-[20px]">GIẤY ĐỀ NGHỊ THANH TOÁN</div>
                <div className="text-[11px] sm:text-[17px]">STATEMENT OF EXPENSES</div>
              </td>
            </tr>
            <tr>
              <td colSpan={2}>Ngày/ Date</td>
              <td className="font-bold">:</td>
              <td className="text-[10px] font-bold sm:text-[15px]" colSpan={4}>
                {slipDate(data.date)}
              </td>
              <td colSpan={2} />
            </tr>
            <tr>
              <td colSpan={2}>Người yêu cầu/ Requestor</td>
              <td className="font-bold">:</td>
              <td className="text-[10.5px] font-bold sm:text-[16px]" colSpan={4}>
                {data.requester}
              </td>
              <td className="text-center" colSpan={2}>
                Branch: Hai Phong
              </td>
            </tr>
            <tr>
              <td colSpan={2}>Bộ phận/ Department</td>
              <td className="font-bold">:</td>
              <td className="text-[10.5px] italic sm:text-[16px]" colSpan={6}>
                {data.department}
              </td>
            </tr>
            <tr>
              <td className="pt-3 italic" colSpan={7}>
                Kindly request to pay following expenses use for ILV&apos;s business as details:
              </td>
              <td className="pt-3 text-right" colSpan={2}>
                Unit (đơn vị): VND
              </td>
            </tr>

            <tr className="text-center">
              <td className={cell} rowSpan={2}>
                Item
                <br />
                (Thứ tự)
              </td>
              <td className={cell} colSpan={8}>
                Particulars <i>(Chi tiết chi phí )</i>
              </td>
            </tr>
            <tr className="text-center">
              <td className={cell} colSpan={4}>
                Expenditure in detail
                <br />
                <i>(Chi phí chi tiết)</i>
              </td>
              <td className={cell} colSpan={2}>
                Paid to
                <br />
                <i>(đối tượng nhận)</i>
              </td>
              <td className={cell}>
                Paid amount
                <br />
                <i>(thực trả)</i>
              </td>
              <td className={cell}>
                Advanced
                <br />
                <i>(đã tạm ứng)</i>
              </td>
            </tr>
            {data.lines.map((line, i) => (
              <tr key={i} className="h-[22px] sm:h-[42px]">
                <td className={`${cell} text-center`}>{line?.no ?? ""}</td>
                <td className={`${cell} break-words`} colSpan={4}>
                  {line?.content ?? ""}
                </td>
                <td className={`${cell} text-center break-words`} colSpan={2}>
                  {line?.paidTo ?? ""}
                </td>
                <td className={`${cell} text-right whitespace-nowrap`}>{line ? amount(line.amount) : ""}</td>
                <td className={`${cell} text-right whitespace-nowrap`}>{line ? amount(line.advanced) : ""}</td>
              </tr>
            ))}
            <tr className="h-[20px] font-bold sm:h-[40px]">
              <td className={`${cell} text-center`} colSpan={7}>
                Total/ Tổng cộng
              </td>
              <td className={`${cell} text-center`}>{accounting(data.totals.paid)}</td>
              <td className={`${cell} text-center`}>{accounting(data.totals.advanced)}</td>
            </tr>
            <tr className="h-[20px] sm:h-[40px]">
              <td className={`${cell} text-center`} colSpan={7}>
                Under Paid (chưa thanh toán)
              </td>
              <td className={`${cell} text-center font-bold`} colSpan={2}>
                {accounting(data.totals.underPaid)}
              </td>
            </tr>
            <tr className="h-[20px] sm:h-[40px]">
              <td className={`${cell} text-center`} colSpan={7}>
                Over Paid (trả lại cho công ty)
              </td>
              <td className={`${cell} text-center font-bold`} colSpan={2}>
                {accounting(data.totals.overPaid)}
              </td>
            </tr>

            <tr>
              <td className="pt-4 font-bold" colSpan={4}>
                Phương thức thanh toán:
              </td>
              <td className="pt-4" colSpan={3}>
                {data.cash ? "☑" : "☐"} Cash
              </td>
              <td className="pt-4 pl-2" colSpan={2}>
                Exchange Rate:
              </td>
            </tr>
            <tr>
              <td colSpan={4}>Payment method</td>
              <td colSpan={3}>{data.bank ? "☑" : "☐"} Bank</td>
              <td className="pl-2" colSpan={2}>
                (VND/USD)
              </td>
            </tr>
            <tr>
              <td className="pt-4 font-bold" colSpan={4}>
                Người nhận<i>: </i>
              </td>
              <td className="pt-4 pl-2" colSpan={2}>
                Chủ TK/ Benificiary
              </td>
              <td className="pt-4">:</td>
              <td className="pt-4 break-words" colSpan={2}>
                {data.receiverName}
              </td>
            </tr>
            <tr>
              <td colSpan={4}>Receiver</td>
              <td className="pl-2" colSpan={2}>
                TK số/ Account No.
              </td>
              <td>:</td>
              <td className="break-all" colSpan={2}>
                {data.receiverAccount}
              </td>
            </tr>
            <tr>
              <td colSpan={4} />
              <td className="pl-2" colSpan={2}>
                Tại NH/ At bank
              </td>
              <td>:</td>
              <td className="break-words" colSpan={2}>
                {data.receiverBank}
              </td>
            </tr>
            <tr>
              <td colSpan={4} />
              <td className="border-b border-l border-black py-1 pl-2" colSpan={2}>
                {data.descriptionLabel}
              </td>
              <td className="py-1">:</td>
              <td className="py-1 font-bold break-words" colSpan={2}>
                {data.description}
              </td>
            </tr>

            <tr>
              <td className="pt-6" colSpan={9} />
            </tr>
            <tr className="text-center font-bold">
              <td colSpan={4}>{data.signatures[0]?.title}</td>
              <td colSpan={3}>{data.signatures[1]?.title}</td>
              <td colSpan={2}>{data.signatures[2]?.title}</td>
            </tr>
            <tr>
              <td className="h-[40px] sm:h-[72px]" colSpan={9} />
            </tr>
            <tr className="text-center font-bold">
              <td colSpan={4}>{data.signatures[0]?.name}</td>
              <td colSpan={3}>{data.signatures[1]?.name}</td>
              <td colSpan={2}>{data.signatures[2]?.name}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {data.itemSheet ? (
        <div className="mx-auto w-full max-w-[820px] bg-white p-2 font-[Arial,Helvetica,sans-serif] text-[9px] leading-snug text-black shadow-md sm:p-6 sm:text-[12px]">
          <p className="text-center text-[11px] font-bold sm:text-[16px]">{data.itemSheet.heading}</p>
          <p className="mb-3 text-center italic">{data.itemSheet.title}</p>
          <table className="w-full table-fixed border-collapse">
            <Colgroup widths={[6, 52, 26, 15, 15]} />
            <thead>
              <tr className="bg-[#EFF3F8] text-center font-bold">
                <th className={cell}>STT</th>
                <th className={cell}>Chi tiết chi phí</th>
                <th className={cell}>Đối tượng nhận</th>
                <th className={cell}>Thực trả</th>
                <th className={cell}>Đã tạm ứng</th>
              </tr>
            </thead>
            <tbody>
              {data.itemSheet.rows.map((row) => (
                <tr key={row.no}>
                  <td className={`${cell} text-center`}>{row.no}</td>
                  <td className={`${cell} break-words`}>{row.content}</td>
                  <td className={`${cell} break-words`}>{row.paidTo}</td>
                  <td className={`${cell} text-right whitespace-nowrap`}>{amount(row.amount)}</td>
                  <td className={`${cell} text-right whitespace-nowrap`}>{amount(row.advanced)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className={cell} colSpan={3}>
                  Tổng cộng
                </td>
                <td className={`${cell} text-right whitespace-nowrap`}>{amount(data.itemSheet.totalPaid)}</td>
                <td className={`${cell} text-right whitespace-nowrap`}>{amount(data.itemSheet.totalAdvanced)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
