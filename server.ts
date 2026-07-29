import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { ConvectionOrder, PaymentRecord, PaymentStatus, ProductionStatus, InvoiceSettings, Customer } from "./src/types";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "orders_db.json");
const SETTINGS_FILE = path.join(process.cwd(), "settings_db.json");
const CUSTOMERS_FILE = path.join(process.cwd(), "customers_db.json");

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper function to read customers
function readCustomers(): Customer[] {
  try {
    if (!fs.existsSync(CUSTOMERS_FILE)) {
      // Seed with initial customer list extracted from default orders
      const initialCustomers: Customer[] = [
        {
          id: "cust-1",
          name: "Suryadi (BEM UI)",
          phone: "081234567890",
          email: "suryadi@bemui.org",
          address: "Gedung Pusgiwa UI Depok, Jawa Barat",
          notes: "Pelanggan langganan kaos event kampus",
          createdAt: new Date().toISOString()
        },
        {
          id: "cust-2",
          name: "Rina Sastrowardoyo",
          phone: "081987654321",
          email: "rina.sastro@gmail.com",
          address: "Jl. Sudirman No. 45, Jakarta Selatan",
          notes: "Pemesanan kemeja PDL komunitas",
          createdAt: new Date().toISOString()
        },
        {
          id: "cust-3",
          name: "Ahmad Hidayat",
          phone: "085712345678",
          email: "ahmad.hidayat@corporate.co.id",
          address: "Kawasan Industri MM2100, Cikarang",
          notes: "Seragam jaket kantor & kaos polo",
          createdAt: new Date().toISOString()
        }
      ];
      fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(initialCustomers, null, 2), "utf8");
      return initialCustomers;
    }
    const raw = fs.readFileSync(CUSTOMERS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading customers DB:", err);
    return [];
  }
}

function writeCustomers(customers: Customer[]) {
  try {
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing customers DB:", err);
  }
}

// Helper function to read settings
function readSettings(): InvoiceSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      const defaultSettings: InvoiceSettings = {
        businessName: "MAHYA APPAREL",
        slogan: "Solusi Konveksi Premium & Custom Terpercaya",
        address: "Jl. Raya Konveksi No. 88, Malang, Indonesia",
        phone: "+62 812-3456-7890",
        email: "mahyaapparel@gmail.com",
        logoUrl: "", // Defaults to our default asset logo
        bankAccounts: [
          {
            bankName: "Bank Mandiri",
            accountNumber: "1780010028294",
            accountHolder: "MUHAMMAD AINUL YAQIN",
            isVA: false
          }
        ],
        additionalNotes: "Invoice ini merupakan dokumen digital resmi yang sah. Segala perubahan status terdokumentasi di sistem kasir pusat.",
        adminPin: "1234"
      };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), "utf8");
      return defaultSettings;
    }
    const rawData = fs.readFileSync(SETTINGS_FILE, "utf8");
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error reading settings:", error);
    return {
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
      additionalNotes: "Invoice ini merupakan dokumen digital resmi yang sah. Segala perubahan status terdokumentasi di sistem kasir pusat."
    };
  }
}

// Helper function to write settings
function writeSettings(data: InvoiceSettings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing settings:", error);
  }
}

// Helper function to read the database
function readDB(): ConvectionOrder[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialData = getSeedData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf8");
      return initialData;
    }
    const rawData = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error reading database:", error);
    return getSeedData();
  }
}

// Helper function to write to the database
function writeDB(data: ConvectionOrder[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing database:", error);
  }
}

// Seed data representing realistic orders in Indonesia
function getSeedData(): ConvectionOrder[] {
  return [
    {
      id: "ord-1",
      invoiceNumber: "INV/202607/0001",
      customerName: "Suryadi - Universitas Indonesia",
      customerPhone: "081234567890",
      customerEmail: "suryadi@ui.ac.id",
      customerAddress: "Gedung Pusgiwa UI Depok, Jawa Barat",
      productType: "Kaos Sablon",
      fabricType: "Cotton Combed 30s",
      fabricColor: "Navy Blue",
      sablonBordir: "Sablon Plastisol",
      sizeS: 10,
      sizeM: 20,
      sizeL: 15,
      sizeXL: 5,
      sizeXXL: 0,
      sizeCustom: "",
      quantity: 50,
      unitPrice: 70000,
      discount: 100000,
      shippingCost: 50000,
      totalPrice: 3450000,
      dpAmount: 1500000,
      remainingBalance: 1950000,
      paymentStatus: "DP_DIBAYAR",
      productionStatus: "JAHIT",
      notes: "Sablon depan logo UI (ukuran A4), sablon belakang tulisan 'PANITIA' (ukuran A3)",
      createdAt: "2026-07-15T10:00:00Z",
      deadline: "2026-08-05",
      paymentHistory: [
        {
          id: "pay-1",
          amount: 1500000,
          type: "DP",
          method: "QRIS",
          reference: "QR-901824",
          timestamp: "2026-07-15T10:15:00Z",
          status: "SUCCESS"
        }
      ]
    },
    {
      id: "ord-2",
      invoiceNumber: "INV/202607/0002",
      customerName: "Mahya Apparel (Bromo Group)",
      customerPhone: "081987654321",
      customerEmail: "mahyaapparel@gmail.com",
      customerAddress: "Jl. Semeru No. 42, Klojen, Kota Malang, Jawa Timur",
      productType: "Hoodie Jumper",
      fabricType: "Fleece Cotton Premium",
      fabricColor: "Jet Black",
      sablonBordir: "Bordir Komputer",
      sizeS: 5,
      sizeM: 10,
      sizeL: 10,
      sizeXL: 5,
      sizeXXL: 0,
      sizeCustom: "3XL: 2",
      quantity: 32,
      unitPrice: 135000,
      discount: 120000,
      shippingCost: 80000,
      totalPrice: 4280000,
      dpAmount: 4280000,
      remainingBalance: 0,
      paymentStatus: "LUNAS",
      productionStatus: "FINISHING",
      notes: "Bordir dada kiri logo Mahya diameter 7cm, bordir punggung tulisan 'Bromo Crew' lebar 25cm.",
      createdAt: "2026-07-18T14:30:00Z",
      deadline: "2026-07-28",
      paymentHistory: [
        {
          id: "pay-2",
          amount: 4280000,
          type: "FULL",
          method: "BANK_TRANSFER",
          reference: "TRF-BCA-88910",
          timestamp: "2026-07-18T14:45:00Z",
          status: "SUCCESS"
        }
      ]
    },
    {
      id: "ord-3",
      invoiceNumber: "INV/202607/0003",
      customerName: "Budi Handoko - Bank Mandiri",
      customerPhone: "085647382910",
      customerEmail: "budi.handoko@mandiri.co.id",
      customerAddress: "Menara Mandiri Lt. 12, Sudirman, Jakarta Selatan",
      productType: "Kemeja PDL",
      fabricType: "American Drill",
      fabricColor: "Khaki Brown",
      sablonBordir: "Bordir Komputer",
      sizeS: 2,
      sizeM: 8,
      sizeL: 10,
      sizeXL: 5,
      sizeXXL: 1,
      sizeCustom: "",
      quantity: 26,
      unitPrice: 110000,
      discount: 0,
      shippingCost: 35000,
      totalPrice: 2895000,
      dpAmount: 0,
      remainingBalance: 2895000,
      paymentStatus: "BELUM_BAYAR",
      productionStatus: "ANTREAN",
      notes: "Model PDL dengan saku dada dua (pakai tutup dan kancing) + pangkat bahu kanan kiri. Bordir logo Mandiri di dada kiri atas saku.",
      createdAt: "2026-07-20T09:15:00Z",
      deadline: "2026-08-15",
      paymentHistory: []
    }
  ];
}

// Generate unique, continuous invoice number
function generateInvoiceNumber(orders: ConvectionOrder[]): string {
  const settings = readSettings();
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const prefix = `INV/${year}${month}/`;

  // Find highest numeric suffix among existing orders
  let maxNum = 0;
  orders.forEach((o) => {
    if (o.invoiceNumber) {
      const match = o.invoiceNumber.match(/\d+$/);
      if (match) {
        const val = parseInt(match[0], 10);
        if (!isNaN(val) && val > maxNum) {
          maxNum = val;
        }
      }
    }
  });

  const storedSeq = settings.lastInvoiceSequence || 0;
  const nextSeq = Math.max(maxNum, storedSeq) + 1;

  // Persist updated lastInvoiceSequence to settings
  settings.lastInvoiceSequence = nextSeq;
  writeSettings(settings);

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

// API Routes

// Get Settings
app.get("/api/settings", (req, res) => {
  const settings = readSettings();
  res.json(settings);
});

// Update Settings
app.put("/api/settings", (req, res) => {
  try {
    const updated = req.body;
    writeSettings(updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get stats
app.get("/api/stats", (req, res) => {
  const orders = readDB();
  
  let totalRevenue = 0;
  let pendingRevenue = 0;
  let activeOrdersCount = 0;

  const productionStats: Record<ProductionStatus, number> = {
    ANTREAN: 0,
    POTONG_BAHAN: 0,
    SABLON_BORDIR: 0,
    JAHIT: 0,
    FINISHING: 0,
    SIAP_DIAMBIL: 0,
    DIKIRIM: 0
  };

  const paymentStats = {
    BELUM_BAYAR: 0,
    DP_DIBAYAR: 0,
    LUNAS: 0
  };

  orders.forEach((o) => {
    // Total revenue = sum of all SUCCESS payments in payment history
    const successfulPaymentsSum = o.paymentHistory
      .filter((p) => p.status === "SUCCESS")
      .reduce((sum, p) => sum + p.amount, 0);
    
    totalRevenue += successfulPaymentsSum;
    pendingRevenue += o.remainingBalance;

    paymentStats[o.paymentStatus]++;
    productionStats[o.productionStatus]++;

    if (o.productionStatus !== "DIKIRIM") {
      activeOrdersCount++;
    }
  });

  res.json({
    totalRevenue,
    pendingRevenue,
    activeOrdersCount,
    totalOrdersCount: orders.length,
    productionStats,
    paymentStats
  });
});

// Helper to find order by ID, invoice number, phone, or partial match
function findOrder(orders: ConvectionOrder[], searchStr: string): ConvectionOrder | undefined {
  if (!searchStr) return undefined;
  const clean = searchStr.trim().replace(/^\/+|\/+$/g, '');
  if (!clean) return undefined;

  const lower = clean.toLowerCase();
  const alphaNumOnly = lower.replace(/[^a-z0-9]/g, '');

  // 1. Exact match by id or invoiceNumber
  let found = orders.find((o) => (o.id || '').trim() === clean || (o.invoiceNumber || '').trim() === clean);
  if (found) return found;

  // 2. Case-insensitive match by id or invoiceNumber
  found = orders.find((o) => (o.id || '').trim().toLowerCase() === lower || (o.invoiceNumber || '').trim().toLowerCase() === lower);
  if (found) return found;

  // 3. Match by normalized alphanumeric string (e.g. inv2026070004 or ordrdydbhboa)
  if (alphaNumOnly.length >= 3) {
    found = orders.find((o) => {
      const oIdAlpha = (o.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const oInvAlpha = (o.invoiceNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return oIdAlpha === alphaNumOnly || oInvAlpha === alphaNumOnly;
    });
    if (found) return found;
  }

  // 4. Partial substring match in invoice number or order ID
  if (alphaNumOnly.length >= 3) {
    found = orders.find((o) => {
      const oIdLower = (o.id || '').toLowerCase();
      const oInvLower = (o.invoiceNumber || '').toLowerCase();
      return oInvLower.includes(lower) || oIdLower.includes(lower);
    });
    if (found) return found;
  }

  // 5. Customer phone number or name match
  if (lower.length >= 2) {
    found = orders.find((o) => {
      const oPhoneClean = (o.customerPhone || '').replace(/\D/g, '');
      const oNameLower = (o.customerName || '').toLowerCase();
      return (alphaNumOnly.length >= 3 && oPhoneClean.includes(alphaNumOnly)) || oNameLower.includes(lower);
    });
    if (found) return found;
  }

  return undefined;
}

// Get all orders
app.get("/api/orders", (req, res) => {
  const orders = readDB();
  // Sort by createdAt descending
  const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(sorted);
});

// Search order by ID or Invoice Number via query param
app.get("/api/orders/lookup", (req, res) => {
  const orders = readDB();
  const query = (req.query.q || req.query.invoice || req.query.id || "").toString().trim();
  if (!query) {
    return res.status(400).json({ error: "Parameter pencarian tidak boleh kosong" });
  }

  const found = findOrder(orders, query);
  if (!found) {
    return res.status(404).json({ error: `Invoice "${query}" tidak ditemukan` });
  }
  return res.json(found);
});

// Get order by ID or Invoice Number via route param
app.get("/api/orders/*", (req, res) => {
  const orders = readDB();
  const rawPath = req.url.replace(/^\/api\/orders\/?/i, '');
  const rawId = rawPath.split('?')[0];
  const searchId = decodeURIComponent(rawId).trim();
  const order = findOrder(orders, searchId);
  if (!order) {
    return res.status(404).json({ error: "Order tidak ditemukan" });
  }
  res.json(order);
});

// Resequence all invoice numbers chronologically
app.post("/api/orders/resequence", (req, res) => {
  try {
    const orders = readDB();
    if (orders.length === 0) {
      return res.json({ message: "Tidak ada order untuk di-urutkan.", orders: [], lastInvoiceSequence: 0 });
    }

    orders.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (a.id || '').localeCompare(b.id || '');
    });

    orders.forEach((o, index) => {
      const seq = index + 1;
      const date = o.createdAt ? new Date(o.createdAt) : new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      o.invoiceNumber = `INV/${year}${month}/${String(seq).padStart(4, "0")}`;
    });

    const settings = readSettings();
    settings.lastInvoiceSequence = orders.length;
    writeSettings(settings);
    writeDB(orders);

    res.json({
      message: "Berhasil mengurutkan ulang semua nomor invoice.",
      orders,
      lastInvoiceSequence: orders.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal mengurutkan nomor invoice." });
  }
});

// Create new order
app.post("/api/orders", (req, res) => {
  try {
    const orders = readDB();
    const newOrderData = req.body;

    const id = "ord-" + Math.random().toString(36).substr(2, 9);
    let invoiceNumber = newOrderData.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = generateInvoiceNumber(orders);
    } else {
      const match = invoiceNumber.match(/\d+$/);
      if (match) {
        const val = parseInt(match[0], 10);
        if (!isNaN(val)) {
          const settings = readSettings();
          const currentSeq = settings.lastInvoiceSequence || 0;
          if (val > currentSeq) {
            settings.lastInvoiceSequence = val;
            writeSettings(settings);
          }
        }
      }
    }
    
    // Server-side calculation to ensure precision
    const sizeS = Number(newOrderData.sizeS) || 0;
    const sizeM = Number(newOrderData.sizeM) || 0;
    const sizeL = Number(newOrderData.sizeL) || 0;
    const sizeXL = Number(newOrderData.sizeXL) || 0;
    const sizeXXL = Number(newOrderData.sizeXXL) || 0;
    const quantity = sizeS + sizeM + sizeL + sizeXL + sizeXXL + (Number(newOrderData.quantityCustomAdd) || 0);
    
    const unitPrice = Number(newOrderData.unitPrice) || 0;
    const discount = Number(newOrderData.discount) || 0;
    const shippingCost = Number(newOrderData.shippingCost) || 0;
    const totalPrice = (quantity * unitPrice) - discount + shippingCost;
    
    const dpAmount = Number(newOrderData.dpAmount) || 0;
    const remainingBalance = totalPrice - dpAmount;

    let paymentStatus: PaymentStatus = "BELUM_BAYAR";
    const paymentHistory: PaymentRecord[] = [];

    if (dpAmount > 0) {
      if (dpAmount >= totalPrice) {
        paymentStatus = "LUNAS";
      } else {
        paymentStatus = "DP_DIBAYAR";
      }

      paymentHistory.push({
        id: "pay-" + Math.random().toString(36).substr(2, 9),
        amount: dpAmount,
        type: dpAmount >= totalPrice ? "FULL" : "DP",
        method: newOrderData.paymentMethod || "CASH",
        reference: newOrderData.paymentReference || "Direct Cashier Cash/Transfer",
        timestamp: new Date().toISOString(),
        status: "SUCCESS"
      });
    }

    const newOrder: ConvectionOrder = {
      id,
      invoiceNumber,
      customerName: newOrderData.customerName || "Tanpa Nama",
      customerPhone: newOrderData.customerPhone || "",
      customerEmail: newOrderData.customerEmail || "",
      customerAddress: newOrderData.customerAddress || "",
      productType: newOrderData.productType || "Kaos",
      fabricType: newOrderData.fabricType || "",
      fabricColor: newOrderData.fabricColor || "",
      sablonBordir: newOrderData.sablonBordir || "",
      sizeS,
      sizeM,
      sizeL,
      sizeXL,
      sizeXXL,
      sizeCustom: newOrderData.sizeCustom || "",
      lenganPendek: Number(newOrderData.lenganPendek) || 0,
      lenganPanjang: Number(newOrderData.lenganPanjang) || 0,
      customSizingDetails: newOrderData.customSizingDetails || "",
      quantity,
      unitPrice,
      discount,
      shippingCost,
      totalPrice,
      dpAmount: paymentStatus === "LUNAS" ? totalPrice : dpAmount,
      remainingBalance: paymentStatus === "LUNAS" ? 0 : remainingBalance,
      paymentStatus,
      productionStatus: "ANTREAN",
      notes: newOrderData.notes || "",
      createdAt: new Date().toISOString(),
      deadline: newOrderData.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      paymentHistory
    };

    orders.push(newOrder);
    writeDB(orders);
    res.status(201).json(newOrder);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update order status or details
app.put("/api/orders/:id", (req, res) => {
  const orders = readDB();
  const searchId = decodeURIComponent(req.params.id || "").trim();
  const lower = searchId.toLowerCase();
  const idx = orders.findIndex((o) => 
    o.id === searchId || 
    o.invoiceNumber === searchId || 
    o.id.toLowerCase() === lower || 
    o.invoiceNumber.toLowerCase() === lower
  );
  if (idx === -1) {
    return res.status(404).json({ error: "Order tidak ditemukan" });
  }

  const existingOrder = orders[idx];
  const updateData = req.body;

  // Perform partial updates
  const updatedOrder = {
    ...existingOrder,
    ...updateData,
    // recalculate if prices changed
    unitPrice: updateData.unitPrice !== undefined ? Number(updateData.unitPrice) : existingOrder.unitPrice,
    discount: updateData.discount !== undefined ? Number(updateData.discount) : existingOrder.discount,
    shippingCost: updateData.shippingCost !== undefined ? Number(updateData.shippingCost) : existingOrder.shippingCost,
  };

  // Recalculate size and quantity if size changes
  if (
    updateData.sizeS !== undefined || 
    updateData.sizeM !== undefined || 
    updateData.sizeL !== undefined || 
    updateData.sizeXL !== undefined || 
    updateData.sizeXXL !== undefined
  ) {
    const sS = updateData.sizeS !== undefined ? Number(updateData.sizeS) : existingOrder.sizeS;
    const sM = updateData.sizeM !== undefined ? Number(updateData.sizeM) : existingOrder.sizeM;
    const sL = updateData.sizeL !== undefined ? Number(updateData.sizeL) : existingOrder.sizeL;
    const sXL = updateData.sizeXL !== undefined ? Number(updateData.sizeXL) : existingOrder.sizeXL;
    const sXXL = updateData.sizeXXL !== undefined ? Number(updateData.sizeXXL) : existingOrder.sizeXXL;
    const customAdd = updateData.quantityCustomAdd !== undefined ? Number(updateData.quantityCustomAdd) : 0;
    
    updatedOrder.quantity = sS + sM + sL + sXL + sXXL + customAdd;
  }

  // Recalculate total
  updatedOrder.totalPrice = (updatedOrder.quantity * updatedOrder.unitPrice) - updatedOrder.discount + updatedOrder.shippingCost;
  
  // Recalculate remaining balance from payment history
  const totalPaid = updatedOrder.paymentHistory
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + p.amount, 0);

  updatedOrder.remainingBalance = Math.max(0, updatedOrder.totalPrice - totalPaid);
  
  if (totalPaid >= updatedOrder.totalPrice) {
    updatedOrder.paymentStatus = "LUNAS";
  } else if (totalPaid > 0) {
    updatedOrder.paymentStatus = "DP_DIBAYAR";
    updatedOrder.dpAmount = totalPaid; // Sync total paid to DP
  } else {
    updatedOrder.paymentStatus = "BELUM_BAYAR";
    updatedOrder.dpAmount = 0;
  }

  orders[idx] = updatedOrder;
  writeDB(orders);
  res.json(updatedOrder);
});

// Record customer payment (via the simulated payment link or cashier manual)
app.post("/api/orders/:id/payments", (req, res) => {
  const orders = readDB();
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: "Order tidak ditemukan" });
  }

  const order = orders[idx];
  const { amount, type, method, reference } = req.body;

  const paymentAmt = Number(amount);
  if (isNaN(paymentAmt) || paymentAmt <= 0) {
    return res.status(400).json({ error: "Jumlah pembayaran tidak valid" });
  }

  const newPayment: PaymentRecord = {
    id: "pay-" + Math.random().toString(36).substr(2, 9),
    amount: paymentAmt,
    type: type || "FULL", // DP, PELUNASAN, FULL
    method: method || "QRIS",
    reference: reference || `Simulated ${method}`,
    timestamp: new Date().toISOString(),
    status: "SUCCESS"
  };

  order.paymentHistory.push(newPayment);

  // Recalculate total successful payments
  const totalPaid = order.paymentHistory
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + p.amount, 0);

  order.remainingBalance = Math.max(0, order.totalPrice - totalPaid);

  if (totalPaid >= order.totalPrice) {
    order.paymentStatus = "LUNAS";
  } else if (totalPaid > 0) {
    order.paymentStatus = "DP_DIBAYAR";
    order.dpAmount = totalPaid; // Sync DP to sum of paid money
  } else {
    order.paymentStatus = "BELUM_BAYAR";
  }

  orders[idx] = order;
  writeDB(orders);
  res.json(order);
});

// Delete order
app.delete("/api/orders/:id", (req, res) => {
  const orders = readDB();
  const filtered = orders.filter((o) => o.id !== req.params.id);
  if (filtered.length === orders.length) {
    return res.status(404).json({ error: "Order tidak ditemukan" });
  }
  writeDB(filtered);
  res.json({ success: true, message: "Order berhasil dihapus" });
});

// CUSTOMER MANAGEMENT API ENDPOINTS
// Get all customers
app.get("/api/customers", (req, res) => {
  const customers = readCustomers();
  res.json(customers);
});

// Create new customer
app.post("/api/customers", (req, res) => {
  try {
    const customers = readCustomers();
    const { name, phone, email, address, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Nama pelanggan wajib diisi" });
    }

    const newCust: Customer = {
      id: "cust-" + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      phone: (phone || "").trim(),
      email: (email || "").trim(),
      address: (address || "").trim(),
      notes: (notes || "").trim(),
      createdAt: new Date().toISOString()
    };

    customers.unshift(newCust);
    writeCustomers(customers);
    res.status(201).json(newCust);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal menambah pelanggan" });
  }
});

// Update customer
app.put("/api/customers/:id", (req, res) => {
  try {
    const customers = readCustomers();
    const idx = customers.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: "Pelanggan tidak ditemukan" });
    }

    const { name, phone, email, address, notes } = req.body;
    const updatedCust: Customer = {
      ...customers[idx],
      name: name !== undefined ? name.trim() : customers[idx].name,
      phone: phone !== undefined ? phone.trim() : customers[idx].phone,
      email: email !== undefined ? email.trim() : customers[idx].email,
      address: address !== undefined ? address.trim() : customers[idx].address,
      notes: notes !== undefined ? notes.trim() : customers[idx].notes,
    };

    customers[idx] = updatedCust;
    writeCustomers(customers);
    res.json(updatedCust);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal memperbarui data pelanggan" });
  }
});

// Delete customer
app.delete("/api/customers/:id", (req, res) => {
  try {
    const customers = readCustomers();
    const filtered = customers.filter((c) => c.id !== req.params.id);
    if (filtered.length === customers.length) {
      return res.status(404).json({ error: "Pelanggan tidak ditemukan" });
    }
    writeCustomers(filtered);
    res.json({ success: true, message: "Data pelanggan berhasil dihapus" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal menghapus data pelanggan" });
  }
});

// 404 handler for API routes to prevent HTML responses
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API endpoint tidak ditemukan" });
});

// Start server and mount Vite
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
