import React, { useState } from 'react';
import { X, Printer, Copy, Check, Calendar, Phone, Mail, MapPin, DollarSign, Download, Loader2, ExternalLink, CreditCard } from 'lucide-react';
import { ConvectionOrder, InvoiceSettings } from '../types';
import { formatRupiah, formatIndonesianDate, getPaymentStatusDetails, getProductionStatusDetails } from '../utils/format';
import { exportElementToPdf } from '../utils/pdfSanitizer';
import mahyaLogo from '../assets/images/mahya_logo_1784646837491.jpg';
import html2pdf from 'html2pdf.js';

const defaultInvoiceSettings: InvoiceSettings = {
  businessName: "MAHYA APPAREL",
  slogan: "Solusi Konveksi Premium & Custom Terpercaya",
  address: "Jl. Raya Konveksi No. 88, Malang, Indonesia",
  phone: "+62 812-3456-7890",
  email: "mahyaapparel@gmail.com",
  logoUrl: "",
  bankAccounts: [
    {
      bankName: "Bank BRI",
      accountNumber: "318501049022539",
      accountHolder: "Farihatun Nimah",
      isVA: false
    }
  ],
  additionalNotes: "Invoice ini merupakan dokumen digital resmi yang sah. Segala perubahan status terdokumentasi di sistem kasir pusat."
};

interface InvoiceDetailModalProps {
  order: ConvectionOrder;
  onClose: () => void;
  onUpdatePaymentStatus?: (id: string, status: 'BELUM_BAYAR' | 'DP_DIBAYAR' | 'LUNAS') => void;
  settings?: InvoiceSettings | null;
}

export default function InvoiceDetailModal({ order, onClose, onUpdatePaymentStatus, settings }: InvoiceDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const activeSettings = settings || defaultInvoiceSettings;

  // Generate the real customer payment link url
  const getPaymentLink = () => {
    const origin = window.location.origin + window.location.pathname;
    const cleanOrigin = origin.endsWith('/') ? origin : origin + '/';
    return `${cleanOrigin}?invoice=${encodeURIComponent(order.id || order.invoiceNumber)}`;
  };

  const copyPaymentLink = async () => {
    const link = getPaymentLink();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = link;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          throw new Error("fallback copy failed");
        }
      }
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsExportingPDF(true);
    try {
      const sourceElement = document.getElementById('printable-invoice');
      if (!sourceElement) {
        window.print();
        return;
      }
      const filename = `Invoice-${(order.invoiceNumber || order.id).replace(/[/\\?%*:|"<>]/g, '-')}.pdf`;
      await exportElementToPdf(sourceElement, filename, 'printable-invoice');
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setIsExportingPDF(false);
    }
  };

  const pStatus = getPaymentStatusDetails(order.paymentStatus);
  const prodStatus = getProductionStatusDetails(order.productionStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto print:bg-white print:p-0">
      {/* Container */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden print:shadow-none print:max-h-full print:rounded-none">
        
        {/* Header - Hidden in Print */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold px-2.5 py-1 bg-amber-500 text-white rounded-md">INV</span>
            <h2 className="text-lg font-bold text-slate-800">Detail Invoice & Transaksi</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={copyPaymentLink}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                copied 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
              id="btn-copy-invoice-modal"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Link Disalin!' : 'Salin Link'}
            </button>

            <button
              onClick={() => {
                const targetId = order.id || order.invoiceNumber;
                const link = `?invoice=${encodeURIComponent(targetId)}`;
                window.history.pushState({}, '', link);
                window.dispatchEvent(new Event('popstate'));
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition-all cursor-pointer"
              id="btn-open-portal-from-invoice-modal"
              title="Buka Tampilan Portal Pelanggan Online"
            >
              <ExternalLink size={15} />
              Buka Portal
            </button>
            
            <button
              onClick={handleDownloadPDF}
              disabled={isExportingPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              id="btn-download-pdf-modal"
              title="Unduh Invoice dalam format PDF"
            >
              {isExportingPDF ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {isExportingPDF ? 'Mengunduh...' : 'Unduh PDF'}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-sm cursor-pointer"
              id="btn-print-invoice-modal"
              title="Cetak langsung lewat printer / browser"
            >
              <Printer size={15} />
              Cetak Invoice
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200/60 transition-colors cursor-pointer"
              id="btn-close-invoice-modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable invoice content */}
        <div className="flex-1 overflow-y-auto p-8 print:overflow-visible print:p-0" id="printable-invoice">
          
          {/* Link Pembayaran Alert - Hidden in Print */}
          <div className="mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
            <div className="space-y-1">
              <span className="text-xs font-bold text-blue-800 block">Link Pembayaran & Pemantauan Pelanggan</span>
              <p className="text-[11px] text-slate-500">Pelanggan bisa buka link ini di browser mana saja untuk memantau progress jahit dan melakukan pembayaran.</p>
            </div>
            <div className="flex gap-1.5 items-center bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg w-full sm:w-auto max-w-sm">
              <input
                type="text"
                readOnly
                value={getPaymentLink()}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 text-[11px] font-mono text-slate-700 bg-transparent focus:outline-none w-48 font-semibold"
              />
              <button
                onClick={copyPaymentLink}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer transition-colors shrink-0 px-1.5"
              >
                {copied ? 'Disalin' : 'Salin'}
              </button>
            </div>
          </div>

          {/* Invoice Header */}
          <div className="flex flex-col md:flex-row md:justify-between justify-start gap-4 border-b border-slate-100 pb-4 print:pb-3">
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <img 
                src={activeSettings.logoUrl || mahyaLogo} 
                alt={`${activeSettings.businessName} Logo`} 
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-xl border border-slate-100 bg-white shadow-sm shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-blue-900">{activeSettings.businessName}</h1>
                {activeSettings.slogan && <p className="text-xs text-slate-500 mt-0.5">{activeSettings.slogan}</p>}
                
                <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
                  <p className="flex items-center gap-1"><MapPin size={12} /> {activeSettings.address}</p>
                  <p className="flex items-center gap-1">
                    <Phone size={12} /> WA: {activeSettings.phone}
                    {activeSettings.email && ` | Email: ${activeSettings.email}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-left md:text-right flex flex-col justify-between items-start md:items-end">
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400">Invoice Pembayaran</span>
                <h3 className="text-xl font-mono font-bold text-slate-800 mt-0.5">{order.invoiceNumber}</h3>
              </div>
              
              <div className="mt-2 flex flex-wrap gap-1.5 md:justify-end">
                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${pStatus.color}`}>
                  {pStatus.label}
                </span>
                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${prodStatus.color}`}>
                  {prodStatus.label}
                </span>
              </div>
            </div>
          </div>

          {/* Dates & Client Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 print:py-3 border-b border-slate-100">
            {/* Bill To */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Detail Pelanggan</span>
              <div className="mt-1 space-y-1">
                <h4 className="text-base font-bold text-slate-800">{order.customerName}</h4>
                <div className="text-xs text-slate-600 space-y-1">
                  {order.customerPhone && (
                    <p className="flex items-center gap-1.5">
                      <Phone size={13} className="text-slate-400" />
                      <span>{order.customerPhone}</span>
                    </p>
                  )}
                  {order.customerEmail && (
                    <p className="flex items-center gap-1.5">
                      <Mail size={13} className="text-slate-400" />
                      <span>{order.customerEmail}</span>
                    </p>
                  )}
                  {order.customerAddress && (
                    <p className="flex items-start gap-1.5">
                      <MapPin size={13} className="text-slate-400 mt-0.5" />
                      <span>{order.customerAddress}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice Meta */}
            <div className="bg-sky-50/80 p-3.5 rounded-xl border border-sky-200/80 space-y-2 h-fit print:bg-sky-50 print:border-sky-200">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 font-medium flex items-center gap-1.5"><Calendar size={13} className="text-blue-600" /> Tanggal Masuk</span>
                <span className="font-bold text-slate-800">{formatIndonesianDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 font-medium flex items-center gap-1.5"><Calendar size={13} className="text-rose-500" /> Deadline Selesai</span>
                <span className="font-bold text-rose-600">{formatIndonesianDate(order.deadline)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 font-medium flex items-center gap-1.5"><DollarSign size={13} className="text-blue-600" /> Sisa Pelunasan</span>
                <span className="font-mono font-extrabold text-blue-900">{formatRupiah(order.remainingBalance)}</span>
              </div>
            </div>
          </div>

          {/* Product Specifications */}
          <div className="py-4 print:py-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Spesifikasi Produksi Konveksi</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 print:bg-slate-50 print:border-slate-200">
              <div>
                <span className="text-[11px] text-slate-500 block">Tipe Produk</span>
                <span className="text-xs font-bold text-slate-800">{order.productType}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Bahan & Kain</span>
                <span className="text-xs font-bold text-slate-800">{order.fabricType || '-'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Warna Kain</span>
                <span className="text-xs font-bold text-slate-800">{order.fabricColor || '-'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Aplikasi Desain</span>
                <span className="text-xs font-bold text-slate-800">{order.sablonBordir || '-'}</span>
              </div>
            </div>
          </div>

          {/* Order items Table */}
          <div className="mt-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Rincian Ukuran & Harga</span>
            <div className="border border-slate-200/80 rounded-xl overflow-hidden print:border-slate-300">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-[11px] font-bold border-b border-slate-200/80 print:bg-white">
                    <th className="px-3 py-2.5">Deskripsi Produk</th>
                    <th className="px-3 py-2.5 text-center">Distribusi Ukuran</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Jumlah</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Harga Satuan</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  <tr>
                    <td className="px-3 py-3 font-medium text-slate-800 align-top">
                      <div className="font-bold">{order.productType}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-normal leading-tight">
                        Bahan: {order.fabricType} <br/>
                        Warna: {order.fabricColor} <br/>
                        Aplikasi: {order.sablonBordir}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center align-top">
                      <div className="flex flex-col items-center gap-1.5">
                        {/* Detailed Matrix Table if breakdown exists */}
                        {(order.sizeS_short !== undefined || order.sizeS_long !== undefined || order.sizeM_short !== undefined || order.sizeM_long !== undefined || (order.customSizes && order.customSizes.length > 0) || order.sizeS > 0 || order.sizeM > 0 || order.sizeL > 0 || order.sizeXL > 0 || order.sizeXXL > 0) ? (
                          <div className="overflow-x-auto max-w-full">
                            {(() => {
                              const activeCustomSizes = (order.customSizes || []).filter(
                                c => (c.short || 0) > 0 || (c.long || 0) > 0 || (c.name && c.name.trim() !== '')
                              );

                              const showS = order.sizeS > 0 || (order.sizeS_short || 0) > 0 || (order.sizeS_long || 0) > 0;
                              const showM = order.sizeM > 0 || (order.sizeM_short || 0) > 0 || (order.sizeM_long || 0) > 0;
                              const showL = order.sizeL > 0 || (order.sizeL_short || 0) > 0 || (order.sizeL_long || 0) > 0;
                              const showXL = order.sizeXL > 0 || (order.sizeXL_short || 0) > 0 || (order.sizeXL_long || 0) > 0;
                              const showXXL = order.sizeXXL > 0 || (order.sizeXXL_short || 0) > 0 || (order.sizeXXL_long || 0) > 0;

                              const sShort = showS ? (order.sizeS_short ?? order.sizeS ?? 0) : 0;
                              const mShort = showM ? (order.sizeM_short ?? order.sizeM ?? 0) : 0;
                              const lShort = showL ? (order.sizeL_short ?? order.sizeL ?? 0) : 0;
                              const xlShort = showXL ? (order.sizeXL_short ?? order.sizeXL ?? 0) : 0;
                              const xxlShort = showXXL ? (order.sizeXXL_short ?? order.sizeXXL ?? 0) : 0;

                              const sLong = showS ? (order.sizeS_long ?? 0) : 0;
                              const mLong = showM ? (order.sizeM_long ?? 0) : 0;
                              const lLong = showL ? (order.sizeL_long ?? 0) : 0;
                              const xlLong = showXL ? (order.sizeXL_long ?? 0) : 0;
                              const xxlLong = showXXL ? (order.sizeXXL_long ?? 0) : 0;

                              const customShortTotal = activeCustomSizes.reduce((sum, cs) => sum + (Number(cs.short) || 0), 0);
                              const customLongTotal = activeCustomSizes.reduce((sum, cs) => sum + (Number(cs.long) || 0), 0);

                              const calculatedPendekTotal = sShort + mShort + lShort + xlShort + xxlShort + customShortTotal;
                              const calculatedPanjangTotal = sLong + mLong + lLong + xlLong + xxlLong + customLongTotal;

                              const finalPendek = Math.max(calculatedPendekTotal, Number(order.lenganPendek) || 0);
                              const finalPanjang = Math.max(calculatedPanjangTotal, Number(order.lenganPanjang) || 0);
                              const finalTotalQty = Math.max(calculatedPendekTotal + calculatedPanjangTotal, Number(order.quantity) || 0);

                              return (
                                <table className="text-[11px] border-collapse border border-slate-200 text-center mx-auto bg-white rounded-lg overflow-hidden">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                      <th className="border-r border-slate-200 px-2 py-1 text-left font-extrabold text-[9px] uppercase text-slate-500">
                                        Ukuran
                                      </th>
                                      {showS && <th className="border-r border-slate-200 px-2 py-1 font-bold">S</th>}
                                      {showM && <th className="border-r border-slate-200 px-2 py-1 font-bold">M</th>}
                                      {showL && <th className="border-r border-slate-200 px-2 py-1 font-bold">L</th>}
                                      {showXL && <th className="border-r border-slate-200 px-2 py-1 font-bold">XL</th>}
                                      {showXXL && <th className="border-r border-slate-200 px-2 py-1 font-bold">XXL</th>}
                                      {activeCustomSizes.map((cs, idx) => (
                                        <th key={idx} className="border-r border-slate-200 px-2 py-1 font-extrabold text-blue-900 bg-blue-100/80">
                                          {cs.name || `Custom ${idx + 1}`}
                                        </th>
                                      ))}
                                      <th className="px-2 py-1 font-extrabold bg-blue-900 text-white">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                                    <tr>
                                      <td className="border-r border-slate-200 px-2 py-0.5 font-bold text-slate-600 text-left bg-slate-50">
                                        Pendek
                                      </td>
                                      {showS && <td className="border-r border-slate-200 px-2 py-0.5">{sShort}</td>}
                                      {showM && <td className="border-r border-slate-200 px-2 py-0.5">{mShort}</td>}
                                      {showL && <td className="border-r border-slate-200 px-2 py-0.5">{lShort}</td>}
                                      {showXL && <td className="border-r border-slate-200 px-2 py-0.5">{xlShort}</td>}
                                      {showXXL && <td className="border-r border-slate-200 px-2 py-0.5">{xxlShort}</td>}
                                      {activeCustomSizes.map((cs, idx) => (
                                        <td key={idx} className="border-r border-slate-200 px-2 py-0.5 font-semibold text-blue-950 bg-blue-50/40">
                                          {cs.short || 0}
                                        </td>
                                      ))}
                                      <td className="px-2 py-0.5 font-extrabold bg-emerald-50 text-emerald-800">{finalPendek}</td>
                                    </tr>
                                    <tr>
                                      <td className="border-r border-slate-200 px-2 py-0.5 font-bold text-slate-600 text-left bg-slate-50">
                                        Panjang
                                      </td>
                                      {showS && <td className="border-r border-slate-200 px-2 py-0.5">{sLong}</td>}
                                      {showM && <td className="border-r border-slate-200 px-2 py-0.5">{mLong}</td>}
                                      {showL && <td className="border-r border-slate-200 px-2 py-0.5">{lLong}</td>}
                                      {showXL && <td className="border-r border-slate-200 px-2 py-0.5">{xlLong}</td>}
                                      {showXXL && <td className="border-r border-slate-200 px-2 py-0.5">{xxlLong}</td>}
                                      {activeCustomSizes.map((cs, idx) => (
                                        <td key={idx} className="border-r border-slate-200 px-2 py-0.5 font-semibold text-blue-950 bg-blue-50/40">
                                          {cs.long || 0}
                                        </td>
                                      ))}
                                      <td className="px-2 py-0.5 font-extrabold bg-indigo-50 text-indigo-800">{finalPanjang}</td>
                                    </tr>
                                    <tr className="font-extrabold bg-slate-100 border-t-2 border-slate-300">
                                      <td className="border-r border-slate-200 px-2 py-0.5 text-left text-slate-900 font-black">
                                        Jumlah
                                      </td>
                                      {showS && <td className="border-r border-slate-200 px-2 py-0.5 font-bold">{sShort + sLong}</td>}
                                      {showM && <td className="border-r border-slate-200 px-2 py-0.5 font-bold">{mShort + mLong}</td>}
                                      {showL && <td className="border-r border-slate-200 px-2 py-0.5 font-bold">{lShort + lLong}</td>}
                                      {showXL && <td className="border-r border-slate-200 px-2 py-0.5 font-bold">{xlShort + xlLong}</td>}
                                      {showXXL && <td className="border-r border-slate-200 px-2 py-0.5 font-bold">{xxlShort + xxlLong}</td>}
                                      {activeCustomSizes.map((cs, idx) => (
                                        <td key={idx} className="border-r border-slate-200 px-2 py-0.5 font-black text-blue-900 bg-blue-100/90">
                                          {(cs.short || 0) + (cs.long || 0)}
                                        </td>
                                      ))}
                                      <td className="px-2 py-0.5 bg-blue-600 text-white font-black">{finalTotalQty} pcs</td>
                                    </tr>
                                  </tbody>
                                </table>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="inline-flex flex-wrap justify-center gap-1.5 text-[11px] font-semibold bg-white px-2 py-0.5 rounded-md border border-slate-100 print:border-none print:p-0">
                            {order.sizeS > 0 && <span>S: {order.sizeS}</span>}
                            {order.sizeM > 0 && <span>M: {order.sizeM}</span>}
                            {order.sizeL > 0 && <span>L: {order.sizeL}</span>}
                            {order.sizeXL > 0 && <span>XL: {order.sizeXL}</span>}
                            {order.sizeXXL > 0 && <span>XXL: {order.sizeXXL}</span>}
                          </div>
                        )}

                        {order.sizeCustom && (!order.customSizes || order.customSizes.length === 0) && (
                          <span className="text-[10px] text-slate-600 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            Custom: {order.sizeCustom}
                          </span>
                        )}

                        {/* Custom sizing details */}
                        {order.customSizingDetails && (
                          <div className="text-[9px] text-blue-700 bg-blue-50/50 border border-blue-100/50 px-2 py-0.5 rounded-md max-w-[240px] text-center leading-tight font-medium print:bg-white">
                            <span className="font-extrabold text-blue-800 block mb-0.5 uppercase text-[8px] tracking-wider">Detail Sizing:</span>
                            {order.customSizingDetails}
                          </div>
                        )}

                        {/* Rincian Tambahan Harga Ukuran & Lengan */}
                        {(() => {
                          const basePrice = order.unitPrice || 0;
                          if (basePrice <= 0) return null;

                          const getEff = (val: number | undefined, base: number) => {
                            if (!val || val <= 0) return base;
                            return val < base ? base + val : val;
                          };

                          const getDelta = (val: number | undefined, base: number) => {
                            if (!val || val <= 0) return 0;
                            return val < base ? val : val - base;
                          };

                          const effXXL = getEff(order.addPriceXXL, basePrice);
                          const deltaXXL = getDelta(order.addPriceXXL, basePrice);

                          const effLong = getEff(order.addPriceLongSleeve, basePrice);
                          const deltaLong = getDelta(order.addPriceLongSleeve, basePrice);

                          const rawLongXXL = order.addPriceLongSleeveXXL || 0;
                          const effLongXXL = rawLongXXL > 0 
                            ? (rawLongXXL < basePrice ? basePrice + rawLongXXL : rawLongXXL)
                            : (effXXL + deltaLong);
                          const deltaLongXXL = effLongXXL - basePrice;

                          const effCustomDefault = getEff(order.addPriceCustom, basePrice);
                          const deltaCustomDefault = getDelta(order.addPriceCustom, basePrice);

                          // Check quantities ordered across all sizes & sleeves
                          const qtyXXLShort = order.sizeXXL_short ?? 0;
                          const qtyXXLLong = order.sizeXXL_long ?? 0;
                          const totalXXLQty = (order.sizeXXL_short !== undefined || order.sizeXXL_long !== undefined)
                            ? (qtyXXLShort + qtyXXLLong)
                            : (order.sizeXXL || 0);

                          const stdLongQty = (order.sizeS_long || 0) + (order.sizeM_long || 0) + (order.sizeL_long || 0) + (order.sizeXL_long || 0);
                          const totalLongQty = stdLongQty + qtyXXLLong + (order.lenganPanjang || 0);

                          const activeCustoms = (order.customSizes || []).filter(
                            c => (c.short || 0) > 0 || (c.long || 0) > 0 || (c.name && c.name.trim() !== '')
                          );

                          const items: { label: string; surchargeStr: string }[] = [];

                          // 1. Size XXL surcharge (applies to any XXL shirt)
                          if (totalXXLQty > 0 && deltaXXL > 0) {
                            items.push({
                              label: 'Tambahan Size XXL',
                              surchargeStr: `+${formatRupiah(deltaXXL)}/pcs`
                            });
                          }

                          // 2. Lengan Panjang surcharge (applies to any long sleeve shirt)
                          if (totalLongQty > 0 && deltaLong > 0) {
                            items.push({
                              label: 'Tambahan Lengan Panjang',
                              surchargeStr: `+${formatRupiah(deltaLong)}/pcs`
                            });
                          }

                          // 3. Special XXL Long Sleeve override surcharge
                          const expectedComboDelta = deltaXXL + deltaLong;
                          if (qtyXXLLong > 0 && deltaLongXXL > 0 && Math.abs(deltaLongXXL - expectedComboDelta) > 1) {
                            const diff = deltaLongXXL - expectedComboDelta;
                            items.push({
                              label: 'Tambahan Khusus Lengan Panjang XXL',
                              surchargeStr: `${diff > 0 ? '+' : ''}${formatRupiah(diff)}/pcs`
                            });
                          }

                          // 4. Custom sizes
                          activeCustoms.forEach((cs, idx) => {
                            const csName = cs.name || `Custom ${idx + 1}`;
                            const csShortQty = cs.short || 0;
                            const csLongQty = cs.long || 0;

                            if (csShortQty > 0) {
                              let pDelta = 0;
                              if (cs.priceShort && cs.priceShort > 0) {
                                pDelta = getDelta(cs.priceShort, basePrice);
                              } else if (deltaCustomDefault > 0) {
                                pDelta = deltaCustomDefault;
                              }
                              if (pDelta > 0) {
                                items.push({
                                  label: `Tambahan ${csName} (Pendek)`,
                                  surchargeStr: `+${formatRupiah(pDelta)}/pcs`
                                });
                              }
                            }

                            if (csLongQty > 0) {
                              let pDelta = 0;
                              if (cs.priceLong && cs.priceLong > 0) {
                                const pEff = getEff(cs.priceLong, effLong > basePrice ? effLong : basePrice);
                                pDelta = pEff > basePrice ? pEff - basePrice : 0;
                              } else if (deltaCustomDefault > 0 || deltaLong > 0) {
                                pDelta = deltaCustomDefault + deltaLong;
                              }

                              if (deltaLong > 0 && pDelta >= deltaLong) {
                                const customSizeExtra = pDelta - deltaLong;
                                if (customSizeExtra > 0) {
                                  items.push({
                                    label: `Tambahan ${csName}`,
                                    surchargeStr: `+${formatRupiah(customSizeExtra)}/pcs`
                                  });
                                }
                              } else if (pDelta > 0) {
                                items.push({
                                  label: `Tambahan ${csName} (Panjang)`,
                                  surchargeStr: `+${formatRupiah(pDelta)}/pcs`
                                });
                              }
                            }
                          });

                          if (items.length === 0) return null;

                          return (
                            <div className="mt-2 pt-2 border-t border-slate-200/80 w-full text-left print:pt-1">
                              <span className="text-[9px] font-extrabold uppercase text-blue-900 block mb-1 tracking-wider">
                                Rincian Tambahan Harga Ukuran:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {items.map((item, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded font-semibold border bg-amber-50 text-amber-900 border-amber-200/80"
                                  >
                                    <span>{item.label}:</span>
                                    <span className="font-mono font-bold text-amber-800">{item.surchargeStr}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    {(() => {
                      const activeCustomSizes = (order.customSizes || []).filter(
                        c => (c.short || 0) > 0 || (c.long || 0) > 0 || (c.name && c.name.trim() !== '')
                      );

                      const showS = order.sizeS > 0 || (order.sizeS_short || 0) > 0 || (order.sizeS_long || 0) > 0;
                      const showM = order.sizeM > 0 || (order.sizeM_short || 0) > 0 || (order.sizeM_long || 0) > 0;
                      const showL = order.sizeL > 0 || (order.sizeL_short || 0) > 0 || (order.sizeL_long || 0) > 0;
                      const showXL = order.sizeXL > 0 || (order.sizeXL_short || 0) > 0 || (order.sizeXL_long || 0) > 0;
                      const showXXL = order.sizeXXL > 0 || (order.sizeXXL_short || 0) > 0 || (order.sizeXXL_long || 0) > 0;

                      const sShort = showS ? (order.sizeS_short ?? order.sizeS ?? 0) : 0;
                      const mShort = showM ? (order.sizeM_short ?? order.sizeM ?? 0) : 0;
                      const lShort = showL ? (order.sizeL_short ?? order.sizeL ?? 0) : 0;
                      const xlShort = showXL ? (order.sizeXL_short ?? order.sizeXL ?? 0) : 0;
                      const xxlShort = showXXL ? (order.sizeXXL_short ?? order.sizeXXL ?? 0) : 0;

                      const sLong = showS ? (order.sizeS_long ?? 0) : 0;
                      const mLong = showM ? (order.sizeM_long ?? 0) : 0;
                      const lLong = showL ? (order.sizeL_long ?? 0) : 0;
                      const xlLong = showXL ? (order.sizeXL_long ?? 0) : 0;
                      const xxlLong = showXXL ? (order.sizeXXL_long ?? 0) : 0;

                      const customShortTotal = activeCustomSizes.reduce((sum, cs) => sum + (Number(cs.short) || 0), 0);
                      const customLongTotal = activeCustomSizes.reduce((sum, cs) => sum + (Number(cs.long) || 0), 0);

                      const calculatedPendekTotal = sShort + mShort + lShort + xlShort + xxlShort + customShortTotal;
                      const calculatedPanjangTotal = sLong + mLong + lLong + xlLong + xxlLong + customLongTotal;

                      const overallTotalQty = Math.max(calculatedPendekTotal + calculatedPanjangTotal, Number(order.quantity) || 0);

                      const computedSubtotal = (order.totalPrice != null && order.totalPrice > 0)
                        ? (order.totalPrice - (order.shippingCost || 0) + (order.discount || 0))
                        : (overallTotalQty * (order.unitPrice || 0));

                      return (
                        <>
                          <td className="px-3 py-3 text-right font-mono font-semibold whitespace-nowrap align-top">
                            {overallTotalQty} pcs
                          </td>
                          <td className="px-3 py-3 text-right font-mono whitespace-nowrap align-top">
                            {formatRupiah(order.unitPrice)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-950 whitespace-nowrap align-top">
                            {formatRupiah(computedSubtotal)}
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Totals & Payment Logs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-slate-100">
            {/* Notes / Payment Terms */}
            <div>
              <div className="mb-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Catatan Tambahan / Desain</span>
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic print:bg-white print:border-none print:p-0">
                  {order.notes || "Tidak ada catatan khusus."}
                </p>
              </div>

              {/* Bank Details & QRIS for payment instructions on invoice */}
              <div className="bg-sky-50/90 p-3 rounded-xl border border-sky-200/90 print:bg-sky-50 print:border-sky-200">
                <h5 className="text-[11px] uppercase font-extrabold text-blue-900 tracking-wide mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CreditCard size={13} className="text-blue-700" />
                    Metode Pembayaran
                  </span>
                  {activeSettings.qrisUrl && (
                    <span className="text-[9px] bg-blue-600 text-white font-black px-1.5 py-0.2 rounded">
                      QRIS & BANK
                    </span>
                  )}
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  {/* QRIS Image if available */}
                  {activeSettings.qrisUrl && (
                    <div className="sm:col-span-4 flex flex-col items-center justify-center bg-white p-1.5 rounded-lg border border-sky-200 shadow-sm text-center">
                      <img 
                        src={activeSettings.qrisUrl} 
                        alt="QRIS Pembayaran" 
                        className="w-20 h-20 object-contain rounded"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[8px] font-extrabold text-slate-700 uppercase tracking-wider mt-0.5 block">
                        Scan QRIS All Bank
                      </span>
                    </div>
                  )}

                  {/* Bank Account Details */}
                  <div className={`${activeSettings.qrisUrl ? 'sm:col-span-8' : 'sm:col-span-12'} text-xs text-blue-950 space-y-0.5 font-bold`}>
                    <p className="text-[9px] uppercase tracking-wider text-blue-800 font-extrabold mb-0.5">Transfer Bank Direct:</p>
                    {activeSettings.bankAccounts && activeSettings.bankAccounts.length > 0 ? (
                      activeSettings.bankAccounts.map((account, index) => (
                        <div key={index} className="flex flex-col gap-0.5 mb-1 last:mb-0">
                          <p className="text-[11px]">{account.bankName} — <span className="font-mono font-extrabold text-blue-900 bg-white px-1.5 py-0.2 rounded border border-sky-200">{account.accountNumber}</span></p>
                          <p className="text-blue-900 font-semibold text-[10px]">A/N: {account.accountHolder}</p>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[11px]">Bank Mandiri — <span className="font-mono font-extrabold text-blue-900 bg-white px-1.5 py-0.2 rounded border border-sky-200">1780010028294</span></p>
                        <p className="text-blue-900 font-semibold text-[10px]">A/N: MUHAMMAD AINUL YAQIN</p>
                      </div>
                    )}
                    <p className="text-[9px] text-blue-700 mt-1 font-medium leading-tight">Sertakan ID invoice {order.invoiceNumber} di deskripsi transfer.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Totals table */}
            <div className="space-y-2.5">
              {(() => {
                const activeCustomSizes = (order.customSizes || []).filter(
                  c => (c.short || 0) > 0 || (c.long || 0) > 0 || (c.name && c.name.trim() !== '')
                );

                const showS = order.sizeS > 0 || (order.sizeS_short || 0) > 0 || (order.sizeS_long || 0) > 0;
                const showM = order.sizeM > 0 || (order.sizeM_short || 0) > 0 || (order.sizeM_long || 0) > 0;
                const showL = order.sizeL > 0 || (order.sizeL_short || 0) > 0 || (order.sizeL_long || 0) > 0;
                const showXL = order.sizeXL > 0 || (order.sizeXL_short || 0) > 0 || (order.sizeXL_long || 0) > 0;
                const showXXL = order.sizeXXL > 0 || (order.sizeXXL_short || 0) > 0 || (order.sizeXXL_long || 0) > 0;

                const sShort = showS ? (order.sizeS_short ?? order.sizeS ?? 0) : 0;
                const mShort = showM ? (order.sizeM_short ?? order.sizeM ?? 0) : 0;
                const lShort = showL ? (order.sizeL_short ?? order.sizeL ?? 0) : 0;
                const xlShort = showXL ? (order.sizeXL_short ?? order.sizeXL ?? 0) : 0;
                const xxlShort = showXXL ? (order.sizeXXL_short ?? order.sizeXXL ?? 0) : 0;

                const sLong = showS ? (order.sizeS_long ?? 0) : 0;
                const mLong = showM ? (order.sizeM_long ?? 0) : 0;
                const lLong = showL ? (order.sizeL_long ?? 0) : 0;
                const xlLong = showXL ? (order.sizeXL_long ?? 0) : 0;
                const xxlLong = showXXL ? (order.sizeXXL_long ?? 0) : 0;

                const customShortTotal = activeCustomSizes.reduce((sum, cs) => sum + (Number(cs.short) || 0), 0);
                const customLongTotal = activeCustomSizes.reduce((sum, cs) => sum + (Number(cs.long) || 0), 0);

                const calculatedPendekTotal = sShort + mShort + lShort + xlShort + xxlShort + customShortTotal;
                const calculatedPanjangTotal = sLong + mLong + lLong + xlLong + xxlLong + customLongTotal;

                const overallTotalQty = Math.max(calculatedPendekTotal + calculatedPanjangTotal, Number(order.quantity) || 0);

                const computedSubtotal = (order.totalPrice != null && order.totalPrice > 0)
                  ? (order.totalPrice - (order.shippingCost || 0) + (order.discount || 0))
                  : (overallTotalQty * (order.unitPrice || 0));

                return (
                  <>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Subtotal ({overallTotalQty} pcs)</span>
                      <span className="font-mono font-semibold">{formatRupiah(computedSubtotal)}</span>
                    </div>
                  </>
                );
              })()}
              {order.discount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-medium">
                  <span>Diskon Potongan</span>
                  <span className="font-mono">-{formatRupiah(order.discount)}</span>
                </div>
              )}
              {order.shippingCost > 0 && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Ongkos Kirim</span>
                  <span className="font-mono">+{formatRupiah(order.shippingCost)}</span>
                </div>
              )}
              <div className="border-t border-slate-100 my-1 pt-1"></div>
              <div className="flex justify-between text-sm font-bold text-slate-900">
                <span>Total Tagihan</span>
                <span className="font-mono text-base text-blue-700">{formatRupiah(order.totalPrice)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Sudah Dibayar</span>
                <span className="font-mono text-emerald-600 font-semibold">{formatRupiah(order.totalPrice - order.remainingBalance)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-rose-700 print:bg-rose-50 print:border-rose-200">
                <span>Sisa Pelunasan</span>
                <span className="font-mono font-black text-base">{formatRupiah(order.remainingBalance)}</span>
              </div>
            </div>
          </div>

          {/* Payment History Log */}
          {order.paymentHistory.length > 0 && (
            <div className="mt-8 pt-8 border-t border-slate-100 print:hidden">
              <span className="text-xs uppercase font-bold text-slate-400 block mb-3">Histori Pembayaran Pelanggan</span>
              <div className="space-y-2">
                {order.paymentHistory.map((pay) => (
                  <div key={pay.id} className="flex justify-between items-center bg-emerald-50/50 px-4 py-3 rounded-xl border border-emerald-100/50 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      <div>
                        <p className="font-bold text-slate-800">
                          Uang {pay.type === 'DP' ? 'Muka (DP)' : pay.type === 'PELUNASAN' ? 'Pelunasan' : 'Lunas/Penuh'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {pay.method.replace('_', ' ')} — {pay.reference}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold font-mono text-emerald-700">{formatRupiah(pay.amount)}</p>
                      <p className="text-[10px] text-slate-400">{new Date(pay.timestamp).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bank Transfer Instructions (Only show in screen if not fully paid) */}
          {order.paymentStatus !== 'LUNAS' && activeSettings.bankAccounts && activeSettings.bankAccounts.length > 0 && (
            <div className="mt-4 p-3 bg-sky-50/60 rounded-xl border border-sky-200 text-left print:hidden">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 tracking-wider">Instruksi Rekening Pembayaran</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeSettings.bankAccounts.map((account, index) => (
                  <div key={index} className="text-xs bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-extrabold text-slate-800">{account.bankName}</span>
                        {account.isVA && (
                          <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded border border-indigo-100">
                            VA
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-slate-700 text-[11px]">No. Rek/HP: <strong className="text-slate-900 font-bold font-mono">{account.accountNumber}</strong></p>
                      <p className="text-slate-500 text-[10px]">Atas Nama: <strong className="text-slate-600 font-semibold">{account.accountHolder}</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice Footer */}
          <div className="mt-6 pt-3 border-t border-dashed border-slate-200 text-center text-[11px] text-slate-400">
            <p>Terima kasih telah mempercayakan pengerjaan konveksi Anda pada <strong>{activeSettings.businessName}</strong>!</p>
            {activeSettings.additionalNotes && (
              <p className="mt-0.5 leading-tight max-w-xl mx-auto text-[10px]">{activeSettings.additionalNotes}</p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
