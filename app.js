import { createClient } from "./vendor/supabase.js?v=1";

const APP_VERSION = "20260823-1";
console.log(`Konferans Salonu Rezervasyon — sürüm: ${APP_VERSION}`);

const USERNAME_EMAIL_DOMAIN = "konferans.local";
const SUPABASE_URL = "https://msggolytyegvgbffldfb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5s3qZ7q54HBMK2Mllis6RA_fbwDme_9";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  weekStart: startOfWeek(new Date()),
  user: null,
  reservations: [],
  reservationIndex: new Map(),
  selectedSlot: null,
  viewOnly: false,
  auditLog: []
};

const lessonSlots = [
  { start: "09:00", end: "09:40", label: "1. Ders" },
  { start: "09:50", end: "10:30", label: "2. Ders" },
  { start: "10:40", end: "11:20", label: "3. Ders" },
  { start: "11:30", end: "12:10", label: "4. Ders" },
  { start: "12:20", end: "13:00", label: "Öğle Arası / 5. Ders" },
  { start: "12:50", end: "13:30", label: "5. Ders / Öğle Arası" },
  { start: "13:40", end: "14:20", label: "6. Ders", altTime: "13:50-14:30" },
  { start: "14:30", end: "15:10", label: "7. Ders", altTime: "14:40-15:20" },
  { start: "15:20", end: "16:00", label: "8. Ders", altTime: "15:25-16:00" }
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
  isim: document.getElementById("isim"),
  password: document.getElementById("password"),
  app: document.getElementById("app"),
  weekLabel: document.getElementById("week-label"),
  headWrap: document.getElementById("calendar-head-wrap"),
  headRow: document.getElementById("calendar-head-row"),
  bodyScroll: document.getElementById("calendar-body-scroll"),
  grid: document.getElementById("calendar-grid"),
  prevWeek: document.getElementById("prev-week"),
  nextWeek: document.getElementById("next-week"),
  todayWeek: document.getElementById("today-week"),
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
  toast: document.getElementById("toast"),
  adminBtn: document.getElementById("admin-btn"),
  adminLogModal: document.getElementById("admin-log-modal"),
  adminLogSearch: document.getElementById("admin-log-search"),
  adminLogActionFilter: document.getElementById("admin-log-action-filter"),
  adminLogTbody: document.getElementById("admin-log-tbody"),
  adminLogEmpty: document.getElementById("admin-log-empty"),
  adminLogClose: document.getElementById("admin-log-close")
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
    state.user = userFromSupabase(data.session.user);
    showApp();
    await loadReservations();
    return;
  }

  showLogin();
}

function bindEvents() {
  el.bodyScroll.addEventListener("scroll", () => {
    el.headRow.style.transform = `translateX(${-el.bodyScroll.scrollLeft}px)`;
  });
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
  el.logoutBtn.addEventListener("click", handleLogout);
  el.form.addEventListener("submit", saveReservation);
  el.deleteBtn.addEventListener("click", deleteReservation);
  el.cancelBtn.addEventListener("click", () => el.modal.close());
  el.adminBtn.addEventListener("click", openAdminPanel);
  el.adminLogClose.addEventListener("click", () => el.adminLogModal.close());
  el.adminLogSearch.addEventListener("input", debounce(renderAuditLog, 150));
  el.adminLogActionFilter.addEventListener("change", renderAuditLog);
}

function debounce(fn, delayMs) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

function userFromSupabase(authUser) {
  return {
    id: authUser.id,
    name: authUser.user_metadata?.display_name || authUser.email,
    isAdmin: Boolean(authUser.user_metadata?.is_admin)
  };
}

async function handleLogin(event) {
  event.preventDefault();
  const username = sanitizeName(el.isim.value).toLowerCase().replace(/\s+/g, "");
  const password = el.password.value;

  if (!username) {
    notify("Kullanıcı adı boş bırakılamaz.");
    return;
  }

  const email = `${username}@${USERNAME_EMAIL_DOMAIN}`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    notify("Giriş başarısız: kullanıcı adı veya şifre hatalı.");
    return;
  }

  state.user = userFromSupabase(data.user);
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
  const weekStartIso = isoDate(state.weekStart);
  const weekEndIso = isoDate(weekEnd);

  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .gte("reservation_date", weekStartIso)
    .lte("reservation_date", weekEndIso);

  if (error) {
    notify(`Rezervasyonlar yüklenemedi: ${error.message}`);
    return;
  }

  state.reservations = data.sort((a, b) => {
    if (a.reservation_date !== b.reservation_date) {
      return a.reservation_date < b.reservation_date ? -1 : 1;
    }
    return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0;
  });
  state.reservationIndex = buildReservationIndex(state.reservations);
  render();
}

function render() {
  const weekEnd = addDays(state.weekStart, 4);
  el.weekLabel.textContent = `${formatDateTR(state.weekStart)} - ${formatDateTR(weekEnd)}`;
  el.grid.innerHTML = "";
  el.headRow.innerHTML = "";

  days.forEach((day, index) => {
    const date = addDays(state.weekStart, index);
    const head = makeCell(`${day}<div class=\"meta\">${formatDateTR(date)}</div>`, "cell head");
    el.headRow.append(head);
  });

  lessonSlots.forEach(({ start, end, label, altTime }) => {
    const ariaTimeLabel = altTime ? `${start}-${end} / ${altTime}` : `${start}-${end}`;
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
          `${date} ${label} (${ariaTimeLabel}) dolu slot, etkinlik: ${reservation.event_content}`
        );
        slot.innerHTML = `
          <div class="slot-time">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2"></path>
            </svg>
            <span>${label}</span>
          </div>
          <div class="title">${escapeHtml(reservation.event_content)}</div>
        `;
      } else {
        slot.setAttribute(
          "aria-label",
          isBlockedEmptySlot
            ? `${date} ${label} (${ariaTimeLabel}) kapalı slot, neden: ${blockedReason}`
            : `${date} ${label} (${ariaTimeLabel}) boş slot`
        );
        slot.innerHTML = isBlockedEmptySlot
          ? `
          <div class="slot-time">
            <span>${label}</span>
          </div>
          <div class="blocked-label">${escapeHtml(blockedReason)}</div>
        `
          : `
          <div class="slot-time">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2"></path>
            </svg>
            <span>${label}</span>
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
    el.slotSummary.textContent = `Saat: ${el.reservationStart.value} - ${el.reservationEnd.value}`;
    el.slotSummary.classList.remove("hidden");
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
    const slotInfo = lessonSlots.find((slot) => slot.start === start);
    const timeText = slotInfo?.altTime ? `${start} - ${end} / ${slotInfo.altTime}` : `${start} - ${end}`;
    el.slotSummary.textContent = `Saat: ${timeText}`;
    el.slotSummary.classList.remove("hidden");
    el.lessonCountField.classList.remove("hidden");
    const startIndex = lessonSlots.findIndex((slot) => slot.start === start);
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

  const teacherName = profileName(state.user);
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

  const startIndex = lessonSlots.findIndex((slot) => slot.start === startTime);
  if (startIndex < 0) {
    notify("Başlangıç saati geçersiz.");
    return;
  }

  const selectedSlots = lessonSlots.slice(startIndex, startIndex + lessonCount);
  if (selectedSlots.length !== lessonCount) {
    notify("Seçilen ders sayısı gün sonunu aşıyor.");
    return;
  }

  const hasPastSlot = selectedSlots.some((slot) => isPastSlot(reservationDate, slot.start));
  if (hasPastSlot) {
    notify("Geçmiş saatler için rezervasyon eklenemez.");
    return;
  }

  const blockedReason = getBlockedReason(reservationDate);
  if (blockedReason) {
    notify(`${blockedReason} nedeniyle bu tarihe rezervasyon eklenemez.`);
    return;
  }

  const { data: existing, error: fetchError } = await supabase
    .from("reservations")
    .select("start_time")
    .eq("reservation_date", reservationDate);
  if (fetchError) {
    notify(`Kayıt kontrol edilemedi: ${fetchError.message}`);
    return;
  }

  const hasCollision = selectedSlots.some((slot) =>
    existing.some((item) => item.start_time.slice(0, 5) === slot.start)
  );
  if (hasCollision) {
    notify("Seçilen aralıkta dolu saat var. Ders sayısını azaltın veya başka saat seçin.");
    return;
  }

  const newReservations = selectedSlots.map((slot) => ({
    teacher_name: teacherName,
    event_content: eventContent,
    reservation_date: reservationDate,
    start_time: slot.start,
    end_time: slot.end,
    user_id: state.user.id
  }));

  const { error: insertError } = await supabase.from("reservations").insert(newReservations);
  if (insertError) {
    if (insertError.code === "23505") {
      notify("Seçilen aralıkta çakışma var. Kayıt yapılmadı.");
      return;
    }
    notify(`Kayıt başarısız: ${insertError.message}`);
    return;
  }

  for (const item of newReservations) {
    await appendAuditLog({
      action: "added",
      actor: state.user.name,
      reservation_date: item.reservation_date,
      start_time: item.start_time,
      end_time: item.end_time,
      event_content: item.event_content
    });
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

  const deletedInfo = {
    reservation_date: el.reservationDate.value,
    start_time: el.reservationStart.value,
    end_time: el.reservationEnd.value,
    event_content: el.eventContent.value
  };

  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) {
    notify(`Silme başarısız: ${error.message}`);
    return;
  }

  await appendAuditLog({
    action: "deleted",
    actor: state.user.name,
    ...deletedInfo
  });

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

async function openAdminPanel() {
  if (!state.user.isAdmin) {
    notify("Bu bölüme erişim yetkiniz yok.");
    return;
  }

  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    notify(`Denetim kaydı yüklenemedi: ${error.message}`);
    return;
  }

  state.auditLog = data;
  el.adminLogSearch.value = "";
  el.adminLogActionFilter.value = "all";
  renderAuditLog();
  el.adminLogModal.showModal();
}

function renderAuditLog() {
  const search = el.adminLogSearch.value.trim().toLowerCase();
  const actionFilter = el.adminLogActionFilter.value;

  const entries = state.auditLog
    .filter((entry) => actionFilter === "all" || entry.action === actionFilter)
    .filter((entry) => {
      if (!search) return true;
      return (
        entry.actor.toLowerCase().includes(search) ||
        entry.event_content.toLowerCase().includes(search)
      );
    });

  el.adminLogTbody.innerHTML = "";
  el.adminLogEmpty.classList.toggle("hidden", entries.length > 0);

  entries.forEach((entry) => {
    const row = document.createElement("tr");
    const actionLabel = entry.action === "added" ? "Eklendi" : "Silindi";
    row.innerHTML = `
      <td>${escapeHtml(new Date(entry.created_at).toLocaleString("tr-TR"))}</td>
      <td>${escapeHtml(entry.actor)}</td>
      <td><span class="admin-log-badge admin-log-badge-${entry.action}">${actionLabel}</span></td>
      <td>${escapeHtml(entry.reservation_date)} ${escapeHtml(entry.start_time)}-${escapeHtml(entry.end_time)}</td>
      <td>${escapeHtml(entry.event_content)}</td>
    `;
    el.adminLogTbody.append(row);
  });
}

function showApp() {
  el.loginCard.classList.add("hidden");
  el.app.classList.remove("hidden");
  el.adminBtn.classList.toggle("hidden", !state.user.isAdmin);
}

function showLogin() {
  el.app.classList.add("hidden");
  el.loginCard.classList.remove("hidden");
}

function profileName(user) {
  if (!user) return "";
  return user.name || "Öğretmen";
}

function makeCell(content, className) {
  const cell = document.createElement("div");
  cell.className = className;
  cell.innerHTML = content;
  return cell;
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

function sanitizeName(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
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

async function appendAuditLog(entry) {
  const { error } = await supabase.from("audit_log").insert(entry);
  if (error) {
    notify(`Denetim kaydı yazılamadı: ${error.message}`);
  }
}
