
// Use consolidated React import to ensure JSX namespace and intrinsic elements are correctly recognized.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Trash2, Printer, Mic, MicOff, Send, Sparkles, 
  Users, X, Check, Save,
  Layout, Moon, Sun, QrCode, Download, Share2, FileText, Image as ImageIcon, Loader2, Building2
} from 'lucide-react';
import { Invoice, LineItem, AIParsedInvoice, Customer } from './types';
import { parseInvoiceText } from './geminiService';

const DEFAULT_INVOICE: Invoice = {
  businessInfo: {
    name: 'Your Business Name',
    address: 'City, State, Country',
    email: 'contact@business.com',
    phone: '+1 000 000 0000',
    taxNumber: 'TAX-000000',
    bankDetails: 'SWIFT: BANKCODE\nIBAN: ACCOUNT-NUMBER'
  },
  customerName: 'Customer Name',
  customerAddress: 'Customer Address',
  customerTaxNumber: '',
  date: new Date().toISOString().split('T')[0],
  deliveryDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  invoiceNumber: `INV-${new Date().getFullYear()}-001`,
  items: [
    { id: '1', description: 'Sample Item', subDescription: '', quantity: 1, rate: 100, total: 100, unit: '' }
  ],
  currency: '₹',
  notes: 'Thank you for your business!',
  terms: 'Payment is due within 7 days.'
};

function App() {
  const [invoice, setInvoice] = useState<Invoice>(DEFAULT_INVOICE);
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Omit<Customer, 'id'>>({ name: '', email: '', address: '', phone: '', taxNumber: '' });

  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedCustomers = localStorage.getItem('billgenius_customers');
    if (savedCustomers) setCustomers(JSON.parse(savedCustomers));
  }, []);

  const saveCustomers = (updated: Customer[]) => {
    setCustomers(updated);
    localStorage.setItem('billgenius_customers', JSON.stringify(updated));
  };

  const subtotal = useMemo(() => 
    invoice.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0),
  [invoice.items]);

  const grandTotal = subtotal;

  const handleItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === id) {
          const val = field === 'quantity' || field === 'rate' ? (value === '' ? 0 : Number(value)) : value;
          const updatedItem = { ...item, [field]: val };
          if (field === 'quantity' || field === 'rate') {
            updatedItem.total = Number(updatedItem.quantity) * Number(updatedItem.rate);
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const addItem = () => {
    const newItem: LineItem = {
      id: Math.random().toString(36).substring(2, 9),
      description: '',
      subDescription: '',
      quantity: 1,
      rate: 1, 
      total: 1,
      unit: ''
    };
    setInvoice(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const removeItem = (id: string) => {
    if (invoice.items.length === 1) return;
    setInvoice(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
  };

  const handleAiInput = async () => {
    if (!aiInput.trim()) return;
    setIsProcessing(true);
    try {
      const parsed = await parseInvoiceText(aiInput);
      applyAiData(parsed);
      setAiInput('');
    } catch (error) {
      console.error(error);
      alert("AI failed to process. Try being more specific!");
    } finally {
      setIsProcessing(false);
    }
  };

  const applyAiData = (data: AIParsedInvoice) => {
    const matchedCustomer = customers.find(c => c.name.toLowerCase() === data.customerName?.toLowerCase());
    setInvoice(prev => ({
      ...prev,
      customerName: data.customerName || prev.customerName,
      customerAddress: matchedCustomer?.address || prev.customerAddress,
      customerTaxNumber: matchedCustomer?.taxNumber || prev.customerTaxNumber,
      items: data.items ? data.items.map(item => ({
        id: Math.random().toString(36).substring(2, 9),
        description: item.description,
        subDescription: item.subDescription || '',
        quantity: item.quantity || 1,
        rate: item.rate || 1,
        total: (item.quantity || 1) * (item.rate || 1),
        unit: ''
      })) : prev.items
    }));
  };

  const generateCanvas = async () => {
    if (!exportRef.current) return null;
    return await (window as any).html2canvas(exportRef.current, {
      scale: 2, // High resolution
      useCORS: true,
      backgroundColor: previewTheme === 'dark' ? '#0f172a' : '#ffffff'
    });
  };

  const handleExportPNG = async () => {
    setIsExporting(true);
    try {
      const canvas = await generateCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${invoice.invoiceNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const canvas = await generateCanvas();
      if (!canvas) return;
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = (window as any).jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${invoice.invoiceNumber}.pdf`);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleShare = async () => {
    setIsExporting(true);
    try {
      const canvas = await generateCanvas();
      if (!canvas) return;
      
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      const file = new File([blob], `${invoice.invoiceNumber}.png`, { type: 'image/png' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${invoice.invoiceNumber}`,
          text: `Invoice from ${invoice.businessInfo.name}`
        });
      } else {
        alert("Sharing not supported on this browser. Use Download instead.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech not supported");
    const recognition = new SpeechRecognition();
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => setAiInput(event.results[0][0].transcript);
    if (isListening) recognition.stop();
    else recognition.start();
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;
    const customer: Customer = { ...newCustomer, id: Date.now().toString() };
    saveCustomers([...customers, customer]);
    setNewCustomer({ name: '', email: '', address: '', phone: '', taxNumber: '' });
    setIsCustomerModalOpen(false);
  };

  const selectCustomer = (c: Customer) => {
    setInvoice({ ...invoice, customerName: c.name, customerAddress: c.address || '', customerTaxNumber: c.taxNumber || '' });
    setShowCustomerDropdown(false);
  };

  const isLight = previewTheme === 'light';

  const formatCurrency = (val: number) => {
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col relative">
      {isExporting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-2xl flex items-center space-x-4">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            <span className="font-bold text-slate-800">Generating high-quality export...</span>
          </div>
        </div>
      )}

      {/* Sidebar Editor Style Layout */}
      <nav className="bg-white border-b sticky top-0 z-50 no-print px-6 h-16 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Layout className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Invoice<span className="text-indigo-600">Studio</span></h1>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button onClick={() => setPreviewTheme(isLight ? 'dark' : 'light')} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
            {isLight ? <Moon className="w-5 h-5 text-slate-600" /> : <Sun className="w-5 h-5 text-amber-500" />}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-5 py-2 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <button onClick={() => { window.print(); setShowExportMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-slate-50 text-slate-700 transition-colors">
                  <Printer className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold">Print Invoice</span>
                </button>
                <button onClick={handleExportPDF} className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-slate-50 text-slate-700 transition-colors">
                  <FileText className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold">Save as PDF</span>
                </button>
                <button onClick={handleExportPNG} className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-slate-50 text-slate-700 transition-colors">
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold">Save as Image</span>
                </button>
                <button onClick={handleShare} className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-slate-50 text-slate-700 transition-colors">
                  <Share2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold">Share Invoice</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-grow flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Inputs */}
        <div className="w-full lg:w-[450px] bg-white border-r overflow-y-auto no-print p-6 space-y-8 shrink-0">
          
          <section className="space-y-4">
            <div className="flex items-center space-x-2 text-indigo-600">
              <Sparkles className="w-5 h-5" />
              <h2 className="font-bold uppercase tracking-widest text-xs">AI Assistant</h2>
            </div>
            <div className="relative">
              <textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder='e.g., "Charge Alex for 5 bags of cement at 450 each"'
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 focus:ring-2 focus:ring-indigo-500 min-h-[100px] text-sm resize-none"
              />
              <button onClick={toggleListening} className={`absolute bottom-3 right-3 p-2 rounded-xl transition-all ${isListening ? 'bg-red-600 text-white' : 'bg-white border text-slate-400'}`}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={handleAiInput} disabled={isProcessing || !aiInput.trim()} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center space-x-2">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Generate Draft</span>
            </button>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold uppercase tracking-widest text-xs text-slate-400">Company Settings (Sender)</h2>
            </div>
            
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <Building2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Business Information</span>
              </div>
              <input type="text" placeholder="Your Business Name" value={invoice.businessInfo.name} onChange={(e) => setInvoice({...invoice, businessInfo: {...invoice.businessInfo, name: e.target.value}})} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 text-sm" />
              <textarea placeholder="Business Address" value={invoice.businessInfo.address} onChange={(e) => setInvoice({...invoice, businessInfo: {...invoice.businessInfo, address: e.target.value}})} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 text-sm min-h-[60px]" />
              <div className="grid grid-cols-2 gap-2">
                 <input type="text" placeholder="Tax ID / GSTIN" value={invoice.businessInfo.taxNumber} onChange={(e) => setInvoice({...invoice, businessInfo: {...invoice.businessInfo, taxNumber: e.target.value}})} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 text-xs" />
                 <input type="text" placeholder="Phone" value={invoice.businessInfo.phone} onChange={(e) => setInvoice({...invoice, businessInfo: {...invoice.businessInfo, phone: e.target.value}})} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 text-xs" />
              </div>
              <input type="email" placeholder="Email" value={invoice.businessInfo.email} onChange={(e) => setInvoice({...invoice, businessInfo: {...invoice.businessInfo, email: e.target.value}})} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 text-xs" />
              <textarea placeholder="Bank Details (SWIFT/IBAN)" value={invoice.businessInfo.bankDetails} onChange={(e) => setInvoice({...invoice, businessInfo: {...invoice.businessInfo, bankDetails: e.target.value}})} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 text-[10px] min-h-[50px]" />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bill To (Recipient)</label>
                <button onClick={() => setShowCustomerDropdown(!showCustomerDropdown)} className="text-[10px] text-indigo-600 font-bold hover:underline uppercase">Clients</button>
              </div>
              {showCustomerDropdown && (
                <div className="bg-slate-50 border rounded-xl p-2 max-h-40 overflow-y-auto mb-2 space-y-1 shadow-inner">
                  {customers.map(c => <button key={c.id} onClick={() => selectCustomer(c)} className="w-full text-left p-2 hover:bg-white rounded-lg text-xs font-medium">{c.name}</button>)}
                  {customers.length === 0 && <p className="text-[10px] text-slate-400 p-2 italic text-center">No saved customers</p>}
                </div>
              )}
              <input type="text" placeholder="Client Name" value={invoice.customerName} onChange={(e) => setInvoice({ ...invoice, customerName: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 text-sm" />
              <textarea placeholder="Client Address" value={invoice.customerAddress} onChange={(e) => setInvoice({ ...invoice, customerAddress: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 text-sm min-h-[60px]" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice #</label>
                <input type="text" value={invoice.invoiceNumber} onChange={(e) => setInvoice({ ...invoice, invoiceNumber: e.target.value })} className="w-full bg-white border-b border-slate-200 p-1 text-sm outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</label>
                <input type="date" value={invoice.date} onChange={(e) => setInvoice({ ...invoice, date: e.target.value })} className="w-full bg-white border-b border-slate-200 p-1 text-sm outline-none" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
             <div className="flex justify-between items-center">
              <h2 className="font-bold uppercase tracking-widest text-xs text-slate-400">Items (Goods/Services)</h2>
              <button onClick={addItem} className="bg-indigo-50 text-indigo-600 p-1.5 hover:bg-indigo-100 rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
            {invoice.items.map((item, idx) => (
              <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 relative group space-y-2">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-bold text-slate-400">Item #{idx + 1}</span>
                   <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <input type="text" placeholder="Description of goods" value={item.description} onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} className="w-full font-bold bg-white border border-slate-200 rounded-xl p-2 outline-none text-sm" />
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold">QTY</label>
                    <input 
                      type="number" 
                      value={item.quantity === 0 ? '' : item.quantity} 
                      placeholder="0"
                      onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)} 
                      onFocus={(e) => e.target.select()}
                      onBlur={() => { if(!item.quantity) handleItemChange(item.id, 'quantity', 1) }}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs" 
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold">RATE</label>
                    <input 
                      type="number" 
                      value={item.rate === 0 ? '' : item.rate} 
                      placeholder="0"
                      onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)} 
                      onFocus={(e) => e.target.select()}
                      onBlur={() => { if(!item.rate) handleItemChange(item.id, 'rate', 1) }}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs" 
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* Right Side: Paper Preview */}
        <div className="flex-grow bg-slate-200 overflow-y-auto p-4 lg:p-12 relative flex justify-center print:bg-white print:p-0">
          
          <div 
            ref={exportRef}
            id="invoice-paper"
            className={`w-full max-w-[850px] min-h-[1100px] shadow-2xl relative overflow-hidden transition-colors duration-500 rounded-[2rem] print:rounded-none print:shadow-none ${isLight ? 'bg-white text-slate-800' : 'bg-slate-900 text-white'}`}
          >
            
            {/* Background Blobs - Hidden in print to save ink */}
            <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[100px] opacity-20 no-print ${isLight ? 'bg-indigo-500' : 'bg-blue-400'}`} />
            <div className={`absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-[100px] opacity-10 no-print ${isLight ? 'bg-indigo-400' : 'bg-indigo-600'}`} />

            {/* Content Layer */}
            <div className="relative z-10 p-12 lg:p-16 flex flex-col min-h-full">
              
              {/* Header */}
              <div className="flex justify-between items-start mb-16">
                <div className="flex items-center space-x-3">
                   <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg">
                      <Layout className="text-white w-8 h-8" />
                   </div>
                   <h2 className="text-3xl font-black tracking-tighter">BillGenius</h2>
                </div>
                <div className="text-right space-y-1 text-xs">
                  <div className="flex justify-end gap-3"><span className="text-slate-400 font-bold uppercase tracking-widest">Invoice</span> <span className="font-bold">{invoice.invoiceNumber}</span></div>
                  <div className="flex justify-end gap-3"><span className="text-slate-400 font-bold uppercase tracking-widest">Issued</span> <span className="font-bold">{new Date(invoice.date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})}</span></div>
                </div>
              </div>

              {/* To/From */}
              <div className="grid grid-cols-2 gap-12 mb-16 text-sm">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Bill To</p>
                  <p className="font-black text-xl underline decoration-indigo-500 underline-offset-4">{invoice.customerName}</p>
                  <p className="text-slate-400 leading-relaxed whitespace-pre-line">{invoice.customerAddress || 'Address not provided'}</p>
                  {invoice.customerTaxNumber && <p className="text-xs font-bold text-slate-400">Customer Tax ID: {invoice.customerTaxNumber}</p>}
                </div>
                <div className="text-right space-y-4">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">From</p>
                   <p className="font-black text-xl">{invoice.businessInfo.name}</p>
                   <p className="text-slate-400 leading-relaxed whitespace-pre-line">{invoice.businessInfo.address}</p>
                   <div className="text-[10px] text-slate-400 font-bold space-y-0.5 mt-2">
                     <p>Tax ID: {invoice.businessInfo.taxNumber}</p>
                     <p>{invoice.businessInfo.email}</p>
                     <p>{invoice.businessInfo.phone}</p>
                   </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="flex-grow mb-12">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-indigo-600 text-white shadow-lg overflow-hidden first:rounded-l-2xl last:rounded-r-2xl">
                      <th className="py-3 px-6 text-left rounded-l-xl font-bold uppercase tracking-widest text-[10px]">Description</th>
                      <th className="py-3 px-4 text-right font-bold uppercase tracking-widest text-[10px]">Price</th>
                      <th className="py-3 px-4 text-right font-bold uppercase tracking-widest text-[10px]">Qty</th>
                      <th className="py-3 px-6 text-right rounded-r-xl font-bold uppercase tracking-widest text-[10px]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/10">
                    {invoice.items.map((item, idx) => (
                      <tr key={item.id} className="group">
                        <td className="py-6 px-6">
                          <p className="font-bold flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-medium">#{idx + 1}</span>
                            {item.description || 'New Product'}
                          </p>
                        </td>
                        <td className="py-6 px-4 text-right text-slate-400 font-medium">{invoice.currency} {formatCurrency(item.rate)}</td>
                        <td className="py-6 px-4 text-right text-slate-400 font-medium">{item.quantity}</td>
                        <td className="py-6 px-6 text-right font-bold">{invoice.currency} {formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                    <tr className="no-print">
                      <td colSpan={4} className="py-4">
                        <button onClick={addItem} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-xs hover:border-indigo-400 hover:text-indigo-400 transition-all">Add new item</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="flex flex-col items-end space-y-3 mb-16">
                <div className={`flex justify-between w-64 py-6 border-t-2 ${isLight ? 'border-slate-900/10' : 'border-white/10'}`}>
                  <span className="text-indigo-600 font-black uppercase tracking-[0.2em] text-xs">Grand Total</span>
                  <span className={`text-3xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {invoice.currency} {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Footer Section */}
              <div className="mt-auto grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-slate-100/10 text-[10px]">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="font-black uppercase tracking-widest text-indigo-500">Notes & Comments</p>
                    <p className="text-slate-400 leading-relaxed">{invoice.notes}</p>
                  </div>
                  <div className="flex items-center space-x-4 pt-4">
                    <div className="p-2 bg-slate-100/10 rounded-lg">
                      <QrCode className="w-12 h-12" />
                    </div>
                    <div className="space-y-1 text-slate-400">
                      <p className="font-bold text-slate-200">Payment Details:</p>
                      <p className="whitespace-pre-line">{invoice.businessInfo.bankDetails}</p>
                      <p className="mt-1">Reference: {invoice.invoiceNumber}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col justify-end space-y-1 text-slate-400">
                  <p className="font-bold text-slate-200 tracking-wider">Generated by BillGenius AI</p>
                  <p>Support: {invoice.businessInfo.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Customer Directory Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <Users className="text-indigo-600 w-6 h-6" />
                <h2 className="text-xl font-bold text-slate-800">Saved Clients</h2>
              </div>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Add New Client</h3>
                <input required placeholder="Client Name" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                <textarea placeholder="Client Address" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[80px]" />
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>Save Client</span>
                </button>
              </form>
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Client Database</h3>
                <div className="flex-grow overflow-y-auto max-h-[340px] space-y-2 pr-2">
                  {customers.map(c => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 group flex justify-between items-center">
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-800 truncate">{c.name}</p>
                      </div>
                      <button onClick={() => { selectCustomer(c); setIsCustomerModalOpen(false); }} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg"><Check className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {customers.length === 0 && <p className="text-xs text-slate-400 text-center py-4 italic">No clients saved yet</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
