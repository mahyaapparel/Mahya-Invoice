import React, { useState } from 'react';
import { X, Printer, Copy, Check, Send, Receipt } from 'lucide-react';
import { ConvectionOrder, InvoiceSettings } from '../types';
import { formatRupiah, formatIndonesianDate } from '../utils/format';

interface ReceiptModalProps {
  order: ConvectionOrder;
  onClose: () => void;
  settings?: InvoiceSettings | null;
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

export default function ReceiptModal({ order, onClose, settings }: ReceiptModalProps) {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [copied, setCopied] = useState(false);
  const activeSettings = settings || defaultInvoiceSettings;

  const invNumber = order.invoiceNumber || order.id || 'INV-000';
  const division = order.division || 'Konveksi';
  const dateFormatted = order.createdAt ? formatIndonesianDate(order.createdAt) : formatIndonesianDate(new Date().toISOString());
  
  // Calculate total paid & remaining
  const paymentHistory = order.paymentHistory || [];
  const totalPaid = paymentHistory.reduce((sum, p) => sum + p.amount, 0) || (order.dpAmount || 0);
  const remaining = Math.max(0, order.totalPrice - totalPaid);
  const isLunas = remaining <= 0 || order.paymentStatus === 'LUNAS';

  // Format WhatsApp Text Receipt
  const generateWhatsAppText = () => {
    let text = `*STRUK NOTA PEMBAYARAN - ${activeSettings.businessName.toUpperCase()}*\n`;
    text += `------------------------------------------\n`;
    text += `No. Invoice : #${invNumber}\n`;
    text += `Tanggal     : ${dateFormatted}\n`;
    text += `Divisi      : ${division}\n`;
    text += `Pelanggan   : ${order.customerName} (${order.customerPhone || '-'})\n`;
    text += `------------------------------------------\n`;
    text += `*DETAIL PESANAN:*\n`;
    text += `• ${order.productType || 'Garment'} (${order.quantity} Pcs)\n`;
    if (order.fabricType || order.fabricColor) {
      text += `  Kain: ${order.fabricType || '-'} (${order.fabricColor || '-'})\n`;
    }
    if (order.sablonBordir) {
      text += `  Aplikasi: ${order.sablonBordir}\n`;
    }
    if (order.unitPrice > 0) {
      text += `  Harga/Pcs: ${formatRupiah(order.unitPrice)}\n`;
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

  const handlePrintThermal = () => {
    document.body.classList.add('printing-receipt-mode');
    if (paperWidth === '58mm') {
      document.body.classList.add('paper-58mm');
    } else {
      document.body.classList.add('paper-80mm');
    }

    window.print();

    setTimeout(() => {
      document.body.classList.remove('printing-receipt-mode', 'paper-58mm', 'paper-80mm');
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Modal - Hidden during print */}
        <div className="p-4 bg-slate-800 text-white flex justify-between items-center shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="text-emerald-400" size={20} />
            <div>
              <h2 className="font-bold text-sm sm:text-base leading-tight">Cetak Struk Kasir / Nota</h2>
              <p className="text-[11px] text-slate-300">Format khusus thermal printer (58mm / 80mm)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar Action Buttons - Hidden during print */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden text-xs">
          {/* Paper Size Selector */}
          <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                paperWidth === '58mm'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              58 mm (Nota Kecil)
            </button>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                paperWidth === '80mm'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              80 mm (Medium)
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={copyTextReceipt}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg shadow-sm cursor-pointer"
              title="Salin Teks Nota Struk"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
            </button>

            <button
              onClick={sendWhatsAppReceipt}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm cursor-pointer"
              title="Kirim Nota Struk via WhatsApp"
            >
              <Send size={14} />
              <span>Kirim WA</span>
            </button>

            <button
              onClick={handlePrintThermal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
              title="Cetak Struk Thermal lewat Printer"
            >
              <Printer size={15} />
              <span>Cetak Struk</span>
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/60 flex justify-center items-start">
          
          {/* Paper thermal visual simulation */}
          <div
            id="printable-thermal-receipt"
            className={`bg-white text-slate-900 shadow-md font-mono text-xs p-4 sm:p-5 mx-auto border border-slate-300 transition-all ${
              paperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
            }`}
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {/* Header */}
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
                <span className="font-bold truncate max-w-[150px]">{order.customerName}</span>
              </div>
              {order.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-600">No HP:</span>
                  <span>{order.customerPhone}</span>
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-2">
              <div>
                <div className="font-bold text-slate-900 uppercase">
                  {order.productType || 'Pakaian Custom'}
                </div>
                <div className="text-[10px] text-slate-600">
                  {order.quantity} Pcs {order.unitPrice > 0 ? `x ${formatRupiah(order.unitPrice)}` : ''}
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
                
                {/* Size breakdown */}
                {(order.sizeS > 0 || order.sizeM > 0 || order.sizeL > 0 || order.sizeXL > 0 || order.sizeXXL > 0 || order.sizeCustom) && (
                  <div className="text-[10px] text-slate-600 font-semibold mt-0.5">
                    Ukuran: {[
                      order.sizeS > 0 ? `S:${order.sizeS}` : '',
                      order.sizeM > 0 ? `M:${order.sizeM}` : '',
                      order.sizeL > 0 ? `L:${order.sizeL}` : '',
                      order.sizeXL > 0 ? `XL:${order.sizeXL}` : '',
                      order.sizeXXL > 0 ? `2XL:${order.sizeXXL}` : '',
                      order.sizeCustom ? `Custom: ${order.sizeCustom}` : ''
                    ].filter(Boolean).join(' | ')}
                  </div>
                )}
              </div>

              {/* Additional Fees / Discount */}
              {order.shippingCost > 0 && (
                <div className="flex justify-between text-[10px]">
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

            {/* Footer Notes */}
            <div className="pt-2 text-center text-[10px] text-slate-600 space-y-1 border-t border-dashed border-slate-400">
              <p className="font-semibold">{activeSettings.additionalNotes || 'Terima Kasih Atas Pesanan Anda!'}</p>
              <p className="text-[9px] italic">Simpan struk ini sebagai bukti transaksi resmi.</p>
            </div>
          </div>

        </div>

        {/* Footer info - Hidden during print */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500 shrink-0 print:hidden">
          Dapat dicetak menggunakan Printer Kasir Bluetooth / Thermal USB (Pos 58/80)
        </div>
      </div>
    </div>
  );
}
