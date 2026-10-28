import { saveTransactionToFirestore } from '../services/firestoreService';

export interface InvoicePaymentWebhookPayload {
  date: string;
  division: string;
  type: string;
  amount: number;
  description: string;
  invoiceNumber: string;
  paymentType: 'DP' | 'Pelunasan';
  action?: 'create' | 'update';
  isUpdate?: boolean;
  transactionId?: string;
}

export const WEBHOOK_URL = 'https://ais-dev-uuxmczdtyyiw62zeoagtzh-1058766488006.asia-southeast1.run.app/api/webhooks/invoice-payment';

export const normalizePaymentType = (type: string, isFullOrSettled?: boolean): 'DP' | 'Pelunasan' => {
  const upper = (type || '').toUpperCase();
  if (upper === 'PELUNASAN' || upper === 'FULL' || upper === 'LUNAS' || isFullOrSettled) {
    return 'Pelunasan';
  }
  return 'DP';
};

export const sendInvoicePaymentWebhook = async (params: {
  date?: string;
  amount: number;
  invoiceNumber?: string;
  customerName?: string;
  paymentType?: string;
  isFullOrSettled?: boolean;
  division?: string;
  type?: string;
  description?: string;
  txSequence?: number;
  action?: 'create' | 'update';
  isUpdate?: boolean;
  txId?: string;
}) => {
  if (!params.amount || params.amount <= 0) return;

  const formattedDate = params.date 
    ? params.date.split('T')[0]
    : new Date().toISOString().split('T')[0];

  let cleanInvNum = params.invoiceNumber ? params.invoiceNumber.replace(/^#/, '') : 'INV';
  if (params.txSequence && params.txSequence > 1 && !cleanInvNum.includes('#')) {
    cleanInvNum = `${cleanInvNum}#${params.txSequence}`;
  }

  const cleanCustomerName = params.customerName ? params.customerName.trim() : 'Pelanggan';
  const payType = normalizePaymentType(params.paymentType || 'DP', params.isFullOrSettled);
  const division = params.division || 'Konveksi';
  const txType = params.type || 'Pemasukan';
  const description = params.description || `${payType} Invoice #${cleanInvNum} - ${cleanCustomerName}`;
  const isUpdate = Boolean(params.isUpdate || params.action === 'update');
  const action: 'create' | 'update' = isUpdate ? 'update' : 'create';

  // Use a deterministic canonical ID so repeat updates update the exact same document rather than creating duplicates
  const canonicalId = `tx-${cleanInvNum.replace(/[^a-zA-Z0-9]/g, '-')}-${payType.toLowerCase()}`;
  const finalTxId = params.txId || canonicalId;

  const payload: InvoicePaymentWebhookPayload = {
    date: formattedDate,
    division,
    type: txType,
    amount: params.amount,
    description,
    invoiceNumber: cleanInvNum,
    paymentType: payType,
    action,
    isUpdate,
    transactionId: finalTxId
  };

  // 1. Direct real-time save or update to Firestore 'transactions' collection
  try {
    await saveTransactionToFirestore({
      id: finalTxId,
      date: formattedDate,
      division,
      type: txType as any,
      amount: params.amount,
      description,
      invoiceNumber: cleanInvNum,
      paymentType: payType
    });
  } catch (err) {
    console.warn("Direct Firestore transaction save warning:", err);
  }

  // 2. Also dispatch to webhook proxy
  try {
    console.log(`Sending invoice payment webhook [${action.toUpperCase()}]:`, payload);
    const response = await fetch('/api/webhook-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn('Webhook proxy response status:', response.status);
    } else {
      console.log('Invoice payment webhook sent successfully via proxy.');
    }
  } catch (error) {
    console.error('Error sending invoice payment webhook:', error);
  }
};

