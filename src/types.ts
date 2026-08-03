export type PaymentStatus = 'BELUM_BAYAR' | 'DP_DIBAYAR' | 'LUNAS';

export type ProductionStatus = 
  | 'ANTREAN' 
  | 'POTONG_BAHAN' 
  | 'SABLON_BORDIR' 
  | 'JAHIT' 
  | 'FINISHING' 
  | 'SIAP_DIAMBIL' 
  | 'DIKIRIM';

export interface PaymentRecord {
  id: string;
  amount: number;
  type: 'DP' | 'PELUNASAN' | 'FULL';
  method: 'BANK_TRANSFER' | 'QRIS' | 'E_WALLET' | 'CASH';
  reference?: string;
  timestamp: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export interface ConvectionOrder {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  
  // Product details
  productType: string; // e.g. Kaos, Kemeja, Hoodie, Jaket, Almamater
  fabricType: string;  // e.g. Cotton Combed 30s, Fleece, American Drill
  fabricColor: string; // e.g. Hitam, Navy, Putih
  sablonBordir: string; // e.g. Sablon Plastisol, Bordir Komputer
  
  // Size counts
  sizeS: number;
  sizeM: number;
  sizeL: number;
  sizeXL: number;
  sizeXXL: number;

  // Per-size sleeve breakdown (Pendek & Panjang)
  sizeS_short?: number;
  sizeS_long?: number;
  sizeM_short?: number;
  sizeM_long?: number;
  sizeL_short?: number;
  sizeL_long?: number;
  sizeXL_short?: number;
  sizeXL_long?: number;
  sizeXXL_short?: number;
  sizeXXL_long?: number;

  sizeCustom: string; // e.g. "XXXL: 2, 4XL: 5"
  customSizes?: { name: string; short: number; long: number; priceShort?: number; priceLong?: number }[];
  lenganPendek?: number; // Jumlah lengan pendek (pcs)
  lenganPanjang?: number; // Jumlah lengan panjang (pcs)
  customSizingDetails?: string; // Rincian ukuran custom (misal: Lebar Dada, Panjang, dll)
  
  // Totals & Pricing
  quantity: number;
  unitPrice: number;
  addPriceXXL?: number; // Tambahan / Harga Satuan XXL
  addPriceLongSleeve?: number; // Tambahan / Harga Satuan Lengan Panjang (S-XL)
  addPriceLongSleeveXXL?: number; // Tambahan / Harga Satuan Lengan Panjang XXL
  addPriceCustom?: number; // Tambahan / Harga Satuan Ukuran Custom (3XL, 4XL, Jumbo, dll)
  discount: number;
  shippingCost: number;
  totalPrice: number;
  dpAmount: number;
  remainingBalance: number;
  
  // Statuses
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStatus;
  
  notes: string;
  createdAt: string;
  deadline: string;
  paymentHistory: PaymentRecord[];
}

export interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isVA: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
}

export interface InvoiceSettings {
  businessName: string;
  slogan: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  qrisUrl?: string;
  bankAccounts: BankAccount[];
  additionalNotes?: string;
  adminPin?: string;
  lastInvoiceSequence?: number;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  division: 'Konveksi' | 'Sablon' | 'Asesoris' | string;
  type: 'Pemasukan' | 'Pengeluaran';
  amount: number;
  description: string;
  invoiceNumber?: string;
  paymentType?: 'DP' | 'Pelunasan' | 'Lainnya';
  createdAt?: string;
}
