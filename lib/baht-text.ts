const digits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const places = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
const money = new Intl.NumberFormat("en-US", { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 });

function readInteger(number: number): string {
  if (number >= 1_000_000) {
    return readInteger(Math.floor(number / 1_000_000)) + "ล้าน" + readInteger(number % 1_000_000);
  }
  return String(number).split("").map((character, index, all) => {
    const digit = Number(character), place = all.length - index - 1;
    if (digit === 0) return "";
    if (place === 1 && digit === 1) return "สิบ";
    if (place === 1 && digit === 2) return "ยี่สิบ";
    if (place === 0 && digit === 1 && number > 1) return "เอ็ด";
    return digits[digit] + places[place];
  }).join("");
}

export function bahtText(value: unknown): string {
  const validText = typeof value === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim());
  const number = typeof value === "number" || validText ? Number(value) : NaN;
  if (!Number.isFinite(number) || Math.abs(number) >= 1e15) {
    throw Error("BAHTTEXT ต้องใช้ยอดเงินที่มีขนาดต่ำกว่าหนึ่งพันล้านล้านบาท");
  }
  const [baht, satang] = money.format(Math.abs(number)).split(".").map(Number);
  const sign = number < 0 && (baht || satang) ? "ลบ" : "";
  return sign + (readInteger(baht) || "ศูนย์") + "บาท" + (satang ? readInteger(satang) + "สตางค์" : "ถ้วน");
}
