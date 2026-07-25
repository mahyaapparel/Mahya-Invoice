import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, AlertCircle, ShieldCheck, CreditCard, 
  ArrowRight, Phone, Clock, MessageSquare, Copy, Check,
  Scissors, Hammer, Activity, Compass, Package, Send, Sparkles, LogIn,
  Printer, Download, Loader2, User, Mail, MapPin, Calendar, Building
} from 'lucide-react';
import { ConvectionOrder, PaymentRecord, InvoiceSettings } from '../types';
import { formatRupiah, formatIndonesianDate, getPaymentStatusDetails } from '../utils/format';
import { exportElementToPdf } from '../utils/pdfSanitizer';
import { fetchOrderFromFirestore, fetchSettingsFromFirestore } from '../services/firestoreService';
import mahyaLogo from '../assets/images/mahya_logo_1784646837491.jpg';
import html2pdf from 'html2pdf.js';

const defaultInvoiceSettings: InvoiceSettings = {
  businessName: "MAHYA APPAREL",
  slogan: "Solusi Konveksi Premium & Custom Terpercaya",
  address: "Jl. Raya Konveksi No. 88, Malang, Indonesia",
  phone: "+62 812-3456-7890",
  email: "mahyaapparel@gmail.com",
  logoUrl: "",
  qrisUrl: "",
  bankAccounts: [
    {
      bankName: "Bank Mandiri",
      accountNumber: "1780010028294",
      accountHolder: "MUHAMMAD AINUL YAQIN",
      isVA: false
    }
  ],
  additionalNotes: "Invoice ini merupakan dokumen digital resmi yang sah. Segala pengerjaan status terhubung real-time dengan pusat produksi kami."
};

interface CustomerPaymentPortalProps {
  invoiceId: string;
  onPaymentSuccess: () => void;
  onBackToCashier?: () => void; // Hidden link to return to Cashier dashboard for convenience
}

export default function CustomerPaymentPortal({ invoiceId, onPaymentSuccess, onBackToCashier }: CustomerPaymentPortalProps) {
  const [order, setOrder] = useState<ConvectionOrder | null>(null);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentOption, setPaymentOption] = useState<'DP' | 'FULL' | 'PELUNASAN'>('FULL');
  const [selectedMethod, setSelectedMethod] = useState<'QRIS' | 'BANK_TRANSFER' | 'E_WALLET' | null>('QRIS');
  const [paymentMethodDetail, setPaymentMethodDetail] = useState<string>('ShopeePay/Gopay/Dana');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);
  const [paymentDone, setPaymentDone] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  const activeSettings = settings || defaultInvoiceSettings;

  // Fetch the invoice and settings
  const fetchInvoiceAndSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const cleanId = invoiceId.trim();

      let data: ConvectionOrder | null = null;

      // 1. First attempt search via lookup endpoint
      try {
        const orderRes = await fetch(`/api/orders/lookup?q=${encodeURIComponent(cleanId)}`);
        const orderType = orderRes.headers.get('content-type') || '';
        if (orderRes.ok && orderType.includes('application/json')) {
          data = await orderRes.json();
        } else {
          const fallbackRes = await fetch(`/api/orders/${encodeURIComponent(cleanId)}`);
          const fallbackType = fallbackRes.headers.get('content-type') || '';
          if (fallbackRes.ok && fallbackType.includes('application/json')) {
            data = await fallbackRes.json();
          }
        }
      } catch (err) {
        console.warn("API order fetch failed:", err);
      }

      // 2. If not found via lookup API, check Firestore directly
      if (!data) {
        try {
          data = await fetchOrderFromFirestore(cleanId);
        } catch (fErr) {
          console.warn("Firestore order fetch failed:", fErr);
        }
      }

      // 3. Fallback: fetch all orders from /api/orders and search
      if (!data) {
        try {
          const allRes = await fetch('/api/orders');
          if (allRes.ok) {
            const allOrders: ConvectionOrder[] = await allRes.json();
            const cleanAlpha = cleanId.toLowerCase().replace(/[^a-z0-9]/g, '');
            data = allOrders.find((o) => {
              const oIdAlpha = (o.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const oInvAlpha = (o.invoiceNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              return oIdAlpha === cleanAlpha || oInvAlpha === cleanAlpha ||
                     (o.id || '').toLowerCase().includes(cleanId.toLowerCase()) ||
                     (o.invoiceNumber || '').toLowerCase().includes(cleanId.toLowerCase());
            }) || null;
          }
        } catch (e) {
          console.warn("Fetch all orders fallback failed:", e);
        }
      }

      if (!data) {
        throw new Error(`Invoice "${cleanId}" tidak ditemukan. Silakan periksa kembali nomor invoice atau hubungi CS.`);
      }

      setOrder(data);

      try {
        let loadedSettings: InvoiceSettings | null = null;
        const settingsRes = await fetch('/api/settings');
        const settingsType = settingsRes.headers.get('content-type') || '';
        if (settingsRes.ok && settingsType.includes('application/json')) {
          loadedSettings = await settingsRes.json();
        }
        
        // Also check Firestore for latest settings (especially qrisUrl)
        const fsSettings = await fetchSettingsFromFirestore();
        if (fsSettings) {
          loadedSettings = {
            ...defaultInvoiceSettings,
            ...loadedSettings,
            ...fsSettings,
            qrisUrl: fsSettings.qrisUrl || loadedSettings?.qrisUrl || ''
          };
        }
        
        if (loadedSettings) {
          setSettings(loadedSettings);
        }
      } catch (sErr) {
        console.warn("Settings fetch failed, using default settings:", sErr);
      }
      
      // Select appropriate payment option
      if (data.paymentStatus === 'BELUM_BAYAR') {
        setPaymentOption('DP');
      } else if (data.paymentStatus === 'DP_DIBAYAR') {
        setPaymentOption('PELUNASAN');
      }
    } catch (err: any) {
      console.error("Error loading invoice:", err);
      setError(err.message || 'Gagal memuat invoice.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceAndSettings();
    }
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Memuat portal invoice Anda...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-xl border border-slate-100 text-center space-y-4">
          <AlertCircle size={48} className="text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">Invoice Tidak Ditemukan</h2>
          <p className="text-slate-500 text-sm leading-relaxed">{error || 'ID invoice salah atau tidak terdaftar di sistem kami.'}</p>
          
          {/* Direct Invoice Number Search */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const input = form.elements.namedItem('searchInvoiceInput') as HTMLInputElement;
              if (input && input.value.trim()) {
                window.location.href = `?invoice=${encodeURIComponent(input.value.trim())}`;
              }
            }}
            className="pt-2"
          >
            <label className="block text-xs font-bold text-slate-600 text-left mb-1.5 uppercase tracking-wide">
              Masukkan Nomor Invoice / Order ID:
            </label>
            <div className="flex gap-2">
              <input 
                type="text"
                name="searchInvoiceInput"
                placeholder="Contoh: INV-2026-0001"
                className="flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
              />
              <button 
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all shrink-0 cursor-pointer"
              >
                Cari Invoice
              </button>
            </div>
          </form>

          <div className="pt-4 flex flex-col gap-2 border-t border-slate-100">
            <a 
              href={`https://wa.me/${activeSettings.phone.replace(/[^0-9]/g, '')}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Phone size={16} />
              Hubungi CS {activeSettings.businessName}
            </a>
            {onBackToCashier && (
              <button 
                onClick={onBackToCashier}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                id="btn-back-to-cashier-error"
              >
                <LogIn size={16} />
                Kembali ke Kasir
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Get active step index based on production status
  const getActiveStepIndex = (status: string) => {
    const steps = ['ANTREAN', 'POTONG_BAHAN', 'SABLON_BORDIR', 'JAHIT', 'FINISHING', 'SIAP_DIAMBIL', 'DIKIRIM'];
    return steps.indexOf(status);
  };

  const currentStepIndex = getActiveStepIndex(order.productionStatus);

  const productionSteps = [
    { title: 'Antrean', desc: 'Pesanan Dikonfirmasi', icon: Clock },
    { title: 'Potong', desc: 'Pemotongan Bahan', icon: Scissors },
    { title: 'Sablon & Bordir', desc: 'Aplikasi Desain', icon: Compass },
    { title: 'Jahit', desc: 'Perakitan Garment', icon: Hammer },
    { title: 'Finishing', desc: 'Setrika & Quality Control', icon: Activity },
    { title: 'Siap Diambil', desc: 'Pesanan Selesai', icon: Sparkles },
    { title: 'Dikirim', desc: 'Diserahkan ke Kurir', icon: Package },
  ];

  // Calculate amount to pay
  const getAmountToPay = () => {
    if (paymentOption === 'DP') {
      // DP is normally half of total or custom. Let's offer standard 50% or full
      return Math.round(order.totalPrice * 0.5);
    } else if (paymentOption === 'PELUNASAN') {
      return order.remainingBalance;
    } else {
      return order.totalPrice;
    }
  };

  const amountToPay = getAmountToPay();

  // Handle fake payment submission
  const handlePaymentSubmit = async () => {
    if (!selectedMethod) return;
    if (selectedMethod === 'E_WALLET' && !phoneNumber) {
      alert('Masukkan nomor E-Wallet Anda.');
      return;
    }

    setProcessingPayment(true);
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const referenceCode = selectedMethod === 'QRIS' 
        ? 'QR-' + Math.floor(100000 + Math.random() * 900000)
        : selectedMethod === 'BANK_TRANSFER'
        ? 'TRF-' + paymentMethodDetail + '-' + Math.floor(100000 + Math.random() * 900000)
        : 'EWL-' + Math.floor(100000 + Math.random() * 900000);

      const paymentType = paymentOption === 'DP' ? 'DP' : paymentOption === 'PELUNASAN' ? 'PELUNASAN' : 'FULL';

      const res = await fetch(`/api/orders/${order.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToPay,
          type: paymentType,
          method: selectedMethod,
          reference: referenceCode
        })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Pembayaran gagal dicatat');
      }
      
      const updatedOrder = await res.json();
      setOrder(updatedOrder);
      setPaymentDone(true);
      onPaymentSuccess();
    } catch (err) {
      alert('Gagal mencatat pembayaran, silakan coba lagi.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const copyVA = () => {
    navigator.clipboard.writeText('8830189911');
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!order) return;
    setIsExportingPDF(true);
    try {
      const sourceElement = document.getElementById('customer-printable-invoice');
      if (!sourceElement) {
        window.print();
        return;
      }
      const filename = `Invoice-${(order.invoiceNumber || order.id).replace(/[/\\?%*:|"<>]/g, '-')}.pdf`;
      await exportElementToPdf(sourceElement, filename, 'customer-printable-invoice');
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setIsExportingPDF(false);
    }
  };

  const pStatusDetails = getPaymentStatusDetails(order.paymentStatus);

  return (
    <div className="min-h-screen bg-slate-50 pb-16 print:bg-white print:pb-0">
      
      {/* Floating Header - Hidden in Print */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 px-6 py-4 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-3">
          <img 
            src={activeSettings.logoUrl || mahyaLogo} 
            alt={`${activeSettings.businessName} Logo`} 
            className="w-9 h-9 object-contain rounded-lg border border-slate-100 bg-white shadow-sm"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-none">{activeSettings.businessName}</h1>
            <p className="text-[10px] text-slate-500">Invoice Customer Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 shadow-sm"
            id="btn-customer-download-pdf"
            title="Unduh Invoice PDF"
          >
            {isExportingPDF ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {isExportingPDF ? 'Proses...' : 'Unduh PDF'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 transition-colors px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shadow-sm"
            id="btn-customer-print-invoice"
            title="Cetak Invoice"
          >
            <Printer size={13} />
            Cetak
          </button>
          {onBackToCashier && (
            <button
              onClick={onBackToCashier}
              className="text-xs font-semibold text-slate-500 hover:text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-all flex items-center gap-1 cursor-pointer"
              id="btn-back-to-cashier-header"
            >
              <LogIn size={13} />
              Kasir Panel
            </button>
          )}
          <a
            href={`https://wa.me/${activeSettings.phone.replace(/[^0-9]/g, '')}?text=Halo+${encodeURIComponent(activeSettings.businessName)},+saya+ingin+tanya+mengenai+invoice+${order.invoiceNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
          >
            <Phone size={13} />
            Hubungi Kasir
          </a>
        </div>
      </header>

      {/* Printable Area Wrapper */}
      <div id="customer-printable-invoice" className="bg-slate-50 print:bg-white print:p-4">

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Order Status, Timeline, Specifications (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main banner & Progress Tracker */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">PROGRES PRODUKSI</span>
            <h2 className="text-xl font-extrabold text-slate-800">
              {order.productionStatus === 'DIKIRIM' 
                ? 'Garment Anda Sudah Dikirim!' 
                : order.productionStatus === 'SIAP_DIAMBIL'
                ? 'Pesanan Selesai & Siap Diambil!'
                : 'Garment Sedang Diproduksi'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">Kami berkomitmen menjaga kualitas setiap jahitan baju Anda.</p>

            {/* Custom Interactive Timeline */}
            <div className="mt-8 relative pl-6 border-l border-slate-100 space-y-6">
              {productionSteps.map((step, idx) => {
                const isPassed = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                const Icon = step.icon;

                return (
                  <div key={idx} className="relative">
                    {/* Circle icon on the line */}
                    <div className={`absolute -left-[37px] top-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCurrent 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md ring-4 ring-blue-50 animate-pulse'
                        : isPassed
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}>
                      {isPassed && !isCurrent ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
                    </div>

                    {/* Step details */}
                    <div className="ml-2">
                      <h4 className={`text-sm font-bold leading-none transition-all ${
                        isCurrent ? 'text-blue-600 text-base' : isPassed ? 'text-slate-800' : 'text-slate-400 font-medium'
                      }`}>
                        {step.title}
                        {isCurrent && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                            Sedang Berjalan
                          </span>
                        )}
                      </h4>
                      <p className={`text-xs mt-1 leading-snug ${
                        isCurrent ? 'text-slate-600' : isPassed ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Specifications Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-base font-bold text-slate-800 mb-4">Spesifikasi Pesanan</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <span className="text-xs text-slate-400 block font-medium">Model Produk</span>
                <span className="font-bold text-slate-700">{order.productType}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <span className="text-xs text-slate-400 block font-medium">Bahan Kain</span>
                <span className="font-bold text-slate-700">{order.fabricType || '-'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <span className="text-xs text-slate-400 block font-medium">Warna Kain</span>
                <span className="font-bold text-slate-700">{order.fabricColor || '-'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <span className="text-xs text-slate-400 block font-medium">Aplikasi Desain</span>
                <span className="font-bold text-slate-700">{order.sablonBordir || '-'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-400 block font-medium mb-1.5">Rincian Ukuran & Type Lengan:</span>
                
                {(order.sizeS_short !== undefined || order.sizeS_long !== undefined || order.sizeM_short !== undefined || order.sizeM_long !== undefined || (order.customSizes && order.customSizes.length > 0)) ? (
                  <div className="overflow-x-auto max-w-full">
                    {(() => {
                      const activeCustomSizes = (order.customSizes || []).filter(
                        c => (c.short || 0) > 0 || (c.long || 0) > 0 || (c.name && c.name.trim() !== '')
                      );

                      return (
                        <table className="text-[11px] border-collapse border border-slate-200 text-center bg-white rounded-lg overflow-hidden w-full max-w-md">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                              <th className="border-r border-slate-200 px-2 py-1 text-left font-extrabold text-[10px] uppercase text-slate-500">
                                Ukuran
                              </th>
                              {order.sizeS > 0 && <th className="border-r border-slate-200 px-2 py-1 font-bold">S</th>}
                              {order.sizeM > 0 && <th className="border-r border-slate-200 px-2 py-1 font-bold">M</th>}
                              {order.sizeL > 0 && <th className="border-r border-slate-200 px-2 py-1 font-bold">L</th>}
                              {order.sizeXL > 0 && <th className="border-r border-slate-200 px-2 py-1 font-bold">XL</th>}
                              {order.sizeXXL > 0 && <th className="border-r border-slate-200 px-2 py-1 font-bold">XXL</th>}
                              {activeCustomSizes.map((cs, idx) => (
                                <th key={idx} className="border-r border-slate-200 px-2 py-1 font-extrabold text-blue-700 bg-blue-50/80">
                                  {cs.name || `Custom ${idx + 1}`}
                                </th>
                              ))}
                              <th className="px-2 py-1 font-extrabold bg-slate-200 text-slate-800">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                            <tr>
                              <td className="border-r border-slate-200 px-2 py-1 font-bold text-slate-600 text-left bg-slate-50">
                                Pendek
                              </td>
                              {order.sizeS > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeS_short ?? order.sizeS}</td>}
                              {order.sizeM > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeM_short ?? order.sizeM}</td>}
                              {order.sizeL > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeL_short ?? order.sizeL}</td>}
                              {order.sizeXL > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeXL_short ?? order.sizeXL}</td>}
                              {order.sizeXXL > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeXXL_short ?? order.sizeXXL}</td>}
                              {activeCustomSizes.map((cs, idx) => (
                                <td key={idx} className="border-r border-slate-200 px-2 py-1 font-semibold text-slate-800 bg-blue-50/30">
                                  {cs.short || 0}
                                </td>
                              ))}
                              <td className="px-2 py-1 font-bold bg-slate-50 text-emerald-700">{order.lenganPendek || 0}</td>
                            </tr>
                            <tr>
                              <td className="border-r border-slate-200 px-2 py-1 font-bold text-slate-600 text-left bg-slate-50">
                                Panjang
                              </td>
                              {order.sizeS > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeS_long ?? 0}</td>}
                              {order.sizeM > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeM_long ?? 0}</td>}
                              {order.sizeL > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeL_long ?? 0}</td>}
                              {order.sizeXL > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeXL_long ?? 0}</td>}
                              {order.sizeXXL > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeXXL_long ?? 0}</td>}
                              {activeCustomSizes.map((cs, idx) => (
                                <td key={idx} className="border-r border-slate-200 px-2 py-1 font-semibold text-slate-800 bg-blue-50/30">
                                  {cs.long || 0}
                                </td>
                              ))}
                              <td className="px-2 py-1 font-bold bg-slate-50 text-indigo-700">{order.lenganPanjang || 0}</td>
                            </tr>
                            <tr className="font-extrabold bg-slate-100 border-t border-slate-200">
                              <td className="border-r border-slate-200 px-2 py-1 text-left text-slate-800">
                                Jumlah
                              </td>
                              {order.sizeS > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeS}</td>}
                              {order.sizeM > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeM}</td>}
                              {order.sizeL > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeL}</td>}
                              {order.sizeXL > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeXL}</td>}
                              {order.sizeXXL > 0 && <td className="border-r border-slate-200 px-2 py-1">{order.sizeXXL}</td>}
                              {activeCustomSizes.map((cs, idx) => (
                                <td key={idx} className="border-r border-slate-200 px-2 py-1 font-black text-blue-900 bg-blue-100/70">
                                  {(cs.short || 0) + (cs.long || 0)}
                                </td>
                              ))}
                              <td className="px-2 py-1 bg-blue-100 text-blue-900 font-black">{order.quantity}</td>
                            </tr>
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {order.sizeS > 0 && <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 text-xs font-bold rounded-lg">S: {order.sizeS}</span>}
                    {order.sizeM > 0 && <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 text-xs font-bold rounded-lg">M: {order.sizeM}</span>}
                    {order.sizeL > 0 && <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 text-xs font-bold rounded-lg">L: {order.sizeL}</span>}
                    {order.sizeXL > 0 && <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 text-xs font-bold rounded-lg">XL: {order.sizeXL}</span>}
                    {order.sizeXXL > 0 && <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 text-xs font-bold rounded-lg">XXL: {order.sizeXXL}</span>}
                    {order.sizeCustom && <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 text-xs font-bold rounded-lg">Custom: {order.sizeCustom}</span>}
                    {!!order.lenganPendek && <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 text-xs font-bold rounded-lg">Pendek: {order.lenganPendek} pcs</span>}
                    {!!order.lenganPanjang && <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 text-xs font-bold rounded-lg">Panjang: {order.lenganPanjang} pcs</span>}
                  </div>
                )}
              </div>

              {/* Custom sizing details */}
              {order.customSizingDetails && (
                <div className="mt-3 border-t border-slate-50 pt-2.5">
                  <span className="text-xs text-slate-400 block font-medium mb-1">Detail Ukuran Custom:</span>
                  <p className="text-xs font-semibold text-blue-800 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 leading-relaxed">
                    {order.customSizingDetails}
                  </p>
                </div>
              )}
              
              {order.notes && (
                <div className="mt-4 border-t border-slate-50 pt-3">
                  <span className="text-xs text-slate-400 block font-medium mb-1">Catatan Tambahan:</span>
                  <p className="text-xs text-slate-600 bg-amber-50/50 p-3 rounded-lg border border-amber-100 italic">
                    "{order.notes}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Confirmation & Send Proof to Admin Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3.5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Konfirmasi Pembayaran</span>
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200">
                WhatsApp Admin
              </span>
            </h3>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Sudah melakukan transfer atau pembayaran? Silakan kirimkan bukti pembayaran (struk/resi transfer) Anda langsung ke Admin via WhatsApp agar status pembayaran invoice Anda dapat segera diverifikasi.
              </p>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Nomor WhatsApp Admin:</span>
                  <span className="font-bold text-slate-900 font-mono">{activeSettings.phone}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Ref. Invoice:</span>
                  <span className="font-extrabold text-blue-700 font-mono">{order.invoiceNumber}</span>
                </div>
              </div>

              {(() => {
                const adminPhoneClean = (activeSettings.phone || '+6281234567890').replace(/\D/g, '');
                const waMessage = encodeURIComponent(
                  `Halo Admin ${activeSettings.businessName},\nSaya mau konfirmasi pembayaran untuk:\n\n` +
                  `*No. Invoice:* ${order.invoiceNumber}\n` +
                  `*Nama Pemesan:* ${order.customerName}\n` +
                  `*Total Tagihan:* ${formatRupiah(order.totalPrice)}\n` +
                  `*Sisa Tagihan:* ${formatRupiah(order.remainingBalance)}\n\n` +
                  `Berikut saya lampirkan bukti pembayaran/transfer. Mohon diproses, terima kasih!`
                );
                const waUrl = `https://wa.me/${adminPhoneClean}?text=${waMessage}`;

                return (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <MessageSquare size={16} />
                    <span>Kirim Bukti Pembayaran ke Admin</span>
                  </a>
                );
              })()}
            </div>
          </div>

        </div>

        {/* Right column: Customer Info, Invoice Totals & Checkout (5 cols) */}
        <div className="lg:col-span-5 space-y-6">

          {/* Customer Information Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-extrabold text-blue-900 tracking-wider">Data Pelanggan (Pemesan)</h3>
                  <p className="text-[11px] text-slate-400">Informasi pemesan & alamat pengiriman</p>
                </div>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                Terverifikasi
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Nama Pemesan / Instansi</span>
                <p className="text-sm font-extrabold text-slate-900">{order.customerName}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-50">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">No. WhatsApp / HP</span>
                  {order.customerPhone ? (
                    <a
                      href={`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      <Phone size={13} className="text-emerald-500" />
                      <span>{order.customerPhone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 font-medium">-</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Email</span>
                  {order.customerEmail ? (
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5 truncate">
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{order.customerEmail}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">-</span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-50">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Alamat Pengiriman</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs font-medium leading-relaxed flex items-start gap-1.5">
                  <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <span>{order.customerAddress || 'Alamat belum diisi (Diambil di outlet)'}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50 text-[11px]">
                <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Tgl Order</span>
                  <span className="font-bold text-slate-800">{formatIndonesianDate(order.orderDate)}</span>
                </div>
                <div className="bg-rose-50/50 p-2 rounded-lg border border-rose-100/50">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Target Deadline</span>
                  <span className="font-bold text-rose-700">{formatIndonesianDate(order.deadline)}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Billing Overview */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-widest block">No. Invoice</span>
                <span className="font-mono text-sm font-bold text-slate-800">{order.invoiceNumber}</span>
              </div>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${pStatusDetails.color}`}>
                {pStatusDetails.label}
              </span>
            </div>

            <div className="space-y-2 text-sm text-slate-600 mb-4">
              <div className="flex justify-between">
                <span>Subtotal ({order.quantity} pcs)</span>
                <span className="font-mono text-slate-800">{formatRupiah(order.quantity * order.unitPrice)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Diskon Potongan</span>
                  <span className="font-mono">-{formatRupiah(order.discount)}</span>
                </div>
              )}
              {order.shippingCost > 0 && (
                <div className="flex justify-between">
                  <span>Ongkos Kirim</span>
                  <span className="font-mono">+{formatRupiah(order.shippingCost)}</span>
                </div>
              )}
              <div className="border-t border-slate-50 pt-2"></div>
              <div className="flex justify-between text-base font-extrabold text-slate-900">
                <span>Total Biaya</span>
                <span className="font-mono text-blue-600">{formatRupiah(order.totalPrice)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 pt-1">
                <span>Uang Muka (DP) Terbayar</span>
                <span className="font-mono text-emerald-600 font-bold">{formatRupiah(order.totalPrice - order.remainingBalance)}</span>
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-xl p-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Harus Dilunasi</span>
                <p className="text-xl font-mono font-black">{formatRupiah(order.remainingBalance)}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Deadline</span>
                <p className="text-xs font-bold text-rose-300">{formatIndonesianDate(order.deadline)}</p>
              </div>
            </div>
          </div>

          {/* Live Simulated Checkout Gate */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 overflow-hidden relative">
            
            {/* If Fully Paid */}
            {order.paymentStatus === 'LUNAS' || paymentDone ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 mb-4 border-2 border-emerald-500/10">
                  <ShieldCheck size={36} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800">Invoice Selesai Dilunasi!</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Terima kasih, pembayaran Anda telah berhasil kami verifikasi. Tim produksi sedang mengerjakan pesanan Anda secepat mungkin.
                </p>
                <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100 text-left text-xs font-mono space-y-1.5">
                  <div className="flex justify-between"><span className="text-slate-400">Total Dibayar:</span><span className="font-bold text-slate-800">{formatRupiah(order.totalPrice)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Status Pembayaran:</span><span className="font-bold text-emerald-600">LUNAS (Verified)</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Sisa Tagihan:</span><span className="font-bold text-slate-800">Rp 0</span></div>
                </div>
              </div>
            ) : (
              /* If Payment Needed */
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                  <CreditCard size={16} className="text-blue-600" />
                  Gerbang Pembayaran Digital (Simulasi)
                </h3>

                {/* Select DP or FULL option if Belum Bayar */}
                {order.paymentStatus === 'BELUM_BAYAR' && (
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 mb-4">
                    <button
                      onClick={() => setPaymentOption('DP')}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        paymentOption === 'DP' 
                          ? 'bg-white text-blue-700 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      id="btn-pay-dp"
                    >
                      Bayar DP (50%)
                      <span className="block font-mono text-[10px] font-medium text-slate-400 mt-0.5">
                        {formatRupiah(order.totalPrice * 0.5)}
                      </span>
                    </button>
                    <button
                      onClick={() => setPaymentOption('FULL')}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        paymentOption === 'FULL' 
                          ? 'bg-white text-blue-700 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      id="btn-pay-full"
                    >
                      Bayar Penuh (Lunas)
                      <span className="block font-mono text-[10px] font-medium text-slate-400 mt-0.5">
                        {formatRupiah(order.totalPrice)}
                      </span>
                    </button>
                  </div>
                )}

                {/* Display Payment Option for Pelunasan */}
                {order.paymentStatus === 'DP_DIBAYAR' && (
                  <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-100 text-xs font-bold flex items-center gap-2 mb-4">
                    <AlertCircle size={14} />
                    <span>Uang Muka (DP) Sudah Dibayar. Menyelesaikan Sisa Pelunasan.</span>
                  </div>
                )}

                <div className="border border-slate-100 rounded-xl p-3.5 mb-4 flex justify-between items-center bg-blue-50/20">
                  <span className="text-xs text-blue-950 font-medium">Jumlah yang akan dibayar:</span>
                  <span className="font-mono text-base font-black text-blue-700">{formatRupiah(amountToPay)}</span>
                </div>

                {/* Choose Payment Method */}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2.5">Pilih Metode Pembayaran</span>
                <div className="space-y-2 mb-6">
                  {/* QRIS */}
                  <button
                    onClick={() => { setSelectedMethod('QRIS'); setPaymentMethodDetail('ShopeePay/Gopay/Dana'); }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all ${
                      selectedMethod === 'QRIS' 
                        ? 'border-blue-600 bg-blue-50/30' 
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                    id="btn-method-qris"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 font-black text-xs flex items-center justify-center">
                        QRIS
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-800">QRIS E-Wallet</h4>
                        <p className="text-[10px] text-slate-500">Scan QR Code instan & otomatis</p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-slate-400" />
                  </button>

                  {/* Bank Transfer */}
                  <button
                    onClick={() => { setSelectedMethod('BANK_TRANSFER'); setPaymentMethodDetail(activeSettings.bankAccounts?.[0]?.bankName || 'Bank BRI'); }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all ${
                      selectedMethod === 'BANK_TRANSFER' 
                        ? 'border-blue-600 bg-blue-50/30' 
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                    id="btn-method-va"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center">
                        {activeSettings.bankAccounts?.[0]?.bankName || 'BRI'}
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-800">Transfer Bank / Rekening</h4>
                        <p className="text-[10px] text-slate-500">Bank BRI & Transfer Bank Lainnya</p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-slate-400" />
                  </button>
                </div>

                {/* Sub-panels for selected method */}
                {selectedMethod === 'QRIS' && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center mb-6 animate-fade-in">
                    <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest block mb-1">
                      PINDAI KODE QRIS DI BAWAH
                    </span>
                    
                    {activeSettings.qrisUrl ? (
                      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-md inline-block mx-auto mt-2 max-w-[240px]">
                        <img 
                          src={activeSettings.qrisUrl} 
                          alt={`QRIS ${activeSettings.businessName}`}
                          className="w-full h-auto object-contain rounded-xl max-h-64 mx-auto"
                          referrerPolicy="no-referrer"
                        />
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span>{activeSettings.businessName}</span>
                          <a 
                            href={activeSettings.qrisUrl} 
                            download={`QRIS-${activeSettings.businessName}.png`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-[10px] flex items-center gap-1 font-bold"
                          >
                            <Download size={12} /> Unduh QR
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm inline-block mx-auto mt-2">
                        <div className="w-44 h-44 bg-slate-50 flex flex-col items-center justify-center relative rounded-xl border border-dashed border-slate-300 p-3 text-center">
                          <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-slate-900"></div>
                          <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-slate-900"></div>
                          <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-slate-900"></div>
                          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-slate-900"></div>
                          
                          <ShieldCheck size={32} className="text-blue-600 mb-1" />
                          <span className="text-[10px] text-slate-700 font-extrabold block">QRIS {activeSettings.businessName}</span>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">ID: {order.id.toUpperCase()}</span>
                          <p className="text-[8px] text-slate-400 mt-2 leading-tight">
                            Atur & unggah foto QRIS resmi Anda di menu <strong>Pengaturan Invoice</strong> di Kasir.
                          </p>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500 font-medium mt-3">
                      Mendukung pembayaran via semua E-Wallet (GoPay, DANA, OVO, ShopeePay, LinkAja) & M-Banking Indonesia (BCA, Mandiri, BRI, BNI, dll).
                    </p>
                  </div>
                )}

                {selectedMethod === 'BANK_TRANSFER' && (
                  <div className="space-y-3 mb-6">
                    {activeSettings.bankAccounts && activeSettings.bankAccounts.length > 0 ? (
                      activeSettings.bankAccounts.map((account, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs animate-fade-in space-y-3">
                          <div className="flex justify-between items-center text-left">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Bank / Rekening</span>
                              <p className="font-extrabold text-slate-800 text-sm">
                                {account.bankName} {account.isVA ? 'Virtual Account' : 'Transfer Manual'}
                              </p>
                            </div>
                            {account.isVA && (
                              <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded border border-blue-200">
                                Otomatis / VA
                              </span>
                            )}
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nomor Rekening / VA</span>
                            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 font-mono">
                              <span className="font-bold text-blue-700 text-sm select-all">{account.accountNumber}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(account.accountNumber);
                                  setCopiedText(true);
                                  setTimeout(() => setCopiedText(false), 2000);
                                }}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer"
                              >
                                {copiedText ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Nama Pemilik / Atas Nama</span>
                            <p className="font-bold text-slate-700">{account.accountHolder}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-center text-slate-400">
                        Belum ada rekening transfer terdaftar. Silakan hubungi kasir.
                      </div>
                    )}
                  </div>
                )}

                {selectedMethod === 'E_WALLET' && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-xs animate-fade-in space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nomor Ponsel Terdaftar</span>
                      <input 
                        type="tel"
                        placeholder="Contoh: 081234567890"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full bg-white px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none font-bold text-slate-800 text-sm"
                        id="input-ewallet-phone"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Kami akan mengirimkan notifikasi konfirmasi pembayaran (push payment) langsung ke aplikasi e-wallet Anda.</p>
                    </div>
                  </div>
                )}

                {/* Proceed button */}
                <button
                  disabled={!selectedMethod || processingPayment}
                  onClick={handlePaymentSubmit}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                    !selectedMethod
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-[0.98]'
                  }`}
                  id="btn-submit-simulated-payment"
                >
                  {processingPayment ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Menghubungkan ke Bank Gateway...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      Konfirmasi & Bayar {formatRupiah(amountToPay)}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

      </main>
      </div>
    </div>
  );
}
