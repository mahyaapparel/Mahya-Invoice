import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, Calendar, DollarSign, Clock, CheckCircle2,
  TrendingUp, User, Phone, ExternalLink, Copy, Trash2, Edit3, 
  AlertTriangle, Activity, FileText, Check, MapPin, CreditCard, Scissors, Sparkles, SlidersHorizontal, X, Settings, Upload,
  Users, UserPlus, PhoneCall, MessageSquare, Building, UserCheck, PlusCircle,
  Cloud, LogIn, LogOut, ShieldCheck, Lock, Unlock, KeyRound, Eye, EyeOff, ShieldAlert, Key, ListOrdered
} from 'lucide-react';
import { ConvectionOrder, PaymentStatus, ProductionStatus, InvoiceSettings, BankAccount, Customer, PaymentRecord, FinanceTransaction } from '../types';
import { formatRupiah, formatIndonesianDate, getPaymentStatusDetails, getProductionStatusDetails } from '../utils/format';
import { sendInvoicePaymentWebhook } from '../utils/webhook';
import InvoiceDetailModal from './InvoiceDetailModal';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import {
  subscribeOrders,
  subscribeCustomers,
  subscribeSettings,
  saveOrderToFirestore,
  deleteOrderFromFirestore,
  saveCustomerToFirestore,
  deleteCustomerFromFirestore,
  saveSettingsToFirestore,
  saveTransactionToFirestore,
  seedInitialFirestoreData
} from '../services/firestoreService';

export default function CashierDashboard() {
  const { currentUser, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [cloudSynced, setCloudSynced] = useState<boolean>(false);

  const [orders, setOrders] = useState<ConvectionOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);


  // Customer Management states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomersModal, setShowCustomersModal] = useState<boolean>(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState<boolean>(false);
  const [saveCustomerToDb, setSaveCustomerToDb] = useState<boolean>(true);
  const [custFormData, setCustFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterProduction, setFilterProduction] = useState<string>('ALL');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');

  // Invoice Settings states
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // PIN Protection states
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('cashier_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinMask, setShowPinMask] = useState<boolean>(true);
  const [showPinInSettings, setShowPinInSettings] = useState<boolean>(false);

  const handleLockSystem = () => {
    try {
      sessionStorage.removeItem('cashier_unlocked');
    } catch (e) {
      console.error(e);
    }
    setIsUnlocked(false);
    setEnteredPin('');
    setPinError(null);
  };

  const handleUnlockSystem = (overridePin?: string) => {
    const pin = overridePin !== undefined ? overridePin : enteredPin;
    const targetPin = (invoiceSettings?.adminPin && invoiceSettings.adminPin.trim() !== '') 
      ? invoiceSettings.adminPin.trim() 
      : '1234';

    if (pin.trim() === targetPin) {
      try {
        sessionStorage.setItem('cashier_unlocked', 'true');
      } catch (e) {
        console.error(e);
      }
      setIsUnlocked(true);
      setPinError(null);
      setEnteredPin('');
    } else {
      setPinError('PIN yang Anda masukkan salah! Silakan coba lagi.');
      setEnteredPin('');
    }
  };

  const handleNumpadPress = (val: string) => {
    setPinError(null);
    if (val === 'CLEAR') {
      setEnteredPin('');
    } else if (val === 'BACK') {
      setEnteredPin(prev => prev.slice(0, -1));
    } else {
      if (enteredPin.length < 6) {
        const next = enteredPin + val;
        setEnteredPin(next);
        const targetPin = (invoiceSettings?.adminPin && invoiceSettings.adminPin.trim() !== '') 
          ? invoiceSettings.adminPin.trim() 
          : '1234';
        if (next === targetPin) {
          handleUnlockSystem(next);
        }
      }
    }
  };

  // Modal control states
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ConvectionOrder | null>(null);
  const [quickPayOrder, setQuickPayOrder] = useState<ConvectionOrder | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [shareOrder, setShareOrder] = useState<ConvectionOrder | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState<boolean>(false);

  // Quick Pay state
  const [quickPayAmount, setQuickPayAmount] = useState<number>(0);
  const [quickPayMethod, setQuickPayMethod] = useState<'BANK_TRANSFER' | 'QRIS' | 'E_WALLET' | 'CASH'>('CASH');
  const [quickPayRef, setQuickPayRef] = useState<string>('Kasir Tunai');

  // Catat Transaksi state & handlers
  const [showTransactionModal, setShowTransactionModal] = useState<boolean>(false);
  const [txDivision, setTxDivision] = useState<'Konveksi' | 'Sablon' | 'Asesoris'>('Konveksi');
  const [txType, setTxType] = useState<'Pemasukan' | 'Pengeluaran'>('Pemasukan');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txDescription, setTxDescription] = useState<string>('');
  const [txInvoiceNumber, setTxInvoiceNumber] = useState<string>('');
  const [txPaymentType, setTxPaymentType] = useState<'DP' | 'Pelunasan' | 'Lainnya'>('DP');
  const [txDate, setTxDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isSubmittingTx, setIsSubmittingTx] = useState<boolean>(false);
  const [txSuccessMessage, setTxSuccessMessage] = useState<string | null>(null);

  const handleOpenTransactionModal = (order?: ConvectionOrder, defaultDivision?: 'Konveksi' | 'Sablon' | 'Asesoris') => {
    setTxSuccessMessage(null);
    setTxDate(new Date().toISOString().split('T')[0]);
    if (order) {
      setTxInvoiceNumber(order.invoiceNumber);
      const isSablon = order.sablonBordir?.toLowerCase().includes('sablon');
      setTxDivision(defaultDivision || (isSablon ? 'Sablon' : 'Konveksi'));
      const remaining = order.remainingBalance;
      setTxAmount(remaining > 0 ? remaining : 0);
      setTxType('Pemasukan');
      setTxPaymentType(order.remainingBalance > 0 && order.dpAmount > 0 ? 'Pelunasan' : 'DP');
      setTxDescription(`Pemasukan ${order.customerName} - ${order.productType}`);
    } else {
      setTxInvoiceNumber('');
      setTxDivision(defaultDivision || 'Konveksi');
      setTxAmount(0);
      setTxType('Pemasukan');
      setTxPaymentType('DP');
      setTxDescription('');
    }
    setShowTransactionModal(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || txAmount <= 0) {
      alert('Masukkan nominal transaksi yang valid!');
      return;
    }
    if (!txDescription.trim()) {
      alert('Masukkan keterangan transaksi!');
      return;
    }

    setIsSubmittingTx(true);
    setTxSuccessMessage(null);

    const newTx: FinanceTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: txDate || new Date().toISOString().split('T')[0],
      division: txDivision,
      type: txType,
      amount: Number(txAmount),
      description: txDescription.trim(),
      invoiceNumber: txInvoiceNumber ? txInvoiceNumber.trim() : undefined,
      paymentType: txPaymentType === 'Lainnya' ? undefined : txPaymentType,
      createdAt: new Date().toISOString()
    };

    try {
      await saveTransactionToFirestore(newTx);

      await sendInvoicePaymentWebhook({
        date: newTx.date,
        division: newTx.division,
        type: newTx.type,
        amount: newTx.amount,
        description: newTx.description,
        invoiceNumber: newTx.invoiceNumber || '-',
        paymentType: newTx.paymentType || 'DP'
      });

      setTxSuccessMessage(`Berhasil mencatat transaksi ${newTx.type} Rp ${formatRupiah(newTx.amount)} ke Divisi ${newTx.division}! Disinkronkan ke Finance Dashboard.`);
      setTimeout(() => {
        setShowTransactionModal(false);
        setTxSuccessMessage(null);
      }, 1800);
    } catch (err) {
      console.error("Gagal mencatat transaksi:", err);
      alert("Terjadi kesalahan saat menyimpan transaksi.");
    } finally {
      setIsSubmittingTx(false);
    }
  };

  // Edit Order state
  const [editingOrder, setEditingOrder] = useState<ConvectionOrder | null>(null);

  // New Order Form state
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    productType: 'Kaos Sablon',
    fabricType: 'Cotton Combed 30s',
    fabricColor: 'Hitam',
    sablonBordir: 'Sablon Plastisol',
    sizeS: 0,
    sizeM: 0,
    sizeL: 0,
    sizeXL: 0,
    sizeXXL: 0,
    sizeS_short: 0,
    sizeS_long: 0,
    sizeM_short: 0,
    sizeM_long: 0,
    sizeL_short: 0,
    sizeL_long: 0,
    sizeXL_short: 0,
    sizeXL_long: 0,
    sizeXXL_short: 0,
    sizeXXL_long: 0,
    sizeCustom: '',
    customSizes: [] as { name: string; short: number; long: number }[],
    lenganPendek: 0,
    lenganPanjang: 0,
    customSizingDetails: '',
    quantityCustomAdd: 0,
    unitPrice: 75000,
    addPriceXXL: 0,
    addPriceLongSleeve: 0,
    addPriceLongSleeveXXL: 0,
    addPriceCustom: 0,
    discount: 0,
    shippingCost: 0,
    dpAmount: 0,
    paymentMethod: 'CASH',
    paymentReference: 'Kasir Tunai',
    notes: '',
    deadline: ''
  });

  // Invoice Settings state drafts & saving helpers
  const [settingsDraft, setSettingsDraft] = useState<InvoiceSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [newBankName, setNewBankName] = useState<string>('');
  const [newBankNumber, setNewBankNumber] = useState<string>('');
  const [newBankHolder, setNewBankHolder] = useState<string>('');
  const [newBankIsVA, setNewBankIsVA] = useState<boolean>(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState<boolean>(false);
  const [isDraggingQris, setIsDraggingQris] = useState<boolean>(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file terlalu besar! Maksimal 2MB agar penyimpanan optimal.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && settingsDraft) {
        setSettingsDraft({
          ...settingsDraft,
          logoUrl: event.target.result as string
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(true);
  };

  const handleLogoDragLeave = () => {
    setIsDraggingLogo(false);
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file terlalu besar! Maksimal 2MB agar penyimpanan optimal.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && settingsDraft) {
        setSettingsDraft({
          ...settingsDraft,
          logoUrl: event.target.result as string
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQrisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file QRIS terlalu besar! Maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && settingsDraft) {
        setSettingsDraft({
          ...settingsDraft,
          qrisUrl: event.target.result as string
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQrisDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingQris(true);
  };

  const handleQrisDragLeave = () => {
    setIsDraggingQris(false);
  };

  const handleQrisDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingQris(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file QRIS terlalu besar! Maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && settingsDraft) {
        setSettingsDraft({
          ...settingsDraft,
          qrisUrl: event.target.result as string
        });
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (showSettings && invoiceSettings) {
      setSettingsDraft(JSON.parse(JSON.stringify(invoiceSettings)));
    }
  }, [showSettings, invoiceSettings]);

  const handleDeleteBankAccount = (index: number) => {
    if (!settingsDraft) return;
    const updatedAccounts = settingsDraft.bankAccounts.filter((_, i) => i !== index);
    setSettingsDraft({
      ...settingsDraft,
      bankAccounts: updatedAccounts
    });
  };

  const handleAddBankAccount = () => {
    if (!settingsDraft) return;
    if (!newBankName || !newBankNumber || !newBankHolder) {
      alert('Harap isi nama bank, nomor rekening, dan nama pemilik!');
      return;
    }
    const newAccount: BankAccount = {
      bankName: newBankName,
      accountNumber: newBankNumber,
      accountHolder: newBankHolder,
      isVA: newBankIsVA
    };
    setSettingsDraft({
      ...settingsDraft,
      bankAccounts: [...settingsDraft.bankAccounts, newAccount]
    });
    // Reset form
    setNewBankName('');
    setNewBankNumber('');
    setNewBankHolder('');
    setNewBankIsVA(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;

    try {
      setSettingsLoading(true);
      await saveSettingsToFirestore(settingsDraft);
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsDraft)
      }).catch(() => {});

      setInvoiceSettings(settingsDraft);
      setShowSettings(false);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSettingsLoading(false);
    }
  };


  // Calculate size totals and live quantities on Add Form
  const sizeS_total = Number(formData.sizeS_short || 0) + Number(formData.sizeS_long || 0);
  const sizeM_total = Number(formData.sizeM_short || 0) + Number(formData.sizeM_long || 0);
  const sizeL_total = Number(formData.sizeL_short || 0) + Number(formData.sizeL_long || 0);
  const sizeXL_total = Number(formData.sizeXL_short || 0) + Number(formData.sizeXL_long || 0);
  const sizeXXL_total = Number(formData.sizeXXL_short || 0) + Number(formData.sizeXXL_long || 0);

  const customSizesList = formData.customSizes || [];
  const customShortTotal = customSizesList.reduce((sum, item) => sum + (Number(item.short) || 0), 0);
  const customLongTotal = customSizesList.reduce((sum, item) => sum + (Number(item.long) || 0), 0);
  const customQtyTotal = customShortTotal + customLongTotal;

  const calcTotalPendek = Number(formData.sizeS_short || 0) + Number(formData.sizeM_short || 0) + Number(formData.sizeL_short || 0) + Number(formData.sizeXL_short || 0) + Number(formData.sizeXXL_short || 0) + customShortTotal;
  const calcTotalPanjang = Number(formData.sizeS_long || 0) + Number(formData.sizeM_long || 0) + Number(formData.sizeL_long || 0) + Number(formData.sizeXL_long || 0) + Number(formData.sizeXXL_long || 0) + customLongTotal;

  // Pricing & Surcharge breakdown calculations
  const basePrice = Number(formData.unitPrice || 0);
  const addXXL = Number(formData.addPriceXXL || 0);
  const addLong = Number(formData.addPriceLongSleeve || 0);
  const addLongXXL = Number(formData.addPriceLongSleeveXXL || 0);
  const addCustom = Number(formData.addPriceCustom || 0);

  const shortStandardQty = Number(formData.sizeS_short || 0) + Number(formData.sizeM_short || 0) + Number(formData.sizeL_short || 0) + Number(formData.sizeXL_short || 0) + Number(formData.quantityCustomAdd || 0);
  const shortXXLQty = Number(formData.sizeXXL_short || 0);
  const longStandardQty = Number(formData.sizeS_long || 0) + Number(formData.sizeM_long || 0) + Number(formData.sizeL_long || 0) + Number(formData.sizeXL_long || 0);
  const longXXLQty = Number(formData.sizeXXL_long || 0);

  const getEffectivePrice = (addVal: number, defaultBase: number = basePrice) => {
    if (addVal === undefined || addVal === null || addVal === 0) return defaultBase;
    if (addVal < 0) return Math.max(0, defaultBase + addVal);
    if (defaultBase > 0 && addVal < (defaultBase / 2)) {
      return defaultBase + addVal;
    }
    return addVal;
  };

  const effShortXXL = getEffectivePrice(addXXL);
  const effLongStandard = getEffectivePrice(addLong);
  const effLongXXL = getEffectivePrice(addLongXXL);
  const effCustom = getEffectivePrice(addCustom);

  // Custom sizes total calculation
  let customSizesTotalPrice = 0;
  customSizesList.forEach((item) => {
    const itemShort = Number(item.short) || 0;
    const itemLong = Number(item.long) || 0;
    const itemShortPrice = (item.priceShort !== undefined && item.priceShort !== 0) 
      ? getEffectivePrice(item.priceShort, basePrice) 
      : effCustom;
    const longSleeveDiff = effLongStandard > basePrice ? (effLongStandard - basePrice) : 0;
    const itemLongPrice = (item.priceLong !== undefined && item.priceLong !== 0) 
      ? getEffectivePrice(item.priceLong, basePrice + longSleeveDiff) 
      : (itemShortPrice + longSleeveDiff);

    customSizesTotalPrice += (itemShort * itemShortPrice) + (itemLong * itemLongPrice);
  });

  const liveQty = sizeS_total + sizeM_total + sizeL_total + sizeXL_total + sizeXXL_total + customQtyTotal + Number(formData.quantityCustomAdd);
  const liveSubtotal = 
    (shortStandardQty * basePrice) + 
    (shortXXLQty * effShortXXL) + 
    (longStandardQty * effLongStandard) + 
    (longXXLQty * effLongXXL) +
    customSizesTotalPrice;
  const liveTotal = liveSubtotal - Number(formData.discount) + Number(formData.shippingCost);

  // Fetch fallback & connect Firestore real-time listeners
  useEffect(() => {
    let unsubOrders: (() => void) | undefined;
    let unsubCustomers: (() => void) | undefined;
    let unsubSettings: (() => void) | undefined;

    const initCloudData = async () => {
      try {
        setLoading(true);
        const [ordersRes, settingsRes, custRes] = await Promise.all([
          fetch('/api/orders'),
          fetch('/api/settings'),
          fetch('/api/customers')
        ]);

        let initialOrders: ConvectionOrder[] = [];
        let initialSettings: InvoiceSettings | null = null;
        let initialCust: Customer[] = [];

        if (ordersRes.ok) initialOrders = await ordersRes.json();
        if (settingsRes.ok) initialSettings = await settingsRes.json();
        if (custRes.ok) initialCust = await custRes.json();

        if (initialOrders.length > 0) setOrders(initialOrders);
        if (initialSettings) setInvoiceSettings(initialSettings);
        if (initialCust.length > 0) setCustomers(initialCust);

        // Seed Firestore if empty
        if (initialSettings) {
          seedInitialFirestoreData(initialOrders, initialCust, initialSettings).catch(() => {});
        }
      } catch (err) {
        console.error("Error loading initial API fallback:", err);
      } finally {
        setLoading(false);
      }

      // Realtime listeners
      unsubOrders = subscribeOrders((fireOrders) => {
        if (fireOrders && fireOrders.length >= 0) {
          setOrders(fireOrders);
          setCloudSynced(true);
          setLoading(false);
        }
      });

      unsubCustomers = subscribeCustomers((fireCustomers) => {
        if (fireCustomers) {
          setCustomers(fireCustomers);
        }
      });

      unsubSettings = subscribeSettings((fireSettings) => {
        if (fireSettings) {
          setInvoiceSettings(fireSettings);
        }
      });
    };

    initCloudData();

    return () => {
      if (unsubOrders) unsubOrders();
      if (unsubCustomers) unsubCustomers();
      if (unsubSettings) unsubSettings();
    };
  }, []);

  // Recalculate stats dynamically when orders change
  useEffect(() => {
    if (orders) {
      const totalRevenue = orders.reduce((sum, o) => {
        const total = Number(o.totalPrice) || 0;
        const rem = Number(o.remainingBalance) || 0;
        return sum + Math.max(0, total - rem);
      }, 0);

      const totalReceivable = orders.reduce((sum, o) => {
        return sum + (Number(o.remainingBalance) || 0);
      }, 0);

      const totalOrders = orders.length;
      const activeProductionCount = orders.filter(o => o.productionStatus !== 'SELESAI' && o.productionStatus !== 'SIAP_DIAMBIL').length;
      const completedCount = orders.filter(o => o.productionStatus === 'SELESAI' || o.productionStatus === 'SIAP_DIAMBIL').length;

      setStats({
        totalRevenue,
        totalReceivable,
        pendingRevenue: totalReceivable,
        totalOrders,
        totalOrdersCount: totalOrders,
        activeProductionCount,
        activeOrdersCount: activeProductionCount,
        completedCount
      });
    }
  }, [orders]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Error fetching fallback orders:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setInvoiceSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch invoice settings:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };


  const handleSaveCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custFormData.name.trim()) {
      alert('Nama pelanggan wajib diisi.');
      return;
    }

    try {
      const isEdit = !!editingCustomer;
      const customerToSave: Customer = {
        id: isEdit ? editingCustomer.id : `cust-${Date.now()}`,
        name: custFormData.name.trim(),
        phone: custFormData.phone.trim(),
        email: custFormData.email.trim(),
        address: custFormData.address.trim(),
        notes: custFormData.notes.trim(),
        createdAt: isEdit ? editingCustomer.createdAt : new Date().toISOString()
      };

      await saveCustomerToFirestore(customerToSave);

      const url = isEdit ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = isEdit ? 'PUT' : 'POST';
      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(custFormData)
      }).catch(() => {});

      setShowAddCustomerModal(false);
      setEditingCustomer(null);
      setCustFormData({ name: '', phone: '', email: '', address: '', notes: '' });
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data pelanggan.');
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pelanggan ini dari database?')) return;
    try {
      await deleteCustomerFromFirestore(id);
      fetch(`/api/customers/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data pelanggan');
    }
  };


  const selectCustomerForOrder = (cust: Partial<Customer>) => {
    setFormData((prev) => ({
      ...prev,
      customerName: cust.name || prev.customerName,
      customerPhone: cust.phone || prev.customerPhone,
      customerEmail: cust.email || prev.customerEmail,
      customerAddress: cust.address || prev.customerAddress
    }));
    setShowCustomerPicker(false);
    if (!showAddForm) {
      setShowCustomersModal(false);
      setEditingOrder(null);
      setShowAddForm(true);
    }
  };

  // Function to resequence all existing invoice numbers chronologically
  const handleResequenceAllOrders = async (silent = false) => {
    if (!orders || orders.length === 0) {
      if (!silent) alert('Belum ada data transaksi untuk diurutkan.');
      return;
    }

    if (!silent) {
      const confirmMsg = `Apakah Anda yakin ingin merapikan & mengurutkan ulang semua ${orders.length} nomor invoice transaksi secara berurutan?\n\nSemua transaksi akan diberi nomor invoice berurutan (0001, 0002, 0003...) berdasarkan tanggal pembuatan tertua.`;
      if (!confirm(confirmMsg)) return;
    }

    try {
      // Sort chronologically (oldest first)
      const sorted = [...orders].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || '').localeCompare(b.id || '');
      });

      const resequencedOrders: ConvectionOrder[] = [];

      for (let i = 0; i < sorted.length; i++) {
        const order = sorted[i];
        const seq = i + 1;
        const rawDate = order.createdAt ? new Date(order.createdAt) : new Date();
        const dateObj = isNaN(rawDate.getTime()) ? new Date() : rawDate;
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const newInvNum = `INV/${year}${month}/${String(seq).padStart(4, '0')}`;

        const updatedOrder: ConvectionOrder = {
          ...order,
          invoiceNumber: newInvNum
        };

        resequencedOrders.push(updatedOrder);

        // Save to Firestore if changed
        if (order.invoiceNumber !== newInvNum) {
          await saveOrderToFirestore(updatedOrder).catch(console.error);
          fetch(`/api/orders/${order.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceNumber: newInvNum })
          }).catch(console.error);
        }
      }

      // Update settings
      const nextLastSeq = sorted.length;
      try {
        localStorage.setItem('last_invoice_sequence', String(nextLastSeq));
      } catch {}

      if (invoiceSettings) {
        const updatedSettings: InvoiceSettings = {
          ...invoiceSettings,
          lastInvoiceSequence: nextLastSeq
        };
        setInvoiceSettings(updatedSettings);
        await saveSettingsToFirestore(updatedSettings).catch(console.error);
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSettings)
        }).catch(console.error);
      }

      fetch('/api/orders/resequence', { method: 'POST' }).catch(console.error);

      setOrders(resequencedOrders);

      if (!silent) {
        alert(`Berhasil merapikan & mengurutkan ulang ${sorted.length} nomor invoice secara berurutan! (INV/.../0001 s/d INV/.../${String(nextLastSeq).padStart(4, '0')})`);
      }
    } catch (err: any) {
      if (!silent) alert('Gagal mengurutkan nomor invoice: ' + (err.message || 'Error'));
    }
  };

  // Auto check for duplicate or non-sequential invoice numbers
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const seenInvoices = new Set<string>();
    let hasDuplicatesOrUnordered = false;

    const seqs = orders.map(o => {
      if (!o.invoiceNumber || seenInvoices.has(o.invoiceNumber)) {
        hasDuplicatesOrUnordered = true;
      } else {
        seenInvoices.add(o.invoiceNumber);
      }
      const match = o.invoiceNumber?.match(/\d+$/);
      return match ? parseInt(match[0], 10) : 0;
    }).sort((a, b) => a - b);

    const isSequential = seqs.every((val, idx) => val === idx + 1);

    if (hasDuplicatesOrUnordered || !isSequential) {
      handleResequenceAllOrders(true);
    }
  }, [orders.length]);

  // Handle order deletion
  const handleDeleteOrder = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus order ini secara permanen?')) return;
    try {
      await deleteOrderFromFirestore(id);
      fetch(`/api/orders/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus order.');
    }
  };

  // Quick production status update
  const handleUpdateProductionStatus = async (id: string, status: ProductionStatus) => {
    try {
      const orderToUpdate = orders.find(o => o.id === id);
      if (orderToUpdate) {
        const updated = { ...orderToUpdate, productionStatus: status };
        await saveOrderToFirestore(updated);
      }
      fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionStatus: status })
      }).catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status.');
    }
  };


  const resetFormData = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      customerAddress: '',
      productType: 'Kaos Sablon',
      fabricType: 'Cotton Combed 30s',
      fabricColor: 'Hitam',
      sablonBordir: 'Sablon Plastisol',
      sizeS: 0,
      sizeM: 0,
      sizeL: 0,
      sizeXL: 0,
      sizeXXL: 0,
      sizeS_short: 0,
      sizeS_long: 0,
      sizeM_short: 0,
      sizeM_long: 0,
      sizeL_short: 0,
      sizeL_long: 0,
      sizeXL_short: 0,
      sizeXL_long: 0,
      sizeXXL_short: 0,
      sizeXXL_long: 0,
      sizeCustom: '',
      customSizes: [],
      lenganPendek: 0,
      lenganPanjang: 0,
      customSizingDetails: '',
      quantityCustomAdd: 0,
      unitPrice: 75000,
      addPriceXXL: 0,
      addPriceLongSleeve: 0,
      addPriceLongSleeveXXL: 0,
      addPriceCustom: 0,
      discount: 0,
      shippingCost: 0,
      dpAmount: 0,
      paymentMethod: 'CASH',
      paymentReference: 'Kasir Tunai',
      notes: '',
      deadline: ''
    });
  };

  const handleOpenEditModal = (order: ConvectionOrder) => {
    setEditingOrder(order);
    setFormData({
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      customerEmail: order.customerEmail || '',
      customerAddress: order.customerAddress || '',
      productType: order.productType || 'Kaos Sablon',
      fabricType: order.fabricType || '',
      fabricColor: order.fabricColor || '',
      sablonBordir: order.sablonBordir || '',
      sizeS: order.sizeS || 0,
      sizeM: order.sizeM || 0,
      sizeL: order.sizeL || 0,
      sizeXL: order.sizeXL || 0,
      sizeXXL: order.sizeXXL || 0,
      sizeS_short: order.sizeS_short ?? (order.sizeS || 0),
      sizeS_long: order.sizeS_long ?? 0,
      sizeM_short: order.sizeM_short ?? (order.sizeM || 0),
      sizeM_long: order.sizeM_long ?? 0,
      sizeL_short: order.sizeL_short ?? (order.sizeL || 0),
      sizeL_long: order.sizeL_long ?? 0,
      sizeXL_short: order.sizeXL_short ?? (order.sizeXL || 0),
      sizeXL_long: order.sizeXL_long ?? 0,
      sizeXXL_short: order.sizeXXL_short ?? (order.sizeXXL || 0),
      sizeXXL_long: order.sizeXXL_long ?? 0,
      sizeCustom: order.sizeCustom || '',
      customSizes: order.customSizes || [],
      lenganPendek: order.lenganPendek || 0,
      lenganPanjang: order.lenganPanjang || 0,
      customSizingDetails: order.customSizingDetails || '',
      quantityCustomAdd: 0,
      unitPrice: order.unitPrice || 75000,
      addPriceXXL: order.addPriceXXL || 0,
      addPriceLongSleeve: order.addPriceLongSleeve || 0,
      addPriceLongSleeveXXL: order.addPriceLongSleeveXXL || 0,
      addPriceCustom: order.addPriceCustom || 0,
      discount: order.discount || 0,
      shippingCost: order.shippingCost || 0,
      dpAmount: order.dpAmount || 0,
      paymentMethod: 'CASH',
      paymentReference: 'Kasir Tunai',
      notes: order.notes || '',
      deadline: order.deadline ? order.deadline.split('T')[0] : ''
    });
    setShowAddForm(true);
  };

  // Submit order form (Create or Edit)
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName) {
      alert('Nama pelanggan wajib diisi.');
      return;
    }
    if (liveQty <= 0) {
      alert('Jumlah pakaian (quantity) harus lebih besar dari 0. Silakan isi rincian ukuran.');
      return;
    }

    try {
      const isEdit = !!editingOrder;
      const orderId = isEdit ? editingOrder.id : `ord-${Date.now()}`;
      
      let invNum = isEdit ? editingOrder.invoiceNumber : '';
      if (!isEdit) {
        let highestInOrders = 0;
        orders.forEach(o => {
          if (o.invoiceNumber) {
            const match = o.invoiceNumber.match(/\d+$/);
            if (match) {
              const val = parseInt(match[0], 10);
              if (!isNaN(val) && val > highestInOrders) {
                highestInOrders = val;
              }
            }
          }
        });

        const storedSeq = invoiceSettings?.lastInvoiceSequence || 0;
        const localSeq = parseInt(localStorage.getItem('last_invoice_sequence') || '0', 10) || 0;

        const nextSeq = Math.max(highestInOrders, storedSeq, localSeq) + 1;
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        invNum = `INV/${year}${month}/${String(nextSeq).padStart(4, '0')}`;

        try {
          localStorage.setItem('last_invoice_sequence', String(nextSeq));
        } catch {}

        if (invoiceSettings) {
          const updatedSettings = {
            ...invoiceSettings,
            lastInvoiceSequence: nextSeq
          };
          setInvoiceSettings(updatedSettings);
          saveSettingsToFirestore(updatedSettings).catch(() => {});
        }
      }

      const generatedCustomStr = (formData.customSizes || [])
        .filter(item => (item.name && item.name.trim()) || (item.short || 0) > 0 || (item.long || 0) > 0)
        .map(item => `${item.name || 'Custom'}: ${(item.short || 0) + (item.long || 0)} pcs (Pendek: ${item.short || 0}, Panjang: ${item.long || 0})`)
        .join(', ');

      const newDpAmount = Number(formData.dpAmount) || 0;
      let finalPaymentHistory: PaymentRecord[] = [];

      if (isEdit) {
        const existingHistory = editingOrder.paymentHistory || [];
        const dpIndex = existingHistory.findIndex(p => p.type === 'DP');
        
        if (dpIndex >= 0) {
          finalPaymentHistory = existingHistory.map((p, idx) => {
            if (idx === dpIndex) {
              return {
                ...p,
                amount: newDpAmount,
                method: formData.paymentMethod || p.method || 'CASH',
                reference: formData.paymentReference || p.reference || 'Kasir Tunai'
              };
            }
            return p;
          });
          if (newDpAmount <= 0) {
            finalPaymentHistory = finalPaymentHistory.filter((_, idx) => idx !== dpIndex);
          }
        } else if (newDpAmount > 0) {
          finalPaymentHistory = [
            {
              id: `pay-${Date.now()}`,
              amount: newDpAmount,
              type: 'DP',
              method: formData.paymentMethod || 'CASH',
              reference: formData.paymentReference || 'Kasir Tunai',
              timestamp: new Date().toISOString(),
              status: 'SUCCESS'
            },
            ...existingHistory
          ];
        } else {
          finalPaymentHistory = [...existingHistory];
        }
      } else {
        finalPaymentHistory = newDpAmount > 0 ? [{
          id: `pay-${Date.now()}`,
          amount: newDpAmount,
          type: 'DP',
          method: formData.paymentMethod || 'CASH',
          reference: formData.paymentReference || 'Kasir Tunai',
          timestamp: new Date().toISOString(),
          status: 'SUCCESS'
        }] : [];
      }

      const totalPaidSoFar = finalPaymentHistory
        .filter(p => p.status === 'SUCCESS' || !p.status)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const newRemaining = Math.max(0, liveTotal - totalPaidSoFar);
      const newPayStatus: PaymentStatus = newRemaining <= 0 ? 'LUNAS' : totalPaidSoFar > 0 ? 'DP_DIBAYAR' : 'BELUM_BAYAR';

      const fullOrderObj: ConvectionOrder = {
        id: orderId,
        invoiceNumber: invNum,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim(),
        customerAddress: formData.customerAddress.trim(),
        productType: formData.productType || 'Kaos Sablon',
        fabricType: formData.fabricType || '',
        fabricColor: formData.fabricColor || '',
        sablonBordir: formData.sablonBordir || '',
        sizeS: sizeS_total,
        sizeM: sizeM_total,
        sizeL: sizeL_total,
        sizeXL: sizeXL_total,
        sizeXXL: sizeXXL_total,
        sizeS_short: formData.sizeS_short || 0,
        sizeS_long: formData.sizeS_long || 0,
        sizeM_short: formData.sizeM_short || 0,
        sizeM_long: formData.sizeM_long || 0,
        sizeL_short: formData.sizeL_short || 0,
        sizeL_long: formData.sizeL_long || 0,
        sizeXL_short: formData.sizeXL_short || 0,
        sizeXL_long: formData.sizeXL_long || 0,
        sizeXXL_short: formData.sizeXXL_short || 0,
        sizeXXL_long: formData.sizeXXL_long || 0,
        sizeCustom: generatedCustomStr || formData.sizeCustom || '',
        customSizes: formData.customSizes || [],
        lenganPendek: calcTotalPendek,
        lenganPanjang: calcTotalPanjang,
        customSizingDetails: formData.customSizingDetails || '',
        unitPrice: Number(formData.unitPrice || 0),
        addPriceXXL: Number(formData.addPriceXXL || 0),
        addPriceLongSleeve: Number(formData.addPriceLongSleeve || 0),
        addPriceLongSleeveXXL: Number(formData.addPriceLongSleeveXXL || 0),
        addPriceCustom: Number(formData.addPriceCustom || 0),
        discount: Number(formData.discount || 0),
        shippingCost: Number(formData.shippingCost || 0),
        quantity: liveQty,
        totalPrice: liveTotal,
        dpAmount: newDpAmount,
        remainingBalance: newRemaining,
        paymentStatus: newPayStatus,
        productionStatus: isEdit ? editingOrder.productionStatus : 'ANTREAN',
        notes: formData.notes || '',
        createdAt: isEdit ? editingOrder.createdAt : new Date().toISOString(),
        deadline: formData.deadline || '',
        paymentHistory: finalPaymentHistory
      };

      await saveOrderToFirestore(fullOrderObj);

      const addedAmount = !isEdit
        ? newDpAmount
        : Math.max(0, newDpAmount - (editingOrder.dpAmount || 0));

      if (addedAmount > 0) {
        const isLunas = newDpAmount >= liveTotal;
        sendInvoicePaymentWebhook({
          amount: addedAmount,
          invoiceNumber: invNum,
          customerName: formData.customerName,
          paymentType: isLunas ? 'Pelunasan' : 'DP',
          isFullOrSettled: isLunas
        }).catch(() => {});
      }

      const url = isEdit ? `/api/orders/${editingOrder.id}` : '/api/orders';
      const method = isEdit ? 'PUT' : 'POST';
      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          id: orderId,
          invoiceNumber: invNum,
          dpAmount: newDpAmount,
          paymentHistory: finalPaymentHistory,
          remainingBalance: newRemaining,
          paymentStatus: newPayStatus,
          sizeCustom: generatedCustomStr || formData.sizeCustom || '',
          sizeS: sizeS_total,
          sizeM: sizeM_total,
          sizeL: sizeL_total,
          sizeXL: sizeXL_total,
          sizeXXL: sizeXXL_total,
          lenganPendek: calcTotalPendek,
          lenganPanjang: calcTotalPanjang,
          quantity: liveQty,
          totalPrice: liveTotal
        })
      }).catch(() => {});

      // Auto-save customer if requested and not existing
      if (saveCustomerToDb && formData.customerName.trim()) {
        const exists = customers.some(c => 
          (c.phone && formData.customerPhone && c.phone.replace(/\D/g, '') === formData.customerPhone.replace(/\D/g, '')) ||
          (c.name.toLowerCase() === formData.customerName.trim().toLowerCase())
        );

        if (!exists) {
          const newCustomerObj: Customer = {
            id: `cust-${Date.now()}`,
            name: formData.customerName.trim(),
            phone: formData.customerPhone.trim(),
            email: formData.customerEmail.trim(),
            address: formData.customerAddress.trim(),
            notes: 'Tersimpan otomatis dari transaksi order baru',
            createdAt: new Date().toISOString()
          };
          saveCustomerToFirestore(newCustomerObj).catch(() => {});
          fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCustomerObj)
          }).catch(() => {});
        }
      }

      // Clear Form & Close
      resetFormData();
      setEditingOrder(null);
      setShowAddForm(false);
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan.');
    }
  };

  // Submit Quick Cashier Payment
  const handleQuickPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayOrder) return;

    try {
      const isPelunasan = quickPayAmount >= quickPayOrder.remainingBalance;
      const newPayRecord = {
        id: `pay-${Date.now()}`,
        amount: quickPayAmount,
        type: isPelunasan ? ('PELUNASAN' as const) : ('DP' as const),
        method: quickPayMethod,
        reference: quickPayRef,
        timestamp: new Date().toISOString(),
        status: 'SUCCESS' as const
      };

      const updatedRemaining = Math.max(0, quickPayOrder.remainingBalance - quickPayAmount);
      const updatedStatus: PaymentStatus = updatedRemaining <= 0 ? 'LUNAS' : 'DP_DIBAYAR';

      const updatedOrderObj: ConvectionOrder = {
        ...quickPayOrder,
        remainingBalance: updatedRemaining,
        paymentStatus: updatedStatus,
        paymentHistory: [...(quickPayOrder.paymentHistory || []), newPayRecord]
      };

      await saveOrderToFirestore(updatedOrderObj);

      sendInvoicePaymentWebhook({
        amount: quickPayAmount,
        invoiceNumber: quickPayOrder.invoiceNumber || quickPayOrder.id,
        customerName: quickPayOrder.customerName,
        paymentType: isPelunasan ? 'Pelunasan' : 'DP',
        isFullOrSettled: isPelunasan
      }).catch(() => {});

      fetch(`/api/orders/${quickPayOrder.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: quickPayAmount,
          type: isPelunasan ? 'PELUNASAN' : 'DP',
          method: quickPayMethod,
          reference: quickPayRef
        })
      }).catch(() => {});

      setQuickPayOrder(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pembayaran.');
    }
  };


  const getInvoiceLink = (order: ConvectionOrder) => {
    const origin = window.location.origin + window.location.pathname;
    const cleanOrigin = origin.endsWith('/') ? origin : origin + '/';
    return `${cleanOrigin}?invoice=${encodeURIComponent(order.id || order.invoiceNumber)}`;
  };

  const copyInvoiceLink = async (order: ConvectionOrder) => {
    const link = getInvoiceLink(order);
    
    setShareOrder(order);
    setShareLinkCopied(false);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        setShareLinkCopied(true);
        setCopiedOrderId(order.id);
        setTimeout(() => setCopiedOrderId(null), 2000);
      } else {
        // Fallback copying using a temporary textarea
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
          setShareLinkCopied(true);
          setCopiedOrderId(order.id);
          setTimeout(() => setCopiedOrderId(null), 2000);
        }
      }
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const getWhatsAppUrl = (order: ConvectionOrder) => {
    const cleanPhone = order.customerPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    
    const paymentLink = getInvoiceLink(order);
    
    const text = `Halo *${order.customerName}*,\n\nBerikut rincian pesanan konveksi Anda di *MAHYA APPAREL*.\n\nNomor Invoice: *${order.invoiceNumber}*\nTotal Tagihan: *${formatRupiah(order.totalPrice)}*\n\nAnda dapat memantau progress produksi (antrean, potong bahan, sablon, jahit) secara langsung serta melakukan pembayaran secara online melalui link berikut:\n${paymentLink}\n\nTerima kasih! 😊`;
    
    return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`;
  };

  const getOrderSeqNum = (o: ConvectionOrder): number => {
    if (o.invoiceNumber) {
      const match = o.invoiceNumber.match(/\d+$/);
      if (match) {
        const val = parseInt(match[0], 10);
        if (!isNaN(val)) return val;
      }
    }
    if (o.createdAt) {
      const t = new Date(o.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };

  // Filter & sort orders (newest on top, oldest/0001 at the bottom)
  const filteredOrders = orders
    .filter((o) => {
      const matchesSearch = 
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        o.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.productType.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesProduction = filterProduction === 'ALL' || o.productionStatus === filterProduction;
      const matchesPayment = filterPayment === 'ALL' || o.paymentStatus === filterPayment;

      return matchesSearch && matchesProduction && matchesPayment;
    })
    .sort((a, b) => getOrderSeqNum(b) - getOrderSeqNum(a));

  // Render PIN Lock Screen if system is locked
  if (!isUnlocked) {
    const displayPin = (invoiceSettings?.adminPin && invoiceSettings.adminPin.trim() !== '') 
      ? invoiceSettings.adminPin.trim() 
      : '1234';

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Background Ambient Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6 animate-fade-in text-center">
          {/* Lock Screen Header */}
          <div className="space-y-3">
            <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Lock size={32} className="animate-pulse text-blue-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase bg-blue-950/80 px-3 py-1 rounded-full border border-blue-800/50 inline-block mb-1.5">
                AKSES KASIR TERKUNCI
              </span>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {invoiceSettings?.businessName || 'Mahya Apparel Konveksi'}
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Masukkan PIN Kasir / Owner untuk mengakses dashboard manajemen dan data order.
              </p>
            </div>
          </div>

          {/* PIN Input Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleUnlockSystem(); }} className="space-y-4">
            <div className="relative">
              <div className="flex items-center justify-center gap-2 py-3 bg-slate-950 border border-slate-800 rounded-2xl px-4 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <KeyRound size={18} className="text-slate-500 shrink-0" />
                <input
                  type={showPinMask ? 'password' : 'text'}
                  value={enteredPin}
                  onChange={(e) => {
                    setPinError(null);
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setEnteredPin(val);
                    if (val === displayPin) {
                      handleUnlockSystem(val);
                    }
                  }}
                  placeholder="Masukkan PIN..."
                  autoFocus
                  className="w-full bg-transparent text-center text-2xl font-mono tracking-widest font-bold text-white focus:outline-none placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal"
                  id="input-pin-lockscreen"
                />
                <button
                  type="button"
                  onClick={() => setShowPinMask(!showPinMask)}
                  className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer transition-colors"
                  title={showPinMask ? 'Tampilkan PIN' : 'Sembunyikan PIN'}
                  id="btn-toggle-pin-mask"
                >
                  {showPinMask ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>

              {/* Indicator dots */}
              <div className="flex justify-center gap-2.5 mt-3">
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = enteredPin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                        isFilled
                          ? 'bg-blue-500 scale-110 shadow-sm shadow-blue-500/50'
                          : 'bg-slate-800 border border-slate-700'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Error Message */}
            {pinError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 animate-shake">
                <ShieldAlert size={16} className="shrink-0 text-rose-400" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Interactive Numpad */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'BACK'].map((key) => {
                let label: React.ReactNode = key;
                let btnClass = "bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-xl font-bold py-3 rounded-2xl border border-slate-700/60 active:scale-95 transition-all shadow-sm cursor-pointer";
                if (key === 'CLEAR') {
                  label = <span className="text-xs font-sans font-bold text-slate-400">HAPUS</span>;
                  btnClass = "bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs py-3 rounded-2xl border border-slate-800 active:scale-95 transition-all cursor-pointer";
                } else if (key === 'BACK') {
                  label = <span className="text-xs font-sans font-bold text-slate-400">⌫</span>;
                  btnClass = "bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs py-3 rounded-2xl border border-slate-800 active:scale-95 transition-all cursor-pointer";
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleNumpadPress(key)}
                    className={btnClass}
                    id={`btn-numpad-${key}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={!enteredPin}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                enteredPin
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 cursor-pointer active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
              id="btn-submit-pin"
            >
              <Unlock size={18} />
              Buka Dashboard Kasir
            </button>
          </form>

          {/* Footer Info */}
          <div className="pt-2 border-t border-slate-800/80 text-left space-y-2">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 <strong className="text-slate-300">Tips Pengamanan:</strong> PIN default sistem adalah <code className="bg-slate-800 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold">1234</code>.
            </p>
            <p className="text-[10px] text-slate-500">
              PIN dapat diatur ulang kapan saja melalui menu <strong>Pengaturan Invoice</strong> di dalam dashboard kasir.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* Sidebar - Professional Polish */}
      <aside className="w-full lg:w-64 bg-slate-900 text-slate-300 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">M</div>
            <span className="text-xl font-bold text-white tracking-tight">Mahya Apparel</span>
          </div>
          <span className="lg:hidden text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-bold">KASIR</span>
        </div>
        <nav className="p-4 space-y-2 flex-1 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible">
          <button 
            type="button"
            onClick={() => {
              setFilterProduction('ALL');
              setFilterPayment('ALL');
              setSearchQuery('');
            }}
            className={`flex items-center gap-3 p-3 w-full rounded-lg transition-all cursor-pointer text-left ${
              filterProduction === 'ALL' && filterPayment === 'ALL'
                ? 'bg-blue-600/10 text-blue-400 font-semibold'
                : 'hover:bg-slate-800 hover:text-white text-slate-400 font-medium'
            }`}
          >
            <SlidersHorizontal size={18} />
            <span className="text-sm whitespace-nowrap">Kasir / POS</span>
          </button>
          
          <button 
            type="button"
            onClick={() => {
              setFilterProduction('ANTREAN');
              setFilterPayment('ALL');
            }}
            className={`flex items-center gap-3 p-3 w-full rounded-lg transition-all cursor-pointer text-left ${
              filterProduction !== 'ALL'
                ? 'bg-blue-600/10 text-blue-400 font-semibold'
                : 'hover:bg-slate-800 hover:text-white text-slate-400 font-medium'
            }`}
          >
            <Scissors size={18} />
            <span className="text-sm whitespace-nowrap">Progres Produksi</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setFilterPayment('BELUM_BAYAR');
              setFilterProduction('ALL');
            }}
            className={`flex items-center gap-3 p-3 w-full rounded-lg transition-all cursor-pointer text-left ${
              filterPayment !== 'ALL'
                ? 'bg-blue-600/10 text-blue-400 font-semibold'
                : 'hover:bg-slate-800 hover:text-white text-slate-400 font-medium'
            }`}
          >
            <CreditCard size={18} />
            <span className="text-sm whitespace-nowrap">Status Tagihan</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setShowCustomersModal(true);
            }}
            className="flex items-center justify-between gap-3 p-3 w-full rounded-lg transition-all cursor-pointer text-left hover:bg-slate-800 hover:text-white text-slate-400 font-medium"
            id="btn-sidebar-customers"
          >
            <div className="flex items-center gap-3">
              <Users size={18} />
              <span className="text-sm whitespace-nowrap">Data Pelanggan</span>
            </div>
            {customers.length > 0 && (
              <span className="text-[10px] font-bold bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                {customers.length}
              </span>
            )}
          </button>

          <button 
            type="button"
            onClick={() => {
              setShowSettings(true);
            }}
            className="flex items-center gap-3 p-3 w-full rounded-lg transition-all cursor-pointer text-left hover:bg-slate-800 hover:text-white text-slate-400 font-medium"
            id="btn-sidebar-settings"
          >
            <Settings size={18} />
            <span className="text-sm whitespace-nowrap">Pengaturan Invoice</span>
          </button>

          <button 
            type="button"
            onClick={handleLockSystem}
            className="flex items-center gap-3 p-3 w-full rounded-lg transition-all cursor-pointer text-left hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 font-medium"
            id="btn-sidebar-lock-pin"
            title="Kunci Kasir dengan PIN"
          >
            <Lock size={18} />
            <span className="text-sm whitespace-nowrap">Kunci Kasir (PIN)</span>
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-800 hidden lg:block">
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Status Server</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-sm text-slate-300">Online - Branch Bandung</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto w-full">
        
        {/* Upper Navigation & Slogan */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between justify-start gap-4">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest block mb-1">MANAJEMEN KASIR</span>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Mahya Apparel <span className="text-sm font-semibold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">Konveksi</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">Sistem pencatatan order, status produksi, dan pembayaran digital.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCustomersModal(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm shadow-sm transition-all active:scale-95 cursor-pointer"
              id="btn-open-customers-header"
            >
              <Users size={18} className="text-blue-600" />
              <span>Data Pelanggan</span>
              {customers.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full">
                  {customers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm shadow-sm transition-all active:scale-95 cursor-pointer"
              id="btn-open-settings"
            >
              <Settings size={18} className="text-slate-500" />
              Pengaturan Invoice
            </button>
            <button
              onClick={handleLockSystem}
              className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm shadow-sm transition-all active:scale-95 cursor-pointer"
              id="btn-lock-pin-header"
              title="Kunci dashboard kasir dengan PIN"
            >
              <Lock size={18} className="text-slate-600" />
              <span>Kunci Kasir</span>
            </button>
            {/* Tombol Catat Transaksi Header */}
            <button
              onClick={() => handleOpenTransactionModal()}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
              id="btn-catat-transaksi-header"
              title="Catat transaksi keuangan ke Divisi Konveksi, Sablon, atau Asesoris"
            >
              <DollarSign size={18} />
              <span>Catat Transaksi</span>
            </button>

            <button
              onClick={() => {
                setEditingOrder(null);
                resetFormData();
                setShowAddForm(true);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
              id="btn-tambah-order"
            >
              <Plus size={18} />
              Buat Order Baru
            </button>
          </div>
        </div>

      {/* Stats Board */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Revenue */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wide">Pendapatan Masuk</span>
              <p className="text-2xl font-mono font-black text-blue-600">{formatRupiah(stats.totalRevenue)}</p>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <TrendingUp size={12} className="text-emerald-500" />
                Dana kas terkumpul dari DP & Pelunasan
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign size={24} />
            </div>
          </div>

          {/* Pending Balance */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wide">Piutang Pelunasan</span>
              <p className="text-2xl font-mono font-black text-rose-600">{formatRupiah(stats.pendingRevenue)}</p>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <AlertTriangle size={12} className="text-rose-500" />
                Sisa tagihan yang harus dilunasi pelanggan
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <CreditCard size={24} />
            </div>
          </div>

          {/* Active Production */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wide">Pesanan Aktif</span>
              <p className="text-2xl font-extrabold text-slate-800">{stats.activeOrdersCount}</p>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock size={12} className="text-amber-500" />
                Proyek dalam proses workshop konveksi
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Scissors size={24} />
            </div>
          </div>

          {/* Total Projects */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wide">Total Orderan</span>
              <p className="text-2xl font-extrabold text-slate-800">{stats.totalOrdersCount}</p>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-500" />
                Total invoice tercatat di database
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles size={24} />
            </div>
          </div>
        </div>
      )}

      {/* Filter and Table Panel */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Search, filters */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari pelanggan, nomor invoice, produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none focus:bg-white text-sm font-medium transition-all"
              id="input-cari-order"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Filter Production Status */}
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal size={14} className="text-slate-400" />
              <select
                value={filterProduction}
                onChange={(e) => setFilterProduction(e.target.value)}
                className="bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                id="select-filter-produksi"
              >
                <option value="ALL">Semua Progres Produksi</option>
                <option value="ANTREAN">Antrean</option>
                <option value="POTONG_BAHAN">Potong Bahan</option>
                <option value="SABLON_BORDIR">Sablon & Bordir</option>
                <option value="JAHIT">Jahit</option>
                <option value="FINISHING">Finishing & QC</option>
                <option value="SIAP_DIAMBIL">Siap Diambil</option>
                <option value="DIKIRIM">Sudah Dikirim</option>
              </select>
            </div>

            {/* Filter Payment Status */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
              id="select-filter-pembayaran"
            >
              <option value="ALL">Semua Status Bayar</option>
              <option value="BELUM_BAYAR">Belum Bayar</option>
              <option value="DP_DIBAYAR">DP Dibayar</option>
              <option value="LUNAS">Lunas</option>
            </select>

            {/* Resequence Invoices Button */}
            <button
              onClick={() => handleResequenceAllOrders(false)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-extrabold transition-all cursor-pointer border border-blue-200 shadow-sm"
              title="Urutkan & Rapikan Ulang Semua Nomor Invoice (0001, 0002, 0003...)"
              id="btn-resequence-invoices"
            >
              <ListOrdered size={15} className="text-blue-600" />
              <span>Urutkan No. Invoice</span>
            </button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <span>Menghubungkan ke database konveksi...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <FileText size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="font-bold">Tidak ada order yang cocok</p>
              <p className="text-xs mt-1">Coba sesuaikan kata kunci pencarian atau filter Anda.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">
                  <th className="px-6 py-4">Invoice / Pelanggan</th>
                  <th className="px-6 py-4">Detail Konveksi</th>
                  <th className="px-6 py-4">Jumlah / Deadline</th>
                  <th className="px-6 py-4">Status Produksi</th>
                  <th className="px-6 py-4">Status Bayar</th>
                  <th className="px-6 py-4 text-right">Keuangan (Sisa)</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredOrders.map((order) => {
                  const payStatus = getPaymentStatusDetails(order.paymentStatus);
                  const deadlineDate = new Date(order.deadline);
                  const isUrgent = (deadlineDate.getTime() - Date.now()) < (3 * 24 * 60 * 60 * 1000) && order.productionStatus !== 'DIKIRIM';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Invoice & Client */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-blue-700 block mb-1">
                          {order.invoiceNumber}
                        </span>
                        <span className="font-bold text-slate-900 block">
                          {order.customerName}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                          <Phone size={10} /> {order.customerPhone || '-'}
                        </span>
                      </td>

                      {/* Convection Details */}
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 block">
                          {order.productType}
                        </span>
                        <span className="text-xs text-slate-500 mt-1 block">
                          {order.fabricType} • {order.fabricColor}
                        </span>
                        <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100/50 px-1.5 py-0.5 rounded font-medium inline-block mt-1">
                          {order.sablonBordir}
                        </span>
                      </td>

                      {/* Qty & Deadline */}
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-800 block">
                          {order.quantity} pcs
                        </span>
                        <span className={`text-[11px] inline-flex items-center gap-1 mt-1.5 font-medium ${
                          isUrgent ? 'text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded animate-pulse' : 'text-slate-400'
                        }`}>
                          {isUrgent && <AlertTriangle size={10} />}
                          Dl: {formatIndonesianDate(order.deadline)}
                        </span>
                      </td>

                      {/* Production Interactive Slider */}
                      <td className="px-6 py-4">
                        <select
                          value={order.productionStatus}
                          onChange={(e) => handleUpdateProductionStatus(order.id, e.target.value as ProductionStatus)}
                          className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
                          id={`select-status-prod-${order.id}`}
                        >
                          <option value="ANTREAN">Antrean</option>
                          <option value="POTONG_BAHAN">Potong Bahan</option>
                          <option value="SABLON_BORDIR">Sablon & Bordir</option>
                          <option value="JAHIT">Jahit</option>
                          <option value="FINISHING">Finishing & QC</option>
                          <option value="SIAP_DIAMBIL">Siap Diambil</option>
                          <option value="DIKIRIM">Sudah Dikirim</option>
                        </select>
                      </td>

                      {/* Payment Badge */}
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${payStatus.color}`}>
                          {payStatus.label}
                        </span>
                      </td>

                      {/* Finances (Remaining) */}
                      <td className="px-6 py-4 text-right font-mono">
                        <span className="font-bold text-slate-900 block">
                          {formatRupiah(order.totalPrice)}
                        </span>
                        <span className={`text-xs block mt-1 font-bold ${order.remainingBalance > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                          {order.remainingBalance > 0 ? `Sisa: ${formatRupiah(order.remainingBalance)}` : 'Selesai'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          
                          {/* Invoice Detail */}
                          <button
                            onClick={() => setSelectedInvoice(order)}
                            title="Buka Invoice"
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            id={`btn-view-${order.id}`}
                          >
                            <FileText size={16} />
                          </button>

                          {/* Open Customer Portal Directly */}
                          <button
                            onClick={() => {
                              const targetId = order.id || order.invoiceNumber;
                              const link = `?invoice=${encodeURIComponent(targetId)}`;
                              window.history.pushState({}, '', link);
                              window.dispatchEvent(new Event('popstate'));
                            }}
                            title="Buka Portal Tampilan Pelanggan"
                            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                            id={`btn-portal-${order.id}`}
                          >
                            <ExternalLink size={16} />
                          </button>

                          {/* Copy Customer Link */}
                          <button
                            onClick={() => copyInvoiceLink(order)}
                            title="Salin Link Pembayaran Pelanggan"
                            className={`p-1.5 rounded-lg transition-colors ${
                              copiedOrderId === order.id 
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                            }`}
                            id={`btn-copy-link-${order.id}`}
                          >
                            {copiedOrderId === order.id ? <Check size={16} /> : <Copy size={16} />}
                          </button>

                          {/* Edit Transaksi */}
                          <button
                            onClick={() => handleOpenEditModal(order)}
                            title="Edit Transaksi"
                            className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 hover:text-amber-700 transition-colors cursor-pointer"
                            id={`btn-edit-${order.id}`}
                          >
                            <Edit3 size={16} />
                          </button>

                          {/* Quick Payment for Cashier */}
                          {order.remainingBalance > 0 && (
                            <button
                              onClick={() => {
                                setQuickPayOrder(order);
                                setQuickPayAmount(order.remainingBalance);
                              }}
                              title="Terima Pembayaran Langsung"
                              className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 hover:text-emerald-700 transition-colors"
                              id={`btn-pay-${order.id}`}
                            >
                              <CreditCard size={16} />
                            </button>
                          )}

                          {/* Catat / Sync Transaksi Ke Divisi */}
                          <button
                            onClick={() => handleOpenTransactionModal(order)}
                            title="Catat / Sync Transaksi ke Divisi (Konveksi, Sablon, Asesoris)"
                            className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                            id={`btn-catat-tx-${order.id}`}
                          >
                            <DollarSign size={16} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            title="Hapus Order"
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-700 transition-colors"
                            id={`btn-delete-${order.id}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: Tambah / Edit Order */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">
                {editingOrder ? `Edit Transaksi #${editingOrder.invoiceNumber}` : 'Form Pembuatan Order Konveksi'}
              </h2>
              <button 
                onClick={() => {
                  setShowAddForm(false);
                  setEditingOrder(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-100 hover:bg-slate-200 transition-colors rounded-lg cursor-pointer"
                id="btn-close-form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Row 1: Pelanggan */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <h3 className="text-xs uppercase font-extrabold text-blue-700 tracking-wide">Data Pelanggan (Pemesan)</h3>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCustomerPicker(!showCustomerPicker)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold transition-all cursor-pointer"
                      id="btn-picker-customer"
                    >
                      <Users size={14} />
                      <span>⚡ Pilih dari Data Pelanggan</span>
                    </button>

                    {/* Customer Quick Picker Dropdown */}
                    {showCustomerPicker && (
                      <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-3 space-y-2 max-h-60 overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-xs font-extrabold text-slate-800">Daftar Pelanggan Tersimpan</span>
                          <button
                            type="button"
                            onClick={() => setShowCustomerPicker(false)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        {customers.length === 0 ? (
                          <p className="text-xs text-slate-400 py-3 text-center">Belum ada pelanggan tersimpan.</p>
                        ) : (
                          <div className="space-y-1">
                            {customers.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => selectCustomerForOrder(c)}
                                className="w-full text-left p-2 hover:bg-blue-50 rounded-lg transition-colors flex flex-col gap-0.5 cursor-pointer border border-transparent hover:border-blue-100"
                              >
                                <span className="text-xs font-bold text-slate-800">{c.name}</span>
                                <span className="text-[11px] text-slate-500">{c.phone} {c.email ? `• ${c.email}` : ''}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Nama Lengkap*</label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-bold text-slate-800"
                      placeholder="Contoh: Suryadi (BEM UI)"
                      id="input-form-customer-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">No. WhatsApp/Ponsel</label>
                    <input
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-semibold text-slate-800"
                      placeholder="Contoh: 081234567890"
                      id="input-form-customer-phone"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-medium text-slate-800"
                      placeholder="Contoh: suryadi@domain.com"
                      id="input-form-customer-email"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Alamat Kirim / Tagihan</label>
                  <textarea
                    value={formData.customerAddress}
                    onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                    className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm h-16 resize-none font-medium text-slate-800"
                    placeholder="Gedung Pusgiwa UI Depok..."
                    id="input-form-customer-address"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveCustomerToDb}
                      onChange={(e) => setSaveCustomerToDb(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      id="checkbox-save-customer"
                    />
                    <span>Otomatis simpan/perbarui data pelanggan ini di Database Pelanggan</span>
                  </label>
                </div>
              </div>

              {/* Row 2: Spesifikasi Garment */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                <h3 className="text-xs uppercase font-extrabold text-blue-700 tracking-wide">Spesifikasi Garment & Konveksi</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Tipe Produk</label>
                    <select
                      value={formData.productType}
                      onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 text-sm cursor-pointer"
                      id="select-form-product-type"
                    >
                      <option value="Kaos Sablon">Kaos Sablon</option>
                      <option value="Kaos Polos">Kaos Polos</option>
                      <option value="Sablon Saja">Sablon Saja</option>
                      <option value="Polo Shirt">Polo Shirt</option>
                      <option value="Kemeja PDL/PDH">Kemeja PDL/PDH</option>
                      <option value="Hoodie Jumper">Hoodie Jumper</option>
                      <option value="Jaket Bomber">Jaket Bomber</option>
                      <option value="Jas Almamater">Jas Almamater</option>
                      <option value="Jersey Sublim">Jersey Sublim</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Bahan Kain / Fabric</label>
                    <input
                      type="text"
                      value={formData.fabricType}
                      onChange={(e) => setFormData({ ...formData, fabricType: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="Contoh: Cotton Combed 30s"
                      id="input-form-fabric"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Warna Kain</label>
                    <input
                      type="text"
                      value={formData.fabricColor}
                      onChange={(e) => setFormData({ ...formData, fabricColor: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="Contoh: Navy Blue"
                      id="input-form-fabric-color"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Aplikasi Sablon/Bordir</label>
                    <input
                      type="text"
                      value={formData.sablonBordir}
                      onChange={(e) => setFormData({ ...formData, sablonBordir: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="Contoh: Bordir Komputer"
                      id="input-form-embellishment"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Distribusi Ukuran & Tipe Lengan */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <div>
                    <h3 className="text-xs uppercase font-extrabold text-blue-700 tracking-wide">
                      Rincian Ukuran & Jenis Lengan (Pcs)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Terdapat dua kolom (Lengan Pendek & Lengan Panjang) di setiap varian ukuran.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm shrink-0">
                    <span>Total: <strong className="text-blue-700 font-extrabold text-sm">{liveQty} pcs</strong></span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-700">Pendek: {calcTotalPendek}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-indigo-700">Panjang: {calcTotalPanjang}</span>
                  </div>
                </div>

                {/* 2-Column Per Size Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    { size: 'S', shortKey: 'sizeS_short', longKey: 'sizeS_long', total: sizeS_total },
                    { size: 'M', shortKey: 'sizeM_short', longKey: 'sizeM_long', total: sizeM_total },
                    { size: 'L', shortKey: 'sizeL_short', longKey: 'sizeL_long', total: sizeL_total },
                    { size: 'XL', shortKey: 'sizeXL_short', longKey: 'sizeXL_long', total: sizeXL_total },
                    { size: 'XXL', shortKey: 'sizeXXL_short', longKey: 'sizeXXL_long', total: sizeXXL_total },
                  ].map(({ size, shortKey, longKey, total }) => (
                    <div key={size} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-xs font-extrabold text-slate-800">Ukuran {size}</span>
                        <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {total} pcs
                        </span>
                      </div>
                      
                      {/* Sub-columns: Pendek & Panjang */}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Pendek
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData[shortKey as keyof typeof formData] || ''}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              [shortKey]: Math.max(0, parseInt(e.target.value) || 0) 
                            })}
                            className="w-full bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500 text-center font-extrabold text-sm font-mono"
                            placeholder="0"
                            id={`input-size-${size.toLowerCase()}-short`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Panjang
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData[longKey as keyof typeof formData] || ''}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              [longKey]: Math.max(0, parseInt(e.target.value) || 0) 
                            })}
                            className="w-full bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500 text-center font-extrabold text-sm font-mono"
                            placeholder="0"
                            id={`input-size-${size.toLowerCase()}-long`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Sizes Section: "Tambah Ukuran Lain" */}
                <div className="pt-3 border-t border-slate-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <span>Ukuran Custom / Ukuran Lainnya</span>
                        {(formData.customSizes && formData.customSizes.length > 0) && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full">
                            {formData.customSizes.length} Ukuran
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Tambahkan ukuran khusus (misal: 3XL, 4XL, 5XL, Anak, Jumbo) dengan rincian lengan pendek & panjang.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const currentCustom = formData.customSizes || [];
                        const defaultNames = ['3XL', '4XL', '5XL', 'Anak', 'Jumbo'];
                        const nextName = defaultNames[currentCustom.length] || `Ukuran ${currentCustom.length + 1}`;
                        setFormData({
                          ...formData,
                          customSizes: [...currentCustom, { name: nextName, short: 0, long: 0 }]
                        });
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm shrink-0 cursor-pointer self-start sm:self-auto"
                      id="button-add-custom-size"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Ukuran Lain</span>
                    </button>
                  </div>

                  {/* Dynamic Custom Sizes Grid matching standard size cards above */}
                  {(formData.customSizes && formData.customSizes.length > 0) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {formData.customSizes.map((item, index) => {
                        const itemTotal = (Number(item.short) || 0) + (Number(item.long) || 0);
                        return (
                          <div key={index} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-2 relative group">
                            {/* Header: Editable Size Label & Total */}
                            <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1.5">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => {
                                  const updated = [...(formData.customSizes || [])];
                                  updated[index] = { ...updated[index], name: e.target.value };
                                  setFormData({ ...formData, customSizes: updated });
                                }}
                                placeholder="Nama Ukuran"
                                className="text-xs font-extrabold text-slate-800 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-blue-500 px-1.5 py-0.5 rounded w-24 focus:outline-none"
                                id={`input-custom-size-name-${index}`}
                              />
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                  {itemTotal} pcs
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = (formData.customSizes || []).filter((_, i) => i !== index);
                                    setFormData({ ...formData, customSizes: updated });
                                  }}
                                  className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                  title="Hapus Ukuran Ini"
                                  id={`button-remove-custom-size-${index}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Sub-columns: Pendek & Panjang */}
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Pendek
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.short || ''}
                                  onChange={(e) => {
                                    const updated = [...(formData.customSizes || [])];
                                    updated[index] = { ...updated[index], short: Math.max(0, parseInt(e.target.value) || 0) };
                                    setFormData({ ...formData, customSizes: updated });
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500 text-center font-extrabold text-sm font-mono"
                                  placeholder="0"
                                  id={`input-custom-size-${index}-short`}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Panjang
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.long || ''}
                                  onChange={(e) => {
                                    const updated = [...(formData.customSizes || [])];
                                    updated[index] = { ...updated[index], long: Math.max(0, parseInt(e.target.value) || 0) };
                                    setFormData({ ...formData, customSizes: updated });
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500 text-center font-extrabold text-sm font-mono"
                                  placeholder="0"
                                  id={`input-custom-size-${index}-long`}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-dashed border-slate-200 p-3.5 text-center">
                      <p className="text-xs text-slate-400 font-medium mb-1.5">Belum ada ukuran custom tambahan yang ditambahkan.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            customSizes: [{ name: '3XL', short: 0, long: 0 }]
                          });
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Ukuran Custom (misal: 3XL, 4XL, Anak)</span>
                      </button>
                    </div>
                  )}
                </div>


              </div>

              {/* Row 4: Keuangan & Pricing */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                <h3 className="text-xs uppercase font-extrabold text-blue-700 tracking-wide">Keuangan & Skema Harga Satuan</h3>
                
                {/* 4 Standard Unit Price Input Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Harga Satuan Standar (S-XL Pendek)*
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.unitPrice}
                      onChange={(e) => setFormData({ ...formData, unitPrice: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md focus:outline-none focus:bg-white focus:border-blue-500 text-sm font-mono font-extrabold text-slate-800"
                      id="input-form-unit-price"
                      placeholder="75000"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Harga dasar per pcs</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Harga Satuan / Tambahan XXL
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.addPriceXXL || ''}
                      onChange={(e) => setFormData({ ...formData, addPriceXXL: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md focus:outline-none focus:bg-white focus:border-blue-500 text-sm font-mono font-bold text-slate-800"
                      id="input-form-price-xxl"
                      placeholder="Contoh: 5000 atau 80000"
                    />
                    <span className="text-[10px] text-blue-600 mt-0.5 block font-semibold">
                      Efektif: {formatRupiah(effShortXXL)}/pcs
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Harga Satuan / Tambahan Panjang
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.addPriceLongSleeve || ''}
                      onChange={(e) => setFormData({ ...formData, addPriceLongSleeve: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md focus:outline-none focus:bg-white focus:border-blue-500 text-sm font-mono font-bold text-slate-800"
                      id="input-form-price-long"
                      placeholder="Contoh: 10000 atau 85000"
                    />
                    <span className="text-[10px] text-indigo-600 mt-0.5 block font-semibold">
                      Efektif: {formatRupiah(effLongStandard)}/pcs
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Harga Satuan / Tambahan Panjang XXL
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.addPriceLongSleeveXXL || ''}
                      onChange={(e) => setFormData({ ...formData, addPriceLongSleeveXXL: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md focus:outline-none focus:bg-white focus:border-blue-500 text-sm font-mono font-bold text-slate-800"
                      id="input-form-price-long-xxl"
                      placeholder="Contoh: 15000 atau 90000"
                    />
                    <span className="text-[10px] text-purple-600 mt-0.5 block font-semibold">
                      Efektif: {formatRupiah(effLongXXL)}/pcs
                    </span>
                  </div>
                </div>

                {/* Dynamic Pricing for Custom Sizes added */}
                {formData.customSizes && formData.customSizes.length > 0 && (
                  <div className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-200/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <h4 className="text-xs font-extrabold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                          <span>Skema Harga Ukuran Custom / Lainnya ({formData.customSizes.length} Ukuran)</span>
                        </h4>
                        <p className="text-[11px] text-amber-800/80">
                          Masukkan harga khusus pendek & panjang untuk masing-masing ukuran custom di bawah (opsional, jika kosong mengikuti harga standar & panjang).
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {formData.customSizes.map((item, index) => {
                        const itemShortPrice = (item.priceShort !== undefined && item.priceShort !== 0) 
                          ? getEffectivePrice(item.priceShort, basePrice) 
                          : effCustom;
                        const longSleeveDiff = effLongStandard > basePrice ? (effLongStandard - basePrice) : 0;
                        const itemLongPrice = (item.priceLong !== undefined && item.priceLong !== 0) 
                          ? getEffectivePrice(item.priceLong, basePrice + longSleeveDiff) 
                          : (itemShortPrice + longSleeveDiff);

                        return (
                          <div key={index} className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm space-y-2">
                            <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
                              <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                                Ukuran {item.name || `Custom ${index + 1}`}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                                Total: {(item.short || 0) + (item.long || 0)} pcs
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-700 block mb-1">
                                  Harga {item.name || 'Custom'} Pendek
                                </label>
                                <input
                                  type="number"
                                  value={item.priceShort || ''}
                                  onChange={(e) => {
                                    const updated = [...(formData.customSizes || [])];
                                    updated[index] = {
                                      ...updated[index],
                                      priceShort: parseInt(e.target.value) || 0
                                    };
                                    setFormData({ ...formData, customSizes: updated });
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none focus:bg-white focus:border-amber-500 text-xs font-mono font-bold text-slate-800"
                                  placeholder={`Standar: ${basePrice ? basePrice.toLocaleString('id-ID') : '75000'} (Anak e.g. 65000 atau -10000)`}
                                  id={`input-price-custom-${index}-short`}
                                />
                                <span className="text-[9px] text-amber-700 mt-0.5 block font-semibold">
                                  Efektif: {formatRupiah(itemShortPrice)}/pcs
                                </span>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-700 block mb-1">
                                  Harga {item.name || 'Custom'} Panjang
                                </label>
                                <input
                                  type="number"
                                  value={item.priceLong || ''}
                                  onChange={(e) => {
                                    const updated = [...(formData.customSizes || [])];
                                    updated[index] = {
                                      ...updated[index],
                                      priceLong: parseInt(e.target.value) || 0
                                    };
                                    setFormData({ ...formData, customSizes: updated });
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none focus:bg-white focus:border-amber-500 text-xs font-mono font-bold text-slate-800"
                                  placeholder={`Standar: ${effLongStandard ? effLongStandard.toLocaleString('id-ID') : '85000'}`}
                                  id={`input-price-custom-${index}-long`}
                                />
                                <span className="text-[9px] text-amber-700 mt-0.5 block font-semibold">
                                  Efektif: {formatRupiah(itemLongPrice)}/pcs
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Diskon & Ongkir */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Diskon Potongan (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.discount || ''}
                      onChange={(e) => setFormData({ ...formData, discount: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-mono"
                      id="input-form-discount"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Ongkos Kirim (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.shippingCost || ''}
                      onChange={(e) => setFormData({ ...formData, shippingCost: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-mono"
                      id="input-form-shipping"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Live Breakdown Summary */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Rincian Subtotal Pakaian
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-slate-500 block text-[10px]">Pendek Standard (S-XL)</span>
                      <strong className="text-slate-800 font-mono">{shortStandardQty} pcs</strong> @ {formatRupiah(basePrice)}
                      <p className="text-slate-600 font-bold font-mono mt-0.5">{formatRupiah(shortStandardQty * basePrice)}</p>
                    </div>
                    <div className="bg-blue-50/60 p-2 rounded border border-blue-100">
                      <span className="text-blue-600 block text-[10px]">Pendek XXL</span>
                      <strong className="text-blue-900 font-mono">{shortXXLQty} pcs</strong> @ {formatRupiah(effShortXXL)}
                      <p className="text-blue-800 font-bold font-mono mt-0.5">{formatRupiah(shortXXLQty * effShortXXL)}</p>
                    </div>
                    <div className="bg-indigo-50/60 p-2 rounded border border-indigo-100">
                      <span className="text-indigo-600 block text-[10px]">Panjang Standard (S-XL)</span>
                      <strong className="text-indigo-900 font-mono">{longStandardQty} pcs</strong> @ {formatRupiah(effLongStandard)}
                      <p className="text-indigo-800 font-bold font-mono mt-0.5">{formatRupiah(longStandardQty * effLongStandard)}</p>
                    </div>
                    <div className="bg-purple-50/60 p-2 rounded border border-purple-100">
                      <span className="text-purple-600 block text-[10px]">Panjang XXL</span>
                      <strong className="text-purple-900 font-mono">{longXXLQty} pcs</strong> @ {formatRupiah(effLongXXL)}
                      <p className="text-purple-800 font-bold font-mono mt-0.5">{formatRupiah(longXXLQty * effLongXXL)}</p>
                    </div>

                    {/* Breakdown per custom size if added */}
                    {formData.customSizes && formData.customSizes.length > 0 ? (
                      formData.customSizes.map((item, idx) => {
                        const itemShort = Number(item.short) || 0;
                        const itemLong = Number(item.long) || 0;
                        const itemShortPrice = (item.priceShort && item.priceShort > 0) ? getEffectivePrice(item.priceShort) : effCustom;
                        const longSleeveDiff = effLongStandard > basePrice ? (effLongStandard - basePrice) : 0;
                        const itemLongPrice = (item.priceLong && item.priceLong > 0) ? getEffectivePrice(item.priceLong) : (itemShortPrice + longSleeveDiff);

                        if (itemShort <= 0 && itemLong <= 0) return null;

                        return (
                          <React.Fragment key={idx}>
                            {itemShort > 0 && (
                              <div className="bg-amber-50/70 p-2 rounded border border-amber-200">
                                <span className="text-amber-800 block text-[10px] font-bold">{item.name || 'Custom'} Pendek</span>
                                <strong className="text-amber-950 font-mono">{itemShort} pcs</strong> @ {formatRupiah(itemShortPrice)}
                                <p className="text-amber-900 font-bold font-mono mt-0.5">{formatRupiah(itemShort * itemShortPrice)}</p>
                              </div>
                            )}
                            {itemLong > 0 && (
                              <div className="bg-amber-100/70 p-2 rounded border border-amber-300">
                                <span className="text-amber-900 block text-[10px] font-bold">{item.name || 'Custom'} Panjang</span>
                                <strong className="text-amber-950 font-mono">{itemLong} pcs</strong> @ {formatRupiah(itemLongPrice)}
                                <p className="text-amber-950 font-bold font-mono mt-0.5">{formatRupiah(itemLong * itemLongPrice)}</p>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      customQtyTotal > 0 && (
                        <div className="bg-amber-50/60 p-2 rounded border border-amber-100">
                          <span className="text-amber-700 block text-[10px]">Ukuran Custom / Lain</span>
                          <strong className="text-amber-900 font-mono">{customQtyTotal} pcs</strong>
                          <p className="text-amber-800 font-bold font-mono mt-0.5">{formatRupiah(customSizesTotalPrice)}</p>
                        </div>
                      )
                    )}
                  </div>

                  {/* Grand Total */}
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm font-bold text-slate-800">
                    <div className="space-y-0.5">
                      <span className="text-xs text-slate-400 font-medium block">Total Pcs Garment</span>
                      <p className="text-base text-slate-800">{liveQty} pcs</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="text-xs text-slate-400 font-medium block">Grand Total Tagihan</span>
                      <p className="text-lg text-blue-700 font-mono font-extrabold">{formatRupiah(liveTotal)}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 my-2 pt-2"></div>

                {/* DP payment */}
                <h4 className="text-xs font-bold text-slate-600 block mb-1">Catatan Pembayaran Down Payment (Uang Muka)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">DP Dibayarkan (Rp)</label>
                    <input
                      type="number"
                      value={formData.dpAmount || ''}
                      onChange={(e) => setFormData({ ...formData, dpAmount: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-mono"
                      placeholder="Boleh diisi 0 jika hutang"
                      id="input-form-dp"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Metode Pembayaran DP</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 text-sm cursor-pointer"
                      id="select-form-dp-method"
                    >
                      <option value="CASH">CASH (Kasir Tunai)</option>
                      <option value="BANK_TRANSFER">Transfer Bank</option>
                      <option value="QRIS">QRIS Digital</option>
                      <option value="E_WALLET">E-Wallet</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">No. Referensi Pembayaran</label>
                    <input
                      type="text"
                      value={formData.paymentReference}
                      onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      placeholder="Kasir Tunai / No. Ref Transfer"
                      id="input-form-dp-ref"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Notes & Deadline */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                <h3 className="text-xs uppercase font-extrabold text-blue-700 tracking-wide">Catatan & Batas Waktu</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Batas Waktu (Deadline)*</label>
                    <input
                      type="date"
                      required
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm cursor-pointer"
                      id="input-form-deadline"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Catatan Tambahan Desain & Posisi Sablon</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-sm h-12"
                      placeholder="Tulis instruksi khusus detail sablon..."
                      id="input-form-notes"
                    />
                  </div>
                </div>
              </div>

              {/* Submits */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingOrder(null);
                  }}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-sm transition-all cursor-pointer"
                  id="btn-cancel-form"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-all cursor-pointer"
                  id="btn-save-form"
                >
                  {editingOrder ? 'Simpan Perubahan Transaksi' : 'Simpan Order & Terbitkan Invoice'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: Terima Pembayaran Langsung di Kasir */}
      {quickPayOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <h3 className="text-lg font-extrabold text-slate-800 mb-2">Terima Pembayaran Kasir</h3>
            <p className="text-xs text-slate-500 mb-4">Pencatatan uang masuk tunai atau transfer langsung untuk pelanggan: <strong>{quickPayOrder.customerName}</strong></p>
            
            <form onSubmit={handleQuickPaySubmit} className="space-y-4">
              <div className="bg-amber-50 text-amber-900 border border-amber-100 p-3 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span>Sisa Tagihan:</span>
                <span className="font-mono font-bold text-sm">{formatRupiah(quickPayOrder.remainingBalance)}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Jumlah Bayar (Rp)*</label>
                <input
                  type="number"
                  required
                  max={quickPayOrder.remainingBalance}
                  min="1"
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(Math.min(quickPayOrder.remainingBalance, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl font-mono font-bold text-slate-800 text-base focus:bg-white focus:outline-none focus:border-blue-500"
                  id="input-quickpay-amount"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Metode</label>
                  <select
                    value={quickPayMethod}
                    onChange={(e) => setQuickPayMethod(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                    id="select-quickpay-method"
                  >
                    <option value="CASH">CASH (Tunai)</option>
                    <option value="BANK_TRANSFER">Transfer Bank</option>
                    <option value="QRIS">QRIS</option>
                    <option value="E_WALLET">E-Wallet</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Keterangan / Ref</label>
                  <input
                    type="text"
                    value={quickPayRef}
                    onChange={(e) => setQuickPayRef(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700"
                    placeholder="Contoh: BCA Lunas"
                    id="input-quickpay-ref"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setQuickPayOrder(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 font-semibold text-xs hover:bg-slate-100"
                  id="btn-close-quickpay"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
                  id="btn-save-quickpay"
                >
                  Konfirmasi Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: Invoice Printable */}
      {selectedInvoice && (
        <InvoiceDetailModal
          order={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          settings={invoiceSettings}
        />
      )}

      {/* MODAL: Bagikan Link Pembayaran & Progress */}
      {shareOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 relative animate-fade-in">
            <button 
              onClick={() => setShareOrder(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 transition-colors rounded-lg"
              id="btn-close-share"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-lg font-extrabold text-slate-800 mb-2">Bagikan Link Pelanggan</h3>
            <p className="text-xs text-slate-500 mb-4">
              Kirimkan link ini kepada pelanggan agar mereka dapat memantau status produksi konveksi secara real-time dan melakukan pembayaran digital.
            </p>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Nama Pelanggan</span>
                <span className="font-bold text-slate-800">{shareOrder.customerName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Nomor Invoice</span>
                <span className="font-mono font-bold text-slate-800">{shareOrder.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Total Tagihan</span>
                <span className="font-mono font-extrabold text-blue-700">{formatRupiah(shareOrder.totalPrice)}</span>
              </div>
            </div>

            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-bold text-slate-500 block">Link Pembayaran & Progress</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getInvoiceLink(shareOrder)}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl font-mono text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                />
                <button
                  onClick={async () => {
                    const link = getInvoiceLink(shareOrder);
                    try {
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(link);
                        setShareLinkCopied(true);
                      } else {
                        const textArea = document.createElement("textarea");
                        textArea.value = link;
                        textArea.style.position = "fixed";
                        textArea.style.left = "-999999px";
                        textArea.style.top = "-999999px";
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        setShareLinkCopied(true);
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className={`px-4 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer ${
                    shareLinkCopied 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  id="btn-copy-share-modal"
                >
                  {shareLinkCopied ? <Check size={14} /> : <Copy size={14} />}
                  {shareLinkCopied ? 'Disalin' : 'Salin'}
                </button>
              </div>

              {/* Direct Open Portal Button */}
              <button
                type="button"
                onClick={() => {
                  const targetId = shareOrder.id || shareOrder.invoiceNumber;
                  const link = `?invoice=${encodeURIComponent(targetId)}`;
                  window.history.pushState({}, '', link);
                  window.dispatchEvent(new Event('popstate'));
                  setShareOrder(null);
                }}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                id="btn-open-portal-share-modal"
              >
                <ExternalLink size={14} />
                Buka Tampilan Portal Pelanggan Sekarang
              </button>
              <p className="text-[10px] text-slate-400">Klik di dalam kotak input di atas untuk memilih seluruh teks secara otomatis.</p>
            </div>

            {/* Kirim Langsung via WhatsApp */}
            <div className="bg-emerald-50 border border-emerald-100/60 p-4 rounded-2xl mb-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Kirim langsung via WhatsApp</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">{shareOrder.customerPhone || 'Tanpa No. HP'}</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Tekan tombol di bawah untuk membuka chat WhatsApp pelanggan secara otomatis dengan pesan rincian pesanan dan link progress terisi langsung.
              </p>
              {shareOrder.customerPhone ? (
                <a
                  href={getWhatsAppUrl(shareOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm text-center cursor-pointer active:scale-[0.98]"
                  id="btn-whatsapp-share-modal"
                >
                  <Phone size={14} />
                  Kirim ke WhatsApp Pelanggan
                </a>
              ) : (
                <div className="text-[11px] text-rose-600 font-medium">
                  ⚠️ No. HP pelanggan kosong atau belum diisi. Anda bisa menyalin link manual di atas untuk dikirimkan secara mandiri.
                </div>
              )}
            </div>

            {/* Localhost / Sandbox Warning */}
            <div className="bg-amber-50 border border-amber-100/60 p-4 rounded-2xl space-y-1.5">
              <h5 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                Informasi & Petunjuk Penting
              </h5>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Jika Anda membuka aplikasi ini dari <strong>localhost:3000</strong>, link di atas tidak dapat dibuka oleh HP pelanggan Anda. 
              </p>
              <p className="text-[11px] text-amber-700 leading-relaxed font-semibold">
                💡 Solusi: Untuk membagikan link ke pelanggan, silakan gunakan link publik aplikasi Anda dari menu Google AI Studio (Shared App URL atau Dev App URL yang berakhiran <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">.run.app</code>).
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-5 flex justify-end">
              <button
                onClick={() => setShareOrder(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                id="btn-close-share-modal-footer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pengaturan Invoice */}
      {showSettings && settingsDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative animate-fade-in my-8 max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 transition-colors rounded-lg z-10"
              id="btn-close-settings-modal"
            >
              <X size={18} />
            </button>

            <div className="mb-4">
              <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <Settings className="text-blue-600 animate-spin-slow" size={22} />
                Pengaturan Invoice & Usaha
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Kustomisasi rincian usaha, logo, kontak, rekening transfer bank, serta catatan kaki yang akan tercetak di invoice pelanggan.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 overflow-y-auto pr-2 flex-1 scrollbar-thin">
              {/* Seksi 1: Profil Usaha */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">PROFIL USAHA</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Nama Usaha*</label>
                    <input 
                      type="text" 
                      required
                      value={settingsDraft.businessName}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, businessName: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Slogan / Deskripsi Singkat</label>
                    <input 
                      type="text"
                      value={settingsDraft.slogan}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, slogan: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">No. WA / Telepon*</label>
                    <input 
                      type="text" 
                      required
                      value={settingsDraft.phone}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, phone: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Email Kontak</label>
                    <input 
                      type="email"
                      value={settingsDraft.email}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, email: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Urutan Invoice Terakhir</label>
                    <input 
                      type="number"
                      min={0}
                      value={settingsDraft.lastInvoiceSequence ?? 3}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, lastInvoiceSequence: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                      placeholder="e.g. 3"
                    />
                  </div>
                </div>

                {/* Banner & Tombol Urutkan Ulang Invoice */}
                <div className="bg-blue-50/80 p-3.5 rounded-2xl border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-extrabold text-blue-950 block">Rapikan & Urutkan Ulang Semua No. Invoice Transaksi</span>
                    <p className="text-[11px] text-blue-800/80 leading-snug">
                      Mengubah semua nomor invoice transaksi yang ada menjadi berurutan tanpa jeda atau ganda (0001, 0002, 0003...) berdasarkan tanggal pembuatan tertua.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResequenceAllOrders(false)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all shrink-0 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <ListOrdered size={14} />
                    <span>Urutkan Ulang Sekarang</span>
                  </button>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">Logo Usaha / Brand</label>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Preview Box */}
                    <div className="md:col-span-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl p-3 h-28 relative shadow-sm">
                      {settingsDraft.logoUrl ? (
                        <>
                          <img 
                            src={settingsDraft.logoUrl} 
                            alt="Logo Usaha" 
                            className="max-h-20 max-w-full object-contain rounded-lg"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setSettingsDraft({ ...settingsDraft, logoUrl: '' })}
                            className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow transition-all cursor-pointer"
                            title="Hapus Logo"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <div className="text-center text-[10px] text-slate-400 font-semibold">
                          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-1 border border-slate-100">
                            <Upload size={14} className="text-slate-400" />
                          </div>
                          Default Logo
                        </div>
                      )}
                    </div>

                    {/* Upload Dropzone */}
                    <div className="md:col-span-3">
                      <div 
                        onDragOver={handleLogoDragOver}
                        onDragLeave={handleLogoDragLeave}
                        onDrop={handleLogoDrop}
                        className={`border-2 border-dashed rounded-2xl h-28 flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer relative ${
                          isDraggingLogo 
                            ? 'border-blue-500 bg-blue-50/50' 
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleLogoUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload size={20} className="text-slate-400 mb-1.5 animate-bounce-slow" />
                        <p className="text-xs font-bold text-slate-700">Pilih atau Seret Foto Logo</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Mendukung PNG, JPG, JPEG, GIF. Maksimal 2MB.</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Optional: Text Input for external URL */}
                  <div className="mt-2.5">
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">ATAU GUNAKAN URL LOGO EKSTERNAL</label>
                    <input 
                      type="text"
                      placeholder="https://contoh.com/logo.png (Biarkan kosong jika sudah mengunggah dari perangkat)"
                      value={settingsDraft.logoUrl.startsWith('data:') ? '' : settingsDraft.logoUrl}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, logoUrl: e.target.value })}
                      className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Alamat Usaha*</label>
                  <textarea 
                    required
                    rows={2}
                    value={settingsDraft.address}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, address: e.target.value })}
                    className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Seksi 2: Rekening Pembayaran & QRIS */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex justify-between items-center">
                  <span>METODE PEMBAYARAN & REKENING BANK</span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded normal-case font-bold">
                    {settingsDraft.bankAccounts.length} Rekening Terdaftar
                  </span>
                </h4>

                {/* Seksi Upload Foto Barcode QRIS */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-slate-800 block">Foto / Image Barcode QRIS</span>
                      <p className="text-[10px] text-slate-500">Unggah gambar barcode QRIS usaha Anda untuk dipindai langsung oleh pelanggan di portal invoice online.</p>
                    </div>
                    {settingsDraft.qrisUrl && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                        QRIS Aktif
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Preview Box QRIS */}
                    <div className="md:col-span-1 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-2.5 h-32 relative shadow-sm">
                      {settingsDraft.qrisUrl ? (
                        <>
                          <img 
                            src={settingsDraft.qrisUrl} 
                            alt="Barcode QRIS" 
                            className="max-h-24 max-w-full object-contain rounded-lg"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setSettingsDraft({ ...settingsDraft, qrisUrl: '' })}
                            className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow transition-all cursor-pointer"
                            title="Hapus QRIS"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <div className="text-center text-[10px] text-slate-400 font-semibold p-1">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mx-auto mb-1 border border-slate-200">
                            <Upload size={14} className="text-slate-400" />
                          </div>
                          Belum ada foto QRIS
                        </div>
                      )}
                    </div>

                    {/* Dropzone Upload QRIS */}
                    <div className="md:col-span-3">
                      <div 
                        onDragOver={handleQrisDragOver}
                        onDragLeave={handleQrisDragLeave}
                        onDrop={handleQrisDrop}
                        className={`border-2 border-dashed rounded-2xl h-32 flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer relative ${
                          isDraggingQris 
                            ? 'border-blue-500 bg-blue-50/50' 
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleQrisUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload size={20} className="text-blue-600 mb-1 animate-bounce-slow" />
                        <p className="text-xs font-bold text-slate-700">Pilih atau Seret Foto Barcode QRIS</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Format PNG, JPG, JPEG. Maksimal 2MB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">ATAU INPUT LINK / URL GAMBAR QRIS</label>
                    <input 
                      type="text"
                      placeholder="https://contoh.com/qris-me.png (Atau upload file foto di atas)"
                      value={settingsDraft.qrisUrl && settingsDraft.qrisUrl.startsWith('data:') ? '' : (settingsDraft.qrisUrl || '')}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, qrisUrl: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 placeholder:text-slate-300"
                    />
                  </div>
                </div>

                {/* List Rekening */}
                {settingsDraft.bankAccounts.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {settingsDraft.bankAccounts.map((account, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm text-xs">
                        <div className="space-y-0.5 text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-800">{account.bankName}</span>
                            {account.isVA && (
                              <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                                Virtual Account
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-slate-600">No. Rek: <strong className="text-slate-900 font-bold">{account.accountNumber}</strong></p>
                          <p className="text-slate-500 text-[10px]">Atas Nama: <strong className="text-slate-700">{account.accountHolder}</strong></p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteBankAccount(index)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors rounded-lg"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white py-4 text-center rounded-xl border border-slate-200/50 text-xs text-slate-400">
                    Belum ada rekening terdaftar. Silakan tambahkan rekening baru di bawah.
                  </div>
                )}

                {/* Form Tambah Rekening */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
                  <span className="text-[10px] font-extrabold text-slate-500 block uppercase text-left">Tambah Rekening Baru</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <input 
                        type="text" 
                        placeholder="Nama Bank (e.g. BCA, Mandiri)"
                        value={newBankName}
                        onChange={(e) => setNewBankName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <input 
                        type="text" 
                        placeholder="Nomor Rekening / HP"
                        value={newBankNumber}
                        onChange={(e) => setNewBankNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <input 
                        type="text" 
                        placeholder="Nama Pemilik Rekening"
                        value={newBankHolder}
                        onChange={(e) => setNewBankHolder(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600 select-none">
                      <input 
                        type="checkbox"
                        checked={newBankIsVA}
                        onChange={(e) => setNewBankIsVA(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Metode ini adalah Virtual Account (VA)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddBankAccount}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus size={13} />
                      Tambahkan
                    </button>
                  </div>
                </div>
              </div>

              {/* Seksi 3: Catatan Kaki / Footer Invoice */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider text-left">CATATAN KAKI / KLAUSUL INVOICE</h4>
                <div>
                  <textarea 
                    rows={2}
                    value={settingsDraft.additionalNotes || ''}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, additionalNotes: e.target.value })}
                    className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Contoh: Invoice ini merupakan dokumen digital resmi yang sah..."
                  />
                </div>
              </div>

              {/* Seksi 4: Keamanan & PIN Kasir */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80 space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider text-left flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-blue-600" />
                    KEAMANAN & PIN KASIR
                  </span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                    PIN Utama
                  </span>
                </h4>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1 text-left">
                    PIN Akses Kasir (4 - 6 Angka)*
                  </label>
                  <div className="relative max-w-xs">
                    <input 
                      type={showPinInSettings ? "text" : "password"}
                      required
                      maxLength={6}
                      value={settingsDraft.adminPin || '1234'}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setSettingsDraft({ ...settingsDraft, adminPin: val });
                      }}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 tracking-widest"
                      placeholder="1234"
                      id="input-settings-pin"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinInSettings(!showPinInSettings)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPinInSettings ? "Sembunyikan PIN" : "Tampilkan PIN"}
                      id="btn-toggle-settings-pin"
                    >
                      {showPinInSettings ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed text-left">
                    PIN ini mengamankan dashboard kasir sehingga jika pelanggan menghapus parameter tautan invoice, mereka akan terhalang layar PIN ini dan tidak bisa mengakses data toko. (PIN Default: <strong>1234</strong>)
                  </p>
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 font-semibold text-xs hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={settingsLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {settingsLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Simpan Pengaturan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Management Data Pelanggan */}
      {showCustomersModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/30 rounded-xl border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Users size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">Database & Direktori Pelanggan</h2>
                  <p className="text-xs text-slate-400">Kelola informasi pemesan, alamat pengiriman, dan riwayat pesanan.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCustomer(null);
                    setCustFormData({ name: '', phone: '', email: '', address: '', notes: '' });
                    setShowAddCustomerModal(true);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  id="btn-add-customer-top"
                >
                  <UserPlus size={15} />
                  <span>Tambah Pelanggan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomersModal(false)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  id="btn-close-customers-modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Search & Stats Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="Cari nama, No. WA, email, alamat..."
                  className="w-full bg-white border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  id="input-search-customers"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-xs text-slate-500 font-semibold">
                  Total Pelanggan: <span className="font-extrabold text-blue-700">{customers.length}</span>
                </div>
                <div className="text-xs text-slate-500 font-semibold">
                  Total Order: <span className="font-extrabold text-emerald-700">{orders.length}</span>
                </div>
              </div>
            </div>

            {/* Customers Content / Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const filteredCust = customers.filter((c) => {
                  const q = customerSearchQuery.toLowerCase();
                  return (
                    c.name.toLowerCase().includes(q) ||
                    (c.phone && c.phone.toLowerCase().includes(q)) ||
                    (c.email && c.email.toLowerCase().includes(q)) ||
                    (c.address && c.address.toLowerCase().includes(q)) ||
                    (c.notes && c.notes.toLowerCase().includes(q))
                  );
                });

                if (filteredCust.length === 0) {
                  return (
                    <div className="py-16 text-center space-y-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                        <Users size={32} />
                      </div>
                      <h3 className="text-sm font-bold text-slate-700">Data Pelanggan Tidak Ditemukan</h3>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        {customerSearchQuery ? 'Tidak ada pelanggan yang cocok dengan pencarian Anda.' : 'Belum ada data pelanggan tersimpan di database.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomer(null);
                          setCustFormData({ name: '', phone: '', email: '', address: '', notes: '' });
                          setShowAddCustomerModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus size={14} />
                        Tambah Pelanggan Baru
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCust.map((cust) => {
                      const custOrders = orders.filter((o) => 
                        (o.customerPhone && cust.phone && o.customerPhone.replace(/\D/g, '') === cust.phone.replace(/\D/g, '')) ||
                        (o.customerName && o.customerName.toLowerCase() === cust.name.toLowerCase())
                      );
                      const totalSpent = custOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
                      const cleanPhone = cust.phone ? cust.phone.replace(/\D/g, '') : '';
                      const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

                      return (
                        <div key={cust.id} className="bg-white rounded-2xl border border-slate-200/80 hover:border-blue-300 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group">
                          
                          {/* Card Top */}
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold rounded-xl flex items-center justify-center text-lg shadow-md shadow-blue-500/20 shrink-0">
                                  {cust.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-extrabold text-slate-900 text-sm truncate group-hover:text-blue-600 transition-colors">
                                    {cust.name}
                                  </h3>
                                  {cust.notes && (
                                    <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-full">
                                      {cust.notes}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                              {cust.phone ? (
                                <a
                                  href={`https://wa.me/${waPhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 hover:text-emerald-600 font-semibold transition-colors group/wa"
                                >
                                  <MessageSquare size={14} className="text-emerald-500 shrink-0" />
                                  <span className="truncate">{cust.phone}</span>
                                  <ExternalLink size={10} className="opacity-0 group-hover/wa:opacity-100 transition-opacity" />
                                </a>
                              ) : (
                                <div className="flex items-center gap-2 text-slate-400">
                                  <Phone size={14} className="shrink-0" />
                                  <span>Tidak ada nomor HP</span>
                                </div>
                              )}

                              {cust.email && (
                                <div className="flex items-center gap-2 text-slate-600">
                                  <FileText size={14} className="text-slate-400 shrink-0" />
                                  <span className="truncate">{cust.email}</span>
                                </div>
                              )}

                              {cust.address && (
                                <div className="flex items-start gap-2 text-slate-500 pt-0.5">
                                  <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                  <span className="line-clamp-2 text-[11px] leading-relaxed">{cust.address}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Bottom */}
                          <div className="space-y-3 pt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">Riwayat Order</span>
                                <span className="font-extrabold text-slate-800">{custOrders.length} Pesanan</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Omset</span>
                                <span className="font-mono font-extrabold text-blue-600">{formatRupiah(totalSpent)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => selectCustomerForOrder(cust)}
                                className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm active:scale-95"
                              >
                                <Plus size={13} />
                                <span>Buat Order</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCustomer(cust);
                                  setCustFormData({
                                    name: cust.name || '',
                                    phone: cust.phone || '',
                                    email: cust.email || '',
                                    address: cust.address || '',
                                    notes: cust.notes || ''
                                  });
                                  setShowAddCustomerModal(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-colors cursor-pointer"
                                title="Edit Pelanggan"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(cust.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Pelanggan"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* Sub-Modal Form Tambah / Edit Pelanggan */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserCheck size={18} className="text-blue-400" />
                <h3 className="font-extrabold text-sm">
                  {editingCustomer ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setEditingCustomer(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Nama Lengkap / Instansi*</label>
                <input
                  type="text"
                  required
                  value={custFormData.name}
                  onChange={(e) => setCustFormData({ ...custFormData, name: e.target.value })}
                  placeholder="Contoh: Suryadi (BEM UI Depok)"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  id="input-cust-name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">No. WhatsApp / HP</label>
                  <input
                    type="tel"
                    value={custFormData.phone}
                    onChange={(e) => setCustFormData({ ...custFormData, phone: e.target.value })}
                    placeholder="Contoh: 081234567890"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                    id="input-cust-phone"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Email</label>
                  <input
                    type="email"
                    value={custFormData.email}
                    onChange={(e) => setCustFormData({ ...custFormData, email: e.target.value })}
                    placeholder="suryadi@domain.com"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                    id="input-cust-email"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Alamat Lengkap Pengiriman</label>
                <textarea
                  rows={2}
                  value={custFormData.address}
                  onChange={(e) => setCustFormData({ ...custFormData, address: e.target.value })}
                  placeholder="Gedung Pusgiwa UI Depok, Jawa Barat"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                  id="input-cust-address"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Catatan Khusus Pelanggan</label>
                <input
                  type="text"
                  value={custFormData.notes}
                  onChange={(e) => setCustFormData({ ...custFormData, notes: e.target.value })}
                  placeholder="Contoh: Pelanggan BEM UI, Diskon Khusus 5%"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  id="input-cust-notes"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-500 font-semibold text-xs hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Catat Transaksi Financial */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Catat Transaksi Finance</h3>
                  <p className="text-xs text-slate-400">Pilih divisi dan sync otomatis ke Aplikasi Finance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTransactionModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
              {txSuccessMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{txSuccessMessage}</span>
                </div>
              )}

              {/* Pilihan Divisi */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Pilih Divisi Tujuan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTxDivision('Konveksi')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      txDivision === 'Konveksi'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🧵 Konveksi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTxDivision('Sablon')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      txDivision === 'Sablon'
                        ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🎨 Sablon</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTxDivision('Asesoris')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      txDivision === 'Asesoris'
                        ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏷️ Asesoris</span>
                  </button>
                </div>
              </div>

              {/* Jenis Transaksi & Pembayaran */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Tipe Transaksi</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setTxType('Pemasukan')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        txType === 'Pemasukan'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pemasukan
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType('Pengeluaran')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        txType === 'Pengeluaran'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pengeluaran
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Jenis Pembayaran</label>
                  <select
                    value={txPaymentType}
                    onChange={(e) => setTxPaymentType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="DP">DP (Uang Muka)</option>
                    <option value="Pelunasan">Pelunasan</option>
                    <option value="Lainnya">Lainnya / Umum</option>
                  </select>
                </div>
              </div>

              {/* Nominal & Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Nominal (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={txAmount || ''}
                    onChange={(e) => setTxAmount(Number(e.target.value))}
                    placeholder="Contoh: 500000"
                    required
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Tanggal Transaksi</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* No. Invoice (Opsional) */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">No. Invoice (Opsional)</label>
                <input
                  type="text"
                  value={txInvoiceNumber}
                  onChange={(e) => setTxInvoiceNumber(e.target.value)}
                  placeholder="Contoh: INV-2026-001"
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Deskripsi / Keterangan */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Keterangan / Detail Transaksi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="Contoh: DP Kaos BEM UI 100pcs - Transfer BCA"
                  required
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransactionModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTx}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check size={16} />
                  {isSubmittingTx ? 'Menyimpan & Syncing...' : 'Simpan & Sync Ke Finance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      </main>
    </div>
  );
}
