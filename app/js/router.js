// js/router.js
// خوارزمية المسار الأمثل لشبكة النقل المتكاملة - القاهرة الكبرى
// يونيو 2026 - النسخة المُعاد هندستها بالكامل

import { metroGraph } from './data.js';
import { landmarks } from './landmarks.js';
import { CONFIG } from './config.js';

// ==========================================================================
// 1. أدوات تطبيع النصوص العربية
// ==========================================================================

/**
 * تطبيع النص العربي لإزالة التشكيل وتوحيد الألفات والتاء المربوطة
 * لتسهيل البحث والمطابقة الفازية
 */
export function normalizeArabic(text) {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')  // إزالة التشكيل
    .replace(/\s+/g, ' ');  // توحيد المسافات
}

// ==========================================================================
// 2. حل اسم المحطة من مدخلات المستخدم
// ==========================================================================

/**
 * البحث عن المحطة المناسبة بناءً على مدخلات المستخدم
 * يدعم: أسماء المحطات المباشرة، البحث الجزئي، المعالم والجامعات
 * @param {string} input - نص المستخدم
 * @returns {string|null} اسم المحطة الدقيق أو null
 */
export function resolveStation(input) {
  const normalizedInput = normalizeArabic(input);
  if (!normalizedInput || normalizedInput.length < 2) return null;

  const stationNames = Object.keys(metroGraph);

  // 1. المطابقة المباشرة (case-insensitive)
  for (const stationName of stationNames) {
    if (normalizeArabic(stationName) === normalizedInput) {
      return stationName;
    }
  }

  // 2. المطابقة الجزئية (يبدأ بالنص)
  for (const stationName of stationNames) {
    if (normalizeArabic(stationName).startsWith(normalizedInput)) {
      return stationName;
    }
  }

  // 3. المطابقة الجزئية (يحتوي على النص)
  for (const stationName of stationNames) {
    if (normalizeArabic(stationName).includes(normalizedInput)) {
      return stationName;
    }
  }

  // 4. البحث في المعالم والجامعات
  for (const landmark of landmarks) {
    const landmarkName = normalizeArabic(landmark.arabicName || landmark.name);
    if (landmarkName.includes(normalizedInput)) {
      return landmark.nearestStation;
    }
  }

  return null;
}

// ==========================================================================
// 3. أدوات تحليل الخطوط
// ==========================================================================

/**
 * استخراج جميع الخطوط التي تمر بمحطة معينة
 * @param {string} station - اسم المحطة
 * @returns {string[]} مصفوفة بأسماء الخطوط
 */
function getLinesAtStation(station) {
  if (!metroGraph[station]) return [];
  return metroGraph[station].line.split(',').map(l => l.trim());
}

/**
 * تحديد الخط المشترك بين محطتين متجاورتين
 * في حالة وجود أكثر من خط مشترك (نادر)، يُرجع الأول
 * @param {string} from - المحطة الحالية
 * @param {string} to - المحطة التالية
 * @returns {string|null} اسم الخط المشترك
 */
function getTransitionLine(from, to) {
  const linesFrom = getLinesAtStation(from);
  const linesTo = getLinesAtStation(to);
  return linesFrom.find(line => linesTo.includes(line)) || null;
}

/**
 * تحديد ما إذا كانت المحطة محطة تحويل (تربط خطين أو أكثر)
 * @param {string} station - اسم المحطة
 * @returns {boolean}
 */
function isTransferStation(station) {
  return getLinesAtStation(station).length > 1;
}

// ==========================================================================
// 4. خوارزمية ديجسترا المُحسّنة
// ==========================================================================

/**
 * خوارزمية ديجسترا لإيجاد أقصر مسار زمني
 * مع عقوبة زمنية للتبديل بين الخطوط في محطات التحويل
 * 
 * كل عقدة في Priority Queue: { station, dist, line, transfers }
 * - line: الخط الحالي الذي يسير عليه الراكب
 * - transfers: عدد التبديلات حتى الآن
 * 
 * @param {string} startStation - محطة البداية
 * @param {string} endStation - محطة النهاية
 * @returns {Object|null} { path: string[], totalTime: number, transfers: number }
 */
export function findShortestPath(startStation, endStation) {
  if (!metroGraph[startStation] || !metroGraph[endStation]) {
    return null;
  }

  if (startStation === endStation) {
    return { path: [startStation], totalTime: 0, transfers: 0 };
  }

  // المسافات الأقصر لكل محطة
  const distances = {};
  // تتبع المسار للرجوع
  const cameFrom = {};
  // تتبع الخط النشط عند الوصول لكل محطة
  const activeLines = {};
  // تتبع عدد التبديلات
  const transferCounts = {};

  // Priority Queue (مصفوفة مرتبة يدويًا)
  const pq = [];

  // تهيئة
  for (const node in metroGraph) {
    distances[node] = Infinity;
    transferCounts[node] = Infinity;
  }

  // خطوط البداية
  const startLines = getLinesAtStation(startStation);
  const initialLine = startLines[0];

  distances[startStation] = 0;
  transferCounts[startStation] = 0;
  activeLines[startStation] = initialLine;
  pq.push({ station: startStation, dist: 0, line: initialLine, transfers: 0 });

  while (pq.length > 0) {
    // استخراج العقدة ذات المسافة الأقصر
    pq.sort((a, b) => a.dist - b.dist);
    const current = pq.shift();
    const { station: currentNode, dist: currentDist, line: currentLine, transfers: currentTransfers } = current;

    // إذا وصلنا للهدف
    if (currentNode === endStation) {
      // إعادة بناء المسار
      const path = [];
      let step = endStation;
      while (step !== undefined) {
        path.unshift(step);
        step = cameFrom[step];
      }
      return {
        path,
        totalTime: distances[endStation],
        transfers: transferCounts[endStation]
      };
    }

    // إذا وجدنا مسارًا أقصر مسبقًا، تخطى
    if (currentDist > distances[currentNode]) continue;

    // استكشاف الجيران
    const neighbors = metroGraph[currentNode].connections;
    for (const neighbor in neighbors) {
      const edgeWeight = neighbors[neighbor];
      const transitionLine = getTransitionLine(currentNode, neighbor);

      if (!transitionLine) continue; // لا يوجد خط مشترك (لا يجب أن يحدث)

      // حساب العقوبة
      let penalty = 0;
      let newTransfers = currentTransfers;
      let nextLine = currentLine;

      // التبديل يحدث فقط إذا:
      // 1. ليس الخطوة الأولى
      // 2. الخط الجديد مختلف عن الخط الحالي
      // 3. المحطة الحالية هي محطة تحويل (رصيف مشترك)
      if (currentLine && transitionLine !== currentLine) {
        if (isTransferStation(currentNode)) {
          penalty = CONFIG.TRANSFER_PENALTY_MINUTES;
          newTransfers = currentTransfers + 1;
          nextLine = transitionLine;
        } else {
          // تبديل غير قانوني (لا يوجد رصيف مشترك)
          // نعاقبه بشدة لمنع الخوارزمية من اختياره
          penalty = 999;
        }
      }

      const newDist = currentDist + edgeWeight + penalty;

      // تحديث إذا وجدنا مسارًا أقصر
      // أو نفس المسافة بتبديلات أقل
      if (newDist < distances[neighbor] || 
          (newDist === distances[neighbor] && newTransfers < transferCounts[neighbor])) {
        distances[neighbor] = newDist;
        cameFrom[neighbor] = currentNode;
        activeLines[neighbor] = nextLine;
        transferCounts[neighbor] = newTransfers;
        pq.push({
          station: neighbor,
          dist: newDist,
          line: nextLine,
          transfers: newTransfers
        });
      }
    }
  }

  return null; // لا يوجد مسار
}

// ==========================================================================
// 5. تحليل المسار وتفصيل الخطوط
// ==========================================================================

/**
 * تحليل المسار إلى شرائح (segments) كل شريحة على خط واحد
 * @param {string[]} path - مصفوفة أسماء المحطات
 * @returns {Object[]} [{ line, stations: string[], from, to, stationCount }]
 */
export function analyzePathSegments(path) {
  if (!path || path.length < 2) return [];

  const segments = [];
  let currentSegment = {
    line: getTransitionLine(path[0], path[1]),
    stations: [path[0]],
    from: path[0]
  };

  for (let i = 1; i < path.length; i++) {
    const line = getTransitionLine(path[i - 1], path[i]);

    if (line !== currentSegment.line && i < path.length - 1) {
      // نهاية الشريحة الحالية
      currentSegment.stations.push(path[i]);
      currentSegment.to = path[i];
      currentSegment.stationCount = currentSegment.stations.length;
      segments.push(currentSegment);

      // بداية شريحة جديدة
      currentSegment = {
        line: line,
        stations: [path[i]],
        from: path[i]
      };
    } else {
      currentSegment.stations.push(path[i]);
    }
  }

  // إغلاق آخر شريحة
  currentSegment.to = path[path.length - 1];
  currentSegment.stationCount = currentSegment.stations.length;
  segments.push(currentSegment);

  return segments;
}

/**
 * تحديد نوع النقل من اسم الخط
 * @param {string} line - اسم الخط
 * @returns {string} 'metro' | 'lrt' | 'monorail'
 */
function getTransportType(line) {
  if (line === 'LRT') return 'lrt';
  if (line && line.startsWith('Monorail')) return 'monorail';
  return 'metro';
}

// ==========================================================================
// 6. حساب التسعيرة
// ==========================================================================

/**
 * حساب سعر التذكرة بالتفصيل مع تقسيم الشرائح
 * @param {string[]} path - مصفوفة أسماء المحطات
 * @returns {Object|null} تفاصيل التسعيرة
 */
export function calculateFare(path) {
  if (!path || path.length < 2) return null;

  const segments = analyzePathSegments(path);

  let metroTotalStations = 0;
  let lrtTotalStations = 0;
  let monorailTotalStations = 0;

  // حساب المحطات لكل نوع نقل
  for (const segment of segments) {
    const type = getTransportType(segment.line);
    const stationCount = segment.stations.length;

    if (type === 'metro') {
      metroTotalStations += stationCount;
    } else if (type === 'lrt') {
      lrtTotalStations += stationCount;
    } else if (type === 'monorail') {
      monorailTotalStations += stationCount;
    }
  }

  // حساب تسعيرة المترو
  let metroPrice = 0;
  let metroTicketColor = 'لا يوجد';
  if (metroTotalStations > 0) {
    const fareRule = CONFIG.METRO_FARES.find(rule => metroTotalStations <= rule.maxStations)
                     || CONFIG.METRO_FARES[CONFIG.METRO_FARES.length - 1];
    metroPrice = fareRule.price;
    metroTicketColor = fareRule.ticketColor;
  }

  // حساب تسعيرة LRT
  let lrtPrice = 0;
  if (lrtTotalStations > 0) {
    const fareRule = CONFIG.LRT_FARES.find(rule => lrtTotalStations <= rule.maxStations)
                     || CONFIG.LRT_FARES[CONFIG.LRT_FARES.length - 1];
    lrtPrice = fareRule.price;
  }

  // حساب تسعيرة المونوريل
  let monorailPrice = 0;
  if (monorailTotalStations > 0) {
    const fareRule = CONFIG.MONORAIL_FARES.find(rule => monorailTotalStations <= rule.maxStations)
                     || CONFIG.MONORAIL_FARES[CONFIG.MONORAIL_FARES.length - 1];
    monorailPrice = fareRule.price;
  }

  return {
    segments,  // تفاصيل الشرائح
    metroStations: metroTotalStations,
    metroPrice,
    metroTicketColor,
    lrtStations: lrtTotalStations,
    lrtPrice,
    monorailStations: monorailTotalStations,
    monorailPrice,
    totalFare: metroPrice + lrtPrice + monorailPrice
  };
}

// ==========================================================================
// 7. أدوات مساعدة للواجهة
// ==========================================================================

/**
 * تحديد لون الخط للعرض البصري
 * @param {string} line - اسم الخط
 * @returns {string} اسم class CSS
 */
export function getLineColorClass(line) {
  if (line === '1') return 'line-1';
  if (line === '2') return 'line-2';
  if (line === '3') return 'line-3';
  if (line === 'LRT') return 'line-lrt';
  if (line && line.startsWith('Monorail')) return 'line-monorail';
  return 'line-transfer';
}

/**
 * تحديد اسم الخط للعرض
 * @param {string} line - اسم الخط
 * @returns {string} الاسم المعروض
 */
export function getLineDisplayName(line) {
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

/**
 * تحديد الخط الانتقالي بين محطتين متتاليتين في المسار
 * للاستخدام في بناء التايم لاين
 * @param {string} nodeA - المحطة السابقة
 * @param {string} nodeB - المحطة الحالية
 * @returns {string|null}
 */
export function getLineOfTransition(nodeA, nodeB) {
  return getTransitionLine(nodeA, nodeB);
}