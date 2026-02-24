import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = window.SUPABASE_URL || "https://udmvmzezfjrngxghbvmq.supabase.co";
const SUPABASE_ANON_KEY =
  window.SUPABASE_ANON_KEY || "sb_publishable_VLk7r1RB0k88iJtWWYka-w_2D7upIsi";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  showConfigError();
  throw new Error("Supabase config missing.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  weekStart: startOfWeek(new Date()),
  user: null,
  reservations: [],
  reservationIndex: new Map(),
  selectedSlot: null,
  viewOnly: false
};

const lessonSlots = [
  ["09:00", "09:40"],
  ["09:50", "10:30"],
  ["10:40", "11:20"],
  ["11:30", "12:10"],
  ["12:50", "13:30"],
  ["13:40", "14:20"],
  ["14:30", "15:10"],
  ["15:20", "16:00"]
];

const days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const blockedDateRanges = [
  { start: "2026-03-16", end: "2026-03-20", reason: "Ara tatil" }, // Kullanıcı talebi
  { start: "2026-03-20", end: "2026-03-22", reason: "Ramazan Bayramı" },
  { start: "2026-05-27", end: "2026-05-30", reason: "Kurban Bayramı" }
];
const blockedSingleDates = new Map([
  ["2026-01-01", "Yılbaşı"],
  ["2026-04-23", "23 Nisan"],
  ["2026-05-01", "1 Mayıs"],
  ["2026-05-19", "19 Mayıs"],
  ["2026-07-15", "15 Temmuz"],
  ["2026-08-30", "30 Ağustos"],
  ["2026-10-29", "29 Ekim"]
]);

const el = {
  loginCard: document.getElementById("login-card"),
  loginForm: document.getElementById("login-form"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  app: document.getElementById("app"),
  weekLabel: document.getElementById("week-label"),
  grid: document.getElementById("calendar-grid"),
  prevWeek: document.getElementById("prev-week"),
  nextWeek: document.getElementById("next-week"),
  todayWeek: document.getElementById("today-week"),
  exportCsvBtn: document.getElementById("export-csv-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  modal: document.getElementById("reservation-modal"),
  form: document.getElementById("reservation-form"),
  modalTitle: document.getElementById("modal-title"),
  reservationId: document.getElementById("reservation-id"),
  teacherField: document.getElementById("teacher-field"),
  eventField: document.getElementById("event-field"),
  slotSummary: document.getElementById("slot-summary"),
  lessonCountField: document.getElementById("lesson-count-field"),
  lessonCount: document.getElementById("lesson-count"),
  teacherName: document.getElementById("teacher-name"),
  eventContent: document.getElementById("event-content"),
  reservationDate: document.getElementById("reservation-date"),
  reservationStart: document.getElementById("reservation-start"),
  reservationEnd: document.getElementById("reservation-end"),
  deleteBtn: document.getElementById("delete-btn"),
  cancelBtn: document.getElementById("cancel-btn"),
  submitBtn: document.getElementById("submit-btn"),
  confirmModal: document.getElementById("confirm-modal"),
  confirmMessage: document.getElementById("confirm-message"),
  confirmOk: document.getElementById("confirm-ok"),
  confirmCancel: document.getElementById("confirm-cancel"),
  toast: document.getElementById("toast")
};

bindEvents();
init();

async function init() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    notify("Oturum kontrol edilemedi.");
    showLogin();
    return;
  }

  if (data.session?.user) {
    state.user = data.session.user;
    showApp();
    await loadReservations();
    return;
  }

  showLogin();
}

function bindEvents() {
  el.loginForm.addEventListener("submit", handleLogin);
  el.prevWeek.addEventListener("click", async () => {
    state.weekStart = addDays(state.weekStart, -7);
    await loadReservations();
  });
  el.nextWeek.addEventListener("click", async () => {
    state.weekStart = addDays(state.weekStart, 7);
    await loadReservations();
  });
  el.todayWeek.addEventListener("click", async () => {
    state.weekStart = startOfWeek(new Date());
    await loadReservations();
  });
  el.exportCsvBtn.addEventListener("click", exportWeekCsv);
  el.logoutBtn.addEventListener("click", handleLogout);
  el.form.addEventListener("submit", saveReservation);
  el.deleteBtn.addEventListener("click", deleteReservation);
  el.cancelBtn.addEventListener("click", () => el.modal.close());
}

async function handleLogin(event) {
  event.preventDefault();
  const email = el.email.value.trim();
  const password = el.password.value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    notify(`Giriş başarısız: ${error.message}`);
    return;
  }

  state.user = data.user;
  el.loginForm.reset();
  showApp();
  await loadReservations();
}

async function handleLogout() {
  await supabase.auth.signOut();
  state.user = null;
  state.reservations = [];
  showLogin();
}

async function loadReservations() {
  const weekEnd = addDays(state.weekStart, 4);
  const { data, error } = await supabase
    .from("reservations")
    .select("id, teacher_name, event_content, reservation_date, start_time, end_time, user_id")
    .gte("reservation_date", isoDate(state.weekStart))
    .lte("reservation_date", isoDate(weekEnd))
    .order("reservation_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    notify(`Veriler alınamadı: ${error.message}`);
    return;
  }

  state.reservations = data || [];
  state.reservationIndex = buildReservationIndex(state.reservations);
  render();
}

function render() {
  const weekEnd = addDays(state.weekStart, 4);
  el.weekLabel.textContent = `${formatDateTR(state.weekStart)} - ${formatDateTR(weekEnd)}`;
  el.grid.innerHTML = "";

  days.forEach((day, index) => {
    const date = addDays(state.weekStart, index);
    const head = makeCell(`${day}<div class=\"meta\">${formatDateTR(date)}</div>`, "cell head");
    el.grid.append(head);
  });

  lessonSlots.forEach(([start, end]) => {
    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      const date = isoDate(addDays(state.weekStart, dayIndex));
      const reservation = state.reservationIndex.get(reservationKey(date, start));

      const slot = document.createElement("button");
      slot.type = "button";
      const blockedReason = getBlockedReason(date);
      const isBlockedEmptySlot = Boolean(blockedReason) && !reservation;
      slot.className = `cell slot ${reservation ? "filled" : ""} ${isBlockedEmptySlot ? "blocked" : ""}`;
      slot.dataset.date = date;
      slot.dataset.start = start;
      slot.dataset.end = end;
      if (isBlockedEmptySlot) {
        slot.disabled = true;
      }

      if (reservation) {
        slot.dataset.id = reservation.id;
        slot.setAttribute(
          "aria-label",
          `${date} ${start}-${end} dolu slot, etkinlik: ${reservation.event_content}`
        );
        slot.innerHTML = `
          <div class="slot-time">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2"></path>
            </svg>
            <span>${start} - ${end}</span>
          </div>
          <div class="title">${escapeHtml(reservation.event_content)}</div>
        `;
      } else {
        slot.setAttribute(
          "aria-label",
          isBlockedEmptySlot
            ? `${date} ${start}-${end} kapalı slot, neden: ${blockedReason}`
            : `${date} ${start}-${end} boş slot`
        );
        slot.innerHTML = isBlockedEmptySlot
          ? `
          <div class="slot-time">
            <span>${start} - ${end}</span>
          </div>
          <div class="blocked-label">${escapeHtml(blockedReason)}</div>
        `
          : `
          <div class="slot-time">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2"></path>
            </svg>
            <span>${start} - ${end}</span>
          </div>
        `;
      }

      if (!isBlockedEmptySlot) {
        slot.addEventListener("click", () => openModal({ reservation, date, start, end }));
      }
      el.grid.append(slot);
    }
  });
}

function openModal({ reservation, date, start, end }) {
  const blockedReason = getBlockedReason(date);
  if (!reservation && blockedReason) {
    notify(`${blockedReason} nedeniyle bu tarihe rezervasyon eklenemez.`);
    return;
  }

  if (!reservation && isPastSlot(date, start)) {
    notify("Geçmiş saatler için rezervasyon eklenemez.");
    return;
  }

  state.selectedSlot = { date, start, end };

  if (reservation) {
    state.viewOnly = true;
    el.modalTitle.textContent = "Rezervasyon Detayı";
    el.reservationId.value = reservation.id;
    el.teacherName.value = reservation.teacher_name;
    el.eventContent.value = reservation.event_content;
    el.reservationDate.value = reservation.reservation_date;
    el.reservationStart.value = reservation.start_time.slice(0, 5);
    el.reservationEnd.value = reservation.end_time.slice(0, 5);
    el.eventContent.readOnly = true;
    el.slotSummary.classList.add("hidden");
    el.lessonCountField.classList.add("hidden");
    el.deleteBtn.classList.remove("hidden");
    el.cancelBtn.classList.add("hidden");
    el.submitBtn.textContent = "Tamam";
  } else {
    state.viewOnly = false;
    el.modalTitle.textContent = "Yeni Rezervasyon";
    el.reservationId.value = "";
    el.teacherName.value = profileName(state.user);
    el.eventContent.value = "";
    el.reservationDate.value = date;
    el.reservationStart.value = start;
    el.reservationEnd.value = end;
    el.eventContent.readOnly = false;
    el.slotSummary.textContent = `Başlangıç saati: ${start}`;
    el.slotSummary.classList.remove("hidden");
    el.lessonCountField.classList.remove("hidden");
    const startIndex = lessonSlots.findIndex(([slotStart]) => slotStart === start);
    const maxCount = lessonSlots.length - startIndex;
    el.lessonCount.max = String(maxCount);
    el.lessonCount.value = "1";
    el.deleteBtn.classList.add("hidden");
    el.cancelBtn.classList.remove("hidden");
    el.submitBtn.textContent = "Kaydet";
  }

  el.modal.showModal();
  if (!state.viewOnly) {
    setTimeout(() => el.eventContent.focus(), 0);
  }
}

async function saveReservation(event) {
  event.preventDefault();
  if (state.viewOnly) {
    el.modal.close();
    return;
  }

  const teacherName = el.teacherName.value.trim() || profileName(state.user);
  const eventContent = el.eventContent.value.trim();
  const reservationDate = el.reservationDate.value;
  const startTime = el.reservationStart.value;
  const lessonCount = Number.parseInt(el.lessonCount.value, 10);

  if (!eventContent) {
    notify("İçerik alanı boş bırakılamaz.");
    return;
  }

  if (!Number.isInteger(lessonCount) || lessonCount < 1) {
    notify("Geçerli bir ders sayısı girin.");
    return;
  }

  const startIndex = lessonSlots.findIndex(([slotStart]) => slotStart === startTime);
  if (startIndex < 0) {
    notify("Başlangıç saati geçersiz.");
    return;
  }

  const selectedSlots = lessonSlots.slice(startIndex, startIndex + lessonCount);
  if (selectedSlots.length !== lessonCount) {
    notify("Seçilen ders sayısı gün sonunu aşıyor.");
    return;
  }

  const hasPastSlot = selectedSlots.some(([slotStart]) => isPastSlot(reservationDate, slotStart));
  if (hasPastSlot) {
    notify("Geçmiş saatler için rezervasyon eklenemez.");
    return;
  }

  const blockedReason = getBlockedReason(reservationDate);
  if (blockedReason) {
    notify(`${blockedReason} nedeniyle bu tarihe rezervasyon eklenemez.`);
    return;
  }

  const hasCollision = selectedSlots.some(([slotStart]) =>
    state.reservations.some(
      (item) => item.reservation_date === reservationDate && item.start_time.slice(0, 5) === slotStart
    )
  );
  if (hasCollision) {
    notify("Seçilen aralıkta dolu saat var. Ders sayısını azaltın veya başka saat seçin.");
    return;
  }

  const insertPayload = selectedSlots.map(([slotStart, slotEnd]) => ({
    teacher_name: teacherName,
    event_content: eventContent,
    reservation_date: reservationDate,
    start_time: slotStart,
    end_time: slotEnd,
    user_id: state.user.id
  }));

  const { error } = await supabase.from("reservations").insert(insertPayload);
  if (error) {
    if (error.code === "23505") {
      notify("Seçilen aralıkta çakışma var. Kayıt yapılmadı.");
      return;
    }
    notify(`Kayıt başarısız: ${error.message}`);
    return;
  }

  el.modal.close();
  await loadReservations();
  notify("Rezervasyon eklendi.");
}

async function deleteReservation() {
  const id = el.reservationId.value;
  if (!id) return;

  if (el.modal.open) {
    el.modal.close();
  }
  const confirmed = await askConfirm("Rezervasyon silinsin mi?");
  if (!confirmed) {
    el.modal.showModal();
    return;
  }

  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) {
    el.modal.showModal();
    notify(`Silme başarısız: ${error.message}`);
    return;
  }

  await loadReservations();
  notify("Rezervasyon silindi.");
}

function askConfirm(message) {
  return new Promise((resolve) => {
    el.confirmMessage.textContent = message;
    el.confirmModal.showModal();

    const cleanup = () => {
      el.confirmOk.removeEventListener("click", onOk);
      el.confirmCancel.removeEventListener("click", onCancel);
      el.confirmModal.removeEventListener("cancel", onCancel);
      if (el.confirmModal.open) el.confirmModal.close();
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = (event) => {
      if (event) event.preventDefault();
      cleanup();
      resolve(false);
    };

    el.confirmOk.addEventListener("click", onOk, { once: true });
    el.confirmCancel.addEventListener("click", onCancel, { once: true });
    el.confirmModal.addEventListener("cancel", onCancel, { once: true });
  });
}

function showApp() {
  el.loginCard.classList.add("hidden");
  el.app.classList.remove("hidden");
}

function showLogin() {
  el.app.classList.add("hidden");
  el.loginCard.classList.remove("hidden");
}

function profileName(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  return meta.full_name || meta.name || user.email || "Öğretmen";
}

function makeCell(content, className) {
  const cell = document.createElement("div");
  cell.className = className;
  cell.innerHTML = content;
  return cell;
}

function showConfigError() {
  const box = document.getElementById("login-card");
  box.classList.remove("hidden");
  box.innerHTML = `
    <h1>Kurulum Gerekli</h1>
    <p>
      <code>app.js</code> içinde <code>window.SUPABASE_URL</code> ve
      <code>window.SUPABASE_ANON_KEY</code> değerlerini README'ye göre girin.
    </p>
  `;
}

function notify(text) {
  el.toast.textContent = text;
  el.toast.classList.add("show");
  setTimeout(() => el.toast.classList.remove("show"), 2600);
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + distanceToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTR(date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isPastSlot(dateIso, startTime) {
  const slotStart = new Date(`${dateIso}T${startTime}:00`);
  return slotStart.getTime() < Date.now();
}

function getBlockedReason(dateIso) {
  if (blockedSingleDates.has(dateIso)) {
    return blockedSingleDates.get(dateIso);
  }
  return (
    blockedDateRanges.find((range) => dateIso >= range.start && dateIso <= range.end)?.reason || null
  );
}

function exportWeekCsv() {
  const rows = [["Tarih", "Gun", "Baslangic", "Bitis", "Durum", "Ogretmen", "Etkinlik", "Not"]];
  for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
    const dateObj = addDays(state.weekStart, dayIndex);
    const dateIso = isoDate(dateObj);
    const dayName = days[dayIndex];
    const blockedReason = getBlockedReason(dateIso);

    lessonSlots.forEach(([start, end]) => {
      const reservation = state.reservationIndex.get(reservationKey(dateIso, start));
      const status = reservation ? "Dolu" : blockedReason ? "Kapali" : "Bos";
      rows.push([
        dateIso,
        dayName,
        start,
        end,
        status,
        reservation?.teacher_name || "",
        reservation?.event_content || "",
        blockedReason || ""
      ]);
    });
  }

  const csvBody = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8;" });
  const fileName = `konferans-hafta-${isoDate(state.weekStart)}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildReservationIndex(reservations) {
  const index = new Map();
  for (const reservation of reservations) {
    const start = reservation.start_time.slice(0, 5);
    index.set(reservationKey(reservation.reservation_date, start), reservation);
  }
  return index;
}

function reservationKey(dateIso, startTime) {
  return `${dateIso}|${startTime}`;
}
