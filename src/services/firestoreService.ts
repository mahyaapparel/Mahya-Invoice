import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db, financeDb } from '../lib/firebase';
import { ConvectionOrder, Customer, InvoiceSettings } from '../types';

const ORDERS_COLLECTION = 'orders';
const CUSTOMERS_COLLECTION = 'customers';
const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'main_settings';

// Real-time listener for Orders
export function subscribeOrders(callback: (orders: ConvectionOrder[]) => void) {
  const q = query(collection(db, ORDERS_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const ordersList: ConvectionOrder[] = [];
    snapshot.forEach((docSnap) => {
      ordersList.push(docSnap.data() as ConvectionOrder);
    });
    // Sort by createdAt desc
    ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(ordersList);
  }, (err) => {
    console.error("Firestore orders snapshot error:", err);
  });
}

// Save or Update Order
export async function saveOrderToFirestore(order: ConvectionOrder) {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, order.id);
    await setDoc(docRef, {
      ...order,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error("Error saving order to Firestore:", err);
    throw err;
  }
}

// Fetch Order from Firestore by ID, invoice number, or search string
export async function fetchOrderFromFirestore(searchStr: string): Promise<ConvectionOrder | null> {
  try {
    if (!searchStr) return null;
    const clean = searchStr.trim().replace(/^\/+|\/+$/g, '');
    if (!clean) return null;

    // 1. Direct doc lookup by ID
    const directDocRef = doc(db, ORDERS_COLLECTION, clean);
    const directSnap = await getDoc(directDocRef);
    if (directSnap.exists()) {
      return directSnap.data() as ConvectionOrder;
    }

    // 2. Query all orders in collection to perform fuzzy/alphanumeric match
    const ordersSnap = await getDocs(collection(db, ORDERS_COLLECTION));
    if (ordersSnap.empty) return null;

    const list: ConvectionOrder[] = [];
    ordersSnap.forEach((docSnap) => {
      list.push(docSnap.data() as ConvectionOrder);
    });

    const lower = clean.toLowerCase();
    const alphaNumOnly = lower.replace(/[^a-z0-9]/g, '');

    // Exact match
    let found = list.find((o) => (o.id || '').trim() === clean || (o.invoiceNumber || '').trim() === clean);
    if (found) return found;

    // Case-insensitive match
    found = list.find((o) => (o.id || '').trim().toLowerCase() === lower || (o.invoiceNumber || '').trim().toLowerCase() === lower);
    if (found) return found;

    // Alphanumeric match
    if (alphaNumOnly.length >= 3) {
      found = list.find((o) => {
        const oIdAlpha = (o.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const oInvAlpha = (o.invoiceNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return oIdAlpha === alphaNumOnly || oInvAlpha === alphaNumOnly;
      });
      if (found) return found;
    }

    // Substring match
    if (alphaNumOnly.length >= 3) {
      found = list.find((o) => {
        const oIdLower = (o.id || '').toLowerCase();
        const oInvLower = (o.invoiceNumber || '').toLowerCase();
        return oInvLower.includes(lower) || oIdLower.includes(lower);
      });
      if (found) return found;
    }

    return null;
  } catch (err) {
    console.error("Error fetching order from Firestore:", err);
    return null;
  }
}

// Delete Order
export async function deleteOrderFromFirestore(orderId: string) {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting order from Firestore:", err);
    throw err;
  }
}

// Real-time listener for Customers
export function subscribeCustomers(callback: (customers: Customer[]) => void) {
  const q = query(collection(db, CUSTOMERS_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const list: Customer[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as Customer);
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(list);
  }, (err) => {
    console.error("Firestore customers snapshot error:", err);
  });
}

// Save or Update Customer
export async function saveCustomerToFirestore(customer: Customer) {
  try {
    const docRef = doc(db, CUSTOMERS_COLLECTION, customer.id);
    await setDoc(docRef, customer, { merge: true });
  } catch (err) {
    console.error("Error saving customer to Firestore:", err);
    throw err;
  }
}

// Delete Customer
export async function deleteCustomerFromFirestore(customerId: string) {
  try {
    const docRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting customer from Firestore:", err);
    throw err;
  }
}

// Real-time listener for Settings
export function subscribeSettings(callback: (settings: InvoiceSettings) => void) {
  const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as InvoiceSettings);
    }
  }, (err) => {
    console.error("Firestore settings snapshot error:", err);
  });
}

// Save Settings
export async function saveSettingsToFirestore(settings: InvoiceSettings) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    await setDoc(docRef, settings, { merge: true });
  } catch (err) {
    console.error("Error saving settings to Firestore:", err);
    throw err;
  }
}

// Fetch Settings from Firestore directly
export async function fetchSettingsFromFirestore(): Promise<InvoiceSettings | null> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as InvoiceSettings;
    }
    return null;
  } catch (err) {
    console.error("Error fetching settings from Firestore:", err);
    return null;
  }
}


const TRANSACTIONS_COLLECTION = 'transactions';

export interface FinanceTransaction {
  id: string;
  date: string;
  division: string;
  type: 'Pemasukan' | 'Pengeluaran';
  amount: number;
  description: string;
  invoiceNumber?: string;
  paymentType?: 'DP' | 'Pelunasan' | 'Lainnya' | string;
  createdAt?: string;
}

export async function saveTransactionToFirestore(tx: FinanceTransaction) {
  try {
    const docData = {
      ...tx,
      createdAt: tx.createdAt || new Date().toISOString()
    };

    // 1. Save to local Kasir Firestore DB
    const docRefLocal = doc(db, TRANSACTIONS_COLLECTION, tx.id);
    await setDoc(docRefLocal, docData, { merge: true });

    // 2. Save directly to Finance Dashboard DB (finance.mahyakaryafaintech.com)
    try {
      const docRefFinance = doc(financeDb, TRANSACTIONS_COLLECTION, tx.id);
      await setDoc(docRefFinance, docData, { merge: true });
      console.log("Transaction successfully synced to Finance Dashboard DB:", tx.id);
    } catch (finErr) {
      console.warn("Direct Finance DB write notice:", finErr);
    }
  } catch (err) {
    console.error("Error saving transaction to Firestore:", err);
  }
}

export async function deleteTransactionFromFirestore(txId: string) {
  try {
    const docRefLocal = doc(db, TRANSACTIONS_COLLECTION, txId);
    await deleteDoc(docRefLocal);

    try {
      const docRefFinance = doc(financeDb, TRANSACTIONS_COLLECTION, txId);
      await deleteDoc(docRefFinance);
      console.log("Transaction successfully deleted from Finance Dashboard DB:", txId);
    } catch (finErr) {
      console.warn("Direct Finance DB delete notice:", finErr);
    }
  } catch (err) {
    console.error("Error deleting transaction from Firestore:", err);
  }
}

export async function syncOrderTransactionsToFirestore(order: ConvectionOrder) {
  try {
    if (!order) return;
    const cleanInvNum = (order.invoiceNumber || order.id || 'INV').replace(/^#/, '');
    const custName = (order.customerName || 'Pelanggan').trim();

    // Sync from paymentHistory if available
    if (order.paymentHistory && order.paymentHistory.length > 0) {
      order.paymentHistory.forEach(async (pay, idx) => {
        if ((pay.status === 'SUCCESS' || !pay.status) && pay.amount > 0) {
          const payType = (pay.type || '').toUpperCase() === 'DP' ? 'DP' : 'Pelunasan';
          const formattedDate = pay.timestamp ? pay.timestamp.split('T')[0] : new Date().toISOString().split('T')[0];
          const txSeq = idx + 1;
          const invNumWithSeq = txSeq > 1 ? `${cleanInvNum}#${txSeq}` : cleanInvNum;
          const division = order.division || 'Konveksi';
          
          await saveTransactionToFirestore({
            id: pay.id || `tx-${order.id}-${payType.toLowerCase()}-${txSeq}`,
            date: formattedDate,
            division: division,
            type: 'Pemasukan',
            amount: pay.amount,
            description: `${payType} Invoice #${invNumWithSeq} - ${custName}`,
            invoiceNumber: invNumWithSeq,
            paymentType: payType
          });
        }
      });
    } else if (order.dpAmount && order.dpAmount > 0) {
      // Fallback for DP if paymentHistory is not yet populated
      const isLunas = order.paymentStatus === 'LUNAS' || order.remainingBalance <= 0;
      const payType = isLunas ? 'Pelunasan' : 'DP';
      const formattedDate = order.createdAt ? order.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
      const division = order.division || 'Konveksi';

      await saveTransactionToFirestore({
        id: `tx-${order.id}-${payType.toLowerCase()}`,
        date: formattedDate,
        division: division,
        type: 'Pemasukan',
        amount: order.dpAmount,
        description: `${payType} Invoice #${cleanInvNum} - ${custName}`,
        invoiceNumber: cleanInvNum,
        paymentType: payType
      });
    }
  } catch (err) {
    console.error("Error syncing order transactions to Firestore:", err);
  }
}

/**
 * Update transaction data in both local Firestore and Finance Dashboard Firestore.
 * Prevents duplicates when an invoice is edited (e.g. order item added, DP changed, etc.)
 * by updating the existing transaction record in-place instead of creating a new one.
 * If multiple duplicate transactions were previously created for this invoice, cleanly cleans them up.
 */
export async function updateOrderTransactionsInFinance(
  order: ConvectionOrder,
  options?: {
    customAmount?: number;
    customDescription?: string;
  }
) {
  try {
    if (!order) return;
    const cleanInvNum = (order.invoiceNumber || order.id || 'INV').replace(/^#/, '');
    const custName = (order.customerName || 'Pelanggan').trim();
    const division = order.division || 'Konveksi';

    // Calculate latest valid payment amount
    const totalPaid = (order.paymentHistory || [])
      .filter((p) => p.status === 'SUCCESS' || !p.status)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || Number(order.dpAmount) || 0;

    const amount = options?.customAmount !== undefined ? options.customAmount : totalPaid;
    if (amount <= 0) return;

    const isLunas = order.paymentStatus === 'LUNAS' || order.remainingBalance <= 0;
    const payType = isLunas ? 'Pelunasan' : 'DP';
    const txDate = order.orderDate ? order.orderDate.split('T')[0] : (order.createdAt ? order.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    const description = options?.customDescription || `${payType} Invoice #${cleanInvNum} - ${custName}`;

    // Canonical deterministic transaction ID for this invoice
    const canonicalTxId = `tx-${cleanInvNum.replace(/[^a-zA-Z0-9]/g, '-')}-${payType.toLowerCase()}`;

    // 1. Check and clean up/update in local Firestore 'transactions'
    try {
      const qLocal = query(collection(db, TRANSACTIONS_COLLECTION), where('invoiceNumber', '==', cleanInvNum));
      const snapLocal = await getDocs(qLocal);
      
      if (!snapLocal.empty) {
        let first = true;
        for (const docSnap of snapLocal.docs) {
          if (first) {
            // Update the existing first doc
            await setDoc(docSnap.ref, {
              date: txDate,
              division,
              type: 'Pemasukan',
              amount,
              description,
              invoiceNumber: cleanInvNum,
              paymentType: payType,
              updatedAt: new Date().toISOString()
            }, { merge: true });
            first = false;
          } else {
            // Clean up duplicate old entries
            await deleteDoc(docSnap.ref).catch(() => {});
          }
        }
      } else {
        // Create with canonical ID
        await setDoc(doc(db, TRANSACTIONS_COLLECTION, canonicalTxId), {
          id: canonicalTxId,
          date: txDate,
          division,
          type: 'Pemasukan',
          amount,
          description,
          invoiceNumber: cleanInvNum,
          paymentType: payType,
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (err) {
      console.warn("Local transactions update notice:", err);
    }

    // 2. Check and clean up/update in Finance Dashboard Firestore (financeDb)
    try {
      const qFinance = query(collection(financeDb, TRANSACTIONS_COLLECTION), where('invoiceNumber', '==', cleanInvNum));
      const snapFinance = await getDocs(qFinance);

      if (!snapFinance.empty) {
        let first = true;
        for (const docSnap of snapFinance.docs) {
          if (first) {
            await setDoc(docSnap.ref, {
              date: txDate,
              division,
              type: 'Pemasukan',
              amount,
              description,
              invoiceNumber: cleanInvNum,
              paymentType: payType,
              updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log("Finance Dashboard transaction successfully updated in-place:", docSnap.id);
            first = false;
          } else {
            // Remove duplicate entry so it doesn't stay doubled
            await deleteDoc(docSnap.ref).catch(() => {});
            console.log("Cleaned up duplicate Finance Dashboard transaction:", docSnap.id);
          }
        }
      } else {
        // If not found by query, save with canonical ID
        await setDoc(doc(financeDb, TRANSACTIONS_COLLECTION, canonicalTxId), {
          id: canonicalTxId,
          date: txDate,
          division,
          type: 'Pemasukan',
          amount,
          description,
          invoiceNumber: cleanInvNum,
          paymentType: payType,
          createdAt: new Date().toISOString()
        }, { merge: true });
        console.log("Created canonical Finance Dashboard transaction:", canonicalTxId);
      }
    } catch (err) {
      console.warn("Finance DB update notice:", err);
    }
  } catch (err) {
    console.error("Error updating order transactions in Finance:", err);
  }
}

// Initial Data Seeding if empty
export async function seedInitialFirestoreData(
  defaultOrders: ConvectionOrder[],
  defaultCustomers: Customer[],
  defaultSettings: InvoiceSettings
) {
  try {
    // 1. Check orders
    const ordersSnap = await getDocs(collection(db, ORDERS_COLLECTION));
    if (ordersSnap.empty && defaultOrders.length > 0) {
      for (const ord of defaultOrders) {
        await setDoc(doc(db, ORDERS_COLLECTION, ord.id), ord);
      }
    }

    // 2. Check customers
    const custSnap = await getDocs(collection(db, CUSTOMERS_COLLECTION));
    if (custSnap.empty && defaultCustomers.length > 0) {
      for (const c of defaultCustomers) {
        await setDoc(doc(db, CUSTOMERS_COLLECTION, c.id), c);
      }
    }

    // 3. Check settings
    const settingsRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const settingsSnap = await getDocs(collection(db, SETTINGS_COLLECTION));
    if (settingsSnap.empty) {
      await setDoc(settingsRef, defaultSettings);
    }
  } catch (err) {
    console.error("Error seeding initial Firestore data:", err);
  }
}

