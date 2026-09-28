import { prisma } from "@/lib/prisma";

export type CafeSettings = {
  cafeName: string;
  currency: string;
  currencySymbol: string;
  receiptFooter: string;
  address: string;
};

const defaults: CafeSettings = {
  cafeName: "What The Food",
  currency: "PKR",
  currencySymbol: "Rs",
  receiptFooter: "Thank you for visiting What The Food!",
  address: "Karachi",
};

export async function getSettings(): Promise<CafeSettings> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    cafeName: map.cafeName ?? defaults.cafeName,
    currency: map.currency ?? defaults.currency,
    currencySymbol: map.currencySymbol ?? defaults.currencySymbol,
    receiptFooter: map.receiptFooter ?? defaults.receiptFooter,
    address: map.address ?? defaults.address,
  };
}

export async function setSettings(partial: Partial<CafeSettings>) {
  const entries = Object.entries(partial).filter(([, v]) => v != null) as [string, string][];
  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}
