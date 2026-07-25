import React, { useState, useEffect } from 'react';
import { Sparkles, HelpCircle } from 'lucide-react';
import CashierDashboard from './components/CashierDashboard';
import CustomerPaymentPortal from './components/CustomerPaymentPortal';

export default function App() {
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  // Parse URL parameter to detect customer payment link
  useEffect(() => {
    const handleUrlParsing = () => {
      let id: string | null = null;
      // 1. Check search query parameters ?invoice=... or ?id=... or ?inv=... or ?q=...
      const searchParams = new URLSearchParams(window.location.search);
      id = searchParams.get('invoice') || searchParams.get('id') || searchParams.get('inv') || searchParams.get('q');

      // 2. Check path parameter e.g. /invoice/ord-123 or /pay/ord-123 or /ord-123
      if (!id) {
        const pathname = window.location.pathname;
        if (pathname && pathname !== '/') {
          const parts = pathname.split('/').filter(Boolean);
          if (parts.length > 0) {
            if (parts[0] === 'invoice' || parts[0] === 'pay' || parts[0] === 'order') {
              id = parts.slice(1).join('/');
            } else if (parts[0].startsWith('ord-') || parts[0].startsWith('INV')) {
              id = parts.join('/');
            }
          }
        }
      }

      // 3. Fallback check hash parameters #invoice=... or #/invoice/...
      if (!id && window.location.hash) {
        const hashStr = window.location.hash.replace(/^#\/?/, '');
        const hashParams = new URLSearchParams(hashStr.includes('?') ? hashStr.split('?')[1] : hashStr);
        id = hashParams.get('invoice') || hashParams.get('id') || hashParams.get('inv');
        
        // Direct route e.g. #INV-2026-0001 or #ord-123
        if (!id && hashStr && !hashStr.includes('=')) {
          id = hashStr;
        }
      }

      if (id) {
        try {
          id = decodeURIComponent(id).trim().replace(/^\/+|\/+$/g, '');
        } catch {
          id = id.trim().replace(/^\/+|\/+$/g, '');
        }
      }

      setInvoiceId(id || null);
    };

    handleUrlParsing();

    window.addEventListener('popstate', handleUrlParsing);
    window.addEventListener('hashchange', handleUrlParsing);
    return () => {
      window.removeEventListener('popstate', handleUrlParsing);
      window.removeEventListener('hashchange', handleUrlParsing);
    };
  }, []);

  // Back to cashier action
  const handleBackToCashier = () => {
    // Clear search query param cleanly without reloading page
    const newUrl = window.location.origin + window.location.pathname;
    window.history.pushState({}, '', newUrl);
    setInvoiceId(null);
  };

  const handlePaymentSuccess = () => {
    console.log('Payment updated successfully');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {invoiceId ? (
        <CustomerPaymentPortal 
          invoiceId={invoiceId} 
          onPaymentSuccess={handlePaymentSuccess}
          onBackToCashier={handleBackToCashier}
        />
      ) : (
        <CashierDashboard />
      )}
      
      {/* Subtle branding footer */}
      <footer className="py-6 border-t border-slate-100 bg-white text-center text-xs text-slate-400 print:hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Mahya Apparel Konveksi. Sistem Kasir & Invoice Terintegrasi.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-blue-600 font-semibold transition-colors">Panduan Sistem</a>
            <a href="#" className="hover:text-blue-600 font-semibold transition-colors font-mono">v1.1.0-STABLE</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
