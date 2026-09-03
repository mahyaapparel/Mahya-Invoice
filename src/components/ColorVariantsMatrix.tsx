import React from 'react';
import { ConvectionOrder, ColorVariant } from '../types';
import { Palette, Layers } from 'lucide-react';

interface ColorVariantsMatrixProps {
  order: ConvectionOrder;
  className?: string;
  compact?: boolean;
}

// Helper to calculate total for a single color variant
export function getColorVariantTotals(variant: ColorVariant) {
  const sShort = Number(variant.sizeS_short) || 0;
  const sLong = Number(variant.sizeS_long) || 0;
  const mShort = Number(variant.sizeM_short) || 0;
  const mLong = Number(variant.sizeM_long) || 0;
  const lShort = Number(variant.sizeL_short) || 0;
  const lLong = Number(variant.sizeL_long) || 0;
  const xlShort = Number(variant.sizeXL_short) || 0;
  const xlLong = Number(variant.sizeXL_long) || 0;
  const xxlShort = Number(variant.sizeXXL_short) || 0;
  const xxlLong = Number(variant.sizeXXL_long) || 0;

  const customList = variant.customSizes || [];
  const customShort = customList.reduce((sum, c) => sum + (Number(c.short) || 0), 0);
  const customLong = customList.reduce((sum, c) => sum + (Number(c.long) || 0), 0);

  const totalShort = sShort + mShort + lShort + xlShort + xxlShort + customShort;
  const totalLong = sLong + mLong + lLong + xlLong + xxlLong + customLong;
  const totalQty = totalShort + totalLong;

  return {
    sShort,
    sLong,
    sTotal: sShort + sLong,
    mShort,
    mLong,
    mTotal: mShort + mLong,
    lShort,
    lLong,
    lTotal: lShort + lLong,
    xlShort,
    xlLong,
    xlTotal: xlShort + xlLong,
    xxlShort,
    xxlLong,
    xxlTotal: xxlShort + xxlLong,
    customShort,
    customLong,
    customTotal: customShort + customLong,
    customList,
    totalShort,
    totalLong,
    totalQty
  };
}

// Generate text representation for WhatsApp / Thermal Receipts
export function formatColorVariantsText(variants: ColorVariant[]): string {
  if (!variants || variants.length === 0) return '';
  let text = '';
  variants.forEach((v, idx) => {
    const t = getColorVariantTotals(v);
    if (t.totalQty === 0 && !v.colorName) return;

    text += `${idx + 1}. *Warna: ${v.colorName || 'Standar'}* (Total: ${t.totalQty} pcs)\n`;
    
    // Short details
    const shortDetails: string[] = [];
    if (t.sShort > 0) shortDetails.push(`S:${t.sShort}`);
    if (t.mShort > 0) shortDetails.push(`M:${t.mShort}`);
    if (t.lShort > 0) shortDetails.push(`L:${t.lShort}`);
    if (t.xlShort > 0) shortDetails.push(`XL:${t.xlShort}`);
    if (t.xxlShort > 0) shortDetails.push(`XXL:${t.xxlShort}`);
    t.customList.forEach(cs => {
      if ((cs.short || 0) > 0) shortDetails.push(`${cs.name}:${cs.short}`);
    });
    if (shortDetails.length > 0) {
      text += `   • Pendek (${t.totalShort} pcs): ${shortDetails.join(', ')}\n`;
    }

    // Long details
    const longDetails: string[] = [];
    if (t.sLong > 0) longDetails.push(`S:${t.sLong}`);
    if (t.mLong > 0) longDetails.push(`M:${t.mLong}`);
    if (t.lLong > 0) longDetails.push(`L:${t.lLong}`);
    if (t.xlLong > 0) longDetails.push(`XL:${t.xlLong}`);
    if (t.xxlLong > 0) longDetails.push(`XXL:${t.xxlLong}`);
    t.customList.forEach(cs => {
      if ((cs.long || 0) > 0) longDetails.push(`${cs.name}:${cs.long}`);
    });
    if (longDetails.length > 0) {
      text += `   • Panjang (${t.totalLong} pcs): ${longDetails.join(', ')}\n`;
    }
  });
  return text;
}

export const ColorVariantsMatrix: React.FC<ColorVariantsMatrixProps> = ({ order, className = '', compact = false }) => {
  const variants = order.colorVariants;

  if (!variants || variants.length === 0) {
    return null;
  }

  // Check if any variant has custom sizes
  const anyCustom = variants.some(v => v.customSizes && v.customSizes.some(c => (c.short || 0) > 0 || (c.long || 0) > 0));

  // Compute grand totals across all variants
  const grandTotals = variants.reduce(
    (acc, v) => {
      const t = getColorVariantTotals(v);
      return {
        sShort: acc.sShort + t.sShort,
        sLong: acc.sLong + t.sLong,
        mShort: acc.mShort + t.mShort,
        mLong: acc.mLong + t.mLong,
        lShort: acc.lShort + t.lShort,
        lLong: acc.lLong + t.lLong,
        xlShort: acc.xlShort + t.xlShort,
        xlLong: acc.xlLong + t.xlLong,
        xxlShort: acc.xxlShort + t.xxlShort,
        xxlLong: acc.xxlLong + t.xxlLong,
        customShort: acc.customShort + t.customShort,
        customLong: acc.customLong + t.customLong,
        totalShort: acc.totalShort + t.totalShort,
        totalLong: acc.totalLong + t.totalLong,
        totalQty: acc.totalQty + t.totalQty
      };
    },
    {
      sShort: 0,
      sLong: 0,
      mShort: 0,
      mLong: 0,
      lShort: 0,
      lLong: 0,
      xlShort: 0,
      xlLong: 0,
      xxlShort: 0,
      xxlLong: 0,
      customShort: 0,
      customLong: 0,
      totalShort: 0,
      totalLong: 0,
      totalQty: 0
    }
  );

  return (
    <div className={`space-y-3 print:space-y-2 ${className}`}>
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100 pb-2 print:pb-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-bold print:hidden">
            <Palette className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs uppercase font-extrabold text-slate-800 tracking-wider flex items-center gap-1.5">
              <span>Matriks Distribusi Varian Warna & Ukuran Kain</span>
              <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full print:border print:border-amber-300">
                {variants.length} Warna
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 print:text-[10px]">
              Panduan pemotongan bahan, sablon/bordir, dan penjahitan sesuai warna kain yang dipesan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700 print:text-[10px]">
          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
            Pendek: <strong className="text-emerald-700">{grandTotals.totalShort} pcs</strong>
          </span>
          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
            Panjang: <strong className="text-indigo-700">{grandTotals.totalLong} pcs</strong>
          </span>
          <span className="bg-amber-100 text-amber-950 px-2.5 py-0.5 rounded font-black">
            Total: {grandTotals.totalQty} pcs
          </span>
        </div>
      </div>

      {/* Mobile Card View (< sm) */}
      <div className="sm:hidden space-y-2.5">
        {variants.map((variant, idx) => {
          const t = getColorVariantTotals(variant);
          return (
            <div
              key={variant.id || idx}
              className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-black text-slate-900 uppercase">
                    Warna: {variant.colorName || `Warna ${idx + 1}`}
                  </span>
                </div>
                <span className="text-xs font-mono font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {t.totalQty} pcs
                </span>
              </div>

              {/* Sleeve breakdowns */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Pendek */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2 space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-emerald-900 border-b border-emerald-200 pb-0.5">
                    <span>LENGAN PENDEK</span>
                    <span className="font-mono">{t.totalShort} pcs</span>
                  </div>
                  <div className="text-[11px] text-emerald-950 font-mono space-y-0.5 pt-0.5">
                    {t.sShort > 0 && <div>S: <strong>{t.sShort}</strong></div>}
                    {t.mShort > 0 && <div>M: <strong>{t.mShort}</strong></div>}
                    {t.lShort > 0 && <div>L: <strong>{t.lShort}</strong></div>}
                    {t.xlShort > 0 && <div>XL: <strong>{t.xlShort}</strong></div>}
                    {t.xxlShort > 0 && <div>XXL: <strong>{t.xxlShort}</strong></div>}
                    {t.customList.map((cs, cIdx) => (cs.short || 0) > 0 && (
                      <div key={cIdx}>{cs.name}: <strong>{cs.short}</strong></div>
                    ))}
                    {t.totalShort === 0 && <span className="text-slate-400 italic text-[10px]">- Kosong -</span>}
                  </div>
                </div>

                {/* Panjang */}
                <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-lg p-2 space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-indigo-900 border-b border-indigo-200 pb-0.5">
                    <span>LENGAN PANJANG</span>
                    <span className="font-mono">{t.totalLong} pcs</span>
                  </div>
                  <div className="text-[11px] text-indigo-950 font-mono space-y-0.5 pt-0.5">
                    {t.sLong > 0 && <div>S: <strong>{t.sLong}</strong></div>}
                    {t.mLong > 0 && <div>M: <strong>{t.mLong}</strong></div>}
                    {t.lLong > 0 && <div>L: <strong>{t.lLong}</strong></div>}
                    {t.xlLong > 0 && <div>XL: <strong>{t.xlLong}</strong></div>}
                    {t.xxlLong > 0 && <div>XXL: <strong>{t.xxlLong}</strong></div>}
                    {t.customList.map((cs, cIdx) => (cs.long || 0) > 0 && (
                      <div key={cIdx}>{cs.name}: <strong>{cs.long}</strong></div>
                    ))}
                    {t.totalLong === 0 && <span className="text-slate-400 italic text-[10px]">- Kosong -</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop & Printable Table View (>= sm) */}
      <div className="hidden sm:block border border-slate-200 rounded-xl overflow-hidden shadow-2xs print:border-slate-300 print:shadow-none bg-white">
        <table className="w-full text-left border-collapse table-auto text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700 uppercase font-extrabold tracking-wider border-b border-slate-200 print:bg-slate-100">
              <th className="py-2.5 px-3 text-center w-10">No</th>
              <th className="py-2.5 px-3 w-40">Warna Kain</th>
              <th className="py-2.5 px-2 text-center w-24">Tipe Lengan</th>
              <th className="py-2.5 px-2 text-center">S</th>
              <th className="py-2.5 px-2 text-center">M</th>
              <th className="py-2.5 px-2 text-center">L</th>
              <th className="py-2.5 px-2 text-center">XL</th>
              <th className="py-2.5 px-2 text-center">XXL</th>
              {anyCustom && <th className="py-2.5 px-2 text-center">Custom</th>}
              <th className="py-2.5 px-3 text-right w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {variants.map((variant, idx) => {
              const t = getColorVariantTotals(variant);
              return (
                <React.Fragment key={variant.id || idx}>
                  {/* Row 1: Pendek */}
                  <tr className="hover:bg-slate-50/70">
                    <td rowSpan={2} className="py-2 px-3 text-center font-mono font-bold text-slate-400 border-r border-slate-100 align-middle bg-slate-50/40">
                      {idx + 1}
                    </td>
                    <td rowSpan={2} className="py-2 px-3 font-bold text-slate-900 border-r border-slate-100 align-middle bg-slate-50/40">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-300 shrink-0 print:border-slate-400" />
                        <span className="text-xs uppercase font-extrabold text-slate-900">{variant.colorName || `Warna ${idx + 1}`}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        Total: {t.totalQty} pcs
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-center border-r border-slate-100 bg-emerald-50/40">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase">
                        Pendek
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-medium text-slate-700">
                      {t.sShort > 0 ? <strong className="text-slate-900 font-bold">{t.sShort}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-medium text-slate-700">
                      {t.mShort > 0 ? <strong className="text-slate-900 font-bold">{t.mShort}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-medium text-slate-700">
                      {t.lShort > 0 ? <strong className="text-slate-900 font-bold">{t.lShort}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-medium text-slate-700">
                      {t.xlShort > 0 ? <strong className="text-slate-900 font-bold">{t.xlShort}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-medium text-slate-700">
                      {t.xxlShort > 0 ? <strong className="text-slate-900 font-bold">{t.xxlShort}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                    {anyCustom && (
                      <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-700">
                        {t.customShort > 0 ? (
                          <span title={t.customList.map(c => `${c.name}:${c.short}`).join(', ')}>
                            <strong className="text-slate-900">{t.customShort}</strong>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    )}
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/20">
                      {t.totalShort} pcs
                    </td>
                  </tr>

                  {/* Row 2: Panjang */}
                  <tr className="hover:bg-slate-50/70 border-b-2 border-slate-200/80">
                    <td className="py-1.5 px-2 text-center border-r border-slate-100 bg-indigo-50/40">
                      <span className="text-[10px] font-bold text-indigo-800 uppercase">
                        Panjang
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-medium text-slate-700">
                      {t.sLong > 0 ? <strong className="text-slate-900 font-bold">{t.sLong}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-medium text-slate-700">
                      {t.mLong > 0 ? <strong className="text-slate-900 font-bold">{t.mLong}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-medium text-slate-700">
                      {t.lLong > 0 ? <strong className="text-slate-900 font-bold">{t.lLong}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-medium text-slate-700">
                      {t.xlLong > 0 ? <strong className="text-slate-900 font-bold">{t.xlLong}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono font-medium text-slate-700">
                      {t.xxlLong > 0 ? <strong className="text-slate-900 font-bold">{t.xxlLong}</strong> : <span className="text-slate-300">-</span>}
                    </td>
                    {anyCustom && (
                      <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-700">
                        {t.customLong > 0 ? (
                          <span title={t.customList.map(c => `${c.name}:${c.long}`).join(', ')}>
                            <strong className="text-slate-900">{t.customLong}</strong>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    )}
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-indigo-800 bg-indigo-50/20">
                      {t.totalLong} pcs
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-100 text-slate-900 font-bold text-xs border-t-2 border-slate-300 print:bg-slate-100">
            <tr>
              <td colSpan={2} className="py-2.5 px-3 uppercase text-[10px] tracking-wider text-slate-700 font-black">
                TOTAL KESELURUHAN
              </td>
              <td className="py-2.5 px-2 text-center text-[10px] uppercase font-bold text-slate-600">
                P/L
              </td>
              <td className="py-2.5 px-2 text-center font-mono">
                {grandTotals.sShort + grandTotals.sLong}
              </td>
              <td className="py-2.5 px-2 text-center font-mono">
                {grandTotals.mShort + grandTotals.mLong}
              </td>
              <td className="py-2.5 px-2 text-center font-mono">
                {grandTotals.lShort + grandTotals.lLong}
              </td>
              <td className="py-2.5 px-2 text-center font-mono">
                {grandTotals.xlShort + grandTotals.xlLong}
              </td>
              <td className="py-2.5 px-2 text-center font-mono">
                {grandTotals.xxlShort + grandTotals.xxlLong}
              </td>
              {anyCustom && (
                <td className="py-2.5 px-2 text-center font-mono">
                  {grandTotals.customShort + grandTotals.customLong}
                </td>
              )}
              <td className="py-2.5 px-3 text-right font-mono font-black text-blue-900 text-sm whitespace-nowrap">
                {grandTotals.totalQty} pcs
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
