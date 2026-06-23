// sw.js
// Service Worker - محطتي 2026
// استراتيجية: Cache First مع تحديث في الخلفية

const CACHE_VERSION = 'v2';
const CACHE_NAME = `mahataty-${CACHE_VERSION}`;

// الملفات الأساسية للتطبيق (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/data.js',
  '/landmarks.js',
  '/config.js',
  '/router.js',
  '/app.js',
  '/manifest.json'
];

// ═══════════════════════════════════════════════════════════
// تثبيت: تخزين الملفات الأساسية في الكاش
// ═══════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // تفعيل النسخة الجديدة فوراً دون انتظار إغلاق التبويبات
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Failed to cache assets:', err);
      })
  );
});

// ═══════════════════════════════════════════════════════════
// تفعيل: حذف الكاش القديم والسيطرة على العملاء
// ═══════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // السيطرة على جميع التبويبات المفتوحة فوراً
        return self.clients.claim();
      })
  );
});

// ═══════════════════════════════════════════════════════════
// جلب: استراتيجية Stale-While-Revalidate للملفات الثابتة
// و Network-First للبيانات الديناميكية
// ═══════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل الطلبات غير HTTP/HTTPS (مثل chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // تجاهل طلبات Google Fonts (لتجنب مشاكل CORS)
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com')) {
    return;
  }

  // تجاهل طلبات POST/PUT/DELETE (لا نكاشها)
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // إذا وجدنا في الكاش، نرجعه فوراً
        if (cachedResponse) {
          // في الخلفية، نحاول تحديث الكاش من الشبكة
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(() => {
              // فشل الجلب من الشبكة - لا مشكلة، الكاش موجود
            });

          return cachedResponse;
        }

        // غير موجود في الكاش، نجلب من الشبكة
        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // نخزن في الكاش للمرات القادمة
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });

            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', error);
            // إذا كان طلب صفحة ولا يوجد كاش، نرجع صفحة offline
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            throw error;
          });
      })
  );
});

// ═══════════════════════════════════════════════════════════
// رسائل من الصفحة الرئيسية
// ═══════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});