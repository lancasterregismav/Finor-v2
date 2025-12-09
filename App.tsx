import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Settings, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown,
  Filter,
  X,
  Trash2,
  Edit2,
  ChevronDown,
  Download,
  Upload,
  ArrowLeft,
  Image as ImageIcon,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  CalendarCheck,
  CreditCard,
  Home,
  FileSpreadsheet,
  CheckCircle2,
  Share2,
  Percent,
  Zap
} from 'lucide-react';
import { Transaction, AppSettings, TransactionStatus, PixKey, CategoryItem, Payable, PayablePeriodicity } from './types';
import { APP_NAME, APP_SUBTITLE, DEFAULT_SETTINGS } from './constants';
import { StorageService } from './services/storage';
import { Card } from './components/Card';
import { Button } from './components/Button';

// Add type definition for html2canvas
declare global {
  interface Window {
    html2canvas: any;
  }
}

// Utility for safe ID generation (works in all browsers)
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

// Utility for formatting currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Utility for formatting date
const formatDate = (dateStr: string) => {
  if (!dateStr) return '--/--/----';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

export default function App() {
  // --- Navigation State ---
  const [currentView, setCurrentView] = useState<'dashboard' | 'payables'>('dashboard');

  // --- Data State ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  // --- Filter/Search State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TransactionStatus>('all');
  const [showPaidPayables, setShowPaidPayables] = useState(false);
  
  // --- Sorting and Selection State ---
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // --- Modals state ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // Transactions
  const [isPayableModalOpen, setIsPayableModalOpen] = useState(false); // Payables
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isReceivablesListOpen, setIsReceivablesListOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // --- Calendar Prompt State ---
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);
  const [tempTransaction, setTempTransaction] = useState<Transaction | null>(null);
  
  // --- Receipt Generation State ---
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  
  // --- Settings Form State ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Forms State ---
  const [formData, setFormData] = useState<Partial<Transaction>>({
    eventDate: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0],
    totalValue: 0,
    paidValue: 0,
    status: 'pending',
    category: ''
  });
  
  // State for "Spot Payment" (Discount) checkbox
  const [isSpotPayment, setIsSpotPayment] = useState(false);

  const [payableFormData, setPayableFormData] = useState<{
    description: string;
    isFixed: boolean;
    amount: string;
    dueDate: string;
    recurrenceCount: string;
    periodicity: PayablePeriodicity;
    isPaid: boolean;
  }>({
    description: '',
    isFixed: false,
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    recurrenceCount: '1',
    periodicity: 'mensal',
    isPaid: false
  });

  // --- Effects ---
  useEffect(() => {
    setTransactions(StorageService.getTransactions());
    setPayables(StorageService.getPayables());
    setSettings(StorageService.getSettings());
  }, []);

  useEffect(() => {
    StorageService.saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    StorageService.savePayables(payables);
  }, [payables]);

  useEffect(() => {
    StorageService.saveSettings(settings);
  }, [settings]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterStatus, searchTerm]);

  // --- Derived State ---
  const stats = useMemo(() => {
    return transactions.reduce((acc, curr) => ({
      received: acc.received + curr.paidValue,
      receivable: acc.receivable + (curr.totalValue - curr.paidValue)
    }), { received: 0, receivable: 0 });
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.clientName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || t.status === filterStatus;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const dateA = new Date(a.eventDate).getTime();
        const dateB = new Date(b.eventDate).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
  }, [transactions, searchTerm, filterStatus, sortOrder]);

  const debtors = useMemo(() => {
    return transactions
      .filter(t => t.totalValue > t.paidValue)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [transactions]);

  const filteredPayables = useMemo(() => {
    return payables
      .filter(p => showPaidPayables ? p.status === 'paid' : p.status === 'pending')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [payables, showPaidPayables]);

  // --- Handlers (Transactions) ---
  
  // Calculate price based on category and discount checkbox
  const calculatePrice = (categoryName: string, applyDiscount: boolean) => {
    const selectedCat = settings.categories.find(c => c.name === categoryName);
    if (!selectedCat) return 0;
    
    let value = selectedCat.defaultValue;
    if (applyDiscount) {
        const discount = settings.discountPercent || 0;
        value = value - (value * discount / 100);
    }
    return value;
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value;
    const newPrice = calculatePrice(newCategory, isSpotPayment);
    
    setFormData(prev => ({ 
        ...prev, 
        category: newCategory, 
        totalValue: newPrice 
    }));
  };

  const handleSpotPaymentToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
      const isChecked = e.target.checked;
      setIsSpotPayment(isChecked);
      
      // Recalculate price if a category is selected
      if (formData.category) {
          const newPrice = calculatePrice(formData.category, isChecked);
          setFormData(prev => ({ ...prev, totalValue: newPrice }));
      }
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.totalValue) return;

    const newTransaction: Transaction = {
      id: formData.id || generateId(),
      clientName: formData.clientName,
      category: formData.category || settings.categories[0]?.name || 'Geral',
      totalValue: Number(formData.totalValue),
      paidValue: Number(formData.paidValue) || 0,
      eventDate: formData.eventDate || new Date().toISOString().split('T')[0],
      paymentDate: formData.paymentDate || new Date().toISOString().split('T')[0],
      status: Number(formData.paidValue) >= Number(formData.totalValue) ? 'paid' : 'pending',
      notes: formData.notes
    };

    if (formData.id) {
      setTransactions(prev => prev.map(t => t.id === newTransaction.id ? newTransaction : t));
    } else {
      setTransactions(prev => [newTransaction, ...prev]);
    }
    
    // Close form modal but open calendar prompt
    setIsAddModalOpen(false);
    setTempTransaction(newTransaction);
    setShowCalendarPrompt(true);
  };

  const handleConfirmSchedule = () => {
    if (!tempTransaction) return;
    const t = tempTransaction;
    const dateStr = t.eventDate.replace(/-/g, '');
    const title = encodeURIComponent(`${t.clientName} - ${t.category}`);
    const details = encodeURIComponent(
      `Serviço: ${t.category}\n` +
      `Valor Total: ${formatCurrency(t.totalValue)}\n` +
      `Valor Pago: ${formatCurrency(t.paidValue)}\n` +
      `Restante: ${formatCurrency(t.totalValue - t.paidValue)}\n` +
      `Status: ${getStatusLabel(t.status)}`
    );
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}`;
    window.open(url, '_blank');
    setShowCalendarPrompt(false);
    setTempTransaction(null);
    resetForm();
  };

  const handleSkipSchedule = () => {
    setShowCalendarPrompt(false);
    setTempTransaction(null);
    resetForm();
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm('Tem certeza que deseja excluir?')) {
      setTransactions(prev => prev.filter(t => t.id !== id));
      if (selectedTransaction?.id === id) setSelectedTransaction(null);
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) {
          newSelected.delete(id);
          setSelectedIds(newSelected);
      }
    }
  };

  // --- Handlers (Payables) ---
  const handleSavePayable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payableFormData.description || !payableFormData.amount) return;

    const count = parseInt(payableFormData.recurrenceCount) || 1;
    const amount = parseFloat(payableFormData.amount);
    const newPayables: Payable[] = [];
    
    // Logic to generate recurrences
    let currentDate = new Date(payableFormData.dueDate);

    for (let i = 0; i < count; i++) {
        // Only mark as paid if checkbox is checked AND it's the first installment
        const isPaid = payableFormData.isPaid && i === 0;
        
        newPayables.push({
            id: generateId(),
            description: payableFormData.description,
            isFixed: payableFormData.isFixed,
            amount: amount,
            dueDate: currentDate.toISOString().split('T')[0],
            periodicity: payableFormData.periodicity,
            recurrenceIndex: i + 1,
            recurrenceTotal: count > 1 ? count : undefined,
            status: isPaid ? 'paid' : 'pending',
            paidDate: isPaid ? new Date().toISOString().split('T')[0] : undefined
        });

        // Increment date based on periodicity
        if (payableFormData.periodicity === 'mensal') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (payableFormData.periodicity === 'semanal') {
            currentDate.setDate(currentDate.getDate() + 7);
        } else if (payableFormData.periodicity === 'anual') {
            currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
    }

    setPayables(prev => [...prev, ...newPayables]);
    setIsPayableModalOpen(false);
    // Reset form
    setPayableFormData({
        description: '',
        isFixed: false,
        amount: '',
        dueDate: new Date().toISOString().split('T')[0],
        recurrenceCount: '1',
        periodicity: 'mensal',
        isPaid: false
    });
  };

  const togglePayableStatus = (id: string) => {
      setPayables(prev => prev.map(p => {
          if (p.id === id) {
              const newStatus = p.status === 'pending' ? 'paid' : 'pending';
              return { 
                  ...p, 
                  status: newStatus,
                  paidDate: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined
              };
          }
          return p;
      }));
  };

  const deletePayable = (id: string) => {
      if (confirm('Excluir esta conta?')) {
          setPayables(prev => prev.filter(p => p.id !== id));
      }
  };

  // --- Handlers (Common) ---
  const resetForm = () => {
    setFormData({
      eventDate: new Date().toISOString().split('T')[0],
      paymentDate: new Date().toISOString().split('T')[0],
      totalValue: 0,
      paidValue: 0,
      status: 'pending',
      category: settings.categories[0]?.name || 'Geral',
      clientName: ''
    });
    setIsSpotPayment(false); // Reset spot payment checkbox
  };

  const openEdit = (t: Transaction, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFormData(t);
    setIsSpotPayment(false); // When editing, we don't automatically check it to avoid overwriting the manual price
    setIsAddModalOpen(true);
  };

  const handleBackup = () => {
    const dataStr = StorageService.exportData();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `finor_backup_${new Date().toISOString().slice(0,10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const json = event.target?.result as string;
      const success = await StorageService.importData(json);
      if (success) {
        alert('Dados restaurados com sucesso!');
        window.location.reload();
      } else {
        alert('Erro ao restaurar arquivo.');
      }
    };
    reader.readAsText(file);
  };

  const handleOpenCalendar = (t: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    const dateStr = t.eventDate.replace(/-/g, '');
    const title = encodeURIComponent(`${t.clientName} - ${t.category}`);
    const details = encodeURIComponent(`Status: ${getStatusLabel(t.status)}\nValor Total: ${formatCurrency(t.totalValue)}\nValor Pago: ${formatCurrency(t.paidValue)}`);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}`;
    window.open(url, '_blank');
  };

  const handleExportExcel = () => {
      // Create CSV content for transactions
      const headers = ['ID', 'Cliente', 'Categoria', 'Data Evento', 'Data Pagamento', 'Valor Total', 'Valor Pago', 'Status'];
      const rows = transactions.map(t => [
          t.id.slice(0, 8),
          `"${t.clientName}"`,
          t.category,
          t.eventDate,
          t.paymentDate,
          t.totalValue.toFixed(2),
          t.paidValue.toFixed(2),
          t.status
      ]);

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + headers.join(";") + "\n" 
        + rows.map(e => e.join(";")).join("\n");

      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `finor_clientes_${new Date().toISOString().slice(0,10)}.csv`);
      link.click();
  };

  const handleGenerateReceipt = async () => {
    setIsGeneratingReceipt(true);
    const element = document.getElementById('receipt-content');
    
    if (element && window.html2canvas) {
        try {
            const clone = element.cloneNode(true) as HTMLElement;
            clone.style.width = '480px';
            clone.style.height = 'auto';
            clone.style.position = 'absolute';
            clone.style.top = '-9999px';
            clone.style.left = '0';
            clone.style.background = 'white';
            clone.style.overflow = 'visible';
            clone.classList.remove('overflow-y-auto');
            
            const header = clone.querySelector('#receipt-header');
            if (header) {
                header.classList.remove('hidden');
                header.classList.add('block');
            }
            document.body.appendChild(clone);
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const canvas = await window.html2canvas(clone, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, windowWidth: 500 });
            document.body.removeChild(clone);
            
            const link = document.createElement('a');
            const safeName = selectedTransaction?.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            link.download = `Comprovante-${safeName || 'finor'}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
        } catch (error) {
            console.error('Erro ao gerar imagem:', error);
            alert('Erro ao gerar imagem. Tente novamente.');
        }
    } else {
        alert('Biblioteca de imagem não carregada.');
    }
    setIsGeneratingReceipt(false);
  };

  // --- Bulk Selection Handlers ---
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Tem certeza que deseja excluir ${selectedIds.size} itens selecionados?`)) {
      setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
    }
  };

  const handleShareSelected = () => {
    if (selectedIds.size === 0) return;
    
    const selectedTransactions = transactions.filter(t => selectedIds.has(t.id));

    // Create CSV content for selected transactions
    const headers = ['ID', 'Cliente', 'Categoria', 'Data Evento', 'Data Pagamento', 'Valor Total', 'Valor Pago', 'Status'];
    const rows = selectedTransactions.map(t => [
        t.id.slice(0, 8),
        `"${t.clientName}"`,
        t.category,
        t.eventDate,
        t.paymentDate,
        t.totalValue.toFixed(2),
        t.paidValue.toFixed(2),
        t.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(";") + "\n" 
      + rows.map(e => e.join(";")).join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `finor_selecionados_${new Date().toISOString().slice(0,10)}.csv`);
    link.click();
  };

  // --- Render Helpers ---
  const getStatusColor = (status: TransactionStatus) => {
    switch (status) {
      case 'paid': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'pending': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'scheduled': return 'text-blue-600 bg-blue-50 border-blue-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  const getStatusLabel = (status: TransactionStatus) => {
    switch (status) {
      case 'paid': return 'Pago';
      case 'pending': return 'Pendente';
      case 'scheduled': return 'Agendado';
    }
  };

  // --- Settings Handlers ---
  const addPixKey = () => {
    const newKey: PixKey = { id: generateId(), name: 'Nova Chave', percent: 0 };
    setSettings(prev => ({ ...prev, pixKeys: [...prev.pixKeys, newKey] }));
  };
  const updatePixKey = (id: string, field: keyof PixKey, value: any) => {
    setSettings(prev => ({ ...prev, pixKeys: prev.pixKeys.map(k => k.id === id ? { ...k, [field]: value } : k) }));
  };
  const removePixKey = (id: string) => {
    setSettings(prev => ({ ...prev, pixKeys: prev.pixKeys.filter(k => k.id !== id) }));
  };
  const addCategory = () => {
    const newCat: CategoryItem = { id: generateId(), name: 'Nova Categoria', defaultValue: 0 };
    setSettings(prev => ({ ...prev, categories: [...prev.categories, newCat] }));
  };
  const updateCategory = (id: string, field: keyof CategoryItem, value: any) => {
    setSettings(prev => ({ ...prev, categories: prev.categories.map(c => c.id === id ? { ...c, [field]: value } : c) }));
  };
  const removeCategory = (id: string) => {
    setSettings(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
  };

  // --------------------------------------------------------------------------------
  // MAIN RENDER
  // --------------------------------------------------------------------------------

  // Render Dashboard View
  const renderDashboard = () => (
    <>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 px-4 py-3 print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-blue-600 tracking-tight">{APP_NAME}</h1>
            <p className="text-xs text-slate-400 font-medium -mt-1 tracking-wide uppercase">{APP_SUBTITLE}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentView('payables')}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Parcelamentos / Contas"
            >
              <CreditCard size={20} />
            </button>
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Configurações"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6 print:hidden">
        
        {/* Dashboard Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 border-none text-white shadow-emerald-200 shadow-lg">
            <div className="flex items-start justify-between mb-2 opacity-80">
              <span className="text-xs font-semibold uppercase tracking-wider">Recebido</span>
              <TrendingUp size={16} />
            </div>
            <div className="text-xl font-bold">{formatCurrency(stats.received)}</div>
          </Card>
          
          <Card 
            className="bg-white cursor-pointer active:scale-95 transition-all hover:bg-slate-50 hover:shadow-md relative group"
            onClick={() => setIsReceivablesListOpen(true)}
          >
            <div className="flex items-start justify-between mb-2 text-slate-400 group-hover:text-blue-500 transition-colors">
              <span className="text-xs font-semibold uppercase tracking-wider">A Receber</span>
              <TrendingDown size={16} className="text-red-400" />
            </div>
            <div className="text-xl font-bold text-slate-700">{formatCurrency(stats.receivable)}</div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronDown size={16} className="text-slate-400" />
            </div>
          </Card>
        </div>

        {/* Filters & Search */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['all', 'paid', 'pending', 'scheduled'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filterStatus === status 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {status === 'all' ? 'Todos' : getStatusLabel(status as any)}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions & Sort Controls */}
        <div className="flex items-center justify-between px-1 py-1">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                 <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition-all"
                    checked={filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length}
                    onChange={handleSelectAll}
                    disabled={filteredTransactions.length === 0}
                 />
                 <span className="text-sm font-medium text-slate-600">Todos</span>
              </label>

              {selectedIds.size > 0 && (
                <>
                <button 
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all text-xs font-bold uppercase tracking-wider animate-in fade-in slide-in-from-left-2 duration-200"
                >
                  <Trash2 size={14} />
                  <span>Excluir ({selectedIds.size})</span>
                </button>
                <button 
                  onClick={handleShareSelected}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all text-xs font-bold uppercase tracking-wider animate-in fade-in slide-in-from-left-2 duration-200"
                >
                  <Share2 size={14} />
                  <span>Exportar</span>
                </button>
                </>
              )}
            </div>

            <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                <button 
                  onClick={() => setSortOrder('asc')}
                  className={`p-1.5 rounded-md transition-all ${sortOrder === 'asc' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  title="Mais antigos primeiro"
                >
                  <ArrowUp size={18} />
                </button>
                <button 
                  onClick={() => setSortOrder('desc')}
                  className={`p-1.5 rounded-md transition-all ${sortOrder === 'desc' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  title="Mais recentes primeiro"
                >
                  <ArrowDown size={18} />
                </button>
            </div>
        </div>

        {/* Transaction List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-slate-800">Histórico</h2>
            <span className="text-xs text-slate-400 font-medium">{filteredTransactions.length} registros</span>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
              <Filter className="mx-auto mb-2 opacity-50" size={32} />
              <p>Nenhum registro encontrado</p>
            </div>
          ) : (
            filteredTransactions.map(t => (
              <div 
                key={t.id}
                onClick={() => setSelectedTransaction(t)}
                className={`group bg-white p-4 rounded-xl border transition-all cursor-pointer active:scale-[0.99] relative overflow-hidden flex gap-3 ${
                   selectedIds.has(t.id) ? 'border-blue-300 shadow-md ring-1 ring-blue-100' : 'border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200'
                }`}
              >
                 <div className={`absolute left-0 top-0 bottom-0 w-1 ${t.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                 
                 {/* Selection Checkbox */}
                 <div className="flex items-center z-10" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelection(t.id)}
                      className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition-all cursor-pointer"
                    />
                 </div>

                 <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-slate-800">{t.clientName}</h3>
                        <p className="text-xs text-slate-500">{t.category} • {formatDate(t.eventDate)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(t.status)}`}>
                          {getStatusLabel(t.status)}
                        </span>
                        {/* Inline edit actions */}
                        <div className="flex gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={(e) => handleOpenCalendar(t, e)} 
                              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                              title="Adicionar à Agenda"
                            >
                              <CalendarIcon size={14} />
                            </button>
                            <button onClick={(e) => openEdit(t, e)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={(e) => handleDelete(t.id, e)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 size={14} />
                            </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-slate-400 font-medium">
                        {t.status !== 'paid' && (
                          <span>Restante: <span className="text-red-500">{formatCurrency(t.totalValue - t.paidValue)}</span></span>
                        )}
                      </div>
                      <div className="text-lg font-bold text-slate-700">
                        {formatCurrency(t.totalValue)}
                      </div>
                    </div>
                 </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Floating Action Button (Only in Dashboard) */}
      <button 
        onClick={() => { resetForm(); setIsAddModalOpen(true); }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-400/40 flex items-center justify-center hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all z-40 print:hidden"
      >
        <Plus size={28} />
      </button>
    </>
  );

  // Render Payables View
  const renderPayables = () => (
    <>
      <div className="bg-blue-600 pb-8 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
         <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-b from-blue-500 to-blue-600 opacity-90 z-0"></div>
         <div className="max-w-3xl mx-auto px-4 pt-4 pb-8 relative z-10 text-white">
            <div className="flex justify-between items-center mb-6">
                <div className="text-center w-full relative">
                   <h1 className="text-xl font-bold">Pagamentos Agendados</h1>
                   <p className="text-xs text-blue-100 opacity-80 uppercase tracking-widest">{APP_SUBTITLE}</p>
                </div>
            </div>

            <div className="flex flex-col gap-3">
               <button 
                  onClick={handleExportExcel}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all"
               >
                  <FileSpreadsheet size={18} /> Exportar Excel
               </button>
               
               <button 
                  onClick={() => setIsPayableModalOpen(true)}
                  className="bg-white text-blue-600 px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
               >
                  <Plus size={18} /> Conta a pagar
               </button>

               <button 
                  onClick={() => setCurrentView('dashboard')}
                  className="bg-blue-800/40 hover:bg-blue-800/60 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all"
               >
                  <Home size={18} /> Voltar (Home)
               </button>
            </div>
         </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 -mt-6 relative z-20 pb-20">
         
         {/* Filter Toggles */}
         <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex gap-2 mb-4">
            <button 
               onClick={() => setShowPaidPayables(false)}
               className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${!showPaidPayables ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
               A Pagar
            </button>
            <button 
               onClick={() => setShowPaidPayables(true)}
               className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${showPaidPayables ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
               Pago
            </button>
         </div>

         {/* List */}
         <div className="space-y-3">
            {filteredPayables.length === 0 ? (
               <div className="bg-white rounded-xl p-8 text-center text-slate-400 border border-slate-100">
                  <CreditCard className="mx-auto mb-2 opacity-50" size={32} />
                  <p>Nenhum pagamento {showPaidPayables ? 'realizado' : 'agendado'}</p>
               </div>
            ) : (
               filteredPayables.map(item => (
                  <div key={item.id} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                     <div className="flex-1">
                        <h4 className="font-bold text-slate-800">{item.description}</h4>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.recurrenceTotal ? `${item.recurrenceIndex}/${item.recurrenceTotal}` : 'Único'}
                           </span>
                           {item.isFixed && <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Fixa</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Vencimento: {formatDate(item.dueDate)}</p>
                        {item.status === 'paid' && <p className="text-[10px] text-emerald-600">Pago em: {formatDate(item.paidDate || '')}</p>}
                     </div>
                     <div className="flex flex-col items-end gap-2">
                        <span className="font-bold text-slate-800 text-lg">{formatCurrency(item.amount)}</span>
                        <div className="flex gap-1">
                           <button 
                              onClick={() => deletePayable(item.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg"
                           >
                              <Trash2 size={16} />
                           </button>
                           <button 
                              onClick={() => togglePayableStatus(item.id)}
                              className={`p-1.5 rounded-lg transition-colors ${item.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500'}`}
                           >
                              <CheckCircle2 size={16} />
                           </button>
                        </div>
                     </div>
                  </div>
               ))
            )}
         </div>

      </main>

      {/* New Payable Modal */}
      {isPayableModalOpen && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsPayableModalOpen(false)} />
            <div className="bg-white w-full max-w-lg rounded-2xl p-6 relative z-10 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
               <h2 className="text-xl font-bold text-blue-600 mb-6">Novo Pagamento Recorrente</h2>
               <form onSubmit={handleSavePayable} className="space-y-4">
                  
                  <div>
                     <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Descrição</label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                           <input 
                              type="checkbox" 
                              checked={payableFormData.isFixed}
                              onChange={e => setPayableFormData({...payableFormData, isFixed: e.target.checked})}
                              className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 w-4 h-4"
                           />
                           <span className="text-xs text-slate-600">Conta Fixa</span>
                        </label>
                     </div>
                     <input 
                        required
                        type="text" 
                        value={payableFormData.description}
                        onChange={e => setPayableFormData({...payableFormData, description: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                     />
                  </div>

                  <div>
                     <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Valor da Parcela</label>
                         <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                               type="checkbox" 
                               checked={payableFormData.isPaid}
                               onChange={e => setPayableFormData({...payableFormData, isPaid: e.target.checked})}
                               className="rounded text-emerald-500 focus:ring-emerald-500 border-gray-300 w-4 h-4 text-emerald-600 checked:bg-emerald-500"
                            />
                            <span className="text-xs font-bold text-emerald-600">Já pago</span>
                         </label>
                     </div>
                     <input 
                        required
                        type="number" 
                        step="0.01"
                        value={payableFormData.amount}
                        onChange={e => setPayableFormData({...payableFormData, amount: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                     />
                  </div>

                  <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase mb-1">Data de Vencimento Inicial</label>
                     <input 
                        required
                        type="date" 
                        value={payableFormData.dueDate}
                        onChange={e => setPayableFormData({...payableFormData, dueDate: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                     />
                  </div>

                  <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase mb-1">Número de Recorrências</label>
                     <input 
                        required
                        type="number" 
                        min="1"
                        value={payableFormData.recurrenceCount}
                        onChange={e => setPayableFormData({...payableFormData, recurrenceCount: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                     />
                     <p className="text-[10px] text-slate-400 mt-1">Ex: 1 para pagamento único, 12 para um ano.</p>
                  </div>

                  <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase mb-1">Periodicidade</label>
                     <select 
                        value={payableFormData.periodicity}
                        onChange={e => setPayableFormData({...payableFormData, periodicity: e.target.value as any})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-white"
                     >
                        <option value="mensal">Mensal</option>
                        <option value="semanal">Semanal</option>
                        <option value="anual">Anual</option>
                        <option value="unico">Único</option>
                     </select>
                  </div>

                  <div className="pt-4 flex gap-3">
                     <Button type="button" variant="ghost" fullWidth onClick={() => setIsPayableModalOpen(false)}>Cancelar</Button>
                     <Button type="submit" fullWidth>Salvar</Button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-slate-50">
       {currentView === 'dashboard' ? renderDashboard() : renderPayables()}

       {/* Common Modals */}
       {/* Debtors List Modal */}
       {isReceivablesListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsReceivablesListOpen(false)} />
          <div className="bg-white w-full max-w-lg rounded-2xl p-0 relative z-10 animate-in zoom-in-95 duration-200 shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle size={20} />
                <h2 className="text-lg font-bold">Clientes com Pendências</h2>
              </div>
              <button onClick={() => setIsReceivablesListOpen(false)} className="bg-slate-100 p-1.5 rounded-full text-slate-500 hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 bg-slate-50">
              {debtors.length === 0 ? (
                <div className="text-center py-8 text-slate-400"><p>Nenhuma pendência encontrada.</p></div>
              ) : (
                debtors.map(t => (
                  <div key={t.id} onClick={() => setIsReceivablesListOpen(false)} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-red-200 hover:shadow-md transition-all cursor-pointer active:scale-95 flex justify-between items-center">
                    <div><h4 className="font-bold text-slate-800">{t.clientName}</h4><p className="text-xs text-slate-500 font-medium">Data: {formatDate(t.eventDate)}</p></div>
                    <div className="text-right"><span className="block font-bold text-red-500 text-lg">{formatCurrency(t.totalValue - t.paidValue)}</span><span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Restante</span></div>
                  </div>
                ))
              )}
            </div>
             <div className="p-3 bg-white border-t border-slate-100 text-center text-xs text-slate-400">Toque em um item para voltar à tela principal</div>
          </div>
        </div>
      )}

      {/* Add/Edit Transaction Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none print:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => setIsAddModalOpen(false)} />
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-6 relative pointer-events-auto animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-slate-800">{formData.id ? 'Editar Pagamento' : 'Novo Pagamento'}</h2><button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-500" /></button></div>
            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cliente</label><input required type="text" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Nome do cliente"/></div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Categoria</label>
                    <div className="relative">
                        <select 
                            value={formData.category} 
                            onChange={handleCategoryChange} 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none appearance-none bg-white"
                        >
                            {settings.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                 </div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Data Evento</label><input type="date" value={formData.eventDate} onChange={e => setFormData({...formData, eventDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"/></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase">Valor Total</label>
                        {!formData.id && ( // Only show discount toggle for new items or manual check
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={isSpotPayment}
                                    onChange={handleSpotPaymentToggle}
                                    className="rounded text-emerald-500 focus:ring-emerald-500 border-gray-300 w-3.5 h-3.5"
                                />
                                <span className="text-[10px] font-bold text-emerald-600">À vista (-{settings.discountPercent}%)</span>
                            </label>
                        )}
                    </div>
                    <input type="number" step="0.01" value={formData.totalValue} onChange={e => setFormData({...formData, totalValue: Number(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-medium" placeholder="0,00"/>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Valor Pago</label><input type="number" step="0.01" value={formData.paidValue} onChange={e => setFormData({...formData, paidValue: Number(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-medium text-emerald-600" placeholder="0,00"/></div>
              </div>
               <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Data Pagamento</label><input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"/></div>
              <div className="pt-4 flex gap-3"><Button type="button" variant="ghost" fullWidth onClick={() => setIsAddModalOpen(false)}>Cancelar</Button><Button type="submit" fullWidth>Salvar</Button></div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsSettingsModalOpen(false)} />
          <div className="bg-white w-full max-w-lg rounded-2xl p-0 relative z-10 animate-in zoom-in-95 duration-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
             <div className="px-6 py-4 bg-blue-600 text-white flex justify-between items-center"><h2 className="text-xl font-bold">Configurações</h2><button onClick={() => setIsSettingsModalOpen(false)} className="bg-white/20 p-1.5 rounded-full hover:bg-white/30"><X size={20} /></button></div>
            <div className="overflow-y-auto p-6 space-y-8">
              <section>
                <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Chaves PIX e Distribuição</h3></div>
                <div className="space-y-3">
                  {settings.pixKeys.map((key) => (
                    <div key={key.id} className="flex gap-2 items-center"><input type="text" value={key.name} onChange={(e) => updatePixKey(key.id, 'name', e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none" placeholder="Nome da Chave"/><div className="relative w-24"><input type="number" value={key.percent} onChange={(e) => updatePixKey(key.id, 'percent', Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-right pr-6 text-sm focus:border-blue-500 outline-none"/><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span></div><button onClick={() => removePixKey(key.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></div>
                  ))}
                  <button onClick={addPixKey} className="text-sm text-blue-600 font-medium flex items-center gap-1 mt-2 hover:underline"><Plus size={16} /> Adicionar Chave</button>
                </div>
              </section>
              <hr className="border-slate-100" />
              <section>
                 <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Desconto À Vista</h3>
                 </div>
                 <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Percent size={18} /></div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">Porcentagem de Desconto</p>
                        <p className="text-xs text-slate-400">Aplicado quando a opção "À vista" é marcada</p>
                    </div>
                    <div className="relative w-24">
                        <input 
                            type="number" 
                            value={settings.discountPercent || 0} 
                            onChange={(e) => setSettings({...settings, discountPercent: Number(e.target.value)})}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-right pr-6 text-sm focus:border-emerald-500 outline-none font-bold text-slate-700"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                    </div>
                 </div>
              </section>
              <hr className="border-slate-100" />
              <section>
                <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Categorias de Pagamento</h3></div>
                <div className="space-y-3">
                  {settings.categories.map((cat) => (
                    <div key={cat.id} className="flex gap-2 items-center"><input type="text" value={cat.name} onChange={(e) => updateCategory(cat.id, 'name', e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none" placeholder="Nome da Categoria"/><div className="relative w-28"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span><input type="number" value={cat.defaultValue} onChange={(e) => updateCategory(cat.id, 'defaultValue', Number(e.target.value))} className="w-full px-3 py-2 pl-7 rounded-lg border border-slate-200 text-right text-sm focus:border-blue-500 outline-none"/></div><button onClick={() => removeCategory(cat.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></div>
                  ))}
                  <button onClick={addCategory} className="text-sm text-blue-600 font-medium flex items-center gap-1 mt-2 hover:underline"><Plus size={16} /> Adicionar Nova Categoria</button>
                </div>
              </section>
              <hr className="border-slate-100" />
              <section>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">Dados e Backup</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleBackup} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors text-sm font-medium"><Download size={16} /> Fazer Backup (JSON)</button>
                  <button onClick={handleRestoreClick} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors text-sm font-medium"><Upload size={16} /> Restaurar Tudo</button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                </div>
              </section>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50"><Button fullWidth onClick={() => setIsSettingsModalOpen(false)}>FECHAR</Button></div>
          </div>
        </div>
      )}

       {/* Calendar Confirmation Prompt */}
       {showCalendarPrompt && tempTransaction && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 print:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 relative z-10 animate-in zoom-in-95 duration-200 shadow-xl text-center">
               <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600"><CalendarCheck size={32} /></div>
               <h3 className="text-xl font-bold text-slate-800 mb-2">Agendar no Calendar?</h3>
               <p className="text-slate-500 mb-6 leading-relaxed">Deseja adicionar o evento de <strong>{tempTransaction.clientName}</strong> no Google Calendar para o dia <strong>{formatDate(tempTransaction.eventDate)}</strong>?</p>
               <div className="space-y-3"><Button onClick={handleConfirmSchedule} fullWidth className="bg-blue-600 hover:bg-blue-700">Sim, Agendar</Button><Button onClick={handleSkipSchedule} variant="ghost" fullWidth>Não, apenas salvar</Button></div>
            </div>
         </div>
      )}

      {/* Transaction Details / Receipt Popup */}
      {selectedTransaction && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none print:items-start print:static print:bg-white print:h-auto">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto print:hidden" onClick={() => setSelectedTransaction(null)} />
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-0 relative pointer-events-auto animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh] print:shadow-none print:animate-none print:max-w-none print:w-full">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 print:hidden"><button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><ArrowLeft size={20} /></button><h3 className="text-lg font-bold text-slate-800">Detalhes do Cliente/Pagamento</h3></div>
            <div id="receipt-content" className="p-6 overflow-y-auto no-scrollbar print:overflow-visible print:p-0 bg-white">
              <div id="receipt-header" className="text-center mb-6 hidden print:block"><h1 className="text-3xl font-bold text-blue-600">{APP_NAME}</h1><p className="text-slate-500 uppercase text-xs">{APP_SUBTITLE}</p><h2 className="text-xl font-bold mt-4 border-b pb-2">Comprovante de Pagamento</h2></div>
              <div className="space-y-3 mb-6"><div><label className="text-xs text-slate-400 font-bold uppercase">ID do Cliente</label><p className="text-slate-800 font-mono text-sm">{selectedTransaction.id.slice(0, 8).toUpperCase()}</p></div><div><label className="text-xs text-slate-400 font-bold uppercase">Nome do Cliente</label><p className="text-lg font-bold text-slate-800 leading-tight">{selectedTransaction.clientName}</p></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-slate-400 font-bold uppercase">Data do Evento</label><p className="text-slate-700">{formatDate(selectedTransaction.eventDate)}</p></div><div><label className="text-xs text-slate-400 font-bold uppercase">Data do Pagamento</label><p className="text-slate-700">{formatDate(selectedTransaction.paymentDate)}</p></div></div><div><label className="text-xs text-slate-400 font-bold uppercase">Categoria</label><p className="text-slate-700">{selectedTransaction.category}</p></div></div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6 print:border-slate-300"><div className="flex justify-between items-center mb-2"><span className="text-sm font-medium text-slate-600">Valor Total</span><span className="font-bold text-slate-800">{formatCurrency(selectedTransaction.totalValue)}</span></div><div className="flex justify-between items-center mb-2"><span className="text-sm font-medium text-slate-600">Valor Pago</span><span className="font-bold text-emerald-600">{formatCurrency(selectedTransaction.paidValue)}</span></div><div className="flex justify-between items-center pt-2 border-t border-slate-200"><span className="text-sm font-medium text-slate-600">Valor Restante</span><span className={`font-bold ${selectedTransaction.totalValue - selectedTransaction.paidValue > 0 ? 'text-red-500' : 'text-slate-400'}`}>{formatCurrency(selectedTransaction.totalValue - selectedTransaction.paidValue)}</span></div></div>
              <div className="mb-6"><h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">Distribuição (Sobre Valor Pago)</h4><div className="space-y-2">{settings.pixKeys.map((key) => {const val = (selectedTransaction.paidValue * key.percent) / 100; return (<div key={key.id} className="flex justify-between items-center text-sm"><span className="text-slate-600">{key.name}</span><span className="font-medium text-slate-700">{formatCurrency(val)}</span></div>)})}</div></div>
            </div>
             <div className="p-4 border-t border-slate-100 flex flex-col gap-3 print:hidden"><Button variant="secondary" onClick={handleGenerateReceipt} className="flex items-center justify-center gap-2 relative overflow-hidden" disabled={isGeneratingReceipt}>{isGeneratingReceipt ? (<span>Gerando...</span>) : (<><ImageIcon size={18} /> Salvar Comprovante (JPEG)</>)}</Button><Button variant="outline" onClick={() => setSelectedTransaction(null)}>Voltar</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}