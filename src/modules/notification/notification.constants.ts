/**
 * BullMQ navbati.
 *
 * Nega navbat kerak: push yuborish tashqi servisga (FCM) chiqadi va u sekin
 * yoki ishlamay turgan boʻlishi mumkin. Mehmonning HTTP javobi shuni kutib
 * tursa — buyurtma berish sekinlashadi. Navbat ishni ajratadi: so'rov
 * "yuborilsin" deb yozib qoʻyadi, yuborishni worker keyin bajaradi.
 */
export const PUSH_QUEUE = 'push';

/** Navbatdagi ish turi. Hozir bitta tur bor, nomi aniq boʻlsin */
export const PUSH_JOB = 'order-event';

/**
 * Ish sozlamalari.
 *
 * `attempts` — FCM vaqtincha javob bermasa qayta urinadi. `backoff` har
 * urinish orasidagi kutish: 2s, 4s, 8s. Bajarilgan ishlar Redis'da
 * toʻplanib qolmasligi uchun chegaralangan.
 */
export const PUSH_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
} as const;

/** FCM bitta chaqiriqda shuncha tokenni qabul qiladi */
export const FCM_BATCH_LIMIT = 500;

/** FCM registratsiya tokeni ~163 belgi; zaxira bilan chegara */
export const DEVICE_TOKEN_MAX_LENGTH = 512;

/**
 * "Token endi yaroqsiz" degan FCM xato kodlari — faqat shular
 * qurilmani oʻchiradi. Boshqa xatolar (tarmoq, kvota) vaqtinchalik.
 */
export const DEAD_TOKEN_ERROR_CODES = [
  // Ilova oʻchirilgan yoki token yangilangan — eng koʻp uchraydigani
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
] as const;

/**
 * `invalid-argument` ikki xil narsani bildiradi: token buzuq **yoki**
 * xabarning oʻzi notoʻgʻri. Faqat birinchisida qurilma oʻchiriladi —
 * shuning uchun kod bilan birga matn ham tekshiriladi. Aks holda bitta
 * noto'g'ri xabar butun filialning qurilmalarini oʻchirib yuborardi.
 */
export const INVALID_ARGUMENT_CODE = 'messaging/invalid-argument';
export const INVALID_TOKEN_MESSAGE = 'not a valid FCM registration token';
