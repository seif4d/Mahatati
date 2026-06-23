// js/app.js
import { resolveStation, findShortestPath, calculateFare, normalizeArabic, getLineColorClass, getLineDisplayName, getLineOfTransition, analyzePathSegments } from './router.js';
import { metroGraph } from './data.js';
import { landmarks } from './landmarks.js';
import { CONFIG } from './config.js';

// ==========================================================================
// 1. عناصر DOM
// ==========================================================================
const startInput = document.getElementById('start-input');
const endInput = document.getElementById('end-input');
const startSuggestions = document.getElementById('start-suggestions');
const endSuggestions = document.getElementById('end-suggestions');
const calculateBtn = document.getElementById('calculate-btn');
const swapBtn = document.getElementById('swap-btn');
const placeholderText = document.getElementById('placeholder-text');
const resultsContent = document.getElementById('results-content');
const routeTimelineList = document.getElementById('route-timeline-list');

const ticketCard = document.getElementById('ticket-card');
const ticketStart = document.getElementById('ticket-start');
const ticketEnd = document.getElementById('ticket-end');
const ticketPrice = document.getElementById('ticket-price');
const statTime = document.getElementById('stat-time');
const statMetro = document.getElementById('stat-metro');
const statLrt = document.getElementById('stat-lrt');
const statMonorail = document.getElementById('stat-monorail');
const resultsPane = document.getElementById('results-pane');

const navHome = document.getElementById('nav-home');
const navAbout = document.getElementById('nav-about');
const paneSearch = document.getElementById('pane-search');
const closeResultsBtn = document.getElementById('close-results-btn');

// Install PWA Elements
const installBanner = document.getElementById('install-banner');
const installBtn = document.getElementById('install-btn');
const installDismiss = document.getElementById('install-dismiss');
const iosInstallModal = document.getElementById('ios-install-modal');
const closeIosBtn = document.getElementById('close-ios-btn');
const appShell = document.getElementById('app-shell');

// ==========================================================================
// 2. PWA Install Logic
// ==========================================================================
let deferredPrompt = null;
let installBannerDismissed = false;

// Check if app is already installed (standalone mode)
function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         localStorage.getItem('mahataty_installed') === 'true';
}

// Check if user dismissed the banner
function wasBannerDismissed() {
  return localStorage.getItem('mahataty_install_dismissed') === 'true';
}

// Show install banner
function showInstallBanner() {
  if (installBanner && !isAppInstalled() && !wasBannerDismissed() && !installBannerDismissed) {
    installBanner.classList.add('show');
    if (appShell) appShell.classList.add('banner-visible');
    if (paneSearch) paneSearch.classList.add('banner-visible');
  }
}

// Hide install banner
function hideInstallBanner() {
  if (installBanner) installBanner.classList.remove('show');
  if (appShell) appShell.classList.remove('banner-visible');
  if (paneSearch) paneSearch.classList.remove('banner-visible');
}

// Handle beforeinstallprompt event (Chrome, Edge, Samsung Internet)
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Save the event for later use
  deferredPrompt = e;
  // Show our custom install banner
  showInstallBanner();
});

// Handle install button click
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    triggerHapticFeedback();

    // Check if it's iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
      // Show iOS install instructions modal
      if (iosInstallModal) iosInstallModal.classList.add('show');
      hideInstallBanner();
      return;
    }

    // For Android/Chrome - use deferred prompt
    if (deferredPrompt) {
      try {
        const result = await deferredPrompt.prompt();
        console.log('Install prompt result:', result.outcome);

        if (result.outcome === 'accepted') {
          localStorage.setItem('mahataty_installed', 'true');
          console.log('User accepted the install prompt');
        }

        // Clear the deferred prompt (can only be used once)
        deferredPrompt = null;
        hideInstallBanner();
      } catch (err) {
        console.error('Error showing install prompt:', err);
      }
    } else {
      // If no deferred prompt, try to show iOS modal as fallback
      if (iosInstallModal) iosInstallModal.classList.add('show');
      hideInstallBanner();
    }
  });
}

// Handle dismiss button
if (installDismiss) {
  installDismiss.addEventListener('click', () => {
    triggerHapticFeedback();
    installBannerDismissed = true;
    localStorage.setItem('mahataty_install_dismissed', 'true');
    hideInstallBanner();
  });
}

// Handle iOS modal close
if (closeIosBtn) {
  closeIosBtn.addEventListener('click', () => {
    triggerHapticFeedback();
    if (iosInstallModal) iosInstallModal.classList.remove('show');
  });
}

// Close iOS modal when clicking outside
if (iosInstallModal) {
  iosInstallModal.addEventListener('click', (e) => {
    if (e.target === iosInstallModal) {
      iosInstallModal.classList.remove('show');
    }
  });
}

// Handle app installed event
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  localStorage.setItem('mahataty_installed', 'true');
  hideInstallBanner();
  deferredPrompt = null;
});

// Show banner after a delay if on mobile (even without beforeinstallprompt)
window.addEventListener('load', () => {
  setTimeout(() => {
    // Only show if on mobile and not already installed
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && !isAppInstalled() && !wasBannerDismissed()) {
      showInstallBanner();
    }
  }, 3000);
});

// ==========================================================================
// 3. تسجيل Service Worker
// ==========================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[App] SW registered:', registration.scope);

        // التحقق من وجود تحديثات
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // نسخة جديدة متوفرة
              console.log('[App] New version available');
            }
          });
        });
      })
      .catch((err) => {
        console.error('[App] SW registration failed:', err);
      });
  });
}

// ==========================================================================
// 4. دوال مساعدة
// ==========================================================================
function triggerHapticFeedback() {
  if ('vibrate' in navigator) {
    navigator.vibrate(15);
  }
}

function getLineColorClassLocal(line) {
  if (line === '1') return 'line-1';
  if (line === '2') return 'line-2';
  if (line === '3') return 'line-3';
  if (line === 'LRT') return 'line-lrt';
  if (line && line.startsWith('Monorail')) return 'line-monorail';
  return 'line-transfer';
}

function getLineDisplayNameLocal(line) {
  const names = {
    '1': 'الخط الأول 🔴',
    '2': 'الخط الثاني 🔵',
    '3': 'الخط الثالث 🟢',
    'LRT': 'القطار الكهربائي الخفيف ⚡',
    'Monorail-East': 'مونوريل شرق النيل 🟦',
    'Monorail-West': 'مونوريل غرب النيل 🟩'
  };
  return names[line] || line;
}

// ==========================================================================
// 5. تأثير 3D على التذكرة
// ==========================================================================
function apply3DTiltEffect() {
  if (!ticketCard) return;

  const handleMove = (e, isTouch) => {
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    const rect = ticketCard.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;

    const xc = rect.width / 2;
    const yc = rect.height / 2;
    const angleX = (yc - y) / 12;
    const angleY = (x - xc) / 18;

    ticketCard.style.transform = `rotateY(${angleY}deg) rotateX(${angleX}deg) scale(1.02)`;
    ticketCard.style.setProperty('--mx', `${(x / rect.width) * 100}%`);
    ticketCard.style.setProperty('--my', `${(y / rect.height) * 100}%`);
  };

  const resetCard = () => {
    ticketCard.style.transform = `rotateY(0deg) rotateX(0deg) scale(1)`;
    ticketCard.style.setProperty('--mx', `50%`);
    ticketCard.style.setProperty('--my', `50%`);
  };

  ticketCard.addEventListener('mousemove', (e) => handleMove(e, false));
  ticketCard.addEventListener('touchmove', (e) => handleMove(e, true));
  ticketCard.addEventListener('mouseleave', resetCard);
  ticketCard.addEventListener('touchend', resetCard);
}

apply3DTiltEffect();

// ==========================================================================
// 6. نظام البحث الذكي والإكمال التلقائي
// ==========================================================================
function handleAutocomplete(inputElement, suggestionsElement) {
  let hideHandler = null;

  inputElement.addEventListener('input', () => {
    const val = inputElement.value;
    suggestionsElement.innerHTML = '';

    if (!val || val.length < 1) return;

    const normalizedVal = normalizeArabic(val);
    const matches = [];
    const seen = new Set();

    // البحث في محطات المترو والـ LRT والمونوريل
    for (let stationName in metroGraph) {
      if (normalizeArabic(stationName).includes(normalizedVal)) {
        const type = stationName.includes('(LRT)') ? 'LRT ⚡' :
                     stationName.includes('(مونوريل)') ? 'مونوريل 🚝' : 'مترو 🚇';
        if (!seen.has(stationName)) {
          matches.push({ name: stationName, type });
          seen.add(stationName);
        }
      }
    }

    // البحث في المعالم
    for (let landmark of landmarks) {
      if (
        normalizeArabic(landmark.name).includes(normalizedVal) ||
        normalizeArabic(landmark.arabicName).includes(normalizedVal)
      ) {
        if (!seen.has(landmark.nearestStation)) {
          matches.push({ name: landmark.arabicName, type: 'وجهة حيوية 🏛', station: landmark.nearestStation });
          seen.add(landmark.nearestStation);
        }
      }
    }

    matches.slice(0, 6).forEach(match => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = `<strong>${match.name}</strong> <span style="float:left; color: var(--text-secondary); font-size:10px;">${match.type}</span>`;
      div.addEventListener('click', () => {
        triggerHapticFeedback();
        inputElement.value = match.station || match.name;
        suggestionsElement.innerHTML = '';
      });
      suggestionsElement.appendChild(div);
    });
  });

  // إخفاء الاقتراحات عند النقر خارجها (listener واحد فقط)
  hideHandler = (e) => {
    if (e.target !== inputElement && !suggestionsElement.contains(e.target)) {
      suggestionsElement.innerHTML = '';
    }
  };
  document.addEventListener('click', hideHandler);
}

handleAutocomplete(startInput, startSuggestions);
handleAutocomplete(endInput, endSuggestions);

// ==========================================================================
// 7. أحداث واجهة المستخدم
// ==========================================================================
swapBtn.addEventListener('click', () => {
  triggerHapticFeedback();
  const temp = startInput.value;
  startInput.value = endInput.value;
  endInput.value = temp;
});

document.querySelectorAll('.badge').forEach(badge => {
  badge.addEventListener('click', () => {
    triggerHapticFeedback();
    endInput.value = badge.getAttribute('data-value');
  });
});

// ==========================================================================
// 8. المنطق الأساسي - حساب المسار
// ==========================================================================
calculateBtn.addEventListener('click', () => {
  triggerHapticFeedback();
  startInput.blur();
  endInput.blur();

  const rawStart = startInput.value.trim();
  const rawEnd = endInput.value.trim();

  if (!rawStart || !rawEnd) {
    alert("يرجى ملء محطتي البداية والنهاية! 📝");
    return;
  }

  const startStation = resolveStation(rawStart);
  const endStation = resolveStation(rawEnd);

  if (!startStation || !endStation) {
    alert("عذراً، لم نتمكن من تحديد محطات رحلتك. يرجى كتابة اسم محطة أو جامعة صحيحة! 🔍");
    return;
  }

  if (startStation === endStation) {
    alert("أنت بالفعل في محطة وصولك يا بطل! 🏁📍");
    return;
  }

  const result = findShortestPath(startStation, endStation);
  if (!result) {
    alert("لم يتم العثور على مسار مباشر. يرجى مراجعة محطات خطوطك!");
    return;
  }

  const fare = calculateFare(result.path);

  // تحديث التذكرة
  ticketStart.textContent = startStation;
  ticketEnd.textContent = endStation;
  ticketPrice.textContent = `${fare.totalFare}.00 EGP`;

  // تحديث الإحصائيات
  statTime.textContent = `${result.totalTime} دقيقة`;
  statMetro.textContent = fare.metroStations > 0 ? `${fare.metroStations} محطة` : 'لا يوجد';
  statLrt.textContent = fare.lrtStations > 0 ? `${fare.lrtStations} محطة` : 'لا يوجد';
  statMonorail.textContent = fare.monorailStations > 0 ? `${fare.monorailStations} محطة` : 'لا يوجد';

  // بناء التايم لاين
  routeTimelineList.innerHTML = '';

  result.path.forEach((station, index) => {
    const li = document.createElement('li');
    li.className = 'timeline-item';

    const stationData = metroGraph[station];
    const lines = stationData.line.split(',');
    const primaryLine = lines[0];

    li.classList.add(getLineColorClassLocal(primaryLine));

    if (stationData.isTransfer) {
      li.classList.add('transfer');
    }
    if (stationData.isUnderConstruction) {
      li.classList.add('under-construction');
    }

    // تحديد الخط الواصل للمحطة
    let lineBadge = '';
    let transferNote = '';

    if (index > 0) {
      const incomingLine = getLineOfTransition(result.path[index - 1], station);
      if (incomingLine) {
        lineBadge = `<span class="line-badge ${getLineColorClassLocal(incomingLine)}">${getLineDisplayNameLocal(incomingLine)}</span>`;
      }
    }

    // تنبيه التبديل
    if (stationData.isTransfer && index > 0 && index < result.path.length - 1) {
      const incomingLine = getLineOfTransition(result.path[index - 1], station);
      const outgoingLine = getLineOfTransition(station, result.path[index + 1]);

      if (incomingLine && outgoingLine && incomingLine !== outgoingLine) {
        transferNote = ` <span class="transfer-alert">(انتقل للرصيف الآخر - ${getLineDisplayNameLocal(outgoingLine)}) 🔄</span>`;
      }
    }

    const constructionBadge = stationData.isUnderConstruction ? ' <span class="construction-badge">🚧 قيد الإنشاء</span>' : '';

    li.innerHTML = `<div class="timeline-content"><span class="station-name">${station}</span>${lineBadge}${transferNote}${constructionBadge}</div>`;
    routeTimelineList.appendChild(li);

    setTimeout(() => {
      li.classList.add('visible');
    }, index * 80);
  });

  placeholderText.classList.add('hidden');
  resultsContent.classList.remove('hidden');

  if (window.innerWidth < 768) {
    resultsPane.classList.add('active-sheet');
    resultsPane.scrollTop = 0;
  }
});

if (closeResultsBtn) {
  closeResultsBtn.addEventListener('click', () => {
    triggerHapticFeedback();
    resultsPane.classList.remove('active-sheet');
  });
}

// ==========================================================================
// 9. شريط الملاحة السفلي - الرحلة والعنا
// ==========================================================================
function showSearchView() {
  document.querySelector('.booking-card').classList.remove('hidden');
  document.querySelector('.quick-landmarks').classList.remove('hidden');

  const aboutSection = document.getElementById('about-section');
  if (aboutSection) aboutSection.remove();

  navHome.classList.add('active');
  navAbout.classList.remove('active');
}

function showAboutView() {
  document.querySelector('.booking-card').classList.add('hidden');
  document.querySelector('.quick-landmarks').classList.add('hidden');

  const oldSection = document.getElementById('about-section');
  if (oldSection) oldSection.remove();

  const aboutSection = document.createElement('section');
  aboutSection.id = 'about-section';
  aboutSection.className = 'about-section';
  aboutSection.innerHTML = `
    <div class="version-badge">📱 الإصدار 2.0 - يونيو 2026</div>

    <h2>🚇 محطتي 2026</h2>
    <p>دليلك الذكي للنقل المتكامل في القاهرة الكبرى. نربط بين <span class="highlight">3 خطوط مترو</span> و<span class="highlight">القطار الكهربائي الخفيف (LRT)</span> و<span class="highlight">مونوريل العاصمة الإدارية</span> — كلها في تطبيق واحد سريع ومجاني.</p>

    <h3>🧠 كيف يعمل؟</h3>
    <p>يستخدم التطبيق <span class="highlight">خوارزمية ديجسترا المحسّنة</span> لحساب أسرع مسار بين أي محطتين، مع إضافة عقوبة زمنية ذكية (5 دقائق) عند التبديل بين الخطوط — لضمان أقل زمن رحلة حقيقي.</p>

    <div class="feature-grid">
      <div class="feature-item">
        <span class="feature-icon">🧭</span>
        <span class="feature-title">مسار أمثل</span>
        <span class="feature-desc">ديجسترا مع عقوبة التحويل</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">💳</span>
        <span class="feature-title">تسعيرة ذكية</span>
        <span class="feature-desc">حساب تلقائي لكل نظام نقل</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">🏛️</span>
        <span class="feature-title">معالم وجامعات</span>
        <span class="feature-desc">اكتب اسم المعلم نحله لك</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">📴</span>
        <span class="feature-title">يعمل Offline</span>
        <span class="feature-desc">PWA كامل بدون إنترنت</span>
      </div>
    </div>

    <h3>🗺️ شبكة النقل المتكاملة</h3>
    <div class="network-stats">
      <div class="network-stat">
        <span class="stat-number">87</span>
        <span class="stat-label">محطة متكاملة</span>
      </div>
      <div class="network-stat">
        <span class="stat-number">5</span>
        <span class="stat-label">خطوط نقل</span>
      </div>
      <div class="network-stat">
        <span class="stat-number">25+</span>
        <span class="stat-label">معلم وجامعة</span>
      </div>
    </div>

    <h3>💰 أسعار التذاكر (يونيو 2026)</h3>

    <p style="font-size: 12px; color: var(--neon-blue); font-weight: 700; margin-bottom: 8px;">🚇 مترو الأنفاق (مدعوم)</p>
    <div class="fare-table-container">
      <table class="fare-table">
        <thead>
          <tr>
            <th>الشريحة</th>
            <th>المحطات</th>
            <th>السعر</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="ticket-color color-yellow"></span>صفراء</td>
            <td>حتى 9 محطات</td>
            <td class="price">10 EGP</td>
          </tr>
          <tr>
            <td><span class="ticket-color color-green"></span>خضراء</td>
            <td>10 - 16 محطة</td>
            <td class="price">12 EGP</td>
          </tr>
          <tr>
            <td><span class="ticket-color color-red"></span>حمراء</td>
            <td>17 - 23 محطة</td>
            <td class="price">15 EGP</td>
          </tr>
          <tr>
            <td><span class="ticket-color color-blue"></span>زرقاء</td>
            <td>24 - 39 محطة</td>
            <td class="price">20 EGP</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="fare-note">📌 آخر تحديث: 27 مارس 2026 | المصدر: وزارة النقل المصرية</div>

    <p style="font-size: 12px; color: var(--neon-lrt); font-weight: 700; margin: 16px 0 8px 0;">⚡ القطار الكهربائي الخفيف (LRT)</p>
    <div class="fare-table-container">
      <table class="fare-table">
        <thead>
          <tr>
            <th>المحطات</th>
            <th>السعر</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1 - 3 محطات</td>
            <td class="price">15 EGP</td>
          </tr>
          <tr>
            <td>4 - 5 محطات</td>
            <td class="price">20 EGP</td>
          </tr>
          <tr>
            <td>6 - 7 محطات</td>
            <td class="price">25 EGP</td>
          </tr>
          <tr>
            <td>8+ محطات</td>
            <td class="price">35 EGP</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="fare-note">📌 أسعار الافتتاح 2022 | غير مدعومة</div>

    <p style="font-size: 12px; color: var(--neon-monorail); font-weight: 700; margin: 16px 0 8px 0;">🚝 مونوريل شرق النيل</p>
    <div class="fare-table-container">
      <table class="fare-table">
        <thead>
          <tr>
            <th>المحطات</th>
            <th>السعر</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>حتى 5 محطات</td>
            <td class="price">20 EGP</td>
          </tr>
          <tr>
            <td>6 - 10 محطات</td>
            <td class="price">40 EGP</td>
          </tr>
          <tr>
            <td>11 - 15 محطة</td>
            <td class="price">55 EGP</td>
          </tr>
          <tr>
            <td>16+ محطة (الخط كامل)</td>
            <td class="price">80 EGP</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="fare-note">📌 بدء التشغيل: مايو 2026 | تخفيض 50% لكبار السن وذوي الهمم</div>

    <h3>⚠️ ملاحظات مهمة</h3>
    <p>• التذكرة الموحدة = مجموع تذاكر كل نظام نقل على حدة (غير متكاملة حالياً).</p>
    <p>• أسعار المونوريل تقديرية حتى إعلان الأسعار النهائية رسمياً.</p>
    <p>• وقت التبديل بين الخطوط محسوب بـ 5 دقائق في الخوارزمية.</p>
    <p>• المحطات تحت الإنشاء مؤشرة بـ 🚧 في خط سير الرحلة.</p>

    <div class="creator-badge">
      <div class="avatar">S</div>
      <div class="creator-info">
        <span class="creator-name">Seif4D</span>
        <span class="creator-role">مطور ومؤسس المشروع</span>
        <a href="https://github.com/seif4d" class="creator-link">github.com/seif4d ↗</a>
      </div>
    </div>

    <p style="text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 20px; padding-bottom: 20px;">
      صُنع بـ 💙 في القاهرة · يونيو 2026<br>
      مفتوح المصدر تحت رخصة MIT
    </p>
  `;

  paneSearch.appendChild(aboutSection);
  navAbout.classList.add('active');
  navHome.classList.remove('active');
}

navHome.addEventListener('click', () => {
  triggerHapticFeedback();
  showSearchView();
});

navAbout.addEventListener('click', () => {
  triggerHapticFeedback();
  showAboutView();
});