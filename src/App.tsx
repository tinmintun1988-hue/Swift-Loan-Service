import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  LayoutDashboard, Users, CircleDollarSign, History, 
  FileText, Settings as SettingsIcon, Plus, Search, 
  Pencil, Trash2, ArrowUpRight, ArrowDownLeft, 
  Download, Globe, Lock, X, Menu, Share2, Sun, Moon,
  Database, FileUp, FileDown, Cloud, LogIn, LogOut, CheckCircle2, ShieldAlert, Smartphone, ShieldCheck,
  Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useData } from './hooks/useData';
import { translations } from './constants';
import { CustomerStats } from './types';

export default function App() {
  const { 
    user, isLoading: isAuthLoading, login, logout,
    customers, loans, settings, setSettings, 
    addCustomer, updateCustomer, deleteCustomer,
    addLoan, updateLoan, deleteLoan, importData 
  } = useData();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'customer' | 'loan' | 'pin' | 'customerDetail'>('customer');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinForm, setPinForm] = useState({ current: '', next: '', confirm: '' });
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNextPin, setShowNextPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [showModalPin, setShowModalPin] = useState(false);
  const [pinUpdateStatus, setPinUpdateStatus] = useState({ error: '', success: '' });
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSharingPDF, setIsSharingPDF] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings);
  const [toast, setToast] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInIframe, setIsInIframe] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Check for iframe
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  const copyAppUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setToast('App URL copied ✓');
  };

  // PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Network Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Apply theme
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Reset PIN visibility when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setShowModalPin(false);
      setShowCurrentPin(false);
      setShowNextPin(false);
      setShowConfirmPin(false);
    }
  }, [isModalOpen]);

  // Sync tempSettings when settings change or tab changes
  useEffect(() => {
    if (activeTab === 'settings') {
      setTempSettings(settings);
    }
  }, [activeTab, settings]);

  const t = (key: keyof typeof translations['en']) => {
    return translations[settings.lang][key] || translations['en'][key] || key;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(val);
  };

  const stats = useMemo(() => {
    const totalLoaned = loans.reduce((acc, l) => acc + Number(l.loanAmount || 0), 0);
    const totalRepaid = loans.reduce((acc, l) => acc + Number(l.repayAmount || 0), 0);
    const totalInterest = Math.round((totalLoaned * settings.interestRate) / 100);
    const outstanding = totalLoaned - totalRepaid;
    const repayRate = totalLoaned > 0 ? Math.round((totalRepaid / totalLoaned) * 100) : 0;
    return { totalLoaned, totalRepaid, outstanding, repayRate, totalInterest };
  }, [loans, settings.interestRate]);

  const getCustomerStats = (cid: number): CustomerStats => {
    const cLoans = loans.filter(l => l.customerId === cid);
    const totalLoaned = cLoans.reduce((s, l) => s + Number(l.loanAmount || 0), 0);
    const totalRepaid = cLoans.reduce((s, l) => s + Number(l.repayAmount || 0), 0);
    return {
      totalLoaned,
      totalRepaid,
      outstanding: totalLoaned - totalRepaid,
      rate: totalLoaned > 0 ? Math.round((totalRepaid / totalLoaned) * 100) : 0,
      loans: cLoans
    };
  };

  const getRiskLevel = (cid: number) => {
    const { outstanding, rate, totalLoaned } = getCustomerStats(cid);
    if (totalLoaned === 0) return { level: 'NEW', cls: 'bg-blue-100 text-blue-700' };
    if (outstanding <= 0) return { level: 'EXCELLENT', cls: 'bg-green-100 text-green-700' };
    if (rate >= 80) return { level: 'LOW', cls: 'bg-green-100 text-green-700' };
    if (rate >= 50) return { level: 'MEDIUM', cls: 'bg-orange-100 text-orange-700' };
    return { level: 'HIGH', cls: 'bg-red-100 text-red-700' };
  };

  const handlePinSubmit = (val: string) => {
    if (val === settings.pin) {
      if (editingItem?.action === 'deleteCustomer') deleteCustomer(editingItem.id);
      if (editingItem?.action === 'deleteLoan') deleteLoan(editingItem.id);
      if (editingItem?.action === 'editCustomer') {
        setModalType('customer');
        setEditingItem(customers.find(c => c.id === editingItem.id));
        setIsModalOpen(true);
        return;
      }
      if (editingItem?.action === 'editLoan') {
        setModalType('loan');
        setEditingItem(loans.find(l => l.id === editingItem.id));
        setIsModalOpen(true);
        return;
      }
      if (editingItem?.action === 'saveSettings') {
        setSettings(tempSettings);
        setIsModalOpen(false);
        setEditingItem(null);
        setPinInput('');
        return;
      }
      if (editingItem?.action === 'exportData') {
        handleExportData();
        setIsModalOpen(false);
        setEditingItem(null);
        setPinInput('');
        return;
      }
      if (editingItem?.action === 'importData') {
        setIsModalOpen(false);
        setEditingItem(null);
        setPinInput('');
        document.getElementById('database-import')?.click();
        return;
      }
      if (editingItem?.action === 'uploadQr') {
        setIsModalOpen(false);
        setEditingItem(null);
        setPinInput('');
        setTimeout(() => {
          document.getElementById('qr-upload')?.click();
        }, 300);
        return;
      }
      if (editingItem?.action === 'removeQr') {
        const newSettings = { ...settings, qrImage: '' };
        setTempSettings(newSettings);
        setSettings(newSettings);
        setIsModalOpen(false);
        setEditingItem(null);
        setPinInput('');
        setToast('QR Image removed');
        return;
      }
      if (editingItem?.action === 'uploadLogo') {
        setIsModalOpen(false);
        setEditingItem(null);
        setPinInput('');
        setTimeout(() => {
          document.getElementById('logo-upload')?.click();
        }, 300);
        return;
      }
      if (editingItem?.action === 'removeLogo') {
        const newSettings = { ...settings, logoImage: '' };
        setTempSettings(newSettings);
        setSettings(newSettings);
        setIsModalOpen(false);
        setEditingItem(null);
        setPinInput('');
        setToast('Logo removed');
        return;
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setPinInput('');
      setPinError('');
    } else {
      setPinError(t('pinWrong'));
      setPinInput('');
    }
  };

  const openPinModal = (item: any) => {
    setEditingItem(item);
    setModalType('pin');
    setPinInput('');
    setPinError('');
    setIsModalOpen(true);
  };

  const handleUpdatePin = () => {
    setPinUpdateStatus({ error: '', success: '' });
    
    if (pinForm.current !== settings.pin) {
      setPinUpdateStatus({ error: t('pinWrongCurrent'), success: '' });
      return;
    }
    
    if (pinForm.next.length !== 6 || !/^\d+$/.test(pinForm.next)) {
      setPinUpdateStatus({ error: t('pinFormat'), success: '' });
      return;
    }
    
    if (pinForm.next !== pinForm.confirm) {
      setPinUpdateStatus({ error: t('pinMismatch'), success: '' });
      return;
    }
    
    setSettings({ ...settings, pin: pinForm.next });
    setPinUpdateStatus({ error: '', success: t('pinUpdated') });
    setPinForm({ current: '', next: '', confirm: '' });
  };

  const handleExportData = () => {
    const data = { customers, loans, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sls_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast('Backup file exported!');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.customers && data.loans && data.settings) {
          importData(data);
          setToast(t('restoreSuccess'));
        } else {
          setToast(t('restoreError'));
        }
      } catch (err) {
        setToast(t('restoreError'));
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const element = invoiceRef.current;
      const captureWidth = 800; // Standard width for HQ PDF
      
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: captureWidth,
        height: element.scrollHeight, // Use scrollHeight to get the full height
        windowWidth: captureWidth,   // Force the window width for responsive styles
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById('invoice-capture-area');
          if (clonedElement) {
            clonedElement.style.width = `${captureWidth}px`;
            clonedElement.style.padding = '0'; // Reset padding for consistency
          }
        }
      });
      const imgData = canvas.toDataURL('image/png');
      
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight]);
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      const customer = customers.find(c => c.id === Number(selectedInvoiceId));
      const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      const fileName = customer ? `Invoice-${customer.name}-${dateStr}.pdf` : `Invoice-SL-${dateStr}.pdf`;
      
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF Generation failed', error);
      // Fallback to print if library fails
      window.print();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSharePDF = async () => {
    if (!invoiceRef.current) return;
    setIsSharingPDF(true);
    try {
      const element = invoiceRef.current;
      const captureWidth = 800;
      
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: captureWidth,
        height: element.scrollHeight,
        windowWidth: captureWidth,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById('invoice-capture-area');
          if (clonedElement) {
            clonedElement.style.width = `${captureWidth}px`;
            clonedElement.style.padding = '0';
          }
        }
      });
      const imgData = canvas.toDataURL('image/png');
      
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight]);
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      const customer = customers.find(c => c.id === Number(selectedInvoiceId));
      const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      const fileName = customer ? `Invoice-${customer.name}-${dateStr}.pdf` : `Invoice-SL-${dateStr}.pdf`;
      
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Loan Invoice',
          text: 'Here is your loan invoice.'
        });
      } else {
        // Fallback: Download
        pdf.save(fileName);
        alert('Sharing not supported on this browser. File has been downloaded instead.');
      }
    } catch (error) {
      console.error('PDF Sharing failed', error);
      window.print();
    } finally {
      setIsSharingPDF(false);
    }
  };

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { id: 'loans', icon: CircleDollarSign, label: t('loans') },
    { id: 'transactions', icon: History, label: t('transactions') },
    { id: 'customers', icon: Users, label: t('customers') },
    { id: 'invoice', icon: FileText, label: t('invoice') },
    { id: 'settings', icon: SettingsIcon, label: t('settings') },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden p-1">
            <img 
              src={settings.logoImage || "https://i.ibb.co/v4m8vYm/logo-loan.png"} 
              alt="Swift Loan Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-[#1D9E75] tracking-tight text-[15px] leading-none">Swift Loan Service</span>
            <span className="text-[10px] text-[#0066B2] font-medium leading-tight mt-0.5">အမြန်ချေး ငွေဝန်ဆောင်မှု</span>
          </div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden absolute top-6 right-6 text-text-muted">
          <X size={24} />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setIsMobileMenuOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all rounded-lg",
              activeTab === item.id 
                ? "bg-primary-light dark:bg-primary/10 text-primary" 
                : "text-text-muted hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-text-main"
            )}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 mt-auto">
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-border-main/50 dark:border-slate-700/50 overflow-hidden">
          {user ? (
            <>
              <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-white shadow-sm" />
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-text-main truncate">{user.displayName}</p>
                <p className="text-[10px] text-text-muted truncate">{user.email}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shrink-0">
                L
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-text-main truncate">Guest User</p>
                <p className="text-[10px] text-text-muted">{t('offline')}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-bg-main">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 bg-white dark:bg-slate-900 border-r border-border-main dark:border-slate-800 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 flex flex-col shadow-2xl"
            >
              <SidebarContent />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-border-main dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-text-muted hover:text-text-main md:hidden"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg md:text-xl font-bold text-text-main">{t(activeTab as any)}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-border-main/50 dark:border-slate-700/50">
              <div className={cn("w-1.5 h-1.5 rounded-full", user ? (isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400") : "bg-gray-400")} />
              <span className="text-[10px] font-bold text-text-muted whitespace-nowrap">
                {user ? (isOnline ? t('online') : t('offline')) : t('offline')}
              </span>
            </div>
            <span className="text-[10px] bg-primary-light px-2.5 py-1 rounded-md font-bold text-primary whitespace-nowrap">
              {settings.lang === 'my' ? '🇲🇲 မြန်မာ' : '🇬🇧 EN'}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {/* Primary Metrics Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* 1. Outstanding */}
                    <div className="card bg-slate-900 border-none text-white shadow-2xl shadow-slate-200">
                      <div className="flex justify-between items-start mb-6">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{t('outstanding')}</p>
                        <div className="p-2 bg-white/10 rounded-xl">
                          <History size={18} className="text-white" />
                        </div>
                      </div>
                      <h2 className="text-3xl font-black tracking-tight mb-2">{formatCurrency(stats.outstanding)}</h2>
                      <p className="text-[10px] text-slate-500 font-medium">Currently Active Portfolio</p>
                    </div>

                    {/* 2. Total Interest */}
                    <div className="card border-none bg-emerald-600 text-white shadow-2xl shadow-emerald-100">
                      <div className="flex justify-between items-start mb-6">
                        <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-[0.2em]">{t('totalInterest')}</p>
                        <div className="p-2 bg-white/20 rounded-xl">
                          <CircleDollarSign size={18} className="text-white" />
                        </div>
                      </div>
                      <h2 className="text-3xl font-black tracking-tight mb-2">{formatCurrency(stats.totalInterest)}</h2>
                      <p className="text-[10px] text-emerald-100/70 font-medium">Accumulated Revenue Yield</p>
                    </div>

                    {/* 3. Total Loaned */}
                    <div className="card border-none bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                      <div className="flex justify-between items-start mb-6">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">{t('totalLoaned')}</p>
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <ArrowUpRight size={18} className="text-primary" />
                        </div>
                      </div>
                      <h2 className="text-3xl font-black text-text-main tracking-tight mb-2">{formatCurrency(stats.totalLoaned)}</h2>
                      <p className="text-[10px] text-primary font-bold uppercase">{customers.length} Customers</p>
                    </div>

                    {/* 4. Repayment Rate */}
                    <div className="card border-none bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                      <div className="flex justify-between items-start mb-6">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">{t('repaymentRate')}</p>
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                          <CheckCircle2 size={18} className="text-blue-500" />
                        </div>
                      </div>
                      <div className="flex items-end gap-2 mb-4">
                        <h2 className="text-3xl font-black text-text-main tracking-tight">{stats.repayRate}%</h2>
                        <div className="flex gap-0.5 mb-2">
                          {[...Array(5)].map((_, i) => (
                             <div key={i} className={cn("w-1 h-3 rounded-full", i < Math.floor(stats.repayRate/20) ? "bg-primary" : "bg-gray-100 dark:bg-slate-700")} />
                          ))}
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${stats.repayRate}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Secondary Insights Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Portfolio Health Graph */}
                    <div className="lg:col-span-8 card bg-white dark:bg-slate-900 shadow-2xl shadow-slate-100 dark:shadow-none border-none">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-xs font-bold text-text-main uppercase tracking-[0.2em]">{t('portfolioHealth')}</h3>
                          <p className="text-[10px] text-text-muted mt-1 uppercase tracking-wider">Risk Profile Distribution</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Charts or Detailed Stats could go here */}
                        <div className="space-y-6">
                          {[
                            { label: 'Prime Assets', color: 'bg-emerald-500', level: 'EXCELLENT', icon: <CheckCircle2 size={12}/> },
                            { label: 'Stable Portfolio', color: 'bg-primary', level: 'LOW', icon: <CheckCircle2 size={12}/> },
                            { label: 'Medium Exposure', color: 'bg-amber-500', level: 'MEDIUM', icon: <ShieldAlert size={12}/> },
                            { label: 'Critical / High Risk', color: 'bg-red-500', level: 'HIGH', icon: <X size={12}/> },
                          ].map((item, idx) => {
                            const count = customers.filter(c => getRiskLevel(c.id).level === item.level).length;
                            const percentage = customers.length > 0 ? (count / customers.length) * 100 : 0;
                            
                            return (
                              <div key={idx} className="group">
                                <div className="flex justify-between items-center mb-2">
                                  <div className="flex items-center gap-3">
                                    <div className={cn("p-1.5 rounded-lg text-white", item.color)}>
                                      {item.icon}
                                    </div>
                                    <span className="text-[11px] font-bold text-text-main">{item.label}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-black text-text-main">{count}</span>
                                    <span className="text-[10px] text-text-muted ml-1">({Math.round(percentage)}%)</span>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-50 dark:bg-slate-800 rounded-full h-1 overflow-hidden">
                                  <div 
                                    className={cn("h-full rounded-full transition-all duration-[1500ms] ease-out", item.color)}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] p-8 flex flex-col justify-center text-center">
                          <div className="mb-6">
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-2">Collection Efficiency</p>
                            <h4 className="text-4xl font-black text-text-main">{formatCurrency(stats.totalRepaid)}</h4>
                          </div>
                          <div className="space-y-4">
                             <div className="flex justify-between items-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-black/5">
                                <span className="text-[10px] font-bold text-text-muted uppercase">Active Loans</span>
                                <span className="text-xs font-black text-primary">{customers.filter(c => getCustomerStats(c.id).outstanding > 0).length}</span>
                             </div>
                             <div className="flex justify-between items-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-black/5">
                                <span className="text-[10px] font-bold text-text-muted uppercase">Risk Level</span>
                                <span className="text-xs font-black text-red-500 uppercase">{customers.filter(c => getRiskLevel(c.id).level === 'HIGH').length} High</span>
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Access Sidebar */}
                    <div className="lg:col-span-4 space-y-6">
                      <div className="card bg-slate-900 border-none text-white p-8 rounded-[2.5rem]">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">System Access</h3>
                        <div className="grid grid-cols-1 gap-3">
                          <button 
                             onClick={() => setActiveTab('customers')}
                             className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 text-left group"
                          >
                            <div className="p-3 rounded-xl bg-primary text-white group-hover:scale-110 transition-transform">
                              <Plus size={20} />
                            </div>
                            <div>
                               <p className="text-xs font-black">Register Customer</p>
                               <p className="text-[10px] text-slate-500">Add to your active list</p>
                            </div>
                          </button>
                          <button 
                             onClick={() => {
                               setEditingItem(null);
                               setModalType('loan');
                               setIsModalOpen(true);
                             }}
                             className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 text-left group"
                          >
                            <div className="p-3 rounded-xl bg-amber-500 text-white group-hover:scale-110 transition-transform">
                              <FileText size={20} />
                            </div>
                            <div>
                               <p className="text-xs font-black">Record Transaction</p>
                               <p className="text-[10px] text-slate-500">New ledger entry</p>
                            </div>
                          </button>
                        </div>
                        
                        <div className="mt-12 pt-8 border-t border-white/5">
                           <div className="flex items-center gap-4 mb-4">
                              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                 <ShieldCheck size={20} />
                              </div>
                              <div>
                                 <p className="text-[10px] font-bold text-white uppercase tracking-wider">Cloud Secured</p>
                                 <p className="text-[9px] text-slate-500">AES-256 Multi-layer Guard</p>
                              </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'customers' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        className="input pl-10" 
                        placeholder={t('searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <button 
                      className="btn btn-primary whitespace-nowrap"
                      onClick={() => {
                        setEditingItem(null);
                        setModalType('customer');
                        setIsModalOpen(true);
                      }}
                    >
                      <Plus size={18} />
                      <span>{t('addCustomer')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {customers
                      .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(customer => {
                        const s = getCustomerStats(customer.id);
                        const r = getRiskLevel(customer.id);
                        
                        const lastTxDate = s.loans.length > 0 
                          ? new Date(Math.max(...s.loans.map(l => new Date(l.date).getTime())))
                          : new Date(customer.createdAt);
                        const daysInactive = Math.floor((new Date().getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24));

                        return (
                          <div 
                            key={customer.id} 
                            className="card hover:shadow-md transition-all group relative cursor-pointer"
                            onClick={() => {
                              setSelectedCustomerId(customer.id);
                              setModalType('customerDetail');
                              setIsModalOpen(true);
                            }}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-gray-900 text-lg hover:text-primary transition-colors">
                                {customer.name}
                              </h4>
                              <div className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider",
                                r.cls === 'bg-red-100 text-red-700' ? "bg-red-50 border-red-100 text-red-500" :
                                r.cls === 'bg-amber-100 text-amber-700' ? "bg-amber-50 border-amber-100 text-amber-500" :
                                "bg-emerald-50 border-emerald-100 text-emerald-500"
                              )}>
                                <span className={cn("w-2 h-2 rounded-full", r.cls.split(' ')[0])} />
                                {r.level}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold mb-4">
                              <span>✓ OK ({daysInactive}d)</span>
                            </div>

                            <div className="space-y-1.5 mb-4">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400 font-medium">Loan Amount</span>
                                <span className="text-gray-900 font-black">฿ {s.totalLoaned.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400 font-medium">Outstanding</span>
                                <span className="text-red-500 font-black">฿ {s.outstanding.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400 font-medium">Transactions</span>
                                <span className="text-gray-900 font-black">{s.loans.length}</span>
                              </div>
                            </div>

                            <div className="flex gap-2 p-2 bg-gray-50 dark:bg-slate-800/50 rounded-2xl mt-2 border border-gray-100 dark:border-slate-700">
                              <button 
                                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-black hover:bg-gray-800 text-white text-[15px] font-bold rounded-xl transition-all z-10 shadow-lg active:scale-95"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPinModal({ id: customer.id, action: 'editCustomer' });
                                }}
                              >
                                <Pencil size={16} />
                                {t('update')}
                              </button>
                              <button 
                                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#d31717] hover:bg-red-700 text-white text-[15px] font-bold rounded-xl transition-all z-10 shadow-lg active:scale-95"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPinModal({ id: customer.id, action: 'deleteCustomer' });
                                }}
                              >
                                <Trash2 size={16} />
                                {settings.lang === 'my' ? 'ဖျက်မည်' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {customers.length === 0 && <div className="text-center py-12 text-gray-400">{t('noCustomers')}</div>}
                  </div>
                </div>
              )}

              {activeTab === 'loans' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button 
                      className="btn btn-primary w-full sm:w-auto"
                      onClick={() => {
                        setEditingItem(null);
                        setModalType('loan');
                        setIsModalOpen(true);
                      }}
                    >
                      <Plus size={18} />
                      {t('newEntry')}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'transactions' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="card bg-primary-light/30 dark:bg-primary/5 border-primary-light dark:border-primary/20">
                      <p className="stat-label text-primary">{t('totalLoaned')}</p>
                      <p className="text-lg font-bold text-text-main">{formatCurrency(stats.totalLoaned)}</p>
                    </div>
                    <div className="card bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20">
                      <p className="stat-label text-blue-700 dark:text-blue-400">{t('repaid')}</p>
                      <p className="text-lg font-bold text-text-main">{formatCurrency(stats.totalRepaid)}</p>
                    </div>
                    <div className="card bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20">
                      <p className="stat-label text-amber-700 dark:text-amber-400">{t('outstanding')}</p>
                      <p className="text-lg font-bold text-text-main">{formatCurrency(stats.outstanding)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {loans.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(loan => {
                      const customer = customers.find(c => c.id === loan.customerId);
                      return (
                        <div key={loan.id} className="card group">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-text-main">{customer?.name || 'Unknown'}</h4>
                                <span className="text-[10px] bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400 font-medium">#{loan.id}</span>
                              </div>
                              <p className="text-xs text-text-muted">{loan.date} • {loan.type || 'N/A'}</p>
                              {loan.notes && <p className="text-xs text-text-muted italic">"{loan.notes}"</p>}
                              <div className="flex gap-4 mt-3">
                                {loan.loanAmount > 0 && (
                                  <div className="flex items-center gap-1 text-primary font-bold text-sm">
                                    <ArrowUpRight size={14} />
                                    {formatCurrency(loan.loanAmount)}
                                  </div>
                                )}
                                {loan.repayAmount > 0 && (
                                  <div className="flex items-center gap-1 text-blue-600 font-bold text-sm">
                                    <ArrowDownLeft size={14} />
                                    {formatCurrency(loan.repayAmount)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                              <button 
                                className="btn btn-outline flex-1 sm:p-2"
                                onClick={() => {
                                  openPinModal({ id: loan.id, action: 'editLoan' });
                                }}
                              >
                                <Pencil size={16} className="sm:mx-auto" />
                                <span className="sm:hidden">Edit</span>
                              </button>
                              <button 
                                className="btn btn-outline text-red-600 border-red-100 hover:bg-red-50 flex-1 sm:p-2"
                                onClick={() => {
                                  openPinModal({ id: loan.id, action: 'deleteLoan' });
                                }}
                              >
                                <Trash2 size={16} className="sm:mx-auto" />
                                <span className="sm:hidden">Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {loans.length === 0 && <div className="text-center py-12 text-gray-400">{t('noLoans')}</div>}
                  </div>
                </div>
              )}

              {activeTab === 'invoice' && (
                <div className="max-w-2xl mx-auto space-y-6 pb-12">
                  <div className="card no-print">
                    <label className="form-label mb-2">{t('customers')}</label>
                    <select 
                      className="input"
                      value={selectedInvoiceId}
                      onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    >
                      <option value="">{t('selectCustomer')}</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {selectedInvoiceId ? (() => {
                    const cid = Number(selectedInvoiceId);
                    const customer = customers.find(c => c.id === cid);
                    const s = getCustomerStats(cid);
                    const r = getRiskLevel(cid);
                    const interestAmt = Math.round((s.totalLoaned * settings.interestRate) / 100);
                    const penaltyAmt = settings.penaltyRate;
                    const grandTotal = s.totalLoaned + interestAmt + penaltyAmt - s.totalRepaid - settings.discount;
                    
                    const lastTxDate = s.loans.length > 0 
                      ? new Date(Math.max(...s.loans.map(l => new Date(l.date).getTime())))
                      : new Date();
                    const daysInactive = Math.floor((new Date().getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 print:shadow-none print:border-none">
                        <div id="invoice-capture-area" ref={invoiceRef} className="bg-white p-2">
                          {/* Header */}
                          <div className="text-center border-b border-gray-50 bg-gray-50 h-[85px] flex flex-col justify-center">
                          <div className="flex justify-center items-center gap-4 mb-4">
                              <div className="w-16 h-16 bg-white rounded-2xl shadow-md border border-gray-100 flex items-center justify-center overflow-hidden p-2">
                                <img 
                                  src={settings.logoImage || "https://i.ibb.co/v4m8vYm/logo-loan.png"} 
                                  alt="Swift Loan Logo" 
                                  className="w-full h-full object-contain"
                                  referrerPolicy="no-referrer"
                                  crossOrigin="anonymous"
                                />
                              </div>
                            <div className="text-left">
                              <h3 className="font-extrabold text-[#1D9E75] tracking-tight text-xl leading-none">Swift Loan Service</h3>
                              <p className="text-xs text-[#0066B2] font-semibold mt-1">အမြန်ချေး ငွေဝန်ဆောင်မှု</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-8 space-y-8">
                          {/* Bill To & Info */}
                          <div className="flex justify-between items-start border-t border-gray-900 pt-6">
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">BILL TO</p>
                              <h4 className="text-xl font-bold text-gray-900">{customer?.name}</h4>
                              <p className="text-xs text-gray-500 font-medium">ကြွေးမြီရှင်းတမ်း</p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-[10px] font-bold text-gray-500">Invoice No: <span className="text-gray-900">SL-{new Date().getFullYear()}-{String(cid).padStart(3, '0')}</span></p>
                              <p className="text-[10px] font-bold text-gray-500">Date: <span className="text-gray-900">{new Date().toLocaleDateString('en-GB')}</span></p>
                            </div>
                          </div>

                          {/* Transaction History Table */}
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">TRANSACTION HISTORY</p>
                            <div className="border-t-2 border-gray-900">
                              <table className="w-full text-left text-[10px] font-bold">
                                <thead>
                                  <tr className="bg-[#003D6B] text-white uppercase tracking-wider">
                                    <th className="px-3 py-2 w-8">#</th>
                                    <th className="px-3 py-2">{t('date')}</th>
                                    <th className="px-3 py-2">TRANSACTION</th>
                                    <th className="px-3 py-2 text-right text-amber-400">LOAN</th>
                                    <th className="px-3 py-2 text-right text-emerald-400">REPAY</th>
                                    <th className="px-3 py-2 text-center">EXPIRE</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {s.loans.map((loan, idx) => {
                                    const txDate = new Date(loan.date);
                                    const diffDays = Math.floor((new Date().getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
                                    const isExpired = diffDays > settings.expireDays;
                                    
                                    return (
                                      <tr key={loan.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-3 text-gray-400">{idx + 1}</td>
                                        <td className="px-3 py-3 text-gray-600">{loan.date}</td>
                                        <td className="px-3 py-3 text-gray-600">{loan.type || 'Standard Entry'}</td>
                                        <td className="px-3 py-3 text-right text-amber-600">
                                          {loan.loanAmount > 0 ? `฿${loan.loanAmount.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-3 py-3 text-right text-emerald-600">
                                          {loan.repayAmount > 0 ? `฿${loan.repayAmount.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                          <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[8px] uppercase font-bold border",
                                            isExpired 
                                              ? "bg-red-50 text-red-500 border-red-100" 
                                              : "bg-emerald-50 text-emerald-500 border-emerald-100"
                                          )}>
                                            {isExpired ? `Expired ${diffDays}d` : 'Active'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Detailed Summary */}
                          <div className="space-y-3 pt-4 border-t border-gray-100">
                            <div className="flex justify-between text-xs font-medium text-gray-600">
                              <span>Loan Amount</span>
                              <span className="text-gray-900 font-bold">฿ {s.totalLoaned.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-gray-600">
                              <span>Interest ({settings.interestRate}%)</span>
                              <span className="text-gray-900 font-bold">฿ {interestAmt.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-red-600">
                              <span>Penalty</span>
                              <span className="font-bold">฿ {penaltyAmt.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-emerald-600">
                              <span>Repayment</span>
                              <span className="font-bold">- ฿ {s.totalRepaid.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-gray-400">
                              <span>Discount</span>
                              <span className="font-bold">- ฿ {settings.discount.toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Grand Total */}
                          <div className="flex justify-between items-center h-[35px] border-y border-gray-900 border-solid rounded-none my-4">
                            <span className="text-[14px] font-black text-gray-900 uppercase tracking-[0.2em]">GRAND TOTAL</span>
                            <span className="text-[17px] font-black text-gray-900">฿ {grandTotal.toLocaleString()}</span>
                          </div>

                          {/* Payment Channel */}
                          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">PAYMENT CHANNEL</p>
                            <div className="max-w-[240px] mx-auto bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                              <div className="bg-[#003D6B] p-3 flex items-center justify-center gap-2 text-white">
                                <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-[#003D6B] font-bold text-[14px] shrink-0">QR</div>
                                <span className="text-[19px] font-black uppercase tracking-tighter leading-none">Thai QR Payment</span>
                              </div>
                              <div className="p-6 text-center">
                                {settings.qrImage ? (
                                  <img 
                                    src={settings.qrImage} 
                                    className="w-32 h-32 mx-auto object-contain mb-4" 
                                    crossOrigin="anonymous"
                                  />
                                ) : (
                                  <div className="w-32 h-32 mx-auto bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-[10px] text-gray-400 mb-4">No QR Code</div>
                                )}
                                <h4 className="font-bold text-[14px] text-gray-900">Thai QR PromptPay</h4>
                                <p className="text-[15px] font-bold text-[#26781d]">{settings.bank}</p>
                                <p className="text-[16px] font-mono font-black text-[#0a6043] mt-1">Acc: {settings.account}</p>
                                <p className="text-[14px] text-gray-600 font-bold">{settings.holder}</p>
                              </div>
                            </div>
                            <p className="text-[10px] leading-[27px] text-amber-600 font-bold text-center mt-4 tracking-tight">⚠️ ငွေလွှဲပြီးပါက Slip ကို admin သို့ ပေးပို့ပါ</p>
                          </div>

                          {/* Footer */}
                          <div className="text-center space-y-4 pt-4">
                            <div className="h-px bg-gray-100 w-full" />
                            <p className="text-[13px] text-gray-400 font-medium italic">Thank you for your business!</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-8 bg-gray-50 border-t border-gray-100 no-print flex flex-col sm:flex-row gap-3">
                          <button 
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF || isSharingPDF}
                            className={cn(
                              "btn btn-primary flex-1 py-4 shadow-lg shadow-primary/20",
                              (isGeneratingPDF || isSharingPDF) && "opacity-70 cursor-not-allowed"
                            )}
                          >
                            {isGeneratingPDF ? (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                {settings.lang === 'my' ? 'PDF ပြင်ဆင်နေသည်...' : 'Generating PDF...'}
                              </div>
                            ) : (
                              <>
                                <Download size={18} />
                                {t('downloadInvoice')}
                              </>
                            )}
                          </button>

                          <button 
                            onClick={handleSharePDF}
                            disabled={isGeneratingPDF || isSharingPDF}
                            className={cn(
                              "btn btn-outline flex-1 py-4 border-primary text-primary hover:bg-primary/5",
                              (isGeneratingPDF || isSharingPDF) && "opacity-70 cursor-not-allowed"
                            )}
                          >
                            {isSharingPDF ? (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                {settings.lang === 'my' ? 'မျှဝေရန် ပြင်ဆင်နေသည်...' : 'Preparing Share...'}
                              </div>
                            ) : (
                              <>
                                <Share2 size={18} />
                                {t('shareInvoice')}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="text-center py-20 text-gray-400 italic text-sm">{t('selectPrompt')}</div>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="max-w-xl mx-auto space-y-6 pb-12">
                  <div className="card">
                    <h3 className="text-sm font-bold text-text-main mb-4 flex items-center gap-2">
                      <Cloud size={18} className="text-primary" />
                      Cloud Sync & Account
                    </h3>
                    <div className="space-y-4">
                      {!user ? (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl">
                          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-3">{t('loginRequired')}</p>
                          <button 
                            onClick={login}
                            className="btn btn-primary w-full gap-2"
                          >
                            <LogIn size={16} />
                            {t('login')}
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl">
                          <div className="flex items-center gap-3 mb-4">
                            <img 
                              src={user.photoURL || ''} 
                              alt={user.displayName || ''} 
                              className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-text-main truncate">{user.displayName}</p>
                              <p className="text-[10px] text-text-muted truncate">{user.email}</p>
                            </div>
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase">
                              <CheckCircle2 size={10} />
                              {isOnline ? 'Synced' : 'Local'}
                            </div>
                          </div>
                          <button 
                            onClick={logout}
                            className="btn btn-outline w-full gap-2 text-red-500 border-red-100 hover:bg-red-50"
                          >
                            <LogOut size={16} />
                            {t('logout')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-bold text-text-main mb-4 flex items-center gap-2">
                      <Smartphone size={18} className="text-primary" />
                      {t('installApp')}
                    </h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-3">
                        <p className="text-xs text-text-muted leading-relaxed">
                          {t('installDesc')}
                        </p>
                        <div className="space-y-2 pt-2 border-t border-primary/5">
                          <div className="flex gap-3 items-start">
                            <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">A</div>
                            <p className="text-xs text-text-main font-medium">{t('androidInstall')}</p>
                          </div>
                          <div className="flex gap-3 items-start">
                            <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">I</div>
                            <p className="text-xs text-text-main font-medium">{t('iosInstall')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-bold text-text-main mb-4 flex items-center gap-2">
                      <Database size={18} className="text-primary" />
                      {t('dataManagement')}
                    </h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-border-main/50">
                        <p className="text-xs font-bold text-text-main mb-1">{t('backupData')}</p>
                        <p className="text-[10px] text-text-muted mb-4">{t('backupDesc')}</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button 
                            className="btn btn-primary flex-1 py-2 text-xs"
                            onClick={() => openPinModal({ action: 'exportData' })}
                          >
                            <FileDown size={14} />
                            {t('backupBtn')}
                          </button>
                          <div className="flex-1">
                            <input 
                              type="file" 
                              id="database-import" 
                              accept=".json" 
                              className="hidden" 
                              onChange={handleImportData}
                            />
                            <button 
                              className="btn btn-outline w-full py-2 text-xs cursor-pointer"
                              onClick={() => openPinModal({ action: 'importData' })}
                            >
                              <FileUp size={14} />
                              {t('restoreBtn')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-bold text-text-main mb-4 flex items-center gap-2">
                      <Sun size={18} className="text-primary" />
                      {t('displayAndBrightness')}
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button 
                        className={cn("btn flex-1", settings.theme === 'light' ? "btn-primary" : "btn-outline")}
                        onClick={() => setSettings({ ...settings, theme: 'light' })}
                      >
                        <Sun size={18} />
                        {t('lightTheme')}
                      </button>
                      <button 
                        className={cn("btn flex-1", settings.theme === 'dark' ? "btn-primary" : "btn-outline")}
                        onClick={() => setSettings({ ...settings, theme: 'dark' })}
                      >
                        <Moon size={18} />
                        {t('darkTheme')}
                      </button>
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-bold text-text-main mb-4 flex items-center gap-2">
                      <Globe size={18} className="text-primary" />
                      {t('language')}
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button 
                        className={cn("btn flex-1", settings.lang === 'en' ? "btn-primary" : "btn-outline")}
                        onClick={() => setSettings({ ...settings, lang: 'en' })}
                      >
                        {t('english')}
                      </button>
                      <button 
                        className={cn("btn flex-1", settings.lang === 'my' ? "btn-primary" : "btn-outline")}
                        onClick={() => setSettings({ ...settings, lang: 'my' })}
                      >
                        {t('myanmar')}
                      </button>
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-bold text-text-main mb-4 flex items-center gap-2">
                      <CircleDollarSign size={18} className="text-primary" />
                      {t('interestSettings')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('interestRate')} (%)</label>
                        <input 
                          type="number" 
                          className="input" 
                          value={tempSettings.interestRate}
                          onChange={(e) => setTempSettings({ ...tempSettings, interestRate: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('penaltyRate')} (฿)</label>
                        <input 
                          type="number" 
                          className="input" 
                          value={tempSettings.penaltyRate}
                          onChange={(e) => setTempSettings({ ...tempSettings, penaltyRate: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('discount')} (฿)</label>
                        <input 
                          type="number" 
                          className="input" 
                          value={tempSettings.discount}
                          onChange={(e) => setTempSettings({ ...tempSettings, discount: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="mb-6">
                      <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('method')}</label>
                      <select 
                        className="input"
                        value={tempSettings.method}
                        onChange={(e) => setTempSettings({ ...tempSettings, method: e.target.value as any })}
                      >
                        <option value="flat">{t('flatMethod')}</option>
                        <option value="compound">{t('compoundMethod')}</option>
                        <option value="penalty">{t('penaltyMethod')}</option>
                      </select>
                    </div>

                    {(tempSettings.interestRate !== settings.interestRate || 
                      tempSettings.penaltyRate !== settings.penaltyRate || 
                      tempSettings.discount !== settings.discount || 
                      tempSettings.method !== settings.method) && (
                      <button 
                        onClick={() => openPinModal({ action: 'saveSettings' })}
                        className="btn btn-primary w-full shadow-lg shadow-primary/20"
                      >
                        {t('updatePin')} {t('interestSettings')}
                      </button>
                    )}
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-bold text-text-main mb-4 flex items-center gap-2">
                      <FileText size={18} className="text-primary" />
                      {t('paymentDetails')}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('bank')}</label>
                        <input 
                          className="input" 
                          value={tempSettings.bank}
                          onChange={(e) => setTempSettings({ ...tempSettings, bank: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('account')}</label>
                        <input 
                          className="input" 
                          value={tempSettings.account}
                          onChange={(e) => setTempSettings({ ...tempSettings, account: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('holder')}</label>
                        <input 
                          className="input" 
                          value={tempSettings.holder}
                          onChange={(e) => setTempSettings({ ...tempSettings, holder: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">QR Code Image</label>
                        <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
                          <div className="w-24 h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center overflow-hidden">
                            {tempSettings.qrImage ? (
                              <img src={tempSettings.qrImage} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-[10px] text-gray-400">No Image</span>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <input 
                              type="file" 
                              id="qr-upload" 
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => setTempSettings({ ...tempSettings, qrImage: ev.target?.result as string });
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <button 
                              className="btn btn-outline btn-sm w-full"
                              onClick={() => openPinModal({ action: 'uploadQr' })}
                            >
                              {t('qrUpload')}
                            </button>
                            {tempSettings.qrImage && (
                              <button 
                                className="btn btn-danger btn-sm w-full"
                                onClick={() => openPinModal({ action: 'removeQr' })}
                              >
                                {settings.lang === 'my' ? 'ဖယ်ရှားမည်' : 'Remove'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {(tempSettings.bank !== settings.bank || 
                      tempSettings.account !== settings.account || 
                      tempSettings.holder !== settings.holder || 
                      tempSettings.qrImage !== settings.qrImage) && (
                      <button 
                        onClick={() => openPinModal({ action: 'saveSettings' })}
                        className="btn btn-primary w-full shadow-lg shadow-primary/20"
                      >
                        {t('updatePin')} {t('paymentDetails')}
                      </button>
                    )}
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-bold text-text-main mb-1 flex items-center gap-2">
                      <Globe size={18} className="text-primary" />
                      {t('logo')}
                    </h3>
                    <p className="text-[10px] text-gray-400 mb-4">Update your business logo (PIN Required)</p>
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-24 h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center overflow-hidden">
                          {tempSettings.logoImage ? (
                            <img src={tempSettings.logoImage} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-[10px] text-gray-400">No Logo</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          <input 
                            type="file" 
                            id="logo-upload" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => setTempSettings({ ...tempSettings, logoImage: ev.target?.result as string });
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <button 
                            className="btn btn-outline btn-sm w-full"
                            onClick={() => openPinModal({ action: 'uploadLogo' })}
                          >
                            {t('uploadLogo')}
                          </button>
                          {tempSettings.logoImage && (
                            <button 
                              className="btn btn-danger btn-sm w-full"
                              onClick={() => openPinModal({ action: 'removeLogo' })}
                            >
                              {settings.lang === 'my' ? 'ဖယ်ရှားမည်' : 'Remove'}
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {tempSettings.logoImage !== settings.logoImage && (
                        <button 
                          onClick={() => openPinModal({ action: 'saveSettings' })}
                          className="btn btn-primary w-full shadow-lg shadow-primary/20 mt-4"
                        >
                          {t('updatePin')} {t('logo')}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-bold text-text-main mb-1 flex items-center gap-2">
                      <Lock size={18} className="text-primary" />
                      {t('pinLock')}
                    </h3>
                    <p className="text-[10px] text-gray-400 mb-4">{t('pinDesc')}</p>
                    <div className="space-y-4">
                      <div className="relative">
                        <input 
                          type={showCurrentPin ? "text" : "password"} 
                          placeholder={t('currentPin')} 
                          className="input pr-10" 
                          value={pinForm.current}
                          onChange={(e) => setPinForm({ ...pinForm, current: e.target.value })}
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowCurrentPin(!showCurrentPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                        >
                          {showCurrentPin ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          type={showNextPin ? "text" : "password"} 
                          placeholder={t('newPin')} 
                          className="input pr-10" 
                          value={pinForm.next}
                          onChange={(e) => setPinForm({ ...pinForm, next: e.target.value })}
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowNextPin(!showNextPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                        >
                          {showNextPin ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          type={showConfirmPin ? "text" : "password"} 
                          placeholder={t('confirmPin')} 
                          className="input pr-10" 
                          value={pinForm.confirm}
                          onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value })}
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPin(!showConfirmPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                        >
                          {showConfirmPin ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      
                      {pinUpdateStatus.error && <p className="text-xs text-red-500 font-bold">{pinUpdateStatus.error}</p>}
                      {pinUpdateStatus.success && <p className="text-xs text-emerald-500 font-bold">{pinUpdateStatus.success}</p>}

                      <button 
                        onClick={handleUpdatePin}
                        className="btn btn-outline w-full text-primary border-primary/20 hover:bg-primary-light/50"
                      >
                        {t('updatePin')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-text-main">
                    {modalType === 'customer' ? (editingItem ? t('editCustomerTitle') : t('addCustomerTitle')) : 
                     modalType === 'loan' ? (editingItem ? t('editLoanTitle') : t('newLoanTitle')) : 
                     modalType === 'customerDetail' ? '' :
                     t('pinVerify')}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>

                {modalType === 'customerDetail' && selectedCustomerId && (() => {
                  const customer = customers.find(c => c.id === selectedCustomerId);
                  const s = getCustomerStats(selectedCustomerId);
                  const r = getRiskLevel(selectedCustomerId);
                  const interestAmt = Math.round((s.totalLoaned * settings.interestRate) / 100);
                  
                  const lastTxDate = s.loans.length > 0 
                    ? new Date(Math.max(...s.loans.map(l => new Date(l.date).getTime())))
                    : new Date(customer?.createdAt || '');
                  const daysInactive = Math.floor((new Date().getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div className="space-y-6">
                      <div className="flex flex-col items-center text-center -mt-4 mb-4">
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mb-6" />
                        <h2 className="text-2xl font-black text-text-main tracking-tight">{customer?.name}</h2>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 rounded-2xl border-t-4 border-t-blue-500 border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-sm">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">LOAN</p>
                          <p className="text-lg font-black text-text-main">฿ {s.totalLoaned.toLocaleString()}</p>
                        </div>
                        <div className="p-4 rounded-2xl border-t-4 border-t-red-500 border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-sm">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">OUTSTANDING</p>
                          <p className="text-lg font-black text-text-main">฿ {s.outstanding.toLocaleString()}</p>
                        </div>
                        <div className="p-4 rounded-2xl border-t-4 border-t-emerald-500 border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-sm">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">REPAID</p>
                          <p className="text-lg font-black text-text-main">฿ {s.totalRepaid.toLocaleString()}</p>
                        </div>
                        <div className="p-4 rounded-2xl border-t-4 border-t-sky-500 border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-sm">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">INTEREST {settings.interestRate}%</p>
                          <p className="text-lg font-black text-text-main">฿ {interestAmt.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Risk:</span>
                          <div className={cn(
                            "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider",
                            r.cls.includes('red') ? "text-red-500" : r.cls.includes('orange') ? "text-orange-500" : "text-emerald-500"
                          )}>
                            <span className={cn("w-2 h-2 rounded-full", r.cls.split(' ')[0])} />
                            {r.level}
                          </div>
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase">
                          Days inactive: <span className="text-gray-900">{daysInactive}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">TRANSACTION HISTORY</p>
                        <div className="overflow-x-auto -mx-6 px-6">
                          <table className="w-full text-left text-[10px] font-bold">
                            <thead>
                              <tr className="bg-[#003D6B] text-white uppercase tracking-wider">
                                <th className="px-3 py-2 w-8">#</th>
                                <th className="px-3 py-2">DATE</th>
                                <th className="px-3 py-2">TRANSACTION</th>
                                <th className="px-3 py-2 text-right text-amber-400">LOAN</th>
                                <th className="px-3 py-2 text-right text-emerald-400">REPAY</th>
                                <th className="px-3 py-2 text-center">EXPIRE</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {s.loans.slice().reverse().map((loan, idx) => {
                                const txDate = new Date(loan.date);
                                const diffDays = Math.floor((new Date().getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
                                const isExpired = diffDays > settings.expireDays;

                                return (
                                  <tr key={loan.id} className="text-gray-600">
                                    <td className="py-3 text-gray-300">{s.loans.length - idx}</td>
                                    <td className="py-3">{loan.date}</td>
                                    <td className="py-3">{loan.type || '—'}</td>
                                    <td className="py-3 text-right text-amber-600">{loan.loanAmount > 0 ? `฿${loan.loanAmount.toLocaleString()}` : '—'}</td>
                                    <td className="py-3 text-right text-emerald-600">{loan.repayAmount > 0 ? `฿${loan.repayAmount.toLocaleString()}` : '—'}</td>
                                    <td className="py-3 text-center">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[8px] font-bold border",
                                        isExpired 
                                          ? "bg-red-50 text-red-500 border-red-100" 
                                          : "bg-emerald-50 text-emerald-500 border-emerald-100"
                                      )}>
                                        {isExpired ? `Expired ${diffDays}d` : 'Active'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {modalType === 'customer' && (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const data = {
                      name: formData.get('name') as string,
                      phone: formData.get('phone') as string,
                      email: formData.get('email') as string,
                      notes: formData.get('notes') as string,
                    };
                    if (editingItem) updateCustomer(editingItem.id, data);
                    else addCustomer(data);
                    setIsModalOpen(false);
                  }} className="space-y-4">
                    <div>
                      <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('name')}</label>
                      <input name="name" required defaultValue={editingItem?.name} className="input" />
                    </div>
                    <div>
                      <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('phone')}</label>
                      <input name="phone" defaultValue={editingItem?.phone} className="input" />
                    </div>
                    <div>
                      <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('email')}</label>
                      <input name="email" type="email" defaultValue={editingItem?.email} className="input" />
                    </div>
                    <div>
                      <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('notes')}</label>
                      <textarea name="notes" defaultValue={editingItem?.notes} className="input h-24 resize-none" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline flex-1">{t('cancel')}</button>
                      <button type="submit" className="btn btn-primary flex-1">{editingItem ? t('update') : t('save')}</button>
                    </div>
                  </form>
                )}

                {modalType === 'loan' && (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const data = {
                      customerId: Number(formData.get('customerId')),
                      date: formData.get('date') as string,
                      loanAmount: Number(formData.get('loanAmount')),
                      repayAmount: Number(formData.get('repayAmount')),
                      type: formData.get('type') as string,
                      notes: formData.get('notes') as string,
                    };
                    if (editingItem) updateLoan(editingItem.id, data);
                    else addLoan(data);
                    setIsModalOpen(false);
                  }} className="space-y-4">
                    <div>
                      <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('customer')}</label>
                      <select name="customerId" required defaultValue={editingItem?.customerId} className="input">
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('date')}</label>
                      <input name="date" type="date" required defaultValue={editingItem?.date || new Date().toISOString().split('T')[0]} className="input" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('loanAmount')}</label>
                        <input name="loanAmount" type="number" defaultValue={editingItem?.loanAmount} className="input" />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('repaymentAmount')}</label>
                        <input name="repayAmount" type="number" defaultValue={editingItem?.repayAmount} className="input" />
                      </div>
                    </div>
                    <div>
                      <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('txType')}</label>
                      <input name="type" defaultValue={editingItem?.type} className="input" placeholder={t('txTypePlaceholder')} />
                    </div>
                    <div>
                      <label className="form-label text-[10px] font-bold text-gray-400 uppercase mb-1">{t('notes')}</label>
                      <input name="notes" defaultValue={editingItem?.notes} className="input" placeholder={t('notesPlaceholder')} />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline flex-1">{t('cancel')}</button>
                      <button type="submit" className="btn btn-primary flex-1">{editingItem ? t('update') : t('save')}</button>
                    </div>
                  </form>
                )}

                {modalType === 'pin' && (
                  <div className="space-y-6">
                    <div className="text-center relative">
                      <button 
                        type="button" 
                        onClick={() => setShowModalPin(!showModalPin)}
                        className="absolute -top-2 right-0 text-gray-400 hover:text-primary p-2 transition-colors z-20"
                        title={showModalPin ? "Hide PIN" : "Show PIN"}
                      >
                        {showModalPin ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                      <p className="text-sm text-gray-500 mb-6">{t('pinPrompt')}</p>
                      <div className="flex justify-center gap-2 sm:gap-3 mb-4">
                        {[...Array(settings.pin.length)].map((_, i) => (
                          <div 
                            key={i} 
                            className={cn(
                              "w-10 h-12 sm:w-12 sm:h-14 rounded-2xl border-2 transition-all flex items-center justify-center text-xl font-black",
                              i < pinInput.length 
                                ? "bg-primary/5 border-primary text-primary shadow-sm scale-110" 
                                : "bg-gray-50 border-gray-100 text-gray-300"
                            )} 
                          >
                            {i < pinInput.length ? (showModalPin ? pinInput[i] : '•') : ''}
                          </div>
                        ))}
                      </div>
                      {pinError && <p className="text-[10px] font-bold text-red-500 animate-bounce">{pinError}</p>}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((n, i) => (
                        <button
                          key={i}
                          disabled={n === ''}
                          onClick={() => {
                            if (n === 'del') {
                              setPinInput(prev => prev.slice(0, -1));
                              setPinError('');
                            } else if (typeof n === 'number') {
                              const newVal = pinInput + n;
                              if (newVal.length <= settings.pin.length) {
                                setPinInput(newVal);
                                setPinError('');
                                if (newVal.length === settings.pin.length) {
                                  handlePinSubmit(newVal);
                                }
                              }
                            }
                          }}
                          className={cn(
                            "h-14 rounded-xl text-lg font-bold transition-all flex items-center justify-center",
                            n === '' ? "invisible" : "bg-gray-50 hover:bg-gray-100 active:scale-95 text-gray-700"
                          )}
                        >
                          {n === 'del' ? '⌫' : n}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="btn btn-outline w-full">{t('cancel')}</button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 border border-white/20 text-white px-6 py-3 rounded-full text-xs font-bold shadow-2xl z-50 flex items-center gap-3 backdrop-blur-xl"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
