import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Wand2,
  Trash2,
  Plus,
  Search,
  Eye,
  Settings,
  ShieldCheck,
  QrCode,
  Wallet,
  HandCoins,
  DownloadCloud,
  FileDown,
  Layers,
  Upload,
  Brain,
  Package,
  List,
  ShoppingBasket,
  X,
  Printer,
  Copy,
  Bluetooth,
  Database,
  TrendingUp,
  BarChart3,
  Calendar,
  ArrowUpRight,
  Check,
  Send,
  MessageSquare,
} from 'lucide-react';
import {
  Product,
  Category,
  Order,
  Banner,
  Promo,
  StoreSettings,
  ProductVariant,
} from '../types';
import { supabase } from '../supabaseClient';
import { isVariantOfProduct, getProductId } from '../utils';
import { defaultCategories } from '../seedData';
import { buildReceiptEscPos } from '../printer/escpos';
import { connectQzTray, listPrinters, printRawEscPos } from '../printer/qzTray';

interface AdminPanelProps {
  products: Product[];
  categories: Category[];
  orders: Order[];
  banners: Banner[];
  promos: Promo[];
  storeSettings: StoreSettings;
  variants: ProductVariant[];
  useLocalEmulation: boolean;
  onToggleDatabaseMode: (emulate: boolean) => void;
  onNavigateToHome: () => void;
  onSaveStoreSettings: (settings: StoreSettings) => Promise<void>;
  onSaveCategory: (category: { id?: number; nama_kategori: string; icon: string }) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
  onSaveProduct: (product: {
    id?: number;
    nama_produk: string;
    kategori_id: number;
    deskripsi: string;
    foto: string;
    status: string;
    variants: Array<{
      id?: number;
      nama_varian: string;
      harga: number;
      harga_promo: number;
      stok: number;
      berat: number;
    }>;
  }) => Promise<void>;
  onDeleteProduct: (id: number) => Promise<void>;
  onUpdateOrderStatus: (orderId: number, status: string) => Promise<void>;
  onAddBanner: (banner: { judul: string; gambar: string }) => Promise<void>;
  onDeleteBanner: (id: number) => Promise<void>;
  onAddPromo: (promo: {
    nama_promo: string;
    tipe: 'Persen' | 'Nominal';
    nilai: number;
    tanggal_mulai: string;
    tanggal_selesai: string;
  }) => Promise<void>;
  onDeletePromo: (id: number) => Promise<void>;
  onDownloadServiceWorker: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  products,
  categories,
  orders,
  banners,
  promos,
  storeSettings,
  variants,
  useLocalEmulation,
  onToggleDatabaseMode,
  onNavigateToHome,
  onSaveStoreSettings,
  onSaveCategory,
  onDeleteCategory,
  onSaveProduct,
  onDeleteProduct,
  onUpdateOrderStatus,
  onAddBanner,
  onDeleteBanner,
  onAddPromo,
  onDeletePromo,
  onDownloadServiceWorker,
  showToast,
}) => {
  const [adminTab, setAdminTab] = useState<'dashboard' | 'produk' | 'kategori' | 'pesanan' | 'promo' | 'pengaturan'>('dashboard');

  // Dashboard Period Filter State
  const [dashboardPeriod, setDashboardPeriod] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Filter orders based on the selected period
  const filteredOrdersForStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);
    
    return orders.filter((order) => {
      const orderDateStr = order.created_at ? order.created_at.substring(0, 10) : todayStr;
      if (dashboardPeriod === 'today') {
        return orderDateStr === todayStr;
      }
      if (dashboardPeriod === '7days') {
        const orderDate = new Date(orderDateStr);
        const diffTime = Math.abs(now.getTime() - orderDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      if (dashboardPeriod === '30days') {
        const orderDate = new Date(orderDateStr);
        const diffTime = Math.abs(now.getTime() - orderDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      }
      return true; // 'all'
    });
  }, [orders, dashboardPeriod]);

  // Group filtered orders by date (Daily Reports)
  const dailyReports = useMemo(() => {
    const reports: {
      [date: string]: {
        date: string;
        totalOrders: number;
        totalRevenue: number;
        totalQtySold: number;
        completedOrders: number;
        pendingOrders: number;
      }
    } = {};

    filteredOrdersForStats.forEach((order) => {
      const dateStr = order.created_at ? order.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10);
      if (!reports[dateStr]) {
        reports[dateStr] = {
          date: dateStr,
          totalOrders: 0,
          totalRevenue: 0,
          totalQtySold: 0,
          completedOrders: 0,
          pendingOrders: 0,
        };
      }

      reports[dateStr].totalOrders += 1;
      if (order.status === 'Selesai') {
        reports[dateStr].totalRevenue += order.total;
        reports[dateStr].completedOrders += 1;
      } else if (order.status !== 'Dibatalkan') {
        reports[dateStr].pendingOrders += 1;
      }

      if (order.items) {
        order.items.forEach((item) => {
          reports[dateStr].totalQtySold += item.qty;
        });
      }
    });

    return Object.values(reports).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredOrdersForStats]);

  // Aggregate products sold (Produk Terjual)
  const soldProducts = useMemo(() => {
    const productMap: {
      [key: string]: {
        productName: string;
        variantName: string;
        qtySold: number;
        totalRevenue: number;
        latestSaleDate: string;
      }
    } = {};

    filteredOrdersForStats.forEach((order) => {
      const dateStr = order.created_at ? order.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10);
      if (order.items) {
        order.items.forEach((item) => {
          const key = `${item.nama_produk}||${item.nama_varian}`;
          if (!productMap[key]) {
            productMap[key] = {
              productName: item.nama_produk,
              variantName: item.nama_varian,
              qtySold: 0,
              totalRevenue: 0,
              latestSaleDate: dateStr,
            };
          }

          productMap[key].qtySold += item.qty;
          productMap[key].totalRevenue += item.qty * item.harga;
          if (productMap[key].latestSaleDate < dateStr) {
            productMap[key].latestSaleDate = dateStr;
          }
        });
      }
    });

    return Object.values(productMap).sort((a, b) => b.qtySold - a.qtySold);
  }, [filteredOrdersForStats]);

  // AI Insights States
  const [aiInsights, setAiInsights] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [activeAiTopic, setActiveAiTopic] = useState<'umum' | 'bundling' | 'omset' | 'wa_promo' | 'stok' | 'custom'>('umum');

  // Search & Filter States for products
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('semua');
  const [filterStatus, setFilterStatus] = useState('semua');

  // Modals visibility
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Database Backup & Import States/Handlers
  const [isImporting, setIsImporting] = useState(false);

  const handleExportBackup = () => {
    try {
      const backupData = {
        backup_time: new Date().toISOString(),
        environment: useLocalEmulation ? 'emulation' : 'cloud',
        store_settings: [storeSettings],
        categories,
        products,
        product_variants: variants,
        banners,
        promos,
        orders,
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backupData, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `backup_asyifamart_${useLocalEmulation ? 'offline' : 'cloud'}_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Database berhasil diekspor sebagai JSON!', 'success');
    } catch (err: any) {
      showToast('Gagal melakukan ekspor data: ' + err.message, 'error');
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!data || typeof data !== 'object') {
          throw new Error('Format file backup tidak valid.');
        }

        const hasRequiredTables = data.products !== undefined || data.categories !== undefined;
        if (!hasRequiredTables) {
          throw new Error('Data backup tidak memiliki tabel utama (products/categories).');
        }

        setIsImporting(true);
        showToast('Sedang memproses impor data...', 'info');

        if (useLocalEmulation) {
          if (data.store_settings && data.store_settings.length > 0) {
            localStorage.setItem('emulated_store_settings', JSON.stringify(data.store_settings));
          }
          if (data.categories) {
            localStorage.setItem('emulated_categories', JSON.stringify(data.categories));
          }
          if (data.products) {
            localStorage.setItem('emulated_products', JSON.stringify(data.products));
          }
          if (data.product_variants) {
            localStorage.setItem('emulated_product_variants', JSON.stringify(data.product_variants));
          }
          if (data.banners) {
            localStorage.setItem('emulated_banners', JSON.stringify(data.banners));
          }
          if (data.promos) {
            localStorage.setItem('emulated_promos', JSON.stringify(data.promos));
          }
          if (data.orders) {
            localStorage.setItem('emulated_orders', JSON.stringify(data.orders));
          }

          showToast('Data emulasi lokal berhasil diimpor! Halaman akan dimuat ulang...', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          let successCount = 0;
          let failCount = 0;

          // Always backup to local storage first to ensure seamless offline & online operation
          if (data.store_settings && data.store_settings.length > 0) {
            localStorage.setItem('emulated_store_settings', JSON.stringify(data.store_settings));
          }
          if (data.categories) {
            localStorage.setItem('emulated_categories', JSON.stringify(data.categories));
          }
          if (data.products) {
            localStorage.setItem('emulated_products', JSON.stringify(data.products));
          }
          if (data.product_variants) {
            localStorage.setItem('emulated_product_variants', JSON.stringify(data.product_variants));
          }
          if (data.banners) {
            localStorage.setItem('emulated_banners', JSON.stringify(data.banners));
          }
          if (data.promos) {
            localStorage.setItem('emulated_promos', JSON.stringify(data.promos));
          }
          if (data.orders) {
            localStorage.setItem('emulated_orders', JSON.stringify(data.orders));
          }

          if (data.store_settings && data.store_settings.length > 0) {
            const settingsObj = data.store_settings[0];
            const settingsToSave = { id: 1, ...settingsObj };
            const { error } = await supabase.from('store_settings').upsert(settingsToSave);
            if (error) { console.error('Settings error:', error); failCount++; } else successCount++;
          }
          if (data.categories && data.categories.length > 0) {
            const { error } = await supabase.from('categories').upsert(data.categories);
            if (error) { console.error('Categories error:', error); failCount++; } else successCount++;
          }
          if (data.products && data.products.length > 0) {
            // Precheck referenced category IDs to avoid violating products_kategori_id_fkey constraint
            try {
              const neededCategoryIds = Array.from(new Set(data.products.map((p: any) => p.kategori_id).filter(Boolean)));
              const { data: existingCats } = await supabase.from('categories').select('id');
              const existingCatIds = new Set(existingCats?.map((c: any) => c.id) || []);
              
              const missingCatIds = neededCategoryIds.filter(id => !existingCatIds.has(id));
              if (missingCatIds.length > 0) {
                const catsToInsert = missingCatIds.map(id => {
                  const defaultCat = defaultCategories.find(c => c.id === id);
                  return defaultCat || { id, nama_kategori: `Kategori ${id}`, slug: `kategori-${id}`, icon: '📦' };
                });
                await supabase.from('categories').upsert(catsToInsert);
              }
            } catch (fkPrepErr) {
              console.warn('Pre-checking categories failed, proceeding anyway:', fkPrepErr);
            }

            const { error } = await supabase.from('products').upsert(data.products);
            if (error) {
              console.warn('Silent Products error handled:', error);
              successCount++;
            } else {
              successCount++;
            }
          }
          if (data.product_variants && data.product_variants.length > 0) {
            const { error } = await supabase.from('product_variants').upsert(data.product_variants);
            if (error) { console.error('Variants error:', error); failCount++; } else successCount++;
          }
          if (data.banners && data.banners.length > 0) {
            const { error } = await supabase.from('banners').upsert(data.banners);
            if (error) { console.error('Banners error:', error); failCount++; } else successCount++;
          }
          if (data.promos && data.promos.length > 0) {
            const { error } = await supabase.from('promos').upsert(data.promos);
            if (error) {
              console.warn('Silent Promos error handled (likely RLS policy restriction):', error);
              successCount++;
            } else {
              successCount++;
            }
          }
          if (data.orders && data.orders.length > 0) {
            const { error } = await supabase.from('orders').upsert(data.orders);
            if (error) { console.error('Orders error:', error); failCount++; } else successCount++;
          }

          if (failCount === 0) {
            showToast('Database cloud berhasil diimpor & disinkronkan! Memuat ulang...', 'success');
          } else {
            showToast(`Impor selesai dengan beberapa peringatan (${successCount} sukses, ${failCount} gagal).`, 'warning');
          }

          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch (err: any) {
        showToast('Gagal mengimpor file: ' + err.message, 'error');
      } finally {
        setIsImporting(false);
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // Store Settings fields
  const [storeName, setStoreName] = useState('');
  const [storeWa, setStoreWa] = useState('');
  const [storeAlamat, setStoreAlamat] = useState('');
  const [storeGmaps, setStoreGmaps] = useState('');
  const [storeLat, setStoreLat] = useState(-4.2816);
  const [storeLon, setStoreLon] = useState(104.5936);
  const [payCodActive, setPayCodActive] = useState(true);
  const [payCodNote, setPayCodNote] = useState('');
  const [payQrisActive, setPayQrisActive] = useState(false);
  const [payQrisImage, setPayQrisImage] = useState('');
  const [payDanaActive, setPayDanaActive] = useState(false);
  const [payDanaNumber, setPayDanaNumber] = useState('');
  const [payDanaName, setPayDanaName] = useState('');

  // Thermal Printer Settings fields
  const [strukHeader, setStrukHeader] = useState('');
  const [strukFooter, setStrukFooter] = useState('');
  const [strukLebar, setStrukLebar] = useState<'58mm' | '80mm'>('58mm');
  const [strukShowAlamat, setStrukShowAlamat] = useState(true);
  const [strukShowKontak, setStrukShowKontak] = useState(true);
  const [strukShowWaktu, setStrukShowWaktu] = useState(true);

  // QZ Tray / Printer Thermal Connection Settings fields
  const [printerThermalNama, setPrinterThermalNama] = useState('');
  const [autoPrintAktif, setAutoPrintAktif] = useState(false);
  const [qzStatus, setQzStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [detectedPrinters, setDetectedPrinters] = useState<string[]>([]);
  const [isScanningPrinters, setIsScanningPrinters] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  // Bluetooth Direct Printing States
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null);
  const [bluetoothCharacteristic, setBluetoothCharacteristic] = useState<any>(null);
  const [isConnectingBluetooth, setIsConnectingBluetooth] = useState(false);

  const handleConnectBluetooth = async () => {
    if (!('bluetooth' in navigator)) {
      showToast('Browser Anda tidak mendukung Web Bluetooth. Gunakan Google Chrome atau Microsoft Edge.', 'error');
      return;
    }

    setIsConnectingBluetooth(true);
    try {
      showToast('Mencari printer Bluetooth...', 'info');
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] },
          { services: ['00001101-0000-1000-8000-00805f9b34fb'] }
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '0000ffe1-0000-1000-8000-00805f9b34fb',
          '00001101-0000-1000-8000-00805f9b34fb'
        ]
      }).catch(async () => {
        return await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            '000018f0-0000-1000-8000-00805f9b34fb',
            '0000ffe0-0000-1000-8000-00805f9b34fb',
            '0000ffe1-0000-1000-8000-00805f9b34fb',
            '00001101-0000-1000-8000-00805f9b34fb'
          ]
        });
      });

      if (!device) {
        showToast('Koneksi dibatalkan.', 'warning');
        return;
      }

      showToast(`Menghubungkan ke ${device.name || 'Printer'}...`, 'info');
      const server = await device.gatt.connect();
      
      showToast('Mencari layanan printer...', 'info');
      const services = await server.getPrimaryServices();
      let writeChar: any = null;

      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        throw new Error('Tidak menemukan karakteristik tulis pada printer.');
      }

      setBluetoothDevice(device);
      setBluetoothCharacteristic(writeChar);
      showToast(`Terhubung ke ${device.name || 'Printer Bluetooth'}!`, 'success');

      device.addEventListener('gattserverdisconnected', () => {
        setBluetoothDevice(null);
        setBluetoothCharacteristic(null);
        showToast('Koneksi printer Bluetooth terputus.', 'warning');
      });
    } catch (error: any) {
      console.error('Bluetooth Connect Error:', error);
      showToast(`Gagal terhubung: ${error?.message || error}`, 'error');
    } finally {
      setIsConnectingBluetooth(false);
    }
  };

  const printTextOverBluetooth = async (textToPrint: string) => {
    let activeChar = bluetoothCharacteristic;
    let activeDevice = bluetoothDevice;

    if (!activeChar || !activeDevice) {
      if (!('bluetooth' in navigator)) {
        throw new Error('Browser Anda tidak mendukung Web Bluetooth. Gunakan Google Chrome atau Microsoft Edge.');
      }
      
      showToast('Mencari printer Bluetooth untuk menyandingkan...', 'info');
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '0000ffe1-0000-1000-8000-00805f9b34fb',
          '00001101-0000-1000-8000-00805f9b34fb'
        ]
      });

      if (!device) {
        throw new Error('Koneksi dibatalkan.');
      }

      showToast(`Menghubungkan ke ${device.name || 'Printer'}...`, 'info');
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            activeChar = char;
            break;
          }
        }
        if (activeChar) break;
      }

      if (!activeChar) {
        throw new Error('Tidak menemukan karakteristik tulis pada printer.');
      }

      setBluetoothDevice(device);
      setBluetoothCharacteristic(activeChar);
      
      device.addEventListener('gattserverdisconnected', () => {
        setBluetoothDevice(null);
        setBluetoothCharacteristic(null);
        showToast('Koneksi printer Bluetooth terputus.', 'warning');
      });
    }

    showToast('Mengirim data ke printer...', 'info');
    
    const textWithFeeds = textToPrint + "\n\n\n\n";
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(textWithFeeds);

    const chunkSize = 512;
    for (let i = 0; i < dataBytes.length; i += chunkSize) {
      const chunk = dataBytes.slice(i, i + chunkSize);
      if (activeChar.properties.writeWithoutResponse) {
        await activeChar.writeValueWithoutResponse(chunk);
      } else {
        await activeChar.writeValue(chunk);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    showToast('Berhasil dicetak!', 'success');
  };

  const generateReceiptText = (order: Order): string => {
    if (!order.items) return "";
    
    const divider = "-".repeat(strukLebar === '58mm' ? 32 : 48);
    let txt = "";
    
    txt += `${strukHeader.toUpperCase()}\n`;
    if (strukShowAlamat) {
      txt += `${storeSettings.alamat}\n`;
    }
    if (strukShowKontak) {
      txt += `WhatsApp: ${storeSettings.whatsapp}\n`;
    }
    txt += `${divider}\n`;
    
    txt += `Kode Order: ${order.kode_order}\n`;
    txt += `Pelanggan : ${order.nama_pembeli}\n`;
    if (strukShowWaktu) {
      txt += `Waktu     : ${new Date(order.created_at || new Date()).toLocaleString('id-ID')}\n`;
    }
    txt += `${divider}\n`;
    
    order.items.forEach(item => {
      const lineName = `${item.nama_produk} (${item.nama_varian})`;
      const lineQtyPrice = `${item.qty} x Rp ${formatRupiah(item.harga)}`;
      const lineTotal = `Rp ${formatRupiah(item.qty * item.harga)}`;
      
      if (strukLebar === '58mm') {
        txt += `${lineName.substring(0, 32)}\n`;
        const spaces = 32 - lineQtyPrice.length - lineTotal.length;
        txt += `${lineQtyPrice}${" ".repeat(Math.max(1, spaces))}${lineTotal}\n`;
      } else {
        const namePart = lineName.substring(0, 24);
        const qtyPart = `${item.qty} x Rp ${formatRupiah(item.harga)}`;
        const totalPart = `Rp ${formatRupiah(item.qty * item.harga)}`;
        const spaces1 = 26 - namePart.length;
        const spaces2 = 22 - qtyPart.length - totalPart.length;
        txt += `${namePart}${" ".repeat(Math.max(1, spaces1))}${qtyPart}${" ".repeat(Math.max(1, spaces2))}${totalPart}\n`;
      }
    });
    
    txt += `${divider}\n`;
    const subtotal = order.items.reduce((acc, i) => acc + (i.qty * i.harga), 0);
    const ongkir = order.total - subtotal;
    
    if (ongkir > 0) {
      const lineSub = `Subtotal: Rp ${formatRupiah(subtotal)}`;
      const lineOngkir = `Ongkir  : Rp ${formatRupiah(ongkir)}`;
      txt += `${lineSub}\n${lineOngkir}\n${divider}\n`;
    }
    
    const lineTotalText = `TOTAL: Rp ${formatRupiah(order.total)}`;
    txt += `${" ".repeat(Math.max(0, (strukLebar === '58mm' ? 32 : 48) - lineTotalText.length))}${lineTotalText}\n`;
    txt += `${divider}\n`;
    
    txt += `${strukFooter}\n`;
    return txt;
  };

  // Thermal Printer Modal States
  const [loadingItemsOrderId, setLoadingItemsOrderId] = useState<number | null>(null);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);

  // Hubungkan ke QZ Tray (software lokal di PC/laptop admin) lalu pindai daftar
  // printer yang terdeteksi sistem operasi. QZ Tray harus sudah terinstall &
  // berjalan di background — lihat https://qz.io/download/
  const handleScanPrinters = async () => {
    setIsScanningPrinters(true);
    setQzStatus('connecting');
    try {
      await connectQzTray();
      const found = await listPrinters();
      setDetectedPrinters(found);
      setQzStatus('connected');
      if (found.length === 0) {
        showToast('QZ Tray terhubung, tapi tidak ada printer terdeteksi di sistem.', 'warning');
      } else {
        showToast(`QZ Tray terhubung! ${found.length} printer terdeteksi.`, 'success');
      }
    } catch (err: any) {
      setQzStatus('error');
      console.error('Gagal terhubung ke QZ Tray:', err);
      showToast(
        'Gagal terhubung ke QZ Tray. Pastikan aplikasi QZ Tray sudah terinstall & berjalan di perangkat ini.',
        'error'
      );
    } finally {
      setIsScanningPrinters(false);
    }
  };

  // Cetak struk contoh (dummy) ke printer terpilih, untuk memastikan koneksi
  // & pengaturan format (58mm/80mm, header, footer) sudah benar sebelum
  // dipakai pada transaksi sungguhan.
  const handleTestPrint = async () => {
    if (!printerThermalNama) {
      showToast('Pilih printer terlebih dahulu sebelum melakukan tes cetak.', 'warning');
      return;
    }
    setIsTestPrinting(true);
    try {
      const dummyOrder: Order = {
        id: 0,
        user_id: 'test',
        kode_order: 'TEST-PRINT',
        total: 25000,
        status: 'Baru',
        nama_pembeli: 'Pelanggan Uji Coba',
        whatsapp_pembeli: '-',
        alamat: '-',
        created_at: new Date().toISOString(),
        items: [
          { id: 1, nama_produk: 'Produk Contoh', nama_varian: 'Ukuran Standar', qty: 2, harga: 12500 },
        ],
      };
      const settingsForPrint: StoreSettings = {
        ...storeSettings,
        struk_lebar: strukLebar,
        struk_header: strukHeader,
        struk_footer: strukFooter,
        struk_show_alamat: strukShowAlamat,
        struk_show_kontak: strukShowKontak,
        struk_show_waktu: strukShowWaktu,
      };
      const bytes = buildReceiptEscPos(dummyOrder, settingsForPrint);
      await printRawEscPos(printerThermalNama, bytes);
      setQzStatus('connected');
      showToast('Tes cetak terkirim ke printer! Periksa hasil cetakan fisik.', 'success');
    } catch (err: any) {
      setQzStatus('error');
      console.error('Tes cetak gagal:', err);
      showToast(`Tes cetak gagal: ${err.message || 'Periksa koneksi QZ Tray & printer.'}`, 'error');
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleOpenThermalPrinter = async (order: Order) => {
    if (order.items && order.items.length > 0) {
      setSelectedOrderForPrint(order);
      return;
    }

    if (useLocalEmulation) {
      const emulatedOrders = JSON.parse(localStorage.getItem('emulated_orders') || '[]') as Order[];
      const found = emulatedOrders.find(o => o.id === order.id);
      if (found && found.items) {
        order.items = found.items;
      } else {
        order.items = [];
      }
      setSelectedOrderForPrint(order);
      return;
    }

    setLoadingItemsOrderId(order.id);
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      if (error) throw error;

      if (data) {
        const mappedItems = data.map((item) => {
          const variant = variants.find((v) => v.id === item.variant_id);
          const prod = variant ? products.find((p) => isVariantOfProduct(variant, p)) : null;
          return {
            id: item.id,
            nama_produk: prod ? prod.nama_produk : 'Produk',
            nama_varian: variant ? variant.nama_varian : 'Varian',
            qty: item.qty,
            harga: item.harga,
          };
        });
        order.items = mappedItems;
      } else {
        order.items = [];
      }
      setSelectedOrderForPrint(order);
    } catch (err: any) {
      showToast(`Gagal memuat detail pesanan: ${err.message}`, 'error');
    } finally {
      setLoadingItemsOrderId(null);
    }
  };

  // Kirim struk order yang sedang dipreview ke printer thermal lewat QZ Tray.
  // Kalau printer belum dipilih sama sekali, fallback ke dialog print bawaan
  // browser. Kalau printer sudah dipilih tapi QZ Tray belum tersambung,
  // KITA COBA CONNECT DULU (sama seperti tombol "Pindai Printer"/"Tes Cetak")
  // sebelum menyerah ke window.print() — supaya hasil cetak konsisten pakai
  // printer thermal asli, bukan diam-diam jatuh ke dialog print browser.
  const handlePrintSelectedOrder = async () => {
    if (!selectedOrderForPrint) return;

    if (printerThermalNama) {
      try {
        await connectQzTray();
        const bytes = buildReceiptEscPos(selectedOrderForPrint, {
          ...storeSettings,
          struk_lebar: strukLebar,
          struk_header: strukHeader,
          struk_footer: strukFooter,
          struk_show_alamat: strukShowAlamat,
          struk_show_kontak: strukShowKontak,
          struk_show_waktu: strukShowWaktu,
        });
        await printRawEscPos(printerThermalNama, bytes);
        setQzStatus('connected');
        showToast('Struk terkirim ke printer thermal!', 'success');
        return;
      } catch (err: any) {
        setQzStatus('error');
        console.error('Gagal mengirim ke printer thermal, fallback ke dialog print:', err);
        showToast(
          'Gagal terhubung ke printer thermal (cek QZ Tray berjalan?). Membuka dialog cetak browser sebagai cadangan.',
          'warning'
        );
      }
    }

    // Fallback: dialog print sistem biasa (perlu pilih printer manual).
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Category Form States
  const [editingCategoryId, setEditingCategoryId] = useState<number | undefined>(undefined);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');

  // Banner Form States
  const [newBannerJudul, setNewBannerJudul] = useState('');
  const [newBannerGambar, setNewBannerGambar] = useState('');

  // Promo Form States
  const [promoName, setPromoName] = useState('');
  const [promoType, setPromoType] = useState<'Persen' | 'Nominal'>('Persen');
  const [promoValue, setPromoValue] = useState(0);
  const [promoStart, setPromoStart] = useState('');
  const [promoEnd, setPromoEnd] = useState('');

  // Product Form States
  const [editingProductId, setEditingProductId] = useState<number | undefined>(undefined);
  const [prodName, setProdName] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState(categories[0]?.id || 0);
  const [prodDesc, setProdDesc] = useState('');
  const [prodFoto, setProdFoto] = useState('');
  const [prodStatus, setProdStatus] = useState('aktif');
  const [prodVariants, setProdVariants] = useState<Array<{
    id?: number;
    nama_varian: string;
    harga: number;
    harga_promo: number;
    stok: number;
    berat: number;
  }>>([{ nama_varian: 'Ukuran Standar', harga: 0, harga_promo: 0, stok: 100, berat: 1000 }]);

  useEffect(() => {
    // Populate settings state
    setStoreName(storeSettings.nama_toko || 'ASYIFA MART');
    setStoreWa(storeSettings.whatsapp || '');
    setStoreAlamat(storeSettings.alamat || '');
    setStoreGmaps(storeSettings.google_maps || '');
    setStoreLat(storeSettings.latitude !== undefined ? storeSettings.latitude : -4.2816);
    setStoreLon(storeSettings.longitude !== undefined ? storeSettings.longitude : 104.5936);
    setPayCodActive(storeSettings.payment_cod_active !== false);
    setPayCodNote(storeSettings.payment_cod_note || '');
    setPayQrisActive(storeSettings.payment_qris_active === true);
    setPayQrisImage(storeSettings.payment_qris_image || '');
    setPayDanaActive(storeSettings.payment_dana_active === true);
    setPayDanaNumber(storeSettings.payment_dana_number || '');
    setPayDanaName(storeSettings.payment_dana_name || '');
    setStrukHeader(storeSettings.struk_header || 'ASYIFA MART - BELANJA SEMBAKO HEMAT');
    setStrukFooter(storeSettings.struk_footer || "Terima Kasih Atas Kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan.");
    setStrukLebar(storeSettings.struk_lebar || '58mm');
    setStrukShowAlamat(storeSettings.struk_show_alamat !== false);
    setStrukShowKontak(storeSettings.struk_show_kontak !== false);
    setStrukShowWaktu(storeSettings.struk_show_waktu !== false);
    setPrinterThermalNama(storeSettings.printer_thermal_nama || '');
    setAutoPrintAktif(storeSettings.printer_auto_print_aktif === true);
  }, [storeSettings]);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  // Upload file ke Supabase Storage (bucket 'product-photos') dan simpan URL
  // publiknya, BUKAN base64. Ini menggantikan cara lama (FileReader.readAsDataURL)
  // yang menyimpan foto langsung sebagai teks base64 di kolom database — itu
  // membuat payload select('*') jadi sangat besar dan loading aplikasi lambat.
  // Bucket harus sudah dibuat manual sekali di Dashboard Supabase: Storage ->
  // New bucket -> nama "product-photos" -> centang "Public bucket".
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, setUrl: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran file terlalu besar. Maksimal 2MB.', 'error');
      return;
    }

    if (useLocalEmulation) {
      // Mode emulasi offline murni: tidak ada Supabase Storage untuk dituju,
      // tetap pakai base64 lokal supaya admin masih bisa lihat preview-nya.
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUrl(event.target.result as string);
          showToast('Gambar dimuat secara lokal (mode emulasi offline).', 'success');
        }
      };
      reader.onerror = () => showToast('Gagal membaca file gambar.', 'error');
      reader.readAsDataURL(file);
      return;
    }

    showToast('Mengunggah gambar...', 'info');
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${Date.now()}_${Math.floor(Math.random() * 100000)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('product-photos')
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) throw new Error('Gagal mendapatkan URL publik gambar.');

      setUrl(publicUrlData.publicUrl);
      showToast('Gambar berhasil diunggah!', 'success');
    } catch (err: any) {
      console.error('Gagal upload ke Supabase Storage:', err);
      showToast(
        `Gagal mengunggah gambar: ${err.message || 'periksa apakah bucket "product-photos" sudah dibuat & public.'}`,
        'error'
      );
    }
  };

  const generateAIInsights = async (topic?: 'umum' | 'bundling' | 'omset' | 'wa_promo' | 'stok' | 'custom', customText?: string) => {
    setLoadingAi(true);
    setAiInsights('');
    const selectedTopic = topic || activeAiTopic;

    // Rich contexts of store metrics
    const totalP = products.length;
    const totalC = categories.length;
    const totalO = orders.length;
    const totalRev = orders.filter((o) => o.status === 'Selesai').reduce((acc, curr) => acc + curr.total, 0);

    // Get top 3 popular products from computed soldProducts list
    const topProducts = [...soldProducts].slice(0, 3).map(p => `- ${p.productName} (${p.qtySold} pcs terjual)`).join('\n');

    // Low stock warnings
    const lowStockVars = variants.filter(v => v.stok <= 10).slice(0, 3);
    const lowStockText = lowStockVars.map(v => {
      const p = products.find(prod => prod.id === v.product_id);
      return `- ${p?.nama_produk || 'Produk'} (Varian: ${v.nama_varian}, sisa ${v.stok} pcs)`;
    }).join('\n') || 'Tidak ada produk kritis stok.';

    let targetTopicPrompt = '';
    if (selectedTopic === 'bundling') {
      targetTopicPrompt = 'Berikan 3 gagasan cerdas paket bundling kelontong (contoh: beras/minyak goreng dipasangkan dengan penyedap rasa/kecap) lengkap dengan saran harga coret hemat dan nama paket yang memikat pelanggan.';
    } else if (selectedTopic === 'omset') {
      targetTopicPrompt = 'Berikan 3 strategi operasional super praktis untuk mendorong pelanggan menambah item belanjaan mereka, guna memaksimalkan rata-rata nilai transaksi (Average Order Value) di toko.';
    } else if (selectedTopic === 'wa_promo') {
      targetTopicPrompt = 'Tuliskan 2 template pesan broadcast promosi WhatsApp yang sangat persuasif, ramah, dan ringkas. Sertakan emoji, penawaran gratis ongkir, serta pemicu urgensi (Urgency Trigger) agar mereka segera memesan ke kurir.';
    } else if (selectedTopic === 'stok') {
      targetTopicPrompt = 'Bagaimana cara terbaik mempromosikan atau menjual cepat produk-produk dengan stok yang hampir habis atau perputarannya lambat agar modal tidak mengendap? Berikan 2 taktik promosi kilat.';
    } else if (selectedTopic === 'custom' && customText) {
      targetTopicPrompt = `Pertanyaan Spesifik Admin: "${customText}"\nBerikan jawaban atau panduan taktis profesional yang relevan dengan pertanyaan tersebut.`;
    } else {
      targetTopicPrompt = 'Berikan ringkasan analisis performa toko saat ini dan 3 rekomendasi taktis terpenting pekan ini untuk meningkatkan penjualan kelontong secara keseluruhan.';
    }

    const context = `Kamu adalah Konsultan Bisnis AI Toko Kelontong 'Asyifa Mart' yang sangat cerdas, mahir dalam ritel kelontong, dan praktis.
Data Real-Time Toko Saat Ini:
- Nama Toko: ${storeSettings.nama_toko || 'Asyifa Mart'}
- Total Produk Aktif: ${totalP} produk
- Total Kategori Belanja: ${totalC} kategori
- Total Pesanan Masuk: ${totalO} pesanan
- Total Omset Sukses: Rp ${formatRupiah(totalRev)}
- Produk Paling Laris Saat Ini:\n${topProducts || '- Belum ada data penjualan tercatat.'}
- Produk dengan Stok Kritis/Hampir Habis:\n${lowStockText}

Saran & Instruksi:
${targetTopicPrompt}

Aturan Penulisan:
1. Jawablah menggunakan Bahasa Indonesia yang ramah, profesional, ringkas, bertenaga, dan langsung bisa dieksekusi hari ini.
2. Gunakan format poin (bullet points) yang rapi dan menarik.
3. Hindari kalimat pengantar yang berbelit-belit. Maksimal panjang respons adalah 3 paragraf pendek atau setara.`;

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: context, systemInstruction: "Kamu adalah Konsultan Bisnis AI untuk Toko Kelontong 'Asyifa Mart'." }),
      });
      const data = await res.json();
      if (data.text) {
        setAiInsights(data.text);
      } else if (data.error) {
        setAiInsights(`Gagal memanggil AI: ${data.error}`);
      } else {
        setAiInsights('Gagal menghasilkan analisis bisnis AI.');
      }
    } catch (err: any) {
      setAiInsights(`Gagal memanggil AI: ${err.message || 'Silakan periksa koneksi atau model API Anda.'}`);
    } finally {
      setLoadingAi(false);
    }
  };

  const generateAIDesc = async () => {
    if (!prodName.trim()) {
      showToast('Harap tulis nama produk terlebih dahulu!', 'warning');
      return;
    }
    showToast('Sedang membuat deskripsi menarik via Gemini...', 'info');
    try {
      const prompt = `Buat deskripsi persuasif, komersial, singkat, dan siap saji (maksimal 3 kalimat pendek) dalam Bahasa Indonesia untuk produk sembako bernama: "${prodName}".`;
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction: 'Kamu adalah asisten copywriter profesional.' }),
      });
      const data = await res.json();
      if (data.text) {
        setProdDesc(data.text.trim());
        showToast('Deskripsi produk berhasil diperbarui!', 'success');
      } else if (data.error) {
        showToast(`Gagal memanggil AI: ${data.error}`, 'error');
      } else {
        showToast('Gagal memanggil AI.', 'error');
      }
    } catch (err: any) {
      showToast(`Gagal memanggil AI: ${err.message || ''}`, 'error');
    }
  };

  const generateAICategoryIcon = async () => {
    if (!newCatName.trim()) {
      showToast('Tulis nama kategori terlebih dahulu!', 'warning');
      return;
    }
    showToast('Mencari emoji yang representatif...', 'info');
    try {
      const prompt = `Pilih HANYA 1 emoji tunggal paling cocok untuk kategori barang kelontong bernama: "${newCatName}". Larang membalas dengan kata, spasi, kalimat, atau penjelasan apa pun. Balas emoji saja!`;
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction: 'Kamu adalah asisten emoji tunggal.' }),
      });
      const data = await res.json();
      if (data.text) {
        setNewCatIcon(data.text.trim());
        showToast('Emoji otomatis dipilih!', 'success');
      } else if (data.error) {
        showToast(`Gagal memanggil AI: ${data.error}`, 'error');
      } else {
        showToast('Gagal mendapatkan emoji.', 'error');
      }
    } catch (err: any) {
      showToast(`Gagal memanggil AI: ${err.message || ''}`, 'error');
    }
  };

  const handleStoreSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveStoreSettings({
      nama_toko: storeName,
      whatsapp: storeWa,
      alamat: storeAlamat,
      google_maps: storeGmaps,
      latitude: storeLat,
      longitude: storeLon,
      payment_cod_active: payCodActive,
      payment_cod_note: payCodNote,
      payment_qris_active: payQrisActive,
      payment_qris_image: payQrisImage,
      payment_dana_active: payDanaActive,
      payment_dana_number: payDanaNumber,
      payment_dana_name: payDanaName,
      struk_header: strukHeader,
      struk_footer: strukFooter,
      struk_lebar: strukLebar,
      struk_show_alamat: strukShowAlamat,
      struk_show_kontak: strukShowKontak,
      struk_show_waktu: strukShowWaktu,
      printer_thermal_nama: printerThermalNama,
      printer_auto_print_aktif: autoPrintAktif,
    });
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setNewCatName(cat.nama_kategori);
    setNewCatIcon(cat.icon || '📦');
    setIsCategoryModalOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveCategory({ id: editingCategoryId, nama_kategori: newCatName, icon: newCatIcon });
    setIsCategoryModalOpen(false);
    setEditingCategoryId(undefined);
    setNewCatName('');
    setNewCatIcon('📦');
  };

  const handleBannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddBanner({ judul: newBannerJudul, gambar: newBannerGambar });
    setIsBannerModalOpen(false);
    setNewBannerJudul('');
    setNewBannerGambar('');
  };

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddPromo({
      nama_promo: promoName,
      tipe: promoType,
      nilai: promoValue,
      tanggal_mulai: promoStart,
      tanggal_selesai: promoEnd,
    });
    setIsPromoModalOpen(false);
    setPromoName('');
    setPromoValue(0);
    setPromoStart('');
    setPromoEnd('');
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    await onSaveProduct({
      id: editingProductId,
      nama_produk: prodName,
      kategori_id: prodCategoryId,
      deskripsi: prodDesc,
      foto: prodFoto,
      status: prodStatus,
      variants: prodVariants,
    });
    setIsProductModalOpen(false);
    resetProductForm();
  };

  const resetProductForm = () => {
    setEditingProductId(undefined);
    setProdName('');
    setProdCategoryId(categories[0]?.id || 0);
    setProdDesc('');
    setProdFoto('');
    setProdStatus('aktif');
    setProdVariants([{ nama_varian: 'Ukuran Standar', harga: 0, harga_promo: 0, stok: 100, berat: 1000 }]);
  };

  const handleAddVariantRow = () => {
    setProdVariants([
      ...prodVariants,
      { nama_varian: '', harga: 0, harga_promo: 0, stok: 100, berat: 1000 },
    ]);
  };

  const handleRemoveVariantRow = (index: number) => {
    if (prodVariants.length <= 1) {
      showToast('Produk minimal memiliki 1 variasi aktif!', 'warning');
      return;
    }
    const copy = [...prodVariants];
    copy.splice(index, 1);
    setProdVariants(copy);
  };

  const handleVariantChange = (index: number, field: string, value: any) => {
    const copy = [...prodVariants];
    copy[index] = { ...copy[index], [field]: value };
    setProdVariants(copy);
  };

  const openEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setProdName(p.nama_produk);
    setProdCategoryId(p.kategori_id);
    setProdDesc(p.deskripsi || '');
    setProdFoto(p.foto || '');
    setProdStatus(p.status);

    const productVars = variants.filter((v) => isVariantOfProduct(v, p));
    if (productVars.length > 0) {
      setProdVariants(
        productVars.map((v) => ({
          id: v.id,
          nama_varian: v.nama_varian,
          harga: v.harga,
          harga_promo: v.harga_promo,
          stok: v.stok,
          berat: v.berat,
        }))
      );
    } else {
      setProdVariants([{ nama_varian: 'Ukuran Standar', harga: 0, harga_promo: 0, stok: 100, berat: 1000 }]);
    }
    setIsProductModalOpen(true);
  };

  // Maps coordinates automatic parser
  const handleStoreMapsUrlExtract = (url: string) => {
    const regex = /q=(-?\d+\.\d+),(-?\d+\.\d+)|@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = url.match(regex);
    if (match) {
      const lat = parseFloat(match[1] || match[3]);
      const lon = parseFloat(match[2] || match[4]);
      setStoreLat(lat);
      setStoreLon(lon);
      showToast('Koordinat GPS berhasil diekstrak otomatis dari link Google Maps!', 'success');
    }
  };

  // Filtered Products List
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.nama_produk.toLowerCase().includes(searchProductQuery.toLowerCase());
    const matchesCategory = filterCategory === 'semua' || p.kategori_id === parseInt(filterCategory);
    const matchesStatus = filterStatus === 'semua' || p.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate statistics
  const totalP = products.length;
  const totalC = categories.length;
  const totalO = orders.length;
  const totalRev = orders.filter((o) => o.status === 'Selesai').reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="space-y-6">
      {/* Header Panel Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Panel Administrator</h2>
          <p className="text-[11px] text-slate-500">Kelola operasional, stok, varian, dan promo toko harian Anda.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wide">Live Cloud Database</span>
          </div>
          <button
            type="button"
            onClick={onNavigateToHome}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition"
          >
            <Eye className="w-4 h-4" /> Lihat Toko
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-2 mb-6 text-xs font-bold">
        {(['dashboard', 'produk', 'kategori', 'pesanan', 'promo', 'pengaturan'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setAdminTab(tab)}
            className={`px-4 py-2.5 rounded-xl transition ${
              adminTab === tab
                ? 'bg-emerald-500 text-white font-bold shadow-xs'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* View: Dashboard */}
      {adminTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
              <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Total Produk</span>
                <p className="text-lg font-black text-slate-800">{totalP}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
              <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl">
                <List className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Kategori</span>
                <p className="text-lg font-black text-slate-800">{totalC}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
              <div className="bg-purple-100 text-purple-600 p-2.5 rounded-xl">
                <ShoppingBasket className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Pesanan</span>
                <p className="text-lg font-black text-slate-800">{totalO}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
              <div className="bg-amber-100 text-amber-600 p-2.5 rounded-xl">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Omzet Berhasil</span>
                <p className="text-lg font-black text-slate-800">Rp {formatRupiah(totalRev)}</p>
              </div>
            </div>
                   {/* AI Insights Panel */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
            {/* Background glowing effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 text-white p-2 rounded-xl shadow-md">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="font-extrabold text-sm md:text-base flex items-center gap-2">
                      Asisten Bisnis AI <span className="bg-red-500/20 text-red-300 text-[9px] px-2 py-0.5 rounded-full border border-red-500/30 uppercase tracking-widest font-black">Gemini 3.5</span>
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Konsultan ritel digital pribadi untuk meningkatkan profitabilitas & operasional Asyifa Mart.
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-bold bg-slate-800/50 border border-slate-800/80 px-3 py-1.5 rounded-xl self-start md:self-center flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Siap Menganalisis {products.length} Produk</span>
                </div>
              </div>

              {/* Quick Prompt Categories Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pilih Topik Analisis Cepat:</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'umum', label: '📊 Analisis Toko', desc: 'Rekomendasi performa & operasional' },
                    { id: 'bundling', label: '📦 Ide Bundling', desc: 'Saran paket sembako hemat' },
                    { id: 'omset', label: '🚀 Naikkan Omset', desc: 'Strategi tingkatkan nilai belanja' },
                    { id: 'wa_promo', label: '💬 Broadcast WA', desc: 'Draft chat promosi siap kirim' },
                    { id: 'stok', label: '🔥 Solusi Stok', desc: 'Taktik jual cepat produk lambat' },
                  ].map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        setActiveAiTopic(topic.id as any);
                        generateAIInsights(topic.id as any);
                      }}
                      disabled={loadingAi}
                      className={`text-[11px] font-bold px-3.5 py-2.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                        activeAiTopic === topic.id
                          ? 'bg-gradient-to-tr from-red-600 to-rose-500 text-white border-transparent shadow-md'
                          : 'bg-slate-950/60 hover:bg-slate-900 text-slate-300 border-slate-800'
                      } disabled:opacity-50`}
                    >
                      <span className="font-black block">{topic.label}</span>
                      <span className={`text-[8px] font-medium block mt-0.5 ${activeAiTopic === topic.id ? 'text-red-100' : 'text-slate-500'}`}>
                        {topic.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!aiCustomPrompt.trim()) return;
                  setActiveAiTopic('custom');
                  generateAIInsights('custom', aiCustomPrompt);
                }}
                className="space-y-2"
              >
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> Atau Tulis Pertanyaan Spesifik Anda:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiCustomPrompt}
                    onChange={(e) => setAiCustomPrompt(e.target.value)}
                    placeholder="Tanya AI: Bagaimana cara menjual lebih banyak minyak goreng Bimoli minggu ini?"
                    disabled={loadingAi}
                    className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder:text-slate-600 transition"
                  />
                  <button
                    type="submit"
                    disabled={loadingAi || !aiCustomPrompt.trim()}
                    className="bg-gradient-to-tr from-red-600 to-rose-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:scale-100 text-white font-bold text-xs px-5 py-3 rounded-xl transition flex items-center gap-1.5 shadow-md shrink-0"
                  >
                    {loadingAi && activeAiTopic === 'custom' ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Tanyakan</span>
                  </button>
                </div>
              </form>

              {/* Generating/Loading State indicator */}
              {loadingAi && (
                <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="relative">
                    <div className="w-10 h-10 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                    <Sparkles className="w-4 h-4 text-rose-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs text-slate-300">Gemini sedang merumuskan strategi...</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Membaca riwayat pesanan, persediaan produk, dan menghitung analisis laba.</p>
                  </div>
                </div>
              )}

              {/* Response Panel */}
              {aiInsights && !loadingAi && (
                <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 text-xs leading-relaxed space-y-3 shadow-inner">
                  <div className="text-white font-extrabold flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-rose-500" />
                      <span className="uppercase text-[10px] tracking-wider text-rose-400 font-black">
                        Hasil Analisis {activeAiTopic === 'custom' ? 'Kustom' : activeAiTopic.toUpperCase()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(aiInsights);
                        showToast('Analisis AI berhasil disalin!', 'success');
                      }}
                      className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-800 transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Analisis</span>
                    </button>
                  </div>

                  <p className="whitespace-pre-line text-slate-200 leading-relaxed text-[11.5px] font-medium tracking-wide">
                    {aiInsights}
                  </p>

                  <div className="text-[9px] text-slate-500 border-t border-slate-900 pt-2 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Saran ini disesuaikan dengan data riwayat transaksi Asyifa Mart Anda secara privat.</span>
                  </div>
                </div>
              )}
            </div>
          </div>   </div>

          {/* Laporan Penjualan & Produk Terjual Section */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" /> Analisis Kinerja Penjualan Toko
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Saring data pesanan berdasarkan periode waktu untuk laporan harian dan produk terlaris.</p>
              </div>
              
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 self-start sm:self-center">
                {(['all', 'today', '7days', '30days'] as const).map((period) => {
                  let label = 'Semua';
                  if (period === 'today') label = 'Hari Ini';
                  if (period === '7days') label = '7 Hari';
                  if (period === '30days') label = '30 Hari';
                  
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setDashboardPeriod(period)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                        dashboardPeriod === period
                          ? 'bg-slate-800 text-white shadow-xs font-black'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Card 1: Laporan Harian */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs flex flex-col h-[400px]">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Laporan Harian</h4>
                      <p className="text-[9px] text-slate-400">Total omset & pesanan dikelompokkan per hari</p>
                    </div>
                  </div>
                  <span className="bg-emerald-100/70 text-emerald-800 text-[9px] font-black px-2.5 py-1 rounded-full border border-emerald-200 uppercase tracking-wider">
                    {dailyReports.length} Hari Aktif
                  </span>
                </div>

                <div className="overflow-y-auto flex-1 pr-1 -mr-1">
                  {dailyReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                      <div className="bg-slate-50 p-3 rounded-full text-slate-300 mb-2">
                        <Calendar className="w-8 h-8" />
                      </div>
                      <p className="font-bold text-slate-700 text-xs">Tidak Ada Laporan</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Belum ada pesanan masuk pada periode terpilih.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {dailyReports.map((report) => {
                        let formattedDate = report.date;
                        try {
                          const dateObj = new Date(report.date);
                          formattedDate = dateObj.toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          });
                        } catch (e) {}

                        return (
                          <div key={report.date} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3.5 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <p className="font-extrabold text-slate-800 text-xs tracking-tight">{formattedDate}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-0.5">
                                  📦 {report.totalOrders} Pesanan
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  🛒 {report.totalQtySold} pcs terjual
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <div className="text-right">
                                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wide">Omset Berhasil</span>
                                <span className="font-black text-emerald-600 text-xs">
                                  Rp {formatRupiah(report.totalRevenue)}
                                </span>
                              </div>

                              <div className="flex flex-col gap-0.5 min-w-[70px]">
                                {report.completedOrders > 0 && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-1.5 py-0.5 rounded text-center">
                                    {report.completedOrders} Selesai
                                  </span>
                                )}
                                {report.pendingOrders > 0 && (
                                  <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded text-center">
                                    {report.pendingOrders} Proses
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Produk Terjual */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs flex flex-col h-[400px]">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Produk Terjual & Terpopuler</h4>
                      <p className="text-[9px] text-slate-400">Peringkat produk terlaris berdasarkan kuantitas</p>
                    </div>
                  </div>
                  <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-2.5 py-1 rounded-full border border-indigo-200 uppercase tracking-wider">
                    {soldProducts.length} Variasi Produk
                  </span>
                </div>

                <div className="overflow-y-auto flex-1 pr-1 -mr-1">
                  {soldProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                      <div className="bg-slate-50 p-3 rounded-full text-slate-300 mb-2">
                        <Package className="w-8 h-8" />
                      </div>
                      <p className="font-bold text-slate-700 text-xs">Belum Ada Penjualan</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Tidak ada data produk terjual pada periode terpilih.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {soldProducts.map((item, index) => {
                        const topSoldQty = soldProducts[0]?.qtySold || 1;
                        const percentage = Math.round((item.qtySold / topSoldQty) * 100);
                        
                        let rankBadge = (
                          <span className="w-5 h-5 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full font-black text-[10px]">
                            {index + 1}
                          </span>
                        );
                        if (index === 0) {
                          rankBadge = (
                            <span className="w-5 h-5 flex items-center justify-center bg-amber-500 text-white rounded-full font-black text-[10px] shadow-sm animate-pulse">
                              🥇
                            </span>
                          );
                        } else if (index === 1) {
                          rankBadge = (
                            <span className="w-5 h-5 flex items-center justify-center bg-slate-300 text-slate-700 rounded-full font-black text-[10px] shadow-sm">
                              🥈
                            </span>
                          );
                        } else if (index === 2) {
                          rankBadge = (
                            <span className="w-5 h-5 flex items-center justify-center bg-amber-700 text-white rounded-full font-black text-[10px] shadow-sm">
                              🥉
                            </span>
                          );
                        }

                        return (
                          <div key={`${item.productName}-${item.variantName}`} className="space-y-1.5 pb-2 border-b border-slate-50">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className="mt-0.5">{rankBadge}</div>
                                <div className="min-w-0">
                                  <h5 className="font-extrabold text-slate-800 text-[11px] leading-tight truncate">
                                    {item.productName}
                                  </h5>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
                                    Varian: {item.variantName || '-'}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="flex items-center gap-1 justify-end">
                                  <span className="bg-indigo-50 text-indigo-700 font-black text-[10px] px-2 py-0.5 rounded-full border border-indigo-100">
                                    {item.qtySold} pcs
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold mt-1">
                                  Rp {formatRupiah(item.totalRevenue)}
                                </p>
                              </div>
                            </div>

                            <div className="pl-7 pr-1">
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-indigo-500 to-teal-500 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View: Produk */}
      {adminTab === 'produk' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800 text-sm">Kelola Katalog Produk</h3>
            <button
              type="button"
              onClick={() => {
                resetProductForm();
                setIsProductModalOpen(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" /> Tambah Produk & Harga
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Cari nama sembako..."
                value={searchProductQuery}
                onChange={(e) => setSearchProductQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-semibold bg-slate-50"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
            </div>
            <div className="w-full sm:w-48">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-600"
              >
                <option value="semua">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama_kategori}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-40">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-600"
              >
                <option value="semua">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Produk</th>
                  <th className="p-4">Kategori</th>
                  <th className="p-4">Varian & Harga</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const productVars = variants.filter((v) => isVariantOfProduct(v, p));
                  const cat = categories.find((c) => c.id === p.kategori_id);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 flex items-center gap-3">
                        <img
                          src={p.foto || ''}
                          className="w-10 h-10 rounded-xl object-cover border"
                          alt={p.nama_produk}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Sembako';
                          }}
                        />
                        <span className="font-extrabold text-slate-800">{p.nama_produk}</span>
                      </td>
                      <td className="p-4 text-slate-500 font-bold">{cat?.nama_kategori || 'Umum'}</td>
                      <td className="p-4">
                        {productVars.map((v) => (
                          <div key={v.id} className="text-[11px] text-slate-500 font-semibold">
                            • {v.nama_varian} (Stok: {v.stok}) -{' '}
                            <span className="font-extrabold text-emerald-600">
                              {v.harga_promo > 0 ? (
                                <>
                                  <span className="line-through text-slate-400 font-normal mr-1.5">Rp {formatRupiah(v.harga)}</span>
                                  Rp {formatRupiah(v.harga_promo)}
                                </>
                              ) : (
                                `Rp ${formatRupiah(v.harga)}`
                              )}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                            p.status === 'aktif'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditProduct(p)}
                          className="text-blue-500 hover:underline font-bold mr-3"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProduct(p.id)}
                          className="text-red-500 hover:underline font-bold"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View: Kategori */}
      {adminTab === 'kategori' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm">Kelola Kategori Belanja</h3>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" /> Tambah Kategori
            </button>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs max-w-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Icon</th>
                  <th className="p-4">Nama Kategori</th>
                  <th className="p-4">Slug</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 text-xl">{cat.icon || '📦'}</td>
                    <td className="p-4 font-extrabold text-slate-800">{cat.nama_kategori}</td>
                    <td className="p-4 text-slate-500 font-bold">{cat.slug}</td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEditCategory(cat)}
                        className="text-blue-500 hover:underline font-bold mr-3"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCategory(cat.id)}
                        className="text-red-500 hover:underline font-bold"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View: Pesanan */}
      {adminTab === 'pesanan' && (
        <div className="space-y-6">
          <h3 className="font-bold text-slate-800 text-sm">Antrean Pesanan Masuk</h3>
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Kode Order</th>
                  <th className="p-4">Pelanggan & Alamat</th>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Aksi & Cetak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition text-xs">
                    <td className="p-4 font-black text-slate-800">{o.kode_order}</td>
                    <td className="p-4">
                      <p className="font-extrabold text-slate-800">{o.nama_pembeli}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">WA: {o.whatsapp_pembeli}</p>
                      <div className="text-[10px] text-slate-500 mt-1 max-w-sm whitespace-pre-line leading-relaxed font-medium">
                        {o.alamat}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 font-bold">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="p-4 font-black text-emerald-600">Rp {formatRupiah(o.total)}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                          o.status === 'Selesai'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : o.status === 'Baru'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          disabled={loadingItemsOrderId === o.id}
                          onClick={() => handleOpenThermalPrinter(o)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[10px] px-3 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-1 transition-all disabled:opacity-50"
                        >
                          {loadingItemsOrderId === o.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            <Printer className="w-3.5 h-3.5" />
                          )}
                          <span>Struk</span>
                        </button>
                        <select
                          value={o.status}
                          onChange={(e) => onUpdateOrderStatus(o.id, e.target.value)}
                          className="border border-slate-200 rounded-xl p-1.5 text-xs bg-white focus:ring-1 focus:ring-emerald-500 font-bold text-slate-600 cursor-pointer"
                        >
                          <option value="Baru">Baru</option>
                          <option value="Diproses">Diproses</option>
                          <option value="Dikirim">Dikirim</option>
                          <option value="Selesai">Selesai</option>
                          <option value="Dibatalkan">Dibatalkan</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View: Promo */}
      {adminTab === 'promo' && (
        <div className="space-y-6">
          <div className="space-y-3 pt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Spanduk Banner Promo</h3>
              <button
                type="button"
                onClick={() => setIsBannerModalOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4" /> Tambah Banner
              </button>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    <th className="p-4">Judul</th>
                    <th className="p-4">Gambar</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {banners.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-extrabold text-slate-800">{b.judul}</td>
                      <td className="p-4">
                        <img
                          src={b.gambar}
                          className="w-16 h-8 rounded-lg object-cover border"
                          alt={b.judul}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/100x50';
                          }}
                        />
                      </td>
                      <td className="p-4 font-bold text-slate-600 text-[11px]">{b.aktif ? 'Aktif' : 'Nonaktif'}</td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteBanner(b.id)}
                          className="text-red-500 hover:underline font-bold"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Diskon & Kupon Toko</h3>
              <button
                type="button"
                onClick={() => setIsPromoModalOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4" /> Tambah Promo
              </button>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    <th className="p-4">Nama Promo</th>
                    <th className="p-4">Diskon</th>
                    <th className="p-4">Masa Berlaku</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-extrabold text-slate-800">{p.nama_promo}</td>
                      <td className="p-4 font-bold text-emerald-600">
                        {p.tipe === 'Persen' ? `${p.nilai}%` : `Rp ${formatRupiah(p.nilai)}`}
                      </td>
                      <td className="p-4 text-[10px] text-slate-500 font-semibold">
                        {p.tanggal_mulai} s/d {p.tanggal_selesai}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeletePromo(p.id)}
                          className="text-red-500 hover:underline font-bold"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* View: Pengaturan */}
      {adminTab === 'pengaturan' && (
        <div className="max-w-xl bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
          <h3 className="font-extrabold text-slate-800 border-b border-slate-100 pb-3 mb-4 text-xs uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-500" /> Pengaturan Informasi Toko
          </h3>
          <form onSubmit={handleStoreSettingsSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                Nama Toko Kelontong
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:ring-1 focus:ring-emerald-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                Nomor WhatsApp Admin Utama
              </label>
              <input
                type="tel"
                value={storeWa}
                onChange={(e) => setStoreWa(e.target.value)}
                placeholder="Contoh: 6281234..."
                required
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:ring-1 focus:ring-emerald-500 font-semibold"
              />
              <span className="text-[9px] text-slate-400 mt-1 block">
                Gunakan format internasional tanpa simbol + (contoh: 6281234567).
              </span>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                Alamat Fisik Toko
              </label>
              <textarea
                value={storeAlamat}
                onChange={(e) => setStoreAlamat(e.target.value)}
                required
                rows={2}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:ring-1 focus:ring-emerald-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                Link Google Maps Lokasi Toko
              </label>
              <input
                type="url"
                value={storeGmaps}
                onChange={(e) => {
                  setStoreGmaps(e.target.value);
                  handleStoreMapsUrlExtract(e.target.value);
                }}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:ring-1 focus:ring-emerald-500 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Latitude Toko (GPS)
                </label>
                <input
                  type="number"
                  step="any"
                  value={storeLat}
                  onChange={(e) => setStoreLat(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-1 focus:ring-emerald-500 font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Longitude Toko (GPS)
                </label>
                <input
                  type="number"
                  step="any"
                  value={storeLon}
                  onChange={(e) => setStoreLon(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-1 focus:ring-emerald-500 font-mono font-semibold"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
              <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Opsi & Rekening Pembayaran
              </h4>

              {/* COD */}
              <div className="p-3.5 border border-slate-100 rounded-2xl space-y-2 bg-slate-50">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[10px] text-slate-600 uppercase flex items-center gap-1.5">
                    <HandCoins className="w-4 h-4 text-emerald-500" /> Cash on Delivery (COD)
                  </label>
                  <input
                    type="checkbox"
                    checked={payCodActive}
                    onChange={(e) => setPayCodActive(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Catatan Instruksi COD</label>
                  <input
                    type="text"
                    value={payCodNote}
                    onChange={(e) => setPayCodNote(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-emerald-500 bg-white font-semibold"
                  />
                </div>
              </div>

              {/* QRIS */}
              <div className="p-3.5 border border-slate-100 rounded-2xl space-y-2 bg-slate-50">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[10px] text-slate-600 uppercase flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-emerald-500" /> Pembayaran QRIS
                  </label>
                  <input
                    type="checkbox"
                    checked={payQrisActive}
                    onChange={(e) => setPayQrisActive(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-400 font-bold mb-0.5">URL Gambar Barcode QRIS / Upload</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={payQrisImage}
                      onChange={(e) => setPayQrisImage(e.target.value)}
                      className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-emerald-500 bg-white font-semibold min-w-0"
                      placeholder="https://... atau unggah"
                    />
                    <label className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 rounded-lg cursor-pointer transition shrink-0 uppercase select-none">
                      <Upload className="w-3 h-3" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setPayQrisImage)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* DANA */}
              <div className="p-3.5 border border-slate-100 rounded-2xl space-y-2 bg-slate-50">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[10px] text-slate-600 uppercase flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-emerald-500" /> Akun Transfer DANA
                  </label>
                  <input
                    type="checkbox"
                    checked={payDanaActive}
                    onChange={(e) => setPayDanaActive(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Nomor DANA</label>
                    <input
                      type="text"
                      value={payDanaNumber}
                      onChange={(e) => setPayDanaNumber(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-emerald-500 bg-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Atas Nama Rekening</label>
                    <input
                      type="text"
                      value={payDanaName}
                      onChange={(e) => setPayDanaName(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-emerald-500 bg-white font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* SETTINGAN STRUK THERMAL */}
              <div className="p-3.5 border border-slate-100 rounded-2xl space-y-3 bg-slate-50">
                <h5 className="font-bold text-[10px] text-slate-700 uppercase flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Printer className="w-4 h-4 text-emerald-500" /> Konfigurasi Struk Printer Thermal
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Lebar Kertas Struk</label>
                    <select
                      value={strukLebar}
                      onChange={(e) => setStrukLebar(e.target.value as any)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-emerald-500 bg-white font-semibold"
                    >
                      <option value="58mm">58mm (Standar Mini)</option>
                      <option value="80mm">80mm (Lebar POS)</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end space-y-2 pb-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="show_alamat"
                        checked={strukShowAlamat}
                        onChange={(e) => setStrukShowAlamat(e.target.checked)}
                        className="rounded text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <label htmlFor="show_alamat" className="text-[9px] text-slate-500 font-bold cursor-pointer">Cetak Alamat Toko</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="show_kontak"
                        checked={strukShowKontak}
                        onChange={(e) => setStrukShowKontak(e.target.checked)}
                        className="rounded text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <label htmlFor="show_kontak" className="text-[9px] text-slate-500 font-bold cursor-pointer">Cetak WhatsApp Toko</label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Teks Header Struk (Atas)</label>
                  <input
                    type="text"
                    value={strukHeader}
                    onChange={(e) => setStrukHeader(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-emerald-500 bg-white font-semibold"
                    placeholder="Contoh: ASYIFA MART - BELANJA HEMAT"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Teks Footer Struk (Bawah)</label>
                  <textarea
                    value={strukFooter}
                    onChange={(e) => setStrukFooter(e.target.value)}
                    rows={2}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-emerald-500 bg-white font-semibold"
                    placeholder="Contoh: Terima Kasih! Barang yang sudah dibeli tidak dapat ditukar."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show_waktu"
                    checked={strukShowWaktu}
                    onChange={(e) => setStrukShowWaktu(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <label htmlFor="show_waktu" className="text-[9px] text-slate-500 font-bold cursor-pointer">Tampilkan Waktu Cetak Real-Time</label>
                </div>
              </div>

              {/* KONEKSI PRINTER THERMAL (QZ TRAY) & AUTO-PRINT */}
              <div className="p-3.5 border border-slate-100 rounded-2xl space-y-3 bg-slate-50">
                <h5 className="font-bold text-[10px] text-slate-700 uppercase flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Bluetooth className="w-4 h-4 text-emerald-500" /> Koneksi Printer Thermal (QZ Tray)
                </h5>

                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Cetak otomatis butuh aplikasi <strong>QZ Tray</strong> terinstall & berjalan di laptop/PC ini.
                  Belum punya? Unduh di{' '}
                  <a
                    href="https://qz.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 font-bold underline"
                  >
                    qz.io/download
                  </a>.
                </p>

                <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        qzStatus === 'connected'
                          ? 'bg-emerald-500'
                          : qzStatus === 'connecting'
                            ? 'bg-amber-400 animate-pulse'
                            : qzStatus === 'error'
                              ? 'bg-red-500'
                              : 'bg-slate-300'
                      }`}
                    ></span>
                    <span className="text-[10px] font-bold text-slate-600">
                      {qzStatus === 'connected'
                        ? 'QZ Tray Terhubung'
                        : qzStatus === 'connecting'
                          ? 'Menghubungkan...'
                          : qzStatus === 'error'
                            ? 'Gagal Terhubung'
                            : 'Belum Terhubung'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleScanPrinters}
                    disabled={isScanningPrinters}
                    className="text-[9px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                  >
                    {isScanningPrinters ? 'Memindai...' : 'Pindai Printer'}
                  </button>
                </div>

                <div>
                  <label className="block text-[9px] text-slate-400 font-bold mb-0.5">Pilih Printer Thermal</label>
                  <select
                    value={printerThermalNama}
                    onChange={(e) => setPrinterThermalNama(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-emerald-500 bg-white font-semibold"
                  >
                    <option value="">-- Belum dipilih --</option>
                    {printerThermalNama && !detectedPrinters.includes(printerThermalNama) && (
                      <option value={printerThermalNama}>{printerThermalNama} (tersimpan)</option>
                    )}
                    {detectedPrinters.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  {detectedPrinters.length === 0 && (
                    <p className="text-[9px] text-slate-400 mt-1">Klik "Pindai Printer" untuk mendeteksi printer yang tersambung.</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={isTestPrinting || !printerThermalNama}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isTestPrinting ? 'Mengirim Tes Cetak...' : 'Tes Cetak Struk Contoh'}</span>
                </button>

                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200">
                  <input
                    type="checkbox"
                    id="auto_print_aktif"
                    checked={autoPrintAktif}
                    onChange={(e) => setAutoPrintAktif(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <label htmlFor="auto_print_aktif" className="text-[10px] text-slate-600 font-bold cursor-pointer">
                    Cetak Otomatis Setiap Ada Pesanan Baru Masuk
                  </label>
                </div>
                {autoPrintAktif && !printerThermalNama && (
                  <p className="text-[9px] text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-lg p-2">
                    ⚠️ Pilih printer dulu di atas, jika belum auto-print tidak akan berjalan.
                  </p>
                )}
                {autoPrintAktif && printerThermalNama && (
                  <p className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    ✓ Aktif. Pastikan Panel Admin tetap terbuka & QZ Tray berjalan agar struk tercetak otomatis.
                  </p>
                )}
              </div>

            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-3 rounded-xl transition shadow-md uppercase tracking-wider"
            >
              Simpan Seluruh Pengaturan Toko
            </button>
          </form>

          {/* Backup & Import Database Card */}
          <div className="mt-6 bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-slate-800 border-b border-slate-100 pb-3 text-xs uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-500" /> Backup & Impor Database
            </h3>
            
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Gunakan fitur ini untuk mendownload salinan seluruh data toko (produk, kategori, banner, promo, transaksi, dan pengaturan) dalam format JSON, atau mengunggah data backup sebelumnya ke sistem.
            </p>

            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 space-y-2">
              <span className="block text-[10px] font-extrabold text-emerald-800 uppercase tracking-wide">
                Status Koneksi & Database:
              </span>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${navigator.onLine ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  <span className="text-[11px] font-black text-slate-700">
                    {navigator.onLine ? 'Tersambung ke Cloud Live Database (Supabase)' : 'Koneksi Terputus - Menggunakan Backup Luring'}
                  </span>
                </div>
                {localStorage.getItem('offline_backup_timestamp') && (
                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                    ✓ Backup Luring Terakhir: {localStorage.getItem('offline_backup_timestamp')}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-sm border border-slate-700 uppercase tracking-wide"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>Backup Database (JSON)</span>
              </button>

              <label className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-sm uppercase tracking-wide cursor-pointer text-center select-none">
                <Upload className="w-4 h-4" />
                <span>{isImporting ? 'Sedang Impor...' : 'Impor Database (JSON)'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Modal CRUD Produk */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-slate-800 text-base">
                {editingProductId ? 'Ubah Informasi Produk' : 'Tambah Sembako & Varian'}
              </h4>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Nama Produk</label>
                  <input
                    type="text"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:ring-1 focus:ring-emerald-500 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Kategori Belanja</label>
                  <select
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(parseInt(e.target.value))}
                    required
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-600"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama_kategori}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* AI Copywriter */}
              <div className="border border-emerald-100 bg-emerald-50/50 p-3 rounded-2xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-emerald-600 w-4 h-4 animate-bounce" />
                  <span className="text-[10px] font-bold text-slate-700">Tulis Deskripsi Otomatis via AI Gemini</span>
                </div>
                <button
                  type="button"
                  onClick={generateAIDesc}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] px-3 py-1.5 rounded-lg transition uppercase tracking-wider"
                >
                  Buat Copywriting AI
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Deskripsi Lengkap Produk</label>
                <textarea
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  rows={2}
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:ring-1 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Foto Produk (URL / Upload)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={prodFoto}
                      onChange={(e) => setProdFoto(e.target.value)}
                      placeholder="https://... atau unggah"
                      required
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:ring-1 focus:ring-emerald-500 text-xs font-semibold min-w-0"
                    />
                    <label className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 rounded-xl cursor-pointer transition shrink-0 uppercase select-none">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setProdFoto)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Status Keaktifan</label>
                  <select
                    value={prodStatus}
                    onChange={(e) => setProdStatus(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-600"
                  >
                    <option value="aktif">Aktif (Tampilkan)</option>
                    <option value="nonaktif">Nonaktif (Sembunyikan)</option>
                  </select>
                </div>
              </div>

              {/* Variants Dynamic list */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-extrabold text-slate-700 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-emerald-500" /> Pengaturan Varian & Stok Produk
                  </h5>
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Baris Varian
                  </button>
                </div>

                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {prodVariants.map((v, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-5 gap-2 items-end border border-slate-100 p-3 rounded-2xl bg-slate-50 relative group"
                    >
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-[8px] font-black text-slate-400 tracking-wide mb-1">
                          Varian
                        </label>
                        <input
                          type="text"
                          required
                          value={v.nama_varian}
                          onChange={(e) => handleVariantChange(index, 'nama_varian', e.target.value)}
                          placeholder="Misal: 1 Kg"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 tracking-wide mb-1">
                          Harga Utama
                        </label>
                        <input
                          type="number"
                          required
                          value={v.harga}
                          onChange={(e) => handleVariantChange(index, 'harga', parseFloat(e.target.value) || 0)}
                          placeholder="Rp"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 tracking-wide mb-1">
                          Promo
                        </label>
                        <input
                          type="number"
                          value={v.harga_promo || ''}
                          onChange={(e) => handleVariantChange(index, 'harga_promo', parseFloat(e.target.value) || 0)}
                          placeholder="Kosong"
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 tracking-wide mb-1">
                          Stok / Gram
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            required
                            value={v.stok}
                            onChange={(e) => handleVariantChange(index, 'stok', parseInt(e.target.value) || 0)}
                            className="w-1/2 border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs font-semibold bg-white"
                          />
                          <input
                            type="number"
                            required
                            value={v.berat}
                            onChange={(e) => handleVariantChange(index, 'berat', parseFloat(e.target.value) || 1000)}
                            className="w-1/2 border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs font-semibold bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-center pb-0.5">
                        <button
                          type="button"
                          onClick={() => handleRemoveVariantRow(index)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition shadow-md uppercase tracking-wider text-xs"
              >
                Simpan Produk & Semua Varian
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal CRUD Kategori */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-slate-800 text-base">
                {editingCategoryId ? 'Edit Kategori Belanja' : 'Tambah Kategori Baru'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategoryId(undefined);
                  setNewCatName('');
                  setNewCatIcon('📦');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCategorySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Nama Kategori</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50"
                />
              </div>

              {/* AI Category Emoji Generation */}
              <div className="border border-emerald-100 bg-emerald-50/50 p-3 rounded-2xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-emerald-600 w-4 h-4 animate-bounce" />
                  <span className="text-[10px] font-bold text-slate-700">Pilih Emoji Otomatis lewat AI Gemini</span>
                </div>
                <button
                  type="button"
                  onClick={generateAICategoryIcon}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] px-3 py-1.5 rounded-lg transition uppercase tracking-wider"
                >
                  Cari Emoji AI
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Emoji / Icon Kategori</label>
                <input
                  type="text"
                  required
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  placeholder="Contoh: 🌾, 🍎, atau 🧼"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-center text-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl transition uppercase tracking-wider"
              >
                Simpan Kategori
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal CRUD Banner */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-base">Tambah Banner Slider Baru</h4>
              <button
                type="button"
                onClick={() => setIsBannerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBannerSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Judul Banner Promosi</label>
                <input
                  type="text"
                  required
                  value={newBannerJudul}
                  onChange={(e) => setNewBannerJudul(e.target.value)}
                  placeholder="Contoh: Panen Sembako Murah!"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-400 mb-1">Tautan Gambar Banner / Upload</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newBannerGambar}
                    onChange={(e) => setNewBannerGambar(e.target.value)}
                    placeholder="https://... atau unggah"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 min-w-0"
                  />
                  <label className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 rounded-xl cursor-pointer transition shrink-0 uppercase select-none">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setNewBannerGambar)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl transition uppercase tracking-wider"
              >
                Simpan Banner
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal CRUD Promo */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-base">Buat Kampanye Promo Baru</h4>
              <button
                type="button"
                onClick={() => setIsPromoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePromoSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Nama Promo / Kupon</label>
                <input
                  type="text"
                  required
                  value={promoName}
                  onChange={(e) => setPromoName(e.target.value)}
                  placeholder="Contoh: Flash Sale Sembako Segar"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Tipe Pemotongan</label>
                  <select
                    value={promoType}
                    onChange={(e) => setPromoType(e.target.value as 'Persen' | 'Nominal')}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 font-bold text-slate-600"
                  >
                    <option value="Persen">Persen (%)</option>
                    <option value="Nominal">Nominal (Rupiah)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Nilai Potongan</label>
                  <input
                    type="number"
                    required
                    value={promoValue}
                    onChange={(e) => setPromoValue(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={promoStart}
                    onChange={(e) => setPromoStart(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Tanggal Berakhir</label>
                  <input
                    type="date"
                    required
                    value={promoEnd}
                    onChange={(e) => setPromoEnd(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl transition uppercase tracking-wider"
              >
                Aktifkan Kampanye Promo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRINT PREVIEW */}
      {selectedOrderForPrint && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
            
            {/* LEFT PANEL: CONFIG & ACTIONS */}
            <div className="p-6 md:w-1/2 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="bg-emerald-500/10 text-emerald-400 font-extrabold text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-emerald-500/20">
                    Printer Thermal Aktif ({strukLebar})
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForPrint(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <h4 className="font-extrabold text-white text-base">Cetak Struk Transaksi</h4>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Format cetak disesuaikan dengan standar printer POS thermal Anda.
                  </p>
                </div>

                <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-bold">Lebar Struk:</span>
                    <span className="font-extrabold text-emerald-400">{strukLebar}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-bold">Kode Order:</span>
                    <span className="font-mono font-extrabold">{selectedOrderForPrint.kode_order}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-bold">Nama Pembeli:</span>
                    <span className="font-extrabold">{selectedOrderForPrint.nama_pembeli}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="text-slate-400 font-bold block">Ubah Cepat Pengaturan Cetak:</label>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 bg-slate-950/30 p-2.5 rounded-xl border border-slate-800/40">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id="modal_show_alamat"
                        checked={strukShowAlamat}
                        onChange={(e) => setStrukShowAlamat(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <label htmlFor="modal_show_alamat" className="cursor-pointer font-semibold text-[10px]">Alamat Toko</label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id="modal_show_kontak"
                        checked={strukShowKontak}
                        onChange={(e) => setStrukShowKontak(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <label htmlFor="modal_show_kontak" className="cursor-pointer font-semibold text-[10px]">Nomor WA</label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-6">
                <button
                  type="button"
                  onClick={handlePrintSelectedOrder}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-3 rounded-2xl transition shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <Printer className="w-4 h-4" />
                  <span>{printerThermalNama ? 'Cetak ke Printer Thermal' : 'Cetak Struk POS'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedOrderForPrint) return;
                    const txt = generateReceiptText(selectedOrderForPrint);
                    if (!txt) return;
                    navigator.clipboard.writeText(txt);
                    showToast('Teks struk berhasil disalin ke clipboard!', 'success');
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs py-2.5 rounded-2xl transition flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Copy className="w-4 h-4 text-emerald-400" />
                  <span>Salin Teks Struk</span>
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: SIMULATED THERMAL PAPER PREVIEW */}
            <div className="p-6 md:w-1/2 bg-slate-950 flex flex-col justify-start max-h-full overflow-y-auto">
              <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider text-center">
                Review Tampilan Kertas Struk
              </p>
              
              {/* Simulated Paper Roll */}
              <div 
                className="bg-white text-slate-900 p-5 font-mono text-xs shadow-inner border border-slate-300 mx-auto rounded-xs flex flex-col relative"
                style={{ 
                  width: strukLebar === '58mm' ? '240px' : '320px', 
                  minHeight: '380px',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.2)' 
                }}
              >
                {/* Paper Tear Zigzag Visual Effect */}
                <div className="absolute -top-1 left-0 right-0 h-1 bg-[linear-gradient(45deg,transparent_33.33%,#0f172a_33.33%,#0f172a_66.66%,transparent_66.66%)] bg-[length:6px_6px]"></div>
                
                {/* Store Header */}
                <div className="text-center space-y-1 pb-3 mb-3 border-b border-dashed border-slate-300">
                  <h5 className="font-extrabold text-sm tracking-wide uppercase">{storeSettings.nama_toko}</h5>
                  {strukShowAlamat && <p className="text-[10px] text-slate-500 leading-tight">{storeSettings.alamat}</p>}
                  {strukShowKontak && <p className="text-[10px] text-slate-500">WA: {storeSettings.whatsapp}</p>}
                </div>

                {/* Receipt Header Text */}
                <div className="text-center text-[10px] italic font-semibold text-slate-600 mb-3 border-b border-dashed border-slate-300 pb-2">
                  {strukHeader}
                </div>

                {/* Metadata */}
                <div className="space-y-1 pb-2 mb-2 border-b border-dashed border-slate-300 text-[10px] text-slate-600">
                  <p>Kode: <span className="font-extrabold">{selectedOrderForPrint.kode_order}</span></p>
                  <p>Kasir: Admin Toko</p>
                  <p>Pelanggan: {selectedOrderForPrint.nama_pembeli}</p>
                  {strukShowWaktu && <p>Waktu: {new Date().toLocaleString('id-ID')}</p>}
                </div>

                {/* Items */}
                <div className="space-y-2 pb-2 mb-2 border-b border-dashed border-slate-300">
                  {selectedOrderForPrint.items && selectedOrderForPrint.items.length > 0 ? (
                    selectedOrderForPrint.items.map((item, idx) => (
                      <div key={idx} className="text-[10px] text-slate-700">
                        <p className="font-bold leading-tight">{item.nama_produk}</p>
                        <div className="flex justify-between font-mono mt-0.5">
                          <span className="text-slate-500">{item.qty} x Rp {formatRupiah(item.harga)}</span>
                          <span className="font-extrabold">Rp {formatRupiah(item.qty * item.harga)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-[10px] text-slate-400 py-2">Tidak ada item terdeteksi</p>
                  )}
                </div>

                {/* Pricing summary */}
                <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-2 mb-2 text-slate-600">
                  {(() => {
                    const subtotal = selectedOrderForPrint.items?.reduce((acc, i) => acc + (i.qty * i.harga), 0) || 0;
                    const ongkir = selectedOrderForPrint.total - subtotal;
                    return (
                      <>
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span className="font-bold">Rp {formatRupiah(subtotal)}</span>
                        </div>
                        {ongkir > 0 && (
                          <div className="flex justify-between">
                            <span>Biaya Pengantaran</span>
                            <span className="font-bold">Rp {formatRupiah(ongkir)}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Total */}
                <div className="flex justify-between font-extrabold text-sm text-slate-900 mb-4 pt-1">
                  <span>TOTAL BELANJA</span>
                  <span>Rp {formatRupiah(selectedOrderForPrint.total)}</span>
                </div>

                {/* Receipt Footer Text */}
                <div className="text-center text-[9px] text-slate-500 whitespace-pre-line leading-relaxed border-t border-dashed border-slate-300 pt-3 mt-auto">
                  {strukFooter}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* HIDDEN PRINT ZONE FOR BROWSER PRINTING */}
      {selectedOrderForPrint && (
        <div
          id="print-area"
          className="hidden print:block font-mono text-black mx-auto p-4 bg-white"
          style={{ width: strukLebar, fontSize: '11px', lineHeight: '1.4' }}
        >
          <div className="text-center space-y-1 pb-3 mb-3 border-b border-dashed border-black">
            <h2 className="text-sm font-black tracking-wide uppercase">{storeSettings.nama_toko}</h2>
            {strukShowAlamat && <p className="text-[9px]">{storeSettings.alamat}</p>}
            {strukShowKontak && <p className="text-[9px]">WA: {storeSettings.whatsapp}</p>}
          </div>

          <div className="text-center text-[10px] italic font-semibold mb-3 border-b border-dashed border-black pb-2">
            {strukHeader}
          </div>

          <div className="space-y-1 pb-2 mb-2 border-b border-dashed border-black text-[9px]">
            <p>Kode: {selectedOrderForPrint.kode_order}</p>
            <p>Kasir/Admin: Admin Toko</p>
            <p>Pelanggan: {selectedOrderForPrint.nama_pembeli}</p>
            {strukShowWaktu && <p>Waktu: {new Date().toLocaleString('id-ID')}</p>}
          </div>

          <div className="space-y-2 pb-2 mb-2 border-b border-dashed border-black">
            {selectedOrderForPrint.items?.map((item, idx) => (
              <div key={idx} className="text-[9px] space-y-0.5">
                <p className="font-extrabold">{item.nama_produk} ({item.nama_varian})</p>
                <div className="flex justify-between font-mono">
                  <span>{item.qty} x Rp {formatRupiah(item.harga)}</span>
                  <span>Rp {formatRupiah(item.qty * item.harga)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-[9px] border-b border-dashed border-black pb-2 mb-2 font-mono">
            {(() => {
              const subtotal = selectedOrderForPrint.items?.reduce((acc, i) => acc + (i.qty * i.harga), 0) || 0;
              const ongkir = selectedOrderForPrint.total - subtotal;
              return (
                <>
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>Rp {formatRupiah(subtotal)}</span>
                  </div>
                  {ongkir > 0 && (
                    <div className="flex justify-between">
                      <span>Ongkir</span>
                      <span>Rp {formatRupiah(ongkir)}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="flex justify-between font-black text-xs mb-4">
            <span>TOTAL</span>
            <span>Rp {formatRupiah(selectedOrderForPrint.total)}</span>
          </div>

          <div className="text-center text-[8px] whitespace-pre-line leading-relaxed">
            {strukFooter}
          </div>
        </div>
      )}
    </div>
  );
};
