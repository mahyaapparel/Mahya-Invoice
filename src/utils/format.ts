/**
 * Format a number into Indonesian Rupiah (IDR) currency format safely.
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  const safeAmount = (!isNaN(num) && isFinite(num)) ? num : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
}

/**
 * Format an ISO date string into a readable Indonesian date.
 * Example: "2026-07-21" -> "21 Juli 2026"
 */
export function formatIndonesianDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Get color classes for production status.
 */
export function getProductionStatusDetails(status: string) {
  switch (status) {
    case 'ANTREAN':
      return { label: 'Antrean', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'POTONG_BAHAN':
      return { label: 'Potong Bahan', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'SABLON_BORDIR':
      return { label: 'Sablon & Bordir', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'JAHIT':
      return { label: 'Proses Jahit', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'FINISHING':
      return { label: 'Finishing & QC', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'SIAP_DIAMBIL':
      return { label: 'Siap Diambil', color: 'bg-teal-50 text-teal-700 border-teal-200' };
    case 'DIKIRIM':
      return { label: 'Sudah Dikirim', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    default:
      return { label: status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

/**
 * Get status details for payment.
 */
export function getPaymentStatusDetails(status: string) {
  switch (status) {
    case 'BELUM_BAYAR':
      return { label: 'Belum Bayar', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'DP_DIBAYAR':
      return { label: 'DP Dibayar', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
    case 'LUNAS':
      return { label: 'Lunas', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    default:
      return { label: status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}
