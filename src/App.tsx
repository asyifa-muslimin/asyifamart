import React, { useState, useEffect, useRef } from 'react';
import {
  WifiOff,
  Store,
  Search,
  Heart,
  ShoppingBasket,
  ChevronDown,
  Receipt,
  ShieldAlert,
  LogIn,
  LogOut,
  User as UserIcon,
  LayoutGrid,
  Package,
  PackageSearch,
  ArrowLeft,
  X,
  Printer,
  XCircle,
  ShoppingBag,
  Download,
  Smartphone,
  Coins,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './supabaseClient';
import {
  StoreSettings,
  Category,
  Product,
  ProductVariant,
  Banner,
  Promo,
  User,
  Order,
  OrderItem,
  WishlistItem,
  CartItem,
  Reward,
  RewardRedemption,
} from './types';
import {
  defaultStoreSettings,
  defaultCategories,
  defaultProducts,
  defaultVariants,
  defaultBanners,
  defaultPromos,
} from './seedData';
import {
  seedCacheStoreSettings,
  seedCacheCategories,
  seedCacheProducts,
  seedCacheVariants,
  seedCacheBanners,
  seedCachePromos,
} from './seedCache';
import { ProductCard } from './components/ProductCard';
import { WishlistPage } from './components/WishlistPage';
import { RewardsPage } from './components/RewardsPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { CartPage } from './components/CartPage';
import { OrderHistory } from './components/OrderHistory';
import { ProfilePage } from './components/ProfilePage';
import { isVariantOfProduct, getProductId, getVariantProductId, safeSetLocalStorage } from './utils';
import { AdminPanel } from './components/AdminPanel';
import { buildReceiptEscPos } from './printer/escpos';
import { printRawEscPos, isQzConnected } from './printer/qzTray';
import { MINIMAL_KOIN_TUKAR } from './constants';

export default function App() {
  // Navigation & Page State
  const [currentPage, setCurrentPage] = useState<'home' | 'detail' | 'cart' | 'wishlist' | 'profile' | 'orders' | 'admin' | 'rewards'>('home');
  const [activeDetailProductId, setActiveDetailProductId] = useState<number | null>(null);

  // Connection & Database Mode States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [useLocalEmulation, setUseLocalEmulation] = useState(false);
  const [originalModePreference, setOriginalModePreference] = useState(false);

  // DB States
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [products, setProducts] = useState<Product[]>(defaultProducts);
  const [variants, setVariants] = useState<ProductVariant[]>(defaultVariants);
  const [banners, setBanners] = useState<Banner[]>(defaultBanners);
  const [promos, setPromos] = useState<Promo[]>(defaultPromos);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Client Local Storage States
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Push Notification State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return 'Notification' in window ? Notification.permission : 'default';
  });

  // Thermal Printer (QZ Tray) States
  const [qzPrinterStatus, setQzPrinterStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [autoPrintOrderIds, setAutoPrintOrderIds] = useState<Set<number>>(new Set());


  // Search, Sort, Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'semua' | number>('semua');
  const [activeSortFilter, setActiveSortFilter] = useState<'terbaru' | 'termurah' | 'termahal'>('terbaru');

  // Custom Confirmation Popup State
  const [confirmPopup, setConfirmPopup] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Variant selector modal state
  const [variantSelectorData, setVariantSelectorData] = useState<{
    isOpen: boolean;
    product: Product | null;
    action: 'cart' | 'buy';
  }>({
    isOpen: false,
    product: null,
    action: 'cart',
  });
  const [selectedVariantIdForPicker, setSelectedVariantIdForPicker] = useState<number | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' | 'warning' }>>([]);

  // User Dropdown open state
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // PWA States & Installer
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);
  const [isOfflineBackupActive, setIsOfflineBackupActive] = useState<boolean>(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(localStorage.getItem('offline_backup_timestamp'));

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install: ${outcome}`);
    } catch (err) {
      console.error('Error with install prompt:', err);
    } finally {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    // Geolocation and online listeners
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Koneksi internet kembali normal!', 'success');
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Koneksi internet terputus.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Hydrate state from localStorage
    const savedUser = localStorage.getItem('asyifa_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }

    // Dengarkan perubahan sesi Supabase Auth (login dari tab lain, sesi
    // habis/expired, dsb) supaya currentUser tidak "nyangkut" di status
    // login padahal sesi Auth sebenarnya sudah berakhir.
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem('asyifa_user');
      }
    });

    const savedCart = localStorage.getItem('asyifa_cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    const savedWish = localStorage.getItem('asyifa_wishlist');
    if (savedWish) {
      setWishlist(JSON.parse(savedWish));
    }

    // Register Service Worker for push notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered successfully:', reg);
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      authListener?.subscription.unsubscribe();
    };
  }, [originalModePreference]);

  // Request notification permission and trigger a test notification
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showToast('Browser Anda tidak mendukung push notification.', 'error');
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showToast('Notifikasi status pesanan berhasil diaktifkan!', 'success');
        triggerPushNotification(
          'Notifikasi Aktif 🔔',
          'Anda akan menerima pemberitahuan setiap kali status pesanan Anda berubah.'
        );
        return true;
      } else {
        showToast('Izin notifikasi ditolak. Silakan aktifkan melalui pengaturan browser.', 'warning');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  // Trigger push notification via registered service worker (or fallback)
  const triggerPushNotification = (title: string, body: string, tag?: string) => {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body: body,
          icon: 'https://images.unsplash.com/photo-1556742077-3f17dabd254a?auto=format&fit=crop&w=192&h=192&q=80',
          badge: 'https://images.unsplash.com/photo-1556742077-3f17dabd254a?auto=format&fit=crop&w=192&h=192&q=80',
          vibrate: [100, 50, 100],
          tag: tag || 'order-status-update',
          renotify: true,
          data: {
            url: '/#orders'
          }
        } as any);
      }).catch((err) => {
        console.error('Error with service worker notification, falling back:', err);
        new Notification(title, { body });
      });
    } else if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  };

  // Track order status changes to trigger push notifications
  useEffect(() => {
    if (!orders || orders.length === 0 || !currentUser) return;

    // Only track status changes for logged-in customers' own orders
    const customerOrders = orders.filter((o) => o.user_id === currentUser.id);
    if (customerOrders.length === 0) return;

    const savedStatusesStr = localStorage.getItem('asyifa_order_statuses');
    const knownStatuses = savedStatusesStr ? JSON.parse(savedStatusesStr) : {};
    let statusChanged = false;

    customerOrders.forEach((order) => {
      const prevStatus = knownStatuses[order.id];
      if (prevStatus !== undefined && prevStatus !== order.status) {
        let statusMessage = '';
        switch (order.status) {
          case 'Diproses':
            statusMessage = `Pesanan Anda (${order.kode_order}) sedang diproses oleh toko.`;
            break;
          case 'Dikirim':
            statusMessage = `Pesanan Anda (${order.kode_order}) sedang dikirim ke alamat Anda! 🚚`;
            break;
          case 'Selesai':
            statusMessage = `Pesanan Anda (${order.kode_order}) telah selesai. Terima kasih telah berbelanja! 🎉`;
            break;
          case 'Dibatalkan':
            statusMessage = `Pesanan Anda (${order.kode_order}) telah dibatalkan.`;
            break;
          default:
            statusMessage = `Status pesanan Anda (${order.kode_order}) berubah menjadi: ${order.status}.`;
        }

        triggerPushNotification(
          `Status Pesanan: ${order.status}`,
          statusMessage,
          `order-${order.id}`
        );
        statusChanged = true;
      }
      knownStatuses[order.id] = order.status;
    });

    localStorage.setItem('asyifa_order_statuses', JSON.stringify(knownStatuses));
  }, [orders, currentUser]);

  // Sync / Load data
  useEffect(() => {
    syncData();
  }, [useLocalEmulation, isOnline]);

  // Load orders when user changes or DB mode changes
  useEffect(() => {
    if (currentUser) {
      loadUserOrders();
      loadRedemptions();
    } else {
      setOrders([]);
      setRedemptions([]);
    }
  }, [currentUser, useLocalEmulation, isOnline, isOfflineBackupActive]);

  // Realtime subscription setup
  useEffect(() => {
    if (useLocalEmulation) return;

    // Listen to changes on schema to synchronize all clients instantly
    const channel = supabase
      .channel('schema-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          console.log('Realtime Postgres Change detected:', payload);
          silentSync();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [useLocalEmulation]);

  // Auto-print struk thermal saat pesanan baru masuk (khusus admin, hanya kalau diaktifkan).
  // Terpisah dari channel 'schema-changes' di atas supaya fokus 1 event spesifik
  // (INSERT pada tabel orders) dan tidak ikut terpicu oleh perubahan tabel lain.
  useEffect(() => {
    if (useLocalEmulation) return;
    if (!currentUser || currentUser.role !== 'admin') return;
    if (!storeSettings.printer_auto_print_aktif) return;
    if (!storeSettings.printer_thermal_nama) return;

    const orderChannel = supabase
      .channel('orders-auto-print')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          const newOrderRow = payload.new as Order;
          if (!newOrderRow || !newOrderRow.id) return;

          await autoPrintIncomingOrder(newOrderRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [useLocalEmulation, currentUser, storeSettings.printer_auto_print_aktif, storeSettings.printer_thermal_nama]);

  // Helper to trigger toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmPopup({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  };

  // Kolom eksplisit per tabel (bukan select('*')) supaya kalau suatu saat ada
  // kolom besar baru ditambahkan ke tabel, query lama tidak otomatis ikut
  // menariknya. Untuk products, foto tetap disertakan karena memang dipakai
  // tampilan — payload besar pada kolom ini sebaiknya diatasi dengan migrasi
  // foto ke Supabase Storage (URL), bukan dengan menghilangkannya dari select.
  const COLS = {
    store_settings:
      'id, nama_toko, whatsapp, alamat, google_maps, latitude, longitude, payment_cod_active, payment_cod_note, payment_qris_active, payment_qris_image, payment_dana_active, payment_dana_number, payment_dana_name, struk_header, struk_footer, struk_lebar, struk_show_alamat, struk_show_kontak, struk_show_waktu, printer_thermal_nama, printer_auto_print_aktif',
    categories: 'id, nama_kategori, slug, icon',
    products: 'id, nama_produk, slug, kategori_id, deskripsi, foto, status',
    product_variants: 'id, product_id, nama_varian, sku, harga, harga_promo, stok, berat',
    banners: 'id, judul, gambar, link, aktif',
    promos: 'id, nama_promo, tipe, nilai, tanggal_mulai, tanggal_selesai',
  };

  // Tiap fungsi di bawah ini independen (fetch tabelnya sendiri, seed kalau
  // kosong) sehingga aman dijalankan bersamaan lewat Promise.all di
  // silentSync(). Dependency foreign key (mis. products -> categories) hanya
  // relevan saat seeding tabel yang BENAR-BENAR kosong; pada pemakaian normal
  // (tabel sudah berisi data) ke-6 query ini tidak saling bergantung.
  const syncStoreSettingsTable = async () => {
    const { data: settings } = await supabase.from('store_settings').select(COLS.store_settings);
    if (settings && settings.length > 0) {
      setStoreSettings(settings[0] as any);
      safeSetLocalStorage('emulated_store_settings', settings);
    } else {
      const { error: seedErr } = await supabase.from('store_settings').insert(defaultStoreSettings);
      if (!seedErr) {
        setStoreSettings(defaultStoreSettings);
        safeSetLocalStorage('emulated_store_settings', [defaultStoreSettings]);
      }
    }
  };

  const syncCategoriesTable = async () => {
    const { data: cats } = await supabase.from('categories').select(COLS.categories);
    if (cats && cats.length > 0) {
      setCategories(cats as any);
      safeSetLocalStorage('emulated_categories', cats);
    } else {
      const { error: seedErr } = await supabase.from('categories').insert(defaultCategories);
      if (!seedErr) {
        const { data: refetched } = await supabase.from('categories').select(COLS.categories);
        if (refetched) {
          setCategories(refetched as any);
          safeSetLocalStorage('emulated_categories', refetched);
        }
      }
    }
  };

  const syncProductsTable = async () => {
    const { data: prods } = await supabase.from('products').select(COLS.products);
    if (prods && prods.length > 0) {
      setProducts(prods as any);
      safeSetLocalStorage('emulated_products', prods);
    } else {
      const { error: seedErr } = await supabase.from('products').insert(defaultProducts);
      if (!seedErr) {
        const { data: refetched } = await supabase.from('products').select(COLS.products);
        if (refetched) {
          setProducts(refetched as any);
          safeSetLocalStorage('emulated_products', refetched);
        }
      }
    }
  };

  const syncVariantsTable = async () => {
    const { data: vars } = await supabase.from('product_variants').select(COLS.product_variants);
    if (vars && vars.length > 0) {
      setVariants(vars as any);
      safeSetLocalStorage('emulated_product_variants', vars);
    } else {
      const { error: seedErr } = await supabase.from('product_variants').insert(defaultVariants);
      if (!seedErr) {
        const { data: refetched } = await supabase.from('product_variants').select(COLS.product_variants);
        if (refetched) {
          setVariants(refetched as any);
          safeSetLocalStorage('emulated_product_variants', refetched);
        }
      }
    }
  };

  const syncBannersTable = async () => {
    const { data: bans } = await supabase.from('banners').select(COLS.banners);
    if (bans && bans.length > 0) {
      setBanners(bans as any);
      safeSetLocalStorage('emulated_banners', bans);
    } else {
      const { error: seedErr } = await supabase.from('banners').insert(defaultBanners);
      if (!seedErr) {
        const { data: refetched } = await supabase.from('banners').select(COLS.banners);
        if (refetched) {
          setBanners(refetched as any);
          safeSetLocalStorage('emulated_banners', refetched);
        }
      }
    }
  };

  const syncPromosTable = async () => {
    const { data: prms } = await supabase.from('promos').select(COLS.promos);
    if (prms && prms.length > 0) {
      setPromos(prms as any);
      safeSetLocalStorage('emulated_promos', prms);
    } else {
      setPromos([]);
      safeSetLocalStorage('emulated_promos', []);
    }
  };

  const syncRewardsTable = async () => {
    const { data: rws } = await supabase
      .from('rewards')
      .select('id, nama_hadiah, deskripsi, foto, biaya_koin, stok, aktif, created_at')
      .order('biaya_koin', { ascending: true });
    if (rws) {
      setRewards(rws as any);
      safeSetLocalStorage('emulated_rewards', rws);
    }
  };

  const silentSync = async () => {
    try {
      // Jalankan sync tabel secara PARALEL (bukan berurutan dengan
      // await satu-per-satu) supaya total waktu = waktu query paling lambat,
      // bukan akumulasi seluruh query.
      await Promise.all([
        syncStoreSettingsTable(),
        syncCategoriesTable(),
        syncProductsTable(),
        syncVariantsTable(),
        syncBannersTable(),
        syncPromosTable(),
        syncRewardsTable(),
      ]);

      const nowStr = new Date().toLocaleString('id-ID');
      safeSetLocalStorage('offline_backup_timestamp', nowStr);
      setLastBackupTime(nowStr);
      setIsOfflineBackupActive(false);

      if (currentUser) {
        loadUserOrders();
      }
    } catch (err) {
      console.warn('Silent sync failed:', err);
      throw err; // throw to let syncData handle backup fallback
    }
  };

  // Baca cache localStorage (jika ada) dan tampilkan ke state.
  // Mengembalikan true jika ada minimal satu cache yang ditemukan, false jika benar-benar kosong (lalu pakai seed dari backup).
  const loadFromCacheOrDefaults = (): boolean => {
    const cachedSettings = localStorage.getItem('emulated_store_settings');
    const cachedCategories = localStorage.getItem('emulated_categories');
    const cachedProducts = localStorage.getItem('emulated_products');
    const cachedVariants = localStorage.getItem('emulated_product_variants');
    const cachedBanners = localStorage.getItem('emulated_banners');
    const cachedPromos = localStorage.getItem('emulated_promos');

    const hasCache = !!(cachedSettings || cachedCategories || cachedProducts || cachedVariants);

    // Catatan: kalau belum ada cache sama sekali (pertama kali app dibuka di perangkat ini),
    // pakai data asli dari backup cloud (seedCache.ts) sebagai tampilan awal, bukan defaultProducts
    // contoh dari seedData.ts. Ini membuat katalog langsung terisi penuh sebelum sempat sync ke Supabase.
    if (cachedSettings) setStoreSettings(JSON.parse(cachedSettings)[0]);
    else setStoreSettings(seedCacheStoreSettings || defaultStoreSettings);

    if (cachedCategories) setCategories(JSON.parse(cachedCategories));
    else setCategories(seedCacheCategories.length > 0 ? seedCacheCategories : defaultCategories);

    if (cachedProducts) setProducts(JSON.parse(cachedProducts));
    else setProducts(seedCacheProducts.length > 0 ? seedCacheProducts : defaultProducts);

    if (cachedVariants) setVariants(JSON.parse(cachedVariants));
    else setVariants(seedCacheVariants.length > 0 ? seedCacheVariants : defaultVariants);

    if (cachedBanners) setBanners(JSON.parse(cachedBanners));
    else setBanners(seedCacheBanners.length > 0 ? seedCacheBanners : defaultBanners);

    if (cachedPromos) setPromos(JSON.parse(cachedPromos));
    else setPromos(seedCachePromos.length > 0 ? seedCachePromos : defaultPromos);

    const cachedRewards = localStorage.getItem('emulated_rewards');
    if (cachedRewards) setRewards(JSON.parse(cachedRewards));

    return hasCache;
  };

  // Cache-first + stale-while-revalidate:
  // 1. Tampilkan cache (atau default) duluan supaya UI langsung terisi tanpa menunggu network.
  // 2. Tetap coba sync ke Supabase di belakang layar; kalau berhasil, tampilan & cache ter-update otomatis (lihat silentSync()).
  // 3. Kalau sync gagal, cache/default yang sudah tampil di langkah 1 tetap dipakai sebagai fallback.
  const syncData = async () => {
    if (useLocalEmulation) {
      // Mode emulasi offline murni: tidak ada Supabase sama sekali, cukup cache/default.
      loadFromCacheOrDefaults();
      return;
    }

    // Langkah 1: tampilkan cache/default dulu secepat mungkin.
    const hadCache = loadFromCacheOrDefaults();

    // Langkah 2: revalidate ke Supabase di belakang layar.
    try {
      await silentSync();
    } catch (error) {
      console.error('Connection to live Supabase failed.', error);

      // Langkah 3: data dari langkah 1 sudah tampil di UI, cukup beri tahu pengguna statusnya.
      if (hadCache) {
        setIsOfflineBackupActive(true);
        const timestamp = localStorage.getItem('offline_backup_timestamp') || 'Beberapa saat lalu';
        showToast(`Offline: Database dimuat dari Backup Lokal (${timestamp})`, 'info');
      } else {
        setIsOfflineBackupActive(true);
        showToast('Koneksi terputus. Menggunakan data bawaan toko.', 'warning');
      }
    }
  };

  const loadUserOrders = async () => {
    if (!currentUser) return;
    if (useLocalEmulation || isOfflineBackupActive) {
      const cachedOrders = localStorage.getItem('emulated_orders') || '[]';
      const parsed = JSON.parse(cachedOrders) as Order[];
      if (currentUser.role === 'admin') {
        setOrders(parsed);
      } else {
        setOrders(parsed.filter((o) => o.user_id === currentUser.id));
      }
      return;
    }
    try {
      let query = supabase
        .from('orders')
        .select('id, user_id, kode_order, total, status, nama_pembeli, whatsapp_pembeli, alamat, catatan, created_at')
        .order('id', { ascending: false });
      if (currentUser.role !== 'admin') {
        query = query.eq('user_id', currentUser.id);
      }
      const { data } = await query;
      if (data) {
        setOrders(data);
        localStorage.setItem('emulated_orders', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Failed to load live orders, using offline order fallback:', err);
      const cachedOrders = localStorage.getItem('emulated_orders') || '[]';
      const parsed = JSON.parse(cachedOrders) as Order[];
      if (currentUser.role === 'admin') {
        setOrders(parsed);
      } else {
        setOrders(parsed.filter((o) => o.user_id === currentUser.id));
      }
    }
  };

  // --- ACTIONS & HANDLERS ---
  const handleBrandClick = () => {
    setCurrentPage('home');
  };

  const navigate = (page: typeof currentPage) => {
    if (page === 'orders' && !currentUser) {
      navigate('profile');
      showToast('Silakan login terlebih dahulu untuk mengakses riwayat pesanan.', 'info');
      return;
    }
    if (page === 'rewards' && !currentUser) {
      navigate('profile');
      showToast('Silakan login terlebih dahulu untuk melihat koin & hadiah Anda.', 'info');
      return;
    }
    if (page === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
      navigate('home');
      showToast('Akses Panel Administrator ditolak.', 'error');
      return;
    }
    setCurrentPage(page);
    setIsUserMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle favorite on/off
  const handleToggleWishlist = async (e: React.MouseEvent, prodId: number) => {
    e.stopPropagation();
    const exists = wishlist.some((item) => item.product_id === prodId);
    let updated: WishlistItem[];

    if (exists) {
      updated = wishlist.filter((item) => item.product_id !== prodId);
      showToast('Dihapus dari daftar favorit.', 'warning');
    } else {
      updated = [...wishlist, { id: Math.floor(Date.now() + Math.random() * 10000), product_id: prodId }];
      showToast('Ditambahkan ke daftar favorit!', 'success');
    }

    setWishlist(updated);
    localStorage.setItem('asyifa_wishlist', JSON.stringify(updated));

    if (currentUser && !useLocalEmulation) {
      try {
        await supabase.from('wishlist').delete().eq('user_id', currentUser.id);
        for (const item of updated) {
          await supabase.from('wishlist').insert({ user_id: currentUser.id, product_id: item.product_id });
        }
      } catch (err) {
        console.error('Failed to sync wishlist to Supabase:', err);
      }
    }
  };

  // Add Item to Cart
  const handleAddToCart = (variantId: number, qtyChange = 1) => {
    const existsIdx = cart.findIndex((item) => item.variant_id === variantId);
    let updated: CartItem[];

    if (existsIdx !== -1) {
      updated = [...cart];
      updated[existsIdx].qty += qtyChange;
      if (updated[existsIdx].qty <= 0) {
        updated.splice(existsIdx, 1);
      }
    } else {
      updated = [...cart, { variant_id: variantId, qty: 1 }];
    }

    setCart(updated);
    localStorage.setItem('asyifa_cart', JSON.stringify(updated));
    showToast('Berhasil menambahkan item ke keranjang!', 'success');
  };

  const handleUpdateQty = (variantId: number, change: number) => {
    const existsIdx = cart.findIndex((item) => item.variant_id === variantId);
    if (existsIdx === -1) return;

    const updated = [...cart];
    updated[existsIdx].qty += change;
    if (updated[existsIdx].qty <= 0) {
      updated.splice(existsIdx, 1);
      showToast('Item dihapus dari keranjang belanja.', 'warning');
    }

    setCart(updated);
    localStorage.setItem('asyifa_cart', JSON.stringify(updated));
  };

  const handleRemoveItem = (variantId: number) => {
    const updated = cart.filter((item) => item.variant_id !== variantId);
    setCart(updated);
    localStorage.setItem('asyifa_cart', JSON.stringify(updated));
    showToast('Item dihapus dari keranjang.', 'warning');
  };

  const handleCheckoutSubmit = async (checkoutData: {
    nama: string;
    wa: string;
    alamat: string;
    catatan: string;
    mapsUrl: string;
    paymentMethod: string;
    distance: number;
    ongkir: number;
  }) => {
    let subtotalPrice = 0;
    let orderLines = "";

    cart.forEach((item, index) => {
      const variant = variants.find((v) => v.id === item.variant_id);
      if (!variant) return;
      const prod = products.find((p) => isVariantOfProduct(variant, p));
      if (!prod) return;
      const price = variant.harga_promo > 0 ? variant.harga_promo : variant.harga;
      const linePrice = price * item.qty;
      subtotalPrice += linePrice;

      orderLines += `${index + 1}. ${prod.nama_produk} (${variant.nama_varian}) x ${item.qty} - Rp ${new Intl.NumberFormat('id-ID').format(linePrice)}\n`;
    });

    const grandTotal = subtotalPrice + checkoutData.ongkir;
    const kodeOrder = "ASYIFA-" + Math.floor(100000 + Math.random() * 900000);
    const fullAlamat = checkoutData.mapsUrl ? `${checkoutData.alamat}\n📍 Maps Link: ${checkoutData.mapsUrl}` : checkoutData.alamat;

    // Koin loyalitas: 1 koin per kelipatan Rp35.000 dari SUBTOTAL belanja
    // (ongkos kirim tidak dihitung, supaya jarak pengantaran tidak mempengaruhi
    // perolehan koin). Dibulatkan ke bawah -- belanja Rp99.000 = 2 koin, bukan 3.
    const KOIN_PER_RUPIAH = 35000;
    const koinDiperoleh = Math.floor(subtotalPrice / KOIN_PER_RUPIAH);

    // If logged in, record the transaction in the database
    if (currentUser) {
      if (useLocalEmulation) {
        const cachedOrders = JSON.parse(localStorage.getItem('emulated_orders') || '[]') as Order[];
        const newOrder: Order = {
          id: Math.floor(Date.now() + Math.random() * 100000),
          user_id: currentUser.id,
          kode_order: kodeOrder,
          total: grandTotal,
          status: 'Baru',
          nama_pembeli: checkoutData.nama,
          whatsapp_pembeli: checkoutData.wa,
          alamat: fullAlamat,
          catatan: checkoutData.catatan,
          koin_diperoleh: koinDiperoleh,
          created_at: new Date().toISOString(),
          items: cart.map(item => {
            const variant = variants.find(v => v.id === item.variant_id);
            const prod = variant ? products.find((p) => isVariantOfProduct(variant, p)) : null;
            return {
              id: Math.random(),
              nama_produk: prod ? prod.nama_produk : 'Produk Sembako',
              nama_varian: variant ? variant.nama_varian : 'Ukuran Standar',
              qty: item.qty,
              harga: variant ? (variant.harga_promo > 0 ? variant.harga_promo : variant.harga) : 0
            };
          })
        };
        const updatedOrders = [newOrder, ...cachedOrders];
        localStorage.setItem('emulated_orders', JSON.stringify(updatedOrders));
        setOrders(updatedOrders.filter((o) => o.user_id === currentUser.id));

        // Tambahkan koin ke saldo user (emulasi lokal).
        if (koinDiperoleh > 0) {
          const updatedUser = { ...currentUser, koin: (currentUser.koin || 0) + koinDiperoleh };
          setCurrentUser(updatedUser);
          localStorage.setItem('asyifa_user', JSON.stringify(updatedUser));
        }
      } else {
        try {
          const { data: newOrder, error } = await supabase
            .from('orders')
            .insert({
              user_id: currentUser.id,
              kode_order: kodeOrder,
              total: grandTotal,
              status: 'Baru',
              nama_pembeli: checkoutData.nama,
              whatsapp_pembeli: checkoutData.wa,
              alamat: fullAlamat,
              catatan: checkoutData.catatan,
              koin_diperoleh: koinDiperoleh,
            })
            .select();

          if (error) throw error;

          if (newOrder && newOrder.length > 0) {
            for (const item of cart) {
              const variant = variants.find((v) => v.id === item.variant_id);
              if (variant) {
                const harga = variant.harga_promo > 0 ? variant.harga_promo : variant.harga;
                await supabase.from('order_items').insert({
                  order_id: newOrder[0].id,
                  variant_id: variant.id,
                  qty: item.qty,
                  harga: harga,
                });
              }
            }
          }

          // Tambahkan koin ke saldo user di database, lalu sinkronkan ke state
          // lokal supaya saldo yang tampil ke pengguna langsung ter-update.
          if (koinDiperoleh > 0) {
            const newKoinTotal = (currentUser.koin || 0) + koinDiperoleh;
            const { error: koinError } = await supabase
              .from('users')
              .update({ koin: newKoinTotal })
              .eq('id', currentUser.id);

            if (!koinError) {
              const updatedUser = { ...currentUser, koin: newKoinTotal };
              setCurrentUser(updatedUser);
              localStorage.setItem('asyifa_user', JSON.stringify(updatedUser));
            } else {
              console.error('Gagal menambah koin:', koinError);
            }
          }
        } catch (err: any) {
          console.error('Failed to save order:', err);
          showToast('Pesanan gagal dicatat ke database cloud, tapi tetap diarahkan ke WhatsApp.', 'warning');
        }
      }
    }

    // Format WhatsApp message
    const waText = `━━━━━━━━━━━━━━
PESANAN ASYIFA MART
━━━━━━━━━━━━━━
Kode Order: ${kodeOrder}
Nama: ${checkoutData.nama}
WhatsApp: ${checkoutData.wa}
Alamat: ${checkoutData.alamat}
${checkoutData.mapsUrl ? `Maps: ${checkoutData.mapsUrl}\n` : ''}Metode Bayar: ${checkoutData.paymentMethod.toUpperCase()}

Detail Belanjaan:
${orderLines}
Subtotal: Rp ${new Intl.NumberFormat('id-ID').format(subtotalPrice)}
Jarak Pengantaran: ${checkoutData.distance > 0 ? `${checkoutData.distance.toFixed(2)} Km` : '-'}
Ongkos Kirim: ${checkoutData.ongkir > 0 ? `Rp ${new Intl.NumberFormat('id-ID').format(checkoutData.ongkir)}` : 'Gratis'}
Total Bayar: Rp ${new Intl.NumberFormat('id-ID').format(grandTotal)}
${currentUser && koinDiperoleh > 0 ? `Koin Diperoleh: +${koinDiperoleh} koin 🪙\n` : ''}Catatan: ${checkoutData.catatan}
━━━━━━━━━━━━━━`;

    const whatsappNumber = storeSettings.whatsapp.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waText)}`;

    // Clear cart
    setCart([]);
    localStorage.removeItem('asyifa_cart');

    window.open(waUrl, '_blank');
    if (currentUser && koinDiperoleh > 0) {
      showToast(`Pesanan berhasil dibuat! Anda mendapat ${koinDiperoleh} koin 🪙`, 'success');
    } else {
      showToast('Pesanan berhasil dibuat! Dialihkan ke WhatsApp kurir...', 'success');
    }
    setCurrentPage('home');
  };

  const handleLogin = async (identifier: string, password: string) => {
    if (useLocalEmulation) {
      // Offline local auth
      const mockUser: User = {
        id: 'emulated-user-123',
        nama: identifier.includes('@') ? identifier.split('@')[0] : `User-${identifier}`,
        email: identifier.includes('@') ? identifier : `user-${identifier}@asyifamart.com`,
        whatsapp: identifier.includes('@') ? '081234567890' : identifier,
        alamat: 'Alamat Emulasi Lokal',
        role: identifier.toLowerCase() === 'admin@asyifamart.com' ? 'admin' : 'pelanggan',
        created_at: new Date().toISOString(),
      };
      setCurrentUser(mockUser);
      localStorage.setItem('asyifa_user', JSON.stringify(mockUser));
      showToast(`Berhasil masuk sebagai ${mockUser.nama} (Offline Emulation)`, 'success');
      return;
    }

    try {
      // Deteksi apakah input berupa email atau nomor HP.
      // Kalau nomor HP: cari email yang terhubung di tabel users dulu,
      // baru login Supabase Auth pakai email itu. Supabase Auth tidak
      // mendukung login langsung dengan nomor HP tanpa SMS provider,
      // jadi email tetap jadi identifier resmi di sisi Auth -- nomor HP
      // hanya dipakai sebagai "jalur alternatif" untuk mencarinya.
      const isEmail = identifier.includes('@');
      let emailToLogin = identifier.trim().toLowerCase();

      if (!isEmail) {
        // Normalisasi nomor HP: hapus semua karakter non-angka,
        // lalu coba beberapa format umum (0812..., 62812..., 812...).
        const cleanPhone = identifier.replace(/[^0-9]/g, '');
        const phoneVariants: string[] = [cleanPhone];
        if (cleanPhone.startsWith('0')) {
          phoneVariants.push('62' + cleanPhone.slice(1));
        } else if (cleanPhone.startsWith('62')) {
          phoneVariants.push('0' + cleanPhone.slice(2));
        } else {
          phoneVariants.push('0' + cleanPhone);
          phoneVariants.push('62' + cleanPhone);
        }

        // Pakai RPC khusus (bukan query langsung ke tabel users), karena
        // RLS membatasi SELECT ke baris milik sendiri saja -- yang
        // mustahil dipenuhi sebelum login. RPC ini secara sengaja sempit:
        // hanya mengembalikan email, tidak ada kolom lain yang bocor.
        let foundEmail: string | null = null;
        for (const variant of phoneVariants) {
          const { data: emailResult, error: phoneErr } = await supabase.rpc('get_email_by_phone', {
            phone_input: variant,
          });
          if (phoneErr) throw phoneErr;
          if (emailResult) {
            foundEmail = emailResult;
            break;
          }
        }

        if (!foundEmail) {
          showToast('Nomor HP tidak ditemukan. Pastikan nomor yang Anda masukkan sudah terdaftar.', 'warning');
          return;
        }
        emailToLogin = foundEmail;
      }

      // Login ke Supabase Auth pakai email + password.
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Masuk gagal, sesi tidak terbentuk.');

      // Ambil profil dari tabel users.
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        const fallbackNama = authData.user.email?.split('@')[0] || 'Pengguna';
        const { data: created, error: createError } = await supabase
          .from('users')
          .insert([
            {
              id: authData.user.id,
              nama: fallbackNama,
              email: authData.user.email,
              whatsapp: '',
              alamat: '',
              role: authData.user.email?.toLowerCase() === 'admin@asyifamart.com' ? 'admin' : 'pelanggan',
            },
          ])
          .select()
          .maybeSingle();

        if (createError || !created) {
          throw new Error(
            'Akun login Anda valid, tapi profil data belum tersedia dan gagal dibuat otomatis. Silakan hubungi admin toko.'
          );
        }

        setCurrentUser(created);
        localStorage.setItem('asyifa_user', JSON.stringify(created));
        showToast(`Profil baru dibuat & masuk sebagai ${created.nama}. Silakan lengkapi data di halaman Profil.`, 'info');
        navigate('home');
        return;
      }

      setCurrentUser(profile);
      localStorage.setItem('asyifa_user', JSON.stringify(profile));
      showToast(`Selamat datang kembali, ${profile.nama}!`, 'success');
      if (profile.role === 'admin') navigate('admin');
      else navigate('home');
    } catch (err: any) {
      const msg = String(err.message || '');
      if (msg.toLowerCase().includes('invalid login credentials')) {
        showToast('Email/No HP atau kata sandi salah. Silakan periksa kembali.', 'error');
      } else {
        showToast(`Masuk gagal: ${msg}`, 'error');
      }
    }
  };

  const handleRegister = async (regData: {
    nama: string;
    email: string;
    password: string;
    whatsapp: string;
    alamat: string;
    mapsUrl: string;
  }) => {
    const isDefaultAdmin = regData.email.toLowerCase() === 'admin@asyifamart.com';
    const role = isDefaultAdmin ? 'admin' : 'pelanggan';

    if (useLocalEmulation) {
      const mockUser: User = {
        id: crypto.randomUUID(),
        nama: regData.nama,
        email: regData.email,
        whatsapp: regData.whatsapp,
        alamat: regData.alamat,
        google_maps: regData.mapsUrl,
        role: role,
        created_at: new Date().toISOString(),
      };
      setCurrentUser(mockUser);
      localStorage.setItem('asyifa_user', JSON.stringify(mockUser));
      showToast(`Pendaftaran berhasil! Selamat datang, ${regData.nama}!`, 'success');
      return;
    }

    try {
      // Daftar lewat Supabase Auth (bukan lagi insert manual ke tabel users).
      // Supabase Auth akan membuat akun resmi dengan email+password, dan
      // memberi `id` (UUID) unik yang nanti jadi acuan auth.uid() untuk RLS.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: regData.email,
        password: regData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Pendaftaran gagal, akun tidak terbentuk.');

      // Simpan profil (nama, WA, alamat) ke tabel `users`, dengan id YANG SAMA
      // dengan id dari Supabase Auth -- ini penghubung penting antara akun
      // login dan data profil/pesanan pelanggan.
      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            nama: regData.nama,
            email: regData.email,
            whatsapp: regData.whatsapp,
            alamat: regData.alamat,
            google_maps: regData.mapsUrl,
            role: role,
          },
        ])
        .select();

      if (error) throw error;
      if (data && data.length > 0) {
        setCurrentUser(data[0]);
        localStorage.setItem('asyifa_user', JSON.stringify(data[0]));
        showToast(`Pendaftaran berhasil! Selamat datang ${regData.nama}!`, 'success');
        navigate('home');
      }
    } catch (err: any) {
      // Pesan Supabase Auth untuk email yang sudah terdaftar biasanya
      // menyebut "already registered" -- terjemahkan supaya lebih jelas.
      const msg = String(err.message || '');
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        showToast('Email sudah terdaftar. Silakan masuk dengan kata sandi Anda.', 'warning');
      } else {
        showToast(`Gagal mendaftar: ${msg}`, 'error');
      }
    }
  };

  const handleLogout = async () => {
    if (!useLocalEmulation) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    localStorage.removeItem('asyifa_user');
    showToast('Berhasil keluar dari akun.', 'warning');
    navigate('home');
  };

  const handleSaveStoreSettings = async (settings: StoreSettings) => {
    if (useLocalEmulation) {
      safeSetLocalStorage('emulated_store_settings', [settings]);
      setStoreSettings(settings);
      showToast('Konfigurasi toko berhasil disimpan secara lokal!', 'success');
      return;
    }

    try {
      const { error } = await supabase.from('store_settings').update(settings).eq('id', 1);
      if (error) {
        // Try fallback insert if not exists
        await supabase.from('store_settings').insert({ id: 1, ...settings });
      }
      setStoreSettings(settings);
      showToast('Profil toko kelontong berhasil disimpan ke Supabase!', 'success');
    } catch (err: any) {
      showToast(`Gagal menyimpan pengaturan: ${err.message}`, 'error');
    }
  };

  const handleSaveCategory = async (cat: { id?: number; nama_kategori: string; icon: string }) => {
    const slug = cat.nama_kategori.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (cat.id) {
      if (useLocalEmulation) {
        const updated = categories.map((c) =>
          c.id === cat.id ? { ...c, nama_kategori: cat.nama_kategori, slug, icon: cat.icon } : c
        );
        safeSetLocalStorage('emulated_categories', updated);
        setCategories(updated);
        showToast('Kategori diperbarui secara lokal!', 'success');
        return;
      }

      try {
        const { error } = await supabase
          .from('categories')
          .update({
            nama_kategori: cat.nama_kategori,
            slug,
            icon: cat.icon,
          })
          .eq('id', cat.id);
        if (error) throw error;
        showToast('Kategori berhasil diperbarui di cloud!', 'success');
        syncData();
      } catch (err: any) {
        showToast(`Gagal memperbarui kategori: ${err.message}`, 'error');
      }
    } else {
      const newId = Math.floor(Date.now() + Math.random() * 100000);
      if (useLocalEmulation) {
        const updated = [...categories, { id: newId, nama_kategori: cat.nama_kategori, slug, icon: cat.icon }];
        safeSetLocalStorage('emulated_categories', updated);
        setCategories(updated);
        showToast('Kategori baru ditambahkan secara lokal!', 'success');
        return;
      }

      try {
        const { error } = await supabase.from('categories').insert({
          nama_kategori: cat.nama_kategori,
          slug,
          icon: cat.icon,
        });
        if (error) throw error;
        showToast('Kategori berhasil ditambahkan ke database cloud!', 'success');
        syncData();
      } catch (err: any) {
        showToast(`Gagal menyimpan kategori: ${err.message}`, 'error');
      }
    }
  };

  const handleDeleteCategory = async (id: number) => {
    showConfirm('Hapus Kategori', 'Yakin ingin menghapus kategori produk ini?', async () => {
      if (useLocalEmulation) {
        const updated = categories.filter((c) => c.id !== id);
        safeSetLocalStorage('emulated_categories', updated);
        setCategories(updated);
        showToast('Kategori dihapus secara lokal.', 'success');
        return;
      }

      try {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
        showToast('Kategori berhasil dihapus dari cloud!', 'success');
        syncData();
      } catch (err: any) {
        showToast('Gagal menghapus kategori.', 'error');
      }
    });
  };

  const handleSaveProduct = async (productData: {
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
  }) => {
    const slug = productData.nama_produk.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (useLocalEmulation) {
      const prodId = productData.id || Math.floor(100000 + Math.random() * 900000);
      let updatedProducts = [...products];

      if (productData.id) {
        updatedProducts = products.map((p) =>
          p.id === productData.id
            ? {
                ...p,
                nama_produk: productData.nama_produk,
                kategori_id: productData.kategori_id,
                deskripsi: productData.deskripsi,
                foto: productData.foto,
                status: productData.status,
              }
            : p
        );
      } else {
        updatedProducts.push({
          id: prodId,
          nama_produk: productData.nama_produk,
          slug,
          kategori_id: productData.kategori_id,
          deskripsi: productData.deskripsi,
          foto: productData.foto,
          status: productData.status,
        });
      }

      // Filter and insert emulated variants
      let allEmulatedVars = JSON.parse(localStorage.getItem('emulated_product_variants') || '[]') as ProductVariant[];
      allEmulatedVars = allEmulatedVars.filter((v) => v.product_id !== prodId);

      const mappedVars: ProductVariant[] = productData.variants.map((v) => ({
        id: v.id || Math.floor(10000 + Math.random() * 90000),
        product_id: prodId,
        nama_varian: v.nama_varian,
        sku: 'SKU-' + prodId + '-' + Math.floor(100 + Math.random() * 900),
        harga: v.harga,
        harga_promo: v.harga_promo,
        stok: v.stok,
        berat: v.berat,
      }));

      const finalVariants = [...allEmulatedVars, ...mappedVars];

      safeSetLocalStorage('emulated_products', updatedProducts);
      safeSetLocalStorage('emulated_product_variants', finalVariants);

      setProducts(updatedProducts);
      setVariants(finalVariants);
      showToast('Produk kelontong berhasil disimpan secara lokal!', 'success');
      return;
    }

    try {
      let savedId = productData.id;
      if (productData.id) {
        const { error } = await supabase
          .from('products')
          .update({
            nama_produk: productData.nama_produk,
            kategori_id: productData.kategori_id,
            deskripsi: productData.deskripsi,
            foto: productData.foto,
            status: productData.status,
          })
          .eq('id', productData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert({
            nama_produk: productData.nama_produk,
            slug,
            kategori_id: productData.kategori_id,
            deskripsi: productData.deskripsi,
            foto: productData.foto,
            status: productData.status,
          })
          .select();
        if (error) throw error;
        if (data && data.length > 0) savedId = data[0].id;
      }

      // Re-create variants
      if (savedId) {
        await supabase.from('product_variants').delete().eq('product_id', savedId);
        for (const colVar of productData.variants) {
          await supabase.from('product_variants').insert({
            product_id: savedId,
            nama_varian: colVar.nama_varian,
            sku: 'SKU-' + savedId + '-' + Math.floor(1000 + Math.random() * 9000),
            harga: colVar.harga,
            harga_promo: colVar.harga_promo,
            stok: colVar.stok,
            berat: colVar.berat,
          });
        }
      }

      showToast('Produk kelontong berhasil disimpan ke cloud database!', 'success');
      syncData();
    } catch (err: any) {
      showToast(`Gagal menyimpan produk: ${err.message}`, 'error');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    showConfirm('Hapus Produk Kelontong', 'Apakah Anda yakin ingin menghapus produk ini beserta seluruh variasinya secara permanen?', async () => {
      if (useLocalEmulation) {
        const updatedProds = products.filter((p) => p.id !== id);
        let updatedVars = JSON.parse(localStorage.getItem('emulated_product_variants') || '[]') as ProductVariant[];
        updatedVars = updatedVars.filter((v) => v.product_id !== id);

        safeSetLocalStorage('emulated_products', updatedProds);
        safeSetLocalStorage('emulated_product_variants', updatedVars);

        setProducts(updatedProds);
        setVariants(updatedVars);
        showToast('Produk berhasil dihapus secara lokal.', 'success');
        return;
      }

      try {
        await supabase.from('product_variants').delete().eq('product_id', id);
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        showToast('Produk berhasil dihapus dari cloud!', 'success');
        syncData();
      } catch (err: any) {
        showToast('Gagal menghapus produk.', 'error');
      }
    });
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    if (useLocalEmulation) {
      const cached = JSON.parse(localStorage.getItem('emulated_orders') || '[]') as Order[];
      const updated = cached.map((o) => (o.id === orderId ? { ...o, status: status as any } : o));
      localStorage.setItem('emulated_orders', JSON.stringify(updated));
      if (currentUser) {
        setOrders(updated.filter((o) => o.user_id === currentUser.id));
      }
      showToast(`Status pesanan berhasil diubah menjadi ${status}!`, 'success');
      return;
    }

    try {
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
      if (error) throw error;
      showToast(`Status pesanan berhasil diubah menjadi ${status}!`, 'success');
      syncData();
    } catch (err: any) {
      showToast('Gagal mengubah status pesanan.', 'error');
    }
  };

  // Dipanggil otomatis lewat realtime listener saat ada baris baru di tabel `orders`.
  // Mengambil rincian item, menyusun struk ESC/POS, lalu mengirimnya ke printer
  // thermal yang dipilih admin di Pengaturan Printer (lewat QZ Tray).
  // Helper bersama: ubah baris mentah tabel order_items (dari Supabase) jadi
  // bentuk siap-tampil { nama_produk, nama_varian, qty, harga } dengan melihat
  // nama produk/varian terbaru dari state products/variants saat ini.
  const mapOrderItemRows = (rows: any[]): NonNullable<Order['items']> => {
    return (rows || []).map((item: any) => {
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
  };

  // Dipakai oleh halaman Riwayat Pesanan konsumen untuk memuat rincian produk
  // satu pesanan saat kartunya di-expand (lazy-load, tidak mengubah object
  // order yang ada di state `orders`, cukup mengembalikan array item-nya).
  const handleFetchOrderItemsForDisplay = async (orderId: number): Promise<NonNullable<Order['items']>> => {
    const existing = orders.find((o) => o.id === orderId);
    if (existing?.items && existing.items.length > 0) {
      return existing.items;
    }

    if (useLocalEmulation || isOfflineBackupActive) {
      const cachedOrders = JSON.parse(localStorage.getItem('emulated_orders') || '[]') as Order[];
      const found = cachedOrders.find((o) => o.id === orderId);
      return found?.items || [];
    }

    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (error) throw error;
    return mapOrderItemRows(data || []);
  };

  const autoPrintIncomingOrder = async (newOrderRow: Order) => {
    // Cegah cetak ganda kalau event realtime sama terkirim ulang oleh Supabase.
    if (autoPrintOrderIds.has(newOrderRow.id)) return;
    setAutoPrintOrderIds((prev) => new Set(prev).add(newOrderRow.id));

    try {
      const { data: itemRows, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', newOrderRow.id);

      if (error) throw error;

      const items = mapOrderItemRows(itemRows || []);

      const orderWithItems: Order = { ...newOrderRow, items };
      const receiptBytes = buildReceiptEscPos(orderWithItems, storeSettings);

      await printRawEscPos(storeSettings.printer_thermal_nama!, receiptBytes);
      setQzPrinterStatus('connected');
      showToast(`Struk pesanan ${newOrderRow.kode_order} otomatis tercetak!`, 'success');
    } catch (err: any) {
      setQzPrinterStatus('error');
      console.error('Auto-print gagal:', err);
      showToast(
        `Gagal mencetak otomatis struk ${newOrderRow.kode_order}. Pastikan QZ Tray berjalan & printer terhubung.`,
        'error'
      );
    }
  };

  const handleAddBanner = async (newBanner: { judul: string; gambar: string; link?: string }) => {
    const id = Math.floor(Date.now() + Math.random() * 100000);
    if (useLocalEmulation) {
      const updated = [...banners, { id, judul: newBanner.judul, gambar: newBanner.gambar, link: newBanner.link, aktif: true }];
      localStorage.setItem('emulated_banners', JSON.stringify(updated));
      setBanners(updated);
      showToast('Banner baru ditambahkan secara lokal!', 'success');
      return;
    }

    try {
      const { error } = await supabase.from('banners').insert({
        judul: newBanner.judul,
        gambar: newBanner.gambar,
        link: newBanner.link || null,
        aktif: true,
      });
      if (error) throw error;
      showToast('Banner promo ditambahkan!', 'success');
      syncData();
    } catch (err: any) {
      showToast('Gagal menyimpan banner.', 'error');
    }
  };

  const handleDeleteBanner = async (id: number) => {
    showConfirm('Hapus Banner', 'Yakin ingin menghapus spanduk banner ini?', async () => {
      if (useLocalEmulation) {
        const updated = banners.filter((b) => b.id !== id);
        localStorage.setItem('emulated_banners', JSON.stringify(updated));
        setBanners(updated);
        showToast('Banner dihapus secara lokal.', 'success');
        return;
      }

      try {
        const { error } = await supabase.from('banners').delete().eq('id', id);
        if (error) throw error;
        showToast('Banner berhasil dihapus dari cloud!', 'success');
        syncData();
      } catch (err: any) {
        showToast('Gagal menghapus banner.', 'error');
      }
    });
  };

  const handleAddPromo = async (newPromo: {
    nama_promo: string;
    tipe: 'Persen' | 'Nominal';
    nilai: number;
    tanggal_mulai: string;
    tanggal_selesai: string;
  }) => {
    const id = Math.floor(Date.now() + Math.random() * 100000);
    if (useLocalEmulation) {
      const updated = [...promos, { id, ...newPromo }];
      localStorage.setItem('emulated_promos', JSON.stringify(updated));
      setPromos(updated);
      showToast('Kupon diskon diaktifkan secara lokal!', 'success');
      return;
    }

    try {
      const { error } = await supabase.from('promos').insert(newPromo);
      if (error) throw error;
      showToast('Kampanye promo diaktifkan di cloud!', 'success');
      syncData();
    } catch (err: any) {
      showToast('Gagal menyimpan kupon.', 'error');
    }
  };

  const handleDeletePromo = async (id: number) => {
    showConfirm('Hapus Kupon Diskon', 'Hapus kampanye promosi ini?', async () => {
      if (useLocalEmulation) {
        const updated = promos.filter((p) => p.id !== id);
        localStorage.setItem('emulated_promos', JSON.stringify(updated));
        setPromos(updated);
        showToast('Promo dihapus secara lokal.', 'success');
        return;
      }

      try {
        const { error } = await supabase.from('promos').delete().eq('id', id);
        if (error) throw error;
        showToast('Promo berhasil dihapus dari cloud!', 'success');
        syncData();
      } catch (err: any) {
        showToast('Gagal menghapus promo.', 'error');
      }
    });
  };

  // --- KOIN & HADIAH (Loyalty Program) ---

  // Admin: tambah/edit hadiah yang bisa ditukar koin.
  const handleSaveReward = async (rewardData: {
    id?: number;
    nama_hadiah: string;
    deskripsi: string;
    foto: string;
    biaya_koin: number;
    stok: number;
    aktif: boolean;
  }) => {
    if (rewardData.biaya_koin < MINIMAL_KOIN_TUKAR) {
      showToast(`Biaya koin minimal ${MINIMAL_KOIN_TUKAR} koin per aturan penukaran.`, 'warning');
      return;
    }

    if (useLocalEmulation) {
      let updated: Reward[];
      if (rewardData.id) {
        updated = rewards.map((r) => (r.id === rewardData.id ? { ...r, ...rewardData } : r));
      } else {
        const newReward: Reward = {
          id: Math.floor(Date.now() + Math.random() * 100000),
          nama_hadiah: rewardData.nama_hadiah,
          deskripsi: rewardData.deskripsi,
          foto: rewardData.foto,
          biaya_koin: rewardData.biaya_koin,
          stok: rewardData.stok,
          aktif: rewardData.aktif,
          created_at: new Date().toISOString(),
        };
        updated = [...rewards, newReward];
      }
      safeSetLocalStorage('emulated_rewards', updated);
      setRewards(updated);
      showToast('Hadiah berhasil disimpan secara lokal!', 'success');
      return;
    }

    try {
      if (rewardData.id) {
        const { error } = await supabase
          .from('rewards')
          .update({
            nama_hadiah: rewardData.nama_hadiah,
            deskripsi: rewardData.deskripsi,
            foto: rewardData.foto,
            biaya_koin: rewardData.biaya_koin,
            stok: rewardData.stok,
            aktif: rewardData.aktif,
          })
          .eq('id', rewardData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rewards').insert({
          nama_hadiah: rewardData.nama_hadiah,
          deskripsi: rewardData.deskripsi,
          foto: rewardData.foto,
          biaya_koin: rewardData.biaya_koin,
          stok: rewardData.stok,
          aktif: rewardData.aktif,
        });
        if (error) throw error;
      }
      showToast('Hadiah berhasil disimpan ke cloud!', 'success');
      syncData();
    } catch (err: any) {
      showToast(`Gagal menyimpan hadiah: ${err.message}`, 'error');
    }
  };

  const handleDeleteReward = async (id: number) => {
    showConfirm('Hapus Hadiah', 'Yakin ingin menghapus hadiah ini dari katalog penukaran?', async () => {
      if (useLocalEmulation) {
        const updated = rewards.filter((r) => r.id !== id);
        safeSetLocalStorage('emulated_rewards', updated);
        setRewards(updated);
        showToast('Hadiah dihapus secara lokal.', 'success');
        return;
      }

      try {
        const { error } = await supabase.from('rewards').delete().eq('id', id);
        if (error) throw error;
        showToast('Hadiah berhasil dihapus dari cloud!', 'success');
        syncData();
      } catch (err: any) {
        showToast('Gagal menghapus hadiah.', 'error');
      }
    });
  };

  // Admin: lihat & ubah status penukaran (Menunggu -> Diproses -> Terkirim).
  const loadRedemptions = async () => {
    if (!currentUser) return;
    if (useLocalEmulation) {
      const cached = JSON.parse(localStorage.getItem('emulated_redemptions') || '[]') as RewardRedemption[];
      if (currentUser.role === 'admin') setRedemptions(cached);
      else setRedemptions(cached.filter((r) => r.user_id === currentUser.id));
      return;
    }

    try {
      let query = supabase.from('reward_redemptions').select('*').order('id', { ascending: false });
      if (currentUser.role !== 'admin') {
        query = query.eq('user_id', currentUser.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (data) setRedemptions(data as any);
    } catch (err) {
      console.error('Gagal memuat riwayat penukaran:', err);
    }
  };

  const handleUpdateRedemptionStatus = async (redemptionId: number, status: RewardRedemption['status']) => {
    if (useLocalEmulation) {
      const cached = JSON.parse(localStorage.getItem('emulated_redemptions') || '[]') as RewardRedemption[];
      const updated = cached.map((r) => (r.id === redemptionId ? { ...r, status } : r));
      localStorage.setItem('emulated_redemptions', JSON.stringify(updated));
      setRedemptions(updated);
      showToast(`Status penukaran diubah menjadi ${status}.`, 'success');
      return;
    }

    try {
      const { error } = await supabase.from('reward_redemptions').update({ status }).eq('id', redemptionId);
      if (error) throw error;
      showToast(`Status penukaran diubah menjadi ${status}.`, 'success');
      loadRedemptions();
    } catch (err: any) {
      showToast('Gagal mengubah status penukaran.', 'error');
    }
  };

  // Pelanggan: tukar koin jadi hadiah. Ini titik PALING PENTING untuk dijaga
  // konsistensinya -- validasi saldo koin & minimal MINIMAL_KOIN_TUKAR koin
  // dilakukan di sini (bukan cuma di UI), supaya tidak bisa "dicurangi" lewat
  // manipulasi state di browser. Untuk keamanan tambahan jangka panjang,
  // idealnya ini pindah ke database function/RPC -- untuk sekarang divalidasi
  // di kode klien dengan saldo TERBARU yang diambil ulang dari server sebelum
  // memotong koin.
  // dengan saldo TERBARU yang diambil ulang dari server sebelum memotong koin.
  const handleRedeemReward = async (reward: Reward) => {
    if (!currentUser) {
      showToast('Silakan masuk akun terlebih dahulu untuk menukar koin.', 'warning');
      return;
    }

    if (reward.biaya_koin < MINIMAL_KOIN_TUKAR) {
      showToast(`Hadiah ini tidak memenuhi syarat minimal ${MINIMAL_KOIN_TUKAR} koin.`, 'error');
      return;
    }

    if (useLocalEmulation) {
      const saldoSekarang = currentUser.koin || 0;
      if (saldoSekarang < reward.biaya_koin) {
        showToast(`Koin tidak cukup. Saldo Anda ${saldoSekarang}, dibutuhkan ${reward.biaya_koin}.`, 'warning');
        return;
      }
      if (reward.stok <= 0) {
        showToast('Stok hadiah ini sudah habis.', 'warning');
        return;
      }

      const updatedUser = { ...currentUser, koin: saldoSekarang - reward.biaya_koin };
      setCurrentUser(updatedUser);
      localStorage.setItem('asyifa_user', JSON.stringify(updatedUser));

      const updatedRewards = rewards.map((r) => (r.id === reward.id ? { ...r, stok: r.stok - 1 } : r));
      safeSetLocalStorage('emulated_rewards', updatedRewards);
      setRewards(updatedRewards);

      const newRedemption: RewardRedemption = {
        id: Math.floor(Date.now() + Math.random() * 100000),
        user_id: currentUser.id,
        reward_id: reward.id,
        nama_hadiah: reward.nama_hadiah,
        koin_terpakai: reward.biaya_koin,
        status: 'Menunggu',
        created_at: new Date().toISOString(),
      };
      const cached = JSON.parse(localStorage.getItem('emulated_redemptions') || '[]') as RewardRedemption[];
      const updatedRedemptions = [newRedemption, ...cached];
      localStorage.setItem('emulated_redemptions', JSON.stringify(updatedRedemptions));
      setRedemptions(updatedRedemptions.filter((r) => r.user_id === currentUser.id));

      showToast(`Berhasil menukar ${reward.biaya_koin} koin untuk ${reward.nama_hadiah}!`, 'success');
      return;
    }

    try {
      // Ambil ulang saldo koin & stok TERBARU langsung dari server (bukan dari
      // state lokal yang mungkin sudah usang) sebelum memutuskan boleh tukar
      // atau tidak -- mencegah penukaran ganda dari banyak tab/perangkat.
      const { data: freshUser, error: userErr } = await supabase
        .from('users')
        .select('koin')
        .eq('id', currentUser.id)
        .single();
      if (userErr) throw userErr;

      const saldoSekarang = freshUser?.koin || 0;
      if (saldoSekarang < reward.biaya_koin) {
        showToast(`Koin tidak cukup. Saldo Anda ${saldoSekarang}, dibutuhkan ${reward.biaya_koin}.`, 'warning');
        return;
      }

      const { data: freshReward, error: rewardErr } = await supabase
        .from('rewards')
        .select('stok, aktif')
        .eq('id', reward.id)
        .single();
      if (rewardErr) throw rewardErr;

      if (!freshReward?.aktif || (freshReward?.stok ?? 0) <= 0) {
        showToast('Hadiah ini sudah tidak tersedia.', 'warning');
        syncData();
        return;
      }

      const newKoinTotal = saldoSekarang - reward.biaya_koin;
      const { error: koinError } = await supabase
        .from('users')
        .update({ koin: newKoinTotal })
        .eq('id', currentUser.id);
      if (koinError) throw koinError;

      await supabase
        .from('rewards')
        .update({ stok: freshReward.stok - 1 })
        .eq('id', reward.id);

      const { error: redemptionError } = await supabase.from('reward_redemptions').insert({
        user_id: currentUser.id,
        reward_id: reward.id,
        nama_hadiah: reward.nama_hadiah,
        koin_terpakai: reward.biaya_koin,
        status: 'Menunggu',
      });
      if (redemptionError) throw redemptionError;

      const updatedUser = { ...currentUser, koin: newKoinTotal };
      setCurrentUser(updatedUser);
      localStorage.setItem('asyifa_user', JSON.stringify(updatedUser));

      showToast(`Berhasil menukar ${reward.biaya_koin} koin untuk ${reward.nama_hadiah}!`, 'success');
      syncData();
      loadRedemptions();
    } catch (err: any) {
      console.error('Gagal menukar koin:', err);
      showToast(`Gagal menukar koin: ${err.message}`, 'error');
    }
  };

  const handleDownloadServiceWorker = () => {
    const content = `const CACHE_NAME = 'asyifa-mart-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('supabase.co')) return;
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});`;

    const blob = new Blob([content], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sw.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('File sw.js berhasil diunduh! Letakkan di folder root web Anda.', 'success');
  };

  const handleToggleDbModeChange = (emulate: boolean) => {
    showToast('Fitur emulasi luring dinonaktifkan. Selalu menggunakan Cloud Live Database.', 'info');
  };

  const getCategoryName = (catId: number) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.nama_kategori : 'Umum';
  };

  const filteredCatalog = products.filter((p) => {
    const matchesSearch = p.nama_produk.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategoryFilter === 'semua' || p.kategori_id === activeCategoryFilter;
    return matchesSearch && matchesCategory && p.status === 'aktif';
  });

  if (activeSortFilter === 'termurah') {
    filteredCatalog.sort((a, b) => {
      const getMinPrice = (prodId: number) => {
        const prodVars = variants.filter((v) => {
          const vpId = getVariantProductId(v);
          return vpId !== null && vpId !== undefined && String(vpId) === String(prodId);
        });
        return prodVars.reduce((min, v) => {
          const val = v.harga_promo > 0 ? v.harga_promo : v.harga;
          return val < min ? val : min;
        }, Infinity);
      };
      return getMinPrice(a.id) - getMinPrice(b.id);
    });
  } else if (activeSortFilter === 'termahal') {
    filteredCatalog.sort((a, b) => {
      const getMinPrice = (prodId: number) => {
        const prodVars = variants.filter((v) => {
          const vpId = getVariantProductId(v);
          return vpId !== null && vpId !== undefined && String(vpId) === String(prodId);
        });
        return prodVars.reduce((min, v) => {
          const val = v.harga_promo > 0 ? v.harga_promo : v.harga;
          return val < min ? val : min;
        }, Infinity);
      };
      return getMinPrice(b.id) - getMinPrice(a.id);
    });
  } else {
    filteredCatalog.sort((a, b) => b.id - a.id);
  }

  // Active product details
  const activeDetailedProduct = products.find((p) => {
    const pId = getProductId(p);
    return pId !== null && pId !== undefined && String(pId) === String(activeDetailProductId);
  });
  const activeDetailedProductVariants = activeDetailedProduct
    ? variants.filter((v) => isVariantOfProduct(v, activeDetailedProduct))
    : [];

  return (
    <div className="bg-slate-50 text-slate-800 font-sans antialiased min-h-screen pb-20 md:pb-6">
      {/* ONLINE/OFFLINE DETECTOR BAR */}
      {!isOnline && (
        <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:right-6 md:left-auto bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl flex items-center justify-between gap-4 shadow-2xl border border-white/10 z-[99] max-w-sm">
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500/10 text-amber-500 p-1.5 rounded-xl">
              <WifiOff className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h5 className="text-xs font-black">Koneksi Internet Terputus</h5>
              <p className="text-[10px] text-slate-300 leading-tight">Silakan periksa kembali jaringan internet Anda.</p>
            </div>
          </div>
          <button type="button" onClick={() => setIsOnline(true)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER NAVBAR */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={handleBrandClick}>
            <div className="bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 text-white p-2.5 rounded-xl flex items-center justify-center shadow-md shadow-red-500/30 hover:scale-105 transition duration-150">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-none flex items-center gap-1">
                ASYIFA <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent font-black">MART</span>
              </h1>
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full inline-block animate-pulse ${
                    isOfflineBackupActive ? 'bg-indigo-500' : isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></span>
                <span>
                  {isOfflineBackupActive
                    ? `Mode Luring (Backup: ${lastBackupTime || 'Aktif'})`
                    : 'Belanja Mudah dan Hemat'}
                </span>
              </span>
            </div>
          </div>

          {/* Search Bar Desktop */}
          {currentPage === 'home' && (
            <div className="hidden md:flex flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="Cari beras, minyak, bumbu dapur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm focus:bg-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          )}

          {/* Icons */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => navigate('wishlist')}
              className="p-2 text-slate-600 hover:text-red-500 hover:bg-rose-50 rounded-full transition relative"
            >
              <Heart className="w-5 h-5" />
              {wishlist.length > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('cart')}
              className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition relative"
            >
              <ShoppingBasket className="w-5 h-5" />
              {cart.reduce((acc, c) => acc + c.qty, 0) > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cart.reduce((acc, c) => acc + c.qty, 0)}
                </span>
              )}
            </button>

            {/* Account Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1.5 p-1 hover:bg-slate-100 rounded-full md:rounded-lg transition"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-200">
                  <span>{currentUser ? currentUser.nama.charAt(0).toUpperCase() : 'U'}</span>
                </div>
                <span className="hidden md:inline text-xs font-semibold text-slate-700 max-w-[80px] truncate">
                  {currentUser ? currentUser.nama : 'Akun'}
                </span>
                <ChevronDown className="hidden md:inline w-3.5 h-3.5 text-slate-500" />
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-52 bg-white border border-slate-100 rounded-2xl shadow-xl py-1.5 z-40"
                  >
                    <button
                      type="button"
                      onClick={() => navigate('profile')}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" /> Profil Saya
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('orders')}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Receipt className="w-4 h-4 text-slate-400" /> Riwayat Pesanan
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('rewards')}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Coins className="w-4 h-4 text-amber-500" /> Koin & Hadiah
                      {currentUser && (currentUser.koin || 0) > 0 && (
                        <span className="ml-auto bg-amber-100 text-amber-700 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                          {currentUser.koin}
                        </span>
                      )}
                    </button>
                    {currentUser?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => navigate('admin')}
                        className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50"
                      >
                        <ShieldAlert className="w-4 h-4 animate-pulse" /> Panel Admin
                      </button>
                    )}
                    {deferredPrompt && (
                      <button
                        type="button"
                        onClick={() => {
                          handleInstallApp();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                      >
                        <Download className="w-4 h-4 text-indigo-500" /> Install Aplikasi
                      </button>
                    )}
                    <div className="border-t border-slate-100 my-1"></div>
                    {currentUser ? (
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4" /> Keluar Akun
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('profile')}
                        className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50"
                      >
                        <LogIn className="w-4 h-4" /> Masuk / Daftar
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE SEARCH BAR */}
      {currentPage === 'home' && (
        <div className="p-3 md:hidden bg-white border-b border-slate-100 sticky top-16 z-20">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari beras, minyak, bumbu dapur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm focus:bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto p-4 min-h-[calc(100vh-12rem)]">
        <AnimatePresence mode="wait">
          {/* PAGE: HOME */}
          {currentPage === 'home' && (
            <motion.section
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Promo Banners */}
              {banners.length > 0 && (
                <div
                  onClick={() => {
                    if (banners[0].link) {
                      const linkedProductId = parseInt(banners[0].link, 10);
                      const productExists = products.some((p) => getProductId(p) === linkedProductId);
                      if (productExists) {
                        setActiveDetailProductId(linkedProductId);
                        navigate('detail');
                      } else {
                        showToast('Produk pada banner ini sudah tidak tersedia.', 'warning');
                      }
                    }
                  }}
                  className={`relative bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-3xl overflow-hidden shadow-xl min-h-[160px] md:min-h-[280px] ${
                    banners[0].link ? 'cursor-pointer active:scale-[0.99] transition' : ''
                  }`}
                >
                  <div className="absolute inset-0 flex bg-cover bg-center" style={{ backgroundImage: `url(${banners[0].gambar})` }}>
                    <div className="absolute inset-0 bg-black/40 flex items-end p-6 md:p-12 text-white">
                      <div>
                        <span className="bg-red-500 text-white font-extrabold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md mb-2 inline-block">
                          Promo Spesial
                        </span>
                        <h4 className="text-sm md:text-2xl font-black leading-tight tracking-tight max-w-lg">
                          {banners[0].judul}
                        </h4>
                        <p className="text-[10px] md:text-sm text-slate-200 mt-1">
                          {banners[0].link ? 'Ketuk untuk lihat produk promo ini' : 'Layanan cepat pesan langsung via kurir WhatsApp harian.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Kategori Grid */}
              <div>
                <h2 className="text-sm md:text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5 mb-3">
                  <LayoutGrid className="w-4 h-4 text-emerald-600" /> Kategori Belanja
                </h2>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setActiveCategoryFilter(cat.id);
                        window.scrollTo({ top: 400, behavior: 'smooth' });
                      }}
                      className={`bg-white border rounded-xl p-2.5 flex flex-col items-center justify-center text-center cursor-pointer transition duration-150 ${
                        activeCategoryFilter === cat.id
                          ? 'border-emerald-500 bg-emerald-50/30 shadow-md shadow-emerald-500/5'
                          : 'border-slate-100 hover:border-emerald-500'
                      }`}
                    >
                      <span className="text-base md:text-xl mb-1">{cat.icon || '📦'}</span>
                      <span className="text-[9px] font-bold text-slate-700 truncate w-full tracking-tight">
                        {cat.nama_kategori}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Catalog Section */}
              <div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-base md:text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-emerald-600" /> Katalog Sembako & Bahan Makanan
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Menyediakan kebutuhan harian keluarga segar langsung diantar kurir.
                    </p>
                  </div>

                  {/* Filters & Sorting */}
                  <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                    <select
                      value={activeSortFilter}
                      onChange={(e) => setActiveSortFilter(e.target.value as any)}
                      className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:ring-1 focus:ring-emerald-500 font-bold text-slate-600"
                    >
                      <option value="terbaru">Terbaru</option>
                      <option value="termurah">Harga: Terendah</option>
                      <option value="termahal">Harga: Tertinggi</option>
                    </select>

                    <select
                      value={activeCategoryFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveCategoryFilter(val === 'semua' ? 'semua' : parseInt(val));
                      }}
                      className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:ring-1 focus:ring-emerald-500 font-bold text-slate-600"
                    >
                      <option value="semua">Semua Kategori</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nama_kategori}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Product Grid */}
                {filteredCatalog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <PackageSearch className="w-16 h-16 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-bold">Produk Tidak Ditemukan</p>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">
                      Silakan coba ganti kategori atau cari nama sembako lainnya.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {filteredCatalog.map((prod) => (
                      <ProductCard
                        key={prod.id}
                        product={prod}
                        categoryName={getCategoryName(prod.kategori_id)}
                        variants={variants.filter((v) => isVariantOfProduct(v, prod))}
                        isFavorited={wishlist.some((w) => {
                          const pId = getProductId(prod);
                          return w && w.product_id && pId && String(w.product_id) === String(pId);
                        })}
                        onToggleWishlist={handleToggleWishlist}
                        onOpenDetail={(id) => {
                          setActiveDetailProductId(id);
                          navigate('detail');
                        }}
                        onQuickAdd={(e, varId) => {
                          const prodVars = variants.filter((v) => isVariantOfProduct(v, prod));
                          if (prodVars.length > 1) {
                            setSelectedVariantIdForPicker(prodVars[0].id);
                            setVariantSelectorData({ isOpen: true, product: prod, action: 'cart' });
                          } else {
                            handleAddToCart(varId);
                          }
                        }}
                        onBuyNow={(e, varId) => {
                          const prodVars = variants.filter((v) => isVariantOfProduct(v, prod));
                          if (prodVars.length > 1) {
                            setSelectedVariantIdForPicker(prodVars[0].id);
                            setVariantSelectorData({ isOpen: true, product: prod, action: 'buy' });
                          } else {
                            handleAddToCart(varId);
                            navigate('cart');
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* PAGE: DETAIL */}
          {currentPage === 'detail' && activeDetailedProduct && (
            <motion.section
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ProductDetailPage
                product={activeDetailedProduct}
                categoryName={getCategoryName(activeDetailedProduct.kategori_id)}
                variants={activeDetailedProductVariants}
                onBack={() => navigate('home')}
                onAddToCart={(vId) => handleAddToCart(vId)}
                onBuyNow={(vId) => {
                  handleAddToCart(vId);
                  navigate('cart');
                }}
              />
            </motion.section>
          )}

          {/* PAGE: WISHLIST */}
          {currentPage === 'wishlist' && (
            <motion.section
              key="wishlist"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <WishlistPage
                wishlist={wishlist}
                products={products}
                variants={variants}
                onRemoveFavorite={handleToggleWishlist}
                onOpenDetail={(id) => {
                  setActiveDetailProductId(id);
                  navigate('detail');
                }}
                onBackToHome={() => navigate('home')}
              />
            </motion.section>
          )}

          {/* PAGE: REWARDS (Koin & Hadiah) */}
          {currentPage === 'rewards' && (
            <motion.section
              key="rewards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <RewardsPage
                currentUser={currentUser}
                rewards={rewards}
                redemptions={redemptions}
                onRedeem={handleRedeemReward}
                onBackToHome={() => navigate('home')}
              />
            </motion.section>
          )}

          {/* PAGE: CART */}
          {currentPage === 'cart' && (
            <motion.section
              key="cart"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CartPage
                cart={cart}
                products={products}
                variants={variants}
                storeSettings={storeSettings}
                currentUser={currentUser}
                onUpdateQty={handleUpdateQty}
                onRemoveItem={handleRemoveItem}
                onCheckout={handleCheckoutSubmit}
                onNavigateToHome={() => navigate('home')}
                showToast={showToast}
              />
            </motion.section>
          )}

          {/* PAGE: ORDERS */}
          {currentPage === 'orders' && (
            <motion.section
              key="orders"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <OrderHistory
                orders={orders}
                onFetchOrderItems={handleFetchOrderItemsForDisplay}
                onPrintReceipt={async (orderId) => {
                  const order = orders.find((o) => o.id === orderId);
                  if (!order) return;

                  // Load order items if they don't exist yet
                  if (!order.items || order.items.length === 0) {
                    if (useLocalEmulation) {
                      const emulatedOrders = JSON.parse(localStorage.getItem('emulated_orders') || '[]') as Order[];
                      const found = emulatedOrders.find(o => o.id === order.id);
                      order.items = found && found.items ? found.items : [];
                    } else {
                      try {
                        showToast('Memuat data rincian pesanan...', 'info');
                        const { data, error } = await supabase
                          .from('order_items')
                          .select('*')
                          .eq('order_id', order.id);

                        if (!error && data) {
                          order.items = data.map((item) => {
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
                        } else {
                          showToast('Gagal memuat rincian pesanan dari cloud.', 'error');
                        }
                      } catch (err) {
                        console.error('Error loading print items:', err);
                        showToast('Gagal menyambung ke database.', 'error');
                      }
                    }
                  }

                  setSelectedOrderForPrint(order);

                  // Trigger system print
                  setTimeout(() => {
                    window.print();
                    showToast('Berhasil membuka layar cetak struk!', 'success');
                  }, 300);
                }}
                notificationPermission={notificationPermission}
                onRequestNotificationPermission={requestNotificationPermission}
              />
            </motion.section>
          )}

          {/* PAGE: PROFILE */}
          {currentPage === 'profile' && (
            <motion.section
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ProfilePage
                currentUser={currentUser}
                onLogin={handleLogin}
                onRegister={handleRegister}
                onLogout={handleLogout}
                showToast={showToast}
              />
            </motion.section>
          )}

          {/* PAGE: ADMIN PANEL */}
          {currentPage === 'admin' && (
            <motion.section
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AdminPanel
                products={products}
                categories={categories}
                orders={orders}
                banners={banners}
                promos={promos}
                rewards={rewards}
                redemptions={redemptions}
                storeSettings={storeSettings}
                variants={variants}
                useLocalEmulation={useLocalEmulation}
                onToggleDatabaseMode={handleToggleDbModeChange}
                onNavigateToHome={() => navigate('home')}
                onSaveStoreSettings={handleSaveStoreSettings}
                onSaveCategory={handleSaveCategory}
                onDeleteCategory={handleDeleteCategory}
                onSaveProduct={handleSaveProduct}
                onDeleteProduct={handleDeleteProduct}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                onAddBanner={handleAddBanner}
                onDeleteBanner={handleDeleteBanner}
                onAddPromo={handleAddPromo}
                onDeletePromo={handleDeletePromo}
                onSaveReward={handleSaveReward}
                onDeleteReward={handleDeleteReward}
                onUpdateRedemptionStatus={handleUpdateRedemptionStatus}
                onDownloadServiceWorker={handleDownloadServiceWorker}
                showToast={showToast}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* PRINT AREA COMPONENT (RECEIPT ZONE) */}
      {currentPage === 'orders' && selectedOrderForPrint && (
        <div
          id="print-area"
          className="hidden print:block font-mono text-black mx-auto p-4 bg-white"
          style={{ width: storeSettings.struk_lebar || '58mm', fontSize: '11px', lineHeight: '1.4' }}
        >
          <div className="text-center space-y-1 pb-3 mb-3 border-b border-dashed border-black">
            <h2 className="text-sm font-black tracking-wide uppercase">{storeSettings.nama_toko}</h2>
            {storeSettings.struk_show_alamat !== false && <p className="text-[9px]">{storeSettings.alamat}</p>}
            {storeSettings.struk_show_kontak !== false && <p className="text-[9px]">WA: {storeSettings.whatsapp}</p>}
          </div>

          <div className="text-center text-[10px] italic font-semibold mb-3 border-b border-dashed border-black pb-2">
            {storeSettings.struk_header || 'ASYIFA MART - BELANJA SEMBAKO HEMAT'}
          </div>

          <div className="space-y-1 pb-2 mb-2 border-b border-dashed border-black text-[9px]">
            <p>Kode: {selectedOrderForPrint.kode_order}</p>
            <p>Pelanggan: {selectedOrderForPrint.nama_pembeli}</p>
            {storeSettings.struk_show_waktu !== false && (
              <p>Waktu: {new Date(selectedOrderForPrint.created_at || new Date()).toLocaleString('id-ID')}</p>
            )}
          </div>

          <div className="space-y-2 pb-2 mb-2 border-b border-dashed border-black">
            {selectedOrderForPrint.items?.map((item, idx) => (
              <div key={idx} className="text-[9px] space-y-0.5">
                <p className="font-extrabold">{item.nama_produk} ({item.nama_varian})</p>
                <div className="flex justify-between font-mono">
                  <span>{item.qty} x Rp {new Intl.NumberFormat('id-ID').format(item.harga)}</span>
                  <span>Rp {new Intl.NumberFormat('id-ID').format(item.qty * item.harga)}</span>
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
                    <span>Rp {new Intl.NumberFormat('id-ID').format(subtotal)}</span>
                  </div>
                  {ongkir > 0 && (
                    <div className="flex justify-between">
                      <span>Ongkos Kirim</span>
                      <span>Rp {new Intl.NumberFormat('id-ID').format(ongkir)}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="flex justify-between font-black text-xs pb-3 border-b border-dashed border-black mb-3">
            <span>TOTAL</span>
            <span>Rp {new Intl.NumberFormat('id-ID').format(selectedOrderForPrint.total)}</span>
          </div>

          <div className="text-center text-[9px] whitespace-pre-line leading-relaxed">
            {storeSettings.struk_footer || "Terima Kasih Atas Kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan."}
          </div>
        </div>
      )}

      {/* BOTTOM MOBILE NAVIGATION BAR */}
      <nav className="md:hidden bg-white border-t border-slate-100 fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around px-4 z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
        <button
          type="button"
          onClick={() => navigate('home')}
          className={`flex flex-col items-center gap-1 ${
            currentPage === 'home' ? 'text-emerald-500' : 'text-slate-400'
          }`}
        >
          <Store className="w-5 h-5" />
          <span className="text-[9px] font-bold">Belanja</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('wishlist')}
          className={`flex flex-col items-center gap-1 ${
            currentPage === 'wishlist' ? 'text-emerald-500' : 'text-slate-400'
          }`}
        >
          <Heart className="w-5 h-5" />
          <span className="text-[9px] font-bold">Favorit</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('cart')}
          className={`flex flex-col items-center gap-1 relative ${
            currentPage === 'cart' ? 'text-emerald-500' : 'text-slate-400'
          }`}
        >
          <ShoppingBasket className="w-5 h-5" />
          <span className="text-[9px] font-bold">Keranjang</span>
          {cart.reduce((acc, c) => acc + c.qty, 0) > 0 && (
            <span className="absolute -top-1.5 right-2.5 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {cart.reduce((acc, c) => acc + c.qty, 0)}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('orders')}
          className={`flex flex-col items-center gap-1 ${
            currentPage === 'orders' ? 'text-emerald-500' : 'text-slate-400'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[9px] font-bold">Transaksi</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('profile')}
          className={`flex flex-col items-center gap-1 ${
            currentPage === 'profile' ? 'text-emerald-500' : 'text-slate-400'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[9px] font-bold">Profil</span>
        </button>
      </nav>

      {/* CONFIRMATION POPUP */}
      <AnimatePresence>
        {confirmPopup.isOpen && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl border border-slate-100"
            >
              <div className="flex items-center gap-2 text-red-500">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
                <h4 className="font-extrabold text-slate-800 text-base">{confirmPopup.title}</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{confirmPopup.message}</p>
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmPopup((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmPopup.onConfirm();
                    setConfirmPopup((prev) => ({ ...prev, isOpen: false }));
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition"
                >
                  Ya, Lanjutkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QUICK VARIANT PICKER MODAL */}
      <AnimatePresence>
        {variantSelectorData.isOpen && variantSelectorData.product && (
          <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl border border-slate-100 overflow-hidden relative"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setVariantSelectorData({ isOpen: false, product: null, action: 'cart' })}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title */}
              <div className="pr-8">
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Pilih Varian
                </span>
                <h4 className="font-extrabold text-slate-800 text-lg mt-2 line-clamp-1">
                  {variantSelectorData.product.nama_produk}
                </h4>
              </div>

              {/* Product Thumbnail & Quick Info */}
              <div className="flex gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                {variantSelectorData.product.foto ? (
                  <img
                    src={variantSelectorData.product.foto}
                    alt={variantSelectorData.product.nama_produk}
                    className="w-16 h-16 object-cover rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-200 rounded-xl flex items-center justify-center">
                    <Package className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                <div className="flex flex-col justify-center">
                  {/* Selected Variant Price */}
                  {(() => {
                    const selVar = variants.find((v) => v.id === selectedVariantIdForPicker);
                    if (!selVar) return null;
                    const hasPromo = selVar.harga_promo > 0;
                    return (
                      <div className="space-y-0.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-black text-rose-600">
                            Rp {new Intl.NumberFormat('id-ID').format(hasPromo ? selVar.harga_promo : selVar.harga)}
                          </span>
                          {hasPromo && (
                            <span className="text-[10px] text-slate-400 line-through">
                              Rp {new Intl.NumberFormat('id-ID').format(selVar.harga)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold">
                          <span>Stok:</span>
                          <span className={selVar.stok > 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                            {selVar.stok > 0 ? `${selVar.stok} pcs` : 'Habis'}
                          </span>
                          <span>• Berat: {selVar.berat}g</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Variant Selector List */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Silakan Pilih Varian / Ukuran:
                </label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {variants
                    .filter((v) => isVariantOfProduct(v, variantSelectorData.product!))
                    .map((v) => {
                      const isSelected = selectedVariantIdForPicker === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantIdForPicker(v.id)}
                          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-start gap-0.5 border text-left ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="font-extrabold">{v.nama_varian}</span>
                          <span className="text-[9px] opacity-80">
                            Rp {new Intl.NumberFormat('id-ID').format(v.harga_promo > 0 ? v.harga_promo : v.harga)}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVariantSelectorData({ isOpen: false, product: null, action: 'cart' })}
                  className="flex-1 py-3 text-xs font-black text-slate-500 hover:bg-slate-50 rounded-xl transition border border-slate-200"
                >
                  Batal
                </button>
                {variantSelectorData.action === 'cart' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedVariantIdForPicker) {
                        handleAddToCart(selectedVariantIdForPicker);
                        setVariantSelectorData({ isOpen: false, product: null, action: 'cart' });
                      }
                    }}
                    className="flex-1 py-3 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/15"
                  >
                    <ShoppingBasket className="w-4 h-4" />
                    <span>Masukkan Keranjang</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedVariantIdForPicker) {
                        handleAddToCart(selectedVariantIdForPicker);
                        setVariantSelectorData({ isOpen: false, product: null, action: 'cart' });
                        navigate('cart');
                      }
                    }}
                    className="flex-1 py-3 text-xs font-black text-white bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 hover:scale-[1.01] active:scale-[0.98] rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-red-500/15"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Beli Sekarang</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING PWA INSTALL BANNER */}
      <AnimatePresence>
        {showInstallBanner && deferredPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 max-w-md bg-white rounded-3xl p-4.5 shadow-2xl border border-slate-100 z-50 flex flex-col gap-3.5"
          >
            <div className="flex gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100/50">
                <Smartphone className="w-5 h-5 text-emerald-600 animate-bounce" />
              </div>
              <div className="flex-1">
                <h5 className="font-extrabold text-slate-800 text-sm">Install Aplikasi ASYIFA MART</h5>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                  Belanja lebih cepat, hemat kuota, dan langsung dari layar utama hp/laptop Anda tanpa ribet buka browser.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallBanner(false)}
                className="text-slate-400 hover:text-slate-600 transition shrink-0 self-start p-1 hover:bg-slate-50 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 justify-end text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowInstallBanner(false)}
                className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-xl transition"
              >
                Nanti Saja
              </button>
              <button
                type="button"
                onClick={handleInstallApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/10"
              >
                <Download className="w-4 h-4" />
                <span>Install Sekarang</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOASTS RENDER CONTAINER */}
      <div className="fixed top-20 right-4 z-[999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold text-white border-white/10 ${
                t.type === 'success'
                  ? 'bg-emerald-600'
                  : t.type === 'error'
                    ? 'bg-red-600'
                    : t.type === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
              }`}
            >
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
