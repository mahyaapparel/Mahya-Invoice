import React, { useState } from 'react';
import { X, Printer, Copy, Check, Send, Receipt, FileText, Image as ImageIcon } from 'lucide-react';
import { ConvectionOrder, InvoiceSettings } from '../types';
import { formatRupiah, formatIndonesianDate } from '../utils/format';
import { calculateOrderBreakdown } from '../utils/orderBreakdown';
import { formatColorVariantsText, getColorVariantTotals } from './ColorVariantsMatrix';
import mahyaLogo from '../assets/images/mahya_logo_1784646837491.jpg';

interface ReceiptModalProps {
  order: ConvectionOrder;
  onClose: () => void;
  settings?: InvoiceSettings | null;
  initialMode?: 'nota' | 'struk';
}

const defaultInvoiceSettings: InvoiceSettings = {
  businessName: "MAHYA APPAREL",
  slogan: "Konveksi, Sablon & Asesoris Apparel Professional",
  address: "Jl. Konveksi No. 88, Malang, Indonesia",
  phone: "0812-3456-7890",
  email: "info@mahyakaryafaintech.com",
  logoUrl: "",
  bankAccounts: [],
  additionalNotes: "Terima kasih atas kepercayaan Anda!"
};

export default function ReceiptModal({ order, onClose, settings, initialMode = 'nota' }: ReceiptModalProps) {
  const [receiptMode, setReceiptMode] = useState<'nota' | 'struk'>(initialMode);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm' | '100mm'>(initialMode === 'nota' ? '80mm' : '58mm');
  const [copied, setCopied] = useState(false);
  const activeSettings = settings || defaultInvoiceSettings;

  const invNumber = order.invoiceNumber || order.id || 'INV-000';
  const division = order.division || 'Konveksi';
  const dateFormatted = formatIndonesianDate(order.orderDate || order.createdAt || new Date().toISOString());
  
  // Calculate total paid & remaining
  const paymentHistory = order.paymentHistory || [];
  const totalPaid = paymentHistory.reduce((sum, p) => sum + p.amount, 0) || (order.dpAmount || 0);
  const remaining = Math.max(0, order.totalPrice - totalPaid);
  const isLunas = remaining <= 0 || order.paymentStatus === 'LUNAS';

  // Format WhatsApp Text Receipt
  const generateWhatsAppText = () => {
    const breakdown = calculateOrderBreakdown(order);
    const headerTitle = receiptMode === 'nota' ? 'NOTA PESANAN & PEMBAYARAN' : 'STRUK NOTA PEMBAYARAN';
    let text = `*${headerTitle} - ${activeSettings.businessName.toUpperCase()}*\n`;
    text += `------------------------------------------\n`;
    text += `No. Nota    : #${invNumber}\n`;
    text += `Tanggal     : ${dateFormatted}\n`;
    text += `Divisi      : ${division}\n`;
    text += `Pelanggan   : ${order.customerName} (${order.customerPhone || '-'})\n`;
    text += `------------------------------------------\n`;
    text += `*DETAIL SPESIFIKASI:*\n`;
    text += `• Produk: ${order.productType || 'Garment'}\n`;
    if (order.fabricType || order.fabricColor) {
      text += `  Kain: ${order.fabricType || '-'} (${order.fabricColor || '-'})\n`;
    }
    if (order.sablonBordir) {
      text += `  Aplikasi: ${order.sablonBordir}\n`;
    }

    text += `\n*RINCIAN ITEM & UKURAN:*\n`;
    breakdown.lines.forEach((line) => {
      text += `• ${line.size} (${line.sleeve}): ${line.quantity} pcs x ${formatRupiah(line.unitPrice)} = ${formatRupiah(line.subtotal)}\n`;
    });
    text += `  Total Qty: ${breakdown.totalQty} pcs\n`;

    if (order.colorVariants && order.colorVariants.length > 0) {
      const colorText = formatColorVariantsText(order.colorVariants);
      if (colorText) {
        text += `\n*DISTRIBUSI VARIAN WARNA:*\n${colorText}`;
      }
    }

    if (order.shippingCost > 0) {
      text += `• Biaya Pengiriman: ${formatRupiah(order.shippingCost)}\n`;
    }
    if (order.discount > 0) {
      text += `• Diskon/Potongan: -${formatRupiah(order.discount)}\n`;
    }

    text += `------------------------------------------\n`;
    text += `*TOTAL ORDER   : ${formatRupiah(order.totalPrice)}*\n`;

    if (paymentHistory.length > 0) {
      text += `\n*HISTORI PEMBAYARAN:*\n`;
      paymentHistory.forEach((pay, idx) => {
        const payType = pay.type === 'DP' ? 'Uang Muka (DP)' : pay.type === 'PELUNASAN' ? 'Pelunasan' : 'Pembayaran';
        text += ` ${idx + 1}. ${payType}: ${formatRupiah(pay.amount)} (${pay.method.replace('_', ' ')})\n`;
      });
    } else if (order.dpAmount > 0) {
      text += `\n*DP DIBAYAR     : ${formatRupiah(order.dpAmount)}*\n`;
    }

    text += `\n*TOTAL TERBAYAR : ${formatRupiah(totalPaid)}*\n`;
    text += `*SISA TAGIHAN  : ${formatRupiah(remaining)}*\n`;
    text += `*STATUS         : ${isLunas ? 'LUNAS' : 'DP DIBAYAR'}*\n`;
    text += `------------------------------------------\n`;
    text += `${activeSettings.additionalNotes || 'Terima kasih atas pesanan Anda!'}\n`;
    text += `_Hubungi kami: ${activeSettings.phone}_`;

    return text;
  };

  const copyTextReceipt = async () => {
    const text = generateWhatsAppText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin ringkasan struk:", err);
    }
  };

  const sendWhatsAppReceipt = () => {
    const rawPhone = (order.customerPhone || '').replace(/\D/g, '');
    let formattedPhone = rawPhone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }
    const text = generateWhatsAppText();
    const encodedText = encodeURIComponent(text);
    const url = formattedPhone 
      ? `https://wa.me/${formattedPhone}?text=${encodedText}` 
      : `https://wa.me/?text=${encodedText}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    document.body.classList.add('printing-receipt-mode');
    if (paperWidth === '58mm') {
      document.body.classList.add('paper-58mm');
    } else if (paperWidth === '80mm') {
      document.body.classList.add('paper-80mm');
    } else {
      document.body.classList.add('paper-100mm');
    }

    window.print();

    setTimeout(() => {
      document.body.classList.remove('printing-receipt-mode', 'paper-58mm', 'paper-80mm', 'paper-100mm');
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[94vh] border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Modal - Hidden during print */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex justify-between items-center shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              {receiptMode === 'nota' ? <FileText size={18} /> : <Receipt size={18} />}
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base leading-tight">
                {receiptMode === 'nota' ? 'Cetak Nota Pesanan (Kop + Logo)' : 'Cetak Struk Kasir (Thermal POS)'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {receiptMode === 'nota' ? 'Nota dengan logo bisnis di samping kop & tanda tangan' : 'Format ringkas printer thermal kasir'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            id="btn-close-receipt-modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar Controls - Hidden during print */}
        <div className="p-3 bg-slate-100/90 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 print:hidden text-xs">
          {/* Format & Paper Size Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Mode Switcher */}
            <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
              <button
                onClick={() => {
                  setReceiptMode('nota');
                  if (paperWidth === '58mm') setPaperWidth('80mm');
                }}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  receiptMode === 'nota'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                id="btn-mode-nota"
                title="Format Nota dengan Logo di samping Kop"
              >
                <FileText size={13} />
                <span>Format Nota</span>
              </button>
              <button
                onClick={() => setReceiptMode('struk')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  receiptMode === 'struk'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                id="btn-mode-struk"
                title="Format Struk Thermal Standar"
              >
                <Receipt size={13} />
                <span>Format Struk</span>
              </button>
            </div>

            {/* Paper Width Selector */}
            <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
              <button
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer text-[11px] ${
                  paperWidth === '58mm'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                id="btn-width-58"
              >
                58mm
              </button>
              <button
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer text-[11px] ${
                  paperWidth === '80mm'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                id="btn-width-80"
              >
                80mm
              </button>
              <button
                onClick={() => setPaperWidth('100mm')}
                className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer text-[11px] ${
                  paperWidth === '100mm'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                id="btn-width-100"
              >
                Lebar
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              onClick={copyTextReceipt}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg shadow-2xs cursor-pointer text-xs transition-colors"
              title="Salin Teks Nota / Struk"
              id="btn-copy-receipt-text"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'Tersalin' : 'Salin'}</span>
            </button>

            <button
              onClick={sendWhatsAppReceipt}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-2xs cursor-pointer text-xs transition-colors"
              title="Kirim Nota via WhatsApp"
              id="btn-send-receipt-wa"
            >
              <Send size={14} />
              <span>Kirim WA</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm cursor-pointer text-xs transition-colors"
              title={`Cetak ${receiptMode === 'nota' ? 'Nota' : 'Struk'} via Printer`}
              id="btn-print-receipt"
            >
              <Printer size={15} />
              <span>Cetak {receiptMode === 'nota' ? 'Nota' : 'Struk'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Receipt / Nota Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 flex justify-center items-start">
          
          {/* Printable Visual Area */}
          <div
            id="printable-thermal-receipt"
            className={`bg-white text-slate-900 shadow-md font-mono text-xs p-4 sm:p-5 mx-auto border border-slate-300 transition-all ${
              paperWidth === '58mm' ? 'w-[290px]' : paperWidth === '80mm' ? 'w-[370px]' : 'w-[450px]'
            }`}
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {/* Header / Kop */}
            {receiptMode === 'nota' ? (
              <div className="pb-3 border-b border-dashed border-slate-400">
                <div className="flex items-center gap-3">
                  <img
                    src={activeSettings.logoUrl || mahyaLogo}
                    alt="Logo Bisnis"
                    className="w-13 h-13 sm:w-15 sm:h-15 object-contain rounded-md border border-slate-200 bg-white p-0.5 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 text-left min-w-0">
                    <h1 className="font-bold text-sm sm:text-base uppercase tracking-tight text-slate-900 leading-snug">
                      {activeSettings.businessName}
                    </h1>
                    {activeSettings.slogan && (
                      <p className="text-[9px] sm:text-[9.5px] text-slate-600 leading-tight line-clamp-1">{activeSettings.slogan}</p>
                    )}
                    <p className="text-[9px] sm:text-[9.5px] text-slate-600 leading-tight line-clamp-2 mt-0.5">{activeSettings.address}</p>
                    <p className="text-[9px] sm:text-[9.5px] text-slate-600 leading-tight font-semibold">Telp/WA: {activeSettings.phone}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-dotted border-slate-300">
                  <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-900">
                    NOTA PESANAN & PEMBAYARAN
                  </span>
                  <span className="bg-slate-900 text-white px-2 py-0.5 text-[9px] font-bold rounded">
                    DIVISI: {division.toUpperCase()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center pb-3 border-b border-dashed border-slate-400">
                <h1 className="font-bold text-sm sm:text-base uppercase tracking-tight text-slate-900">
                  {activeSettings.businessName}
                </h1>
                {activeSettings.slogan && (
                  <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">{activeSettings.slogan}</p>
                )}
                <p className="text-[10px] text-slate-600 mt-0.5">{activeSettings.address}</p>
                <p className="text-[10px] text-slate-600">Telp: {activeSettings.phone}</p>
                
                <div className="mt-2 inline-block bg-slate-900 text-white px-2 py-0.5 text-[10px] font-bold rounded">
                  DIVISI: {division.toUpperCase()}
                </div>
              </div>
            )}

            {/* Order Info */}
            <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">No. Nota:</span>
                <span className="font-bold text-slate-900">#{invNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tanggal:</span>
                <span>{dateFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Pelanggan:</span>
                <span className="font-bold truncate max-w-[160px]">{order.customerName}</span>
              </div>
              {order.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-600">No HP:</span>
                  <span>{order.customerPhone}</span>
                </div>
              )}
            </div>

            {/* Product & Item Breakdown Details */}
            {(() => {
              const breakdown = calculateOrderBreakdown(order);
              return (
                <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-2">
                  <div>
                    <div className="font-bold text-slate-900 uppercase">
                      {order.productType || 'Pakaian Custom'}
                    </div>
                    {order.fabricType && (
                      <div className="text-[10px] text-slate-600">
                        Kain: {order.fabricType} ({order.fabricColor || '-'})
                      </div>
                    )}
                    {order.sablonBordir && (
                      <div className="text-[10px] text-slate-600">
                        Aplikasi: {order.sablonBordir}
                      </div>
                    )}
                  </div>

                  {/* Itemized lines per size & sleeve */}
                  <div className="pt-1 border-t border-dotted border-slate-300 space-y-1">
                    <div className="text-[9px] font-bold text-slate-500 uppercase flex justify-between tracking-wider">
                      <span>Item / Ukuran</span>
                      <span>Subtotal</span>
                    </div>
                    {breakdown.lines.map((line, idx) => (
                      <div key={line.id || idx} className="text-[10px]">
                        <div className="font-bold text-slate-900 flex justify-between">
                          <span>{line.size} ({line.sleeve})</span>
                          <span className="font-mono">{formatRupiah(line.subtotal)}</span>
                        </div>
                        <div className="text-slate-500 text-[9px] font-mono">
                          {line.quantity} pcs x {formatRupiah(line.unitPrice)}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-slate-900 text-[10px] pt-1 border-t border-dotted border-slate-300">
                      <span>Total Qty Item:</span>
                      <span className="font-mono">{breakdown.totalQty} pcs</span>
                    </div>

                    {/* Varian Warna di Struk */}
                    {order.colorVariants && order.colorVariants.length > 0 && (
                      <div className="pt-1 border-t border-dotted border-slate-200 text-[9px] space-y-0.5">
                        <div className="font-bold text-slate-600 uppercase tracking-wider">
                          Varian Warna ({order.colorVariants.length}):
                        </div>
                        {order.colorVariants.map((v, vIdx) => {
                          const t = getColorVariantTotals(v);
                          return (
                            <div key={vIdx} className="flex justify-between text-slate-700">
                              <span>• {v.colorName || `Warna ${vIdx + 1}`}:</span>
                              <span className="font-mono font-medium">{t.totalQty} pcs (P:{t.totalShort}, L:{t.totalLong})</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Additional Fees / Discount */}
                  {order.shippingCost > 0 && (
                    <div className="flex justify-between text-[10px] pt-1 border-t border-dotted border-slate-200">
                      <span>Ongkos Kirim:</span>
                      <span className="font-semibold">{formatRupiah(order.shippingCost)}</span>
                    </div>
                  )}
                  {order.discount > 0 && (
                    <div className="flex justify-between text-[10px]">
                      <span>Diskon:</span>
                      <span className="font-semibold text-rose-700">-{formatRupiah(order.discount)}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Financial Summary */}
            <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-1">
              <div className="flex justify-between font-bold text-slate-900 text-xs">
                <span>TOTAL ORDER:</span>
                <span>{formatRupiah(order.totalPrice)}</span>
              </div>

              {/* Payment History Breakdown */}
              {paymentHistory.length > 0 ? (
                <div className="pt-1 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Rincian Pembayaran:</span>
                  {paymentHistory.map((pay, idx) => (
                    <div key={idx} className="flex justify-between text-[10px] text-slate-700">
                      <span>• {pay.type === 'DP' ? 'Uang Muka (DP)' : pay.type === 'PELUNASAN' ? 'Pelunasan' : 'Bayar'}:</span>
                      <span>{formatRupiah(pay.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                order.dpAmount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Uang Muka (DP):</span>
                    <span>{formatRupiah(order.dpAmount)}</span>
                  </div>
                )
              )}

              <div className="flex justify-between text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Terbayar:</span>
                <span className="font-bold">{formatRupiah(totalPaid)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold text-xs">
                <span>Sisa Tagihan:</span>
                <span className={remaining > 0 ? "text-rose-700" : "text-emerald-700"}>
                  {formatRupiah(remaining)}
                </span>
              </div>
            </div>

            {/* Status Stamp */}
            <div className="py-2.5 text-center">
              <div className={`inline-block border-2 px-3 py-1 font-extrabold text-xs tracking-wider uppercase rounded ${
                isLunas 
                  ? 'border-emerald-600 text-emerald-800 bg-emerald-50' 
                  : 'border-amber-600 text-amber-800 bg-amber-50'
              }`}>
                === {isLunas ? 'LUNAS' : 'DP DIBAYAR'} ===
              </div>
            </div>

            {/* Signature Block for Nota */}
            {receiptMode === 'nota' && (
              <div className="py-3 border-t border-dashed border-slate-400 grid grid-cols-2 text-center text-[10px] gap-2">
                <div>
                  <p className="text-slate-600">Penerima / Pelanggan,</p>
                  <div className="h-10"></div>
                  <p className="font-bold text-slate-900 border-t border-dotted border-slate-400 pt-0.5 mx-1">
                    ({order.customerName || 'Pelanggan'})
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Hormat Kami,</p>
                  <div className="h-10"></div>
                  <p className="font-bold text-slate-900 border-t border-dotted border-slate-400 pt-0.5 mx-1">
                    ({activeSettings.businessName || 'Kasir'})
                  </p>
                </div>
              </div>
            )}

            {/* Footer Notes */}
            <div className="pt-2 text-center text-[10px] text-slate-600 space-y-1 border-t border-dashed border-slate-400">
              <p className="font-semibold">{activeSettings.additionalNotes || 'Terima Kasih Atas Pesanan Anda!'}</p>
              <p className="text-[9px] italic">Simpan nota/struk ini sebagai bukti transaksi resmi.</p>
            </div>
          </div>

        </div>

        {/* Footer info - Hidden during print */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0 print:hidden px-4">
          <span>Format didukung untuk printer Bluetooth thermal POS & Printer biasa</span>
          <span className="font-semibold text-slate-700">Mode: {receiptMode === 'nota' ? 'Nota Resmi (Logo)' : 'Struk Kasir'}</span>
        </div>
      </div>
    </div>
  );
}
