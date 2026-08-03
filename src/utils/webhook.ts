import { saveTransactionToFirestore } from '../services/firestoreService';

export interface InvoicePaymentWebhookPayload {
  date: string;
  division: string;
  type: string;
  amount: number;
  description: string;
  invoiceNumber: string;
  paymentType: 'DP' | 'Pelunasan';
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
  invoiceNumber: string;
  customerName: string;
  paymentType: string;
  isFullOrSettled?: boolean;
}) => {
  if (!params.amount || params.amount <= 0) return;

  const formattedDate = params.date 
    ? params.date.split('T')[0]
    : new Date().toISOString().split('T')[0];

  const cleanInvNum = params.invoiceNumber ? params.invoiceNumber.replace(/^#/, '') : 'INV';
  const cleanCustomerName = params.customerName ? params.customerName.trim() : 'Pelanggan';
  const payType = normalizePaymentType(params.paymentType, params.isFullOrSettled);

  const payload: InvoicePaymentWebhookPayload = {
    date: formattedDate,
    division: 'Sablon',
    type: 'Pemasukan',
    amount: params.amount,
    description: `${payType} Invoice #${cleanInvNum} - ${cleanCustomerName}`,
    invoiceNumber: cleanInvNum,
    paymentType: payType
  };

  // 1. Direct real-time save to Firestore 'transactions' collection
  try {
    const txId = `tx-${cleanInvNum.replace(/[^a-zA-Z0-9]/g, '-')}-${payType.toLowerCase()}-${Date.now()}`;
    await saveTransactionToFirestore({
      id: txId,
      date: formattedDate,
      division: 'Sablon',
      type: 'Pemasukan',
      amount: params.amount,
      description: payload.description,
      invoiceNumber: cleanInvNum,
      paymentType: payType
    });
  } catch (err) {
    console.warn("Direct Firestore transaction save warning:", err);
  }

  // 2. Also dispatch to webhook proxy
  try {
    console.log('Sending invoice payment webhook:', payload);
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

