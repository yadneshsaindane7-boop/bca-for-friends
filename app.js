// app.js - Full replacement
// Supabase + secure in-page PDF viewer rendered with PDF.js + watermark + loading + page-count
// ---------------------------------------------------------------------------
// NOTE: This file expects your HTML and CSS (IDs/classes) to match what you provided.
// Replace the supabase keys below if you rotate them later.
// ---------------------------------------------------------------------------

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ---------------- Supabase config (your values) ----------------
const supabaseUrl = "https://cvyqiwroddbbyqpyuayq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2eXFpd3JvZGRiYnlxcHl1YXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyOTU5NTQsImV4cCI6MjA3Njg3MTk1NH0.QT8li2H-32sE66UH2sZIBQlGye0dtfL_-LYgaR6yj8M";
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------------- PDF.js loader ----------------
// We load PDF.js from CDN and set worker path. Rendering will use pdfjsLib.
(function loadPdfJs() {
  const scriptUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const existing = document.querySelector(`script[src="${scriptUrl}"]`);
  if (existing) return;
  const s = document.createElement("script");
  s.src = scriptUrl;
  s.onload = () => {
    try {
      // worker
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      console.log("pdf.js loaded");
    } catch (err) {
      console.warn("pdf.js worker couldn't be configured:", err);
    }
  };
  s.onerror = () => console.warn("Failed to load pdf.js from CDN");
  document.head.appendChild(s);
})();

// ---------------- DOM references ----------------
const loginDiv = document.getElementById("login");
const dashboardDiv = document.getElementById("dashboard");
const adminPanelDiv = document.getElementById("adminPanel");
const profileModal = document.getElementById("profileModal");
const pdfViewerDiv = document.getElementById("pdfViewer");

const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginMsg = document.getElementById("loginMsg");
const userNicknameSpan = document.getElementById("userNickname");
const logoutBtn = document.getElementById("logoutBtn");
const profileBtn = document.getElementById("profileBtn");
const closeProfileBtn = document.getElementById("closeProfileBtn");
const darkModeToggle = document.getElementById("darkModeToggle");
const pdfListDiv = document.getElementById("pdfList");
const adminBtnContainer = document.getElementById("adminBtnContainer");
const uploadPdfBtn = document.getElementById("uploadPdfBtn");
const pdfTitleInput = document.getElementById("pdfTitle");
const pdfFileInput = document.getElementById("pdfFile");
const pdfSubjectSelect = document.getElementById("pdfSubject");
const addUserBtn = document.getElementById("addUserBtn");
const newUserEmail = document.getElementById("newUserEmail");
const newUserNickname = document.getElementById("newUserNickname");

const showYadneshInfo = document.getElementById("showYadneshInfo");
const creatorModal = document.getElementById("creatorModal");
const closeCreatorModal = document.getElementById("closeCreatorModal");

// If your HTML includes fixed buttons inside #pdfViewer (Back/Close) we'll try to use them:
const staticBackToSubjectsBtn = document.getElementById("backToSubjectsBtn");
const staticClosePdfBtn = document.getElementById("closePdfBtn");
const staticPdfFrame = document.getElementById("pdfFrame"); // (we won't use iframe for secure rendering)

// ---------------- App state ----------------
let currentUser = null;              // Supabase user object
let currentUserProfile = null;       // profile row from user_profiles
let currentViewingSubject = null;    // string subject currently used
let currentPdfDoc = null;            // PDFDocumentProxy returned by pdf.js
let currentPdfRenderTasks = [];      // track render tasks to allow cancellation
let currentViewingPdfTitle = null;   // title string for viewer

// ---------------- Theme init ----------------
(function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.className = savedTheme === "dark" ? "dark-mode" : "light-mode";
  function updateIcon() {
    if (!darkModeToggle) return;
    const isDark = document.body.classList.contains("dark-mode");
    darkModeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
  updateIcon();
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-mode");
      document.body.classList.toggle("light-mode");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      updateIcon();
    });
  }
})();

// ---------------- Small helpers ----------------
const isAdminEmail = (email) => (email || "").trim().toLowerCase() === "yadneshsaindane7@gmail.com";

function showElement(el) {
  if (!el) return;
  el.classList.remove("hidden");
  el.classList.add("visible");
  el.style.display = ""; // reset inline style if any
}
function hideElement(el) {
  if (!el) return;
  el.classList.remove("visible");
  el.classList.add("hidden");
  el.style.display = "none";
}
function clearChildren(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}
function createEl(tag, attrs = {}, inner = "") {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === "className") e.className = attrs[k];
    else if (k === "text") e.textContent = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  if (inner) e.innerHTML = inner;
  return e;
}

// ---------------- Navigation screens ----------------
function showLogin() {
  showElement(loginDiv);
  hideElement(dashboardDiv);
  hideElement(adminPanelDiv);
  hideElement(profileModal);
  hidePdfViewer();
}
function showDashboard() {
  hideElement(loginDiv);
  showElement(dashboardDiv);
  hideElement(adminPanelDiv);
  hideElement(profileModal);
  hidePdfViewer();
  loadSubjects();
}
function showAdminPanel() {
  hideElement(loginDiv);
  hideElement(dashboardDiv);
  showElement(adminPanelDiv);
  hidePdfViewer();
  // load admin data
  loadAnalytics();
  loadUserManagement();
  loadActivityLogs();
}

// ---------------- Auth (login / state) ----------------
async function performLogin() {
  if (!emailInput || !passwordInput || !loginMsg) return;
  const email = (emailInput.value || "").trim();
  const password = passwordInput.value || "";
  if (!email || !password) {
    loginMsg.textContent = "Please enter your email and password.";
    loginMsg.style.color = "red";
    return;
  }
  loginMsg.textContent = "Logging in...";
  loginMsg.style.color = "blue";
  try {
    // sign in with password
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      loginMsg.textContent = "Login failed: " + error.message;
      loginMsg.style.color = "red";
      console.warn("Login error:", error);
    } else {
      loginMsg.textContent = "";
      emailInput.value = "";
      passwordInput.value = "";
      // onAuthStateChange will handle navigation
    }
  } catch (err) {
    loginMsg.textContent = "Login error: " + (err.message || err);
    loginMsg.style.color = "red";
    console.error(err);
  }
}

if (loginBtn) loginBtn.addEventListener("click", performLogin);
if (passwordInput) passwordInput.addEventListener("keypress", (e) => { if (e.key === "Enter") performLogin(); });

// listen for authentication state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  // session may be null when signed out
  if (session && session.user) {
    currentUser = session.user;
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("email", currentUser.email.toLowerCase())
        .maybeSingle();
      currentUserProfile = profile || null;
    } catch (e) {
      currentUserProfile = null;
    }

    if (userNicknameSpan) userNicknameSpan.textContent = currentUserProfile?.nickname || currentUser.email.split("@")[0];

    // admin button injection
    if (isAdminEmail(currentUser.email)) {
      adminBtnContainer.innerHTML = `<button id="openAdminBtn" class="primary-btn"><i class="fas fa-user-shield"></i> Admin Panel</button>`;
      const openAdminBtn = document.getElementById("openAdminBtn");
      if (openAdminBtn) openAdminBtn.addEventListener("click", showAdminPanel);
    } else {
      adminBtnContainer.innerHTML = "";
    }

    showDashboard();
  } else {
    currentUser = null;
    currentUserProfile = null;
    showLogin();
  }
});

if (logoutBtn) logoutBtn.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
    // after signOut, onAuthStateChange will show login
  } catch (err) {
    console.error("Sign out error:", err);
  }
});

// ---------------- Profile modal ----------------
if (profileBtn) {
  profileBtn.addEventListener("click", async () => {
    if (!currentUser) return alert("No user is signed in.");
    showElement(profileModal);
    document.getElementById("profileEmail").textContent = currentUser.email;
    document.getElementById("profileNickname").textContent = currentUserProfile?.nickname || "Not set";
    document.getElementById("profileJoined").textContent = new Date(currentUser.created_at).toLocaleDateString();

    try {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("user_email", currentUser.email)
        .order("created_at", { ascending: false })
        .limit(10);
      document.getElementById("userActivityList").innerHTML =
        data?.map(a => `<div class="activity-item"><span><i class="fas fa-eye"></i> ${a.action}: ${a.pdf_title}</span><small>${new Date(a.created_at).toLocaleString()}</small></div>`).join("") || "<p>No activity yet</p>";
    } catch (e) {
      console.error("Failed to load user activity:", e);
    }
  });
}

if (closeProfileBtn) closeProfileBtn.addEventListener("click", () => hideElement(profileModal));

// ---------------- Subjects and PDF list ----------------
async function loadSubjects() {
  if (!pdfListDiv) return;
  pdfListDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading subjects...</p>';

  // Hard-coded subjects (you can load from DB if needed)
  const subjects = ["Data Structure", "Data Communications", "Income Tax", "Marathi", "IKS", "C++"];
  pdfListDiv.innerHTML = "";

  subjects.forEach(subject => {
    const btn = createEl('button', { className: 'subject-btn primary-btn' }, subject);
    btn.style.margin = "5px";
    btn.onclick = () => loadPdfsBySubject(subject);
    pdfListDiv.appendChild(btn);
  });
}

// Loads pdf rows from Supabase where subject matches
async function loadPdfsBySubject(subjectName) {
  currentViewingSubject = subjectName;
  if (!pdfListDiv) return;

  // show top back button + loading indicator
  pdfListDiv.innerHTML = `
    <button id="backToSubjectsBtnGenerated" class="primary-btn" style="margin-bottom:15px;">
      <i class="fas fa-arrow-left"></i> Back to Subjects
    </button>
    <p id="loadingPdfsText"><i class="fas fa-spinner fa-spin"></i> Loading PDFs for "${subjectName}"...</p>
  `;

  const genBackBtn = document.getElementById("backToSubjectsBtnGenerated");
  if (genBackBtn) genBackBtn.onclick = () => { hidePdfViewer(); showDashboard(); };

  try {
    const { data, error } = await supabase
      .from("pdfs")
      .select("*")
      .eq("subject", subjectName)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const loadingNode = document.getElementById("loadingPdfsText");
    if (loadingNode) loadingNode.remove();

    if (!data || data.length === 0) {
      pdfListDiv.innerHTML += `<p>No PDFs available for ${subjectName}.</p>`;
      return;
    }

    data.forEach(pdf => {
      const pdfCard = createEl('div', { className: 'pdf-card' });
      const safeTitle = (pdf.title || "Untitled").replace(/'/g, "\\'");
      pdfCard.innerHTML = `
        <h3><i class="fas fa-file-pdf"></i> ${pdf.title}</h3>
        <small>${new Date(pdf.created_at).toLocaleDateString()}</small>
        <div style="margin-top:8px;">
          <button class="primary-btn view-pdf-btn" data-url="${pdf.url}" data-title="${safeTitle}">
            <i class="fas fa-eye"></i> View PDF
          </button>
        </div>
      `;
      pdfListDiv.appendChild(pdfCard);
    });

    // Attach view listeners
    pdfListDiv.querySelectorAll(".view-pdf-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const url = btn.getAttribute("data-url");
        const title = btn.getAttribute("data-title");
        if (url) window.viewPdf(url, title);
      });
    });
  } catch (err) {
    console.error("Error loading PDFs:", err);
    pdfListDiv.innerHTML += `<p>Error loading PDFs: ${err.message || err}</p>`;
  }
}
window.loadPdfsBySubject = loadPdfsBySubject; // for debugging / global access

// ---------------- Viewer controls & security ----------------

// Prevent common operations while viewer is visible
function disableShortcutsWhileViewing(e) {
  if (!pdfViewerDiv || pdfViewerDiv.classList.contains("hidden")) return;
  // block Ctrl/Cmd+P (print), Ctrl/Cmd+S (save), Ctrl/Cmd+U (view-source)
  if ((e.ctrlKey || e.metaKey) && ["p", "s", "u"].includes(e.key.toLowerCase())) {
    e.preventDefault();
    e.stopPropagation();
  }
  // block F12 & Ctrl+Shift+I (devtools)
  if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "i")) {
    e.preventDefault();
    e.stopPropagation();
  }
}
function preventContextIfViewing(e) {
  if (!pdfViewerDiv) return;
  if (!pdfViewerDiv.classList.contains("hidden")) {
    e.preventDefault();
    e.stopPropagation();
  }
}
document.addEventListener("contextmenu", preventContextIfViewing, true);
document.addEventListener("keydown", disableShortcutsWhileViewing, true);
document.addEventListener("copy", (e) => {
  if (!pdfViewerDiv) return;
  if (!pdfViewerDiv.classList.contains("hidden")) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

// ---------------- Rendering / Watermark / Loading UI ----------------

// We'll render the PDF pages onto canvases inside #pdfViewer and overlay a watermark (user email).
// We will also show a small top area with spinner + page-count which updates while rendering.

function showPdfViewer() {
  if (!pdfViewerDiv) return;
  pdfViewerDiv.classList.remove("hidden");
  pdfViewerDiv.classList.add("visible");
  pdfViewerDiv.style.display = "flex";
  pdfViewerDiv.style.flexDirection = "column";
  document.body.style.overflow = "hidden"; // prevent background scroll
}
function hidePdfViewer() {
  if (!pdfViewerDiv) return;
  pdfViewerDiv.classList.remove("visible");
  pdfViewerDiv.classList.add("hidden");
  pdfViewerDiv.style.display = "none";
  document.body.style.overflow = "";
  clearChildren(pdfViewerDiv);
  // cancel/destroy pdf doc
  try { if (currentPdfDoc) { currentPdfDoc.destroy(); currentPdfDoc = null; } } catch (e) {}
}

// Helper: create top loading + page count element
function makeLoadingTopbar() {
  const topbar = createEl('div', { className: 'pdf-topbar' });
  topbar.style.width = "100%";
  topbar.style.display = "flex";
  topbar.style.justifyContent = "space-between";
  topbar.style.alignItems = "center";
  topbar.style.padding = "12px 18px";
  topbar.style.boxSizing = "border-box";
  topbar.style.background = "linear-gradient(90deg, rgba(0,0,0,0.18), rgba(0,0,0,0.08))";
  topbar.style.backdropFilter = "blur(6px)";
  topbar.style.position = "sticky";
  topbar.style.top = "0";
  topbar.style.zIndex = "10002";

  topbar.innerHTML = `
    <div style="display:flex; gap:10px; align-items:center;">
      <button id="top_backToSubjects" class="secondary-btn"><i class="fas fa-arrow-left"></i> Back to Subjects</button>
      <button id="top_closePdf" class="danger-btn"><i class="fas fa-times"></i> Close PDF</button>
    </div>
    <div style="display:flex; gap:12px; align-items:center; font-weight:700; color:#fff;">
      <div id="top_loadingSpinner"><i class="fas fa-spinner fa-spin"></i> Loading</div>
      <div id="top_pageCount"></div>
    </div>
    <div style="min-width:120px; text-align:right; color:#fff; font-weight:700;">
      <span id="top_docTitle"></span>
    </div>
  `;
  return topbar;
}

/**
 * renderPdfInViewer(url, watermarkText)
 * - url: public URL of PDF (Supabase public URL)
 * - watermarkText: string to draw on each page (user email)
 */
async function renderPdfInViewer(url, watermarkText) {
  // wait until pdfjsLib is available (timeout fallback)
  if (!window.pdfjsLib) {
    await new Promise((resolve) => {
      let attempts = 0;
      const t = setInterval(() => {
        attempts++;
        if (window.pdfjsLib || attempts > 200) { // ~10s max
          clearInterval(t);
          resolve();
        }
      }, 50);
    });
  }
  if (!window.pdfjsLib) {
    alert("PDF library failed to load. Please check network connectivity.");
    return;
  }

  // cleanup old stuff
  currentPdfRenderTasks.forEach(task => { try { if (task && task.cancel) task.cancel(); } catch(e){} });
  currentPdfRenderTasks = [];
  clearChildren(pdfViewerDiv);

  // Insert topbar + canvas container
  const topbar = makeLoadingTopbar();
  pdfViewerDiv.appendChild(topbar);

  // grab topbar controls / indicators for use later
  const topBackBtn = topbar.querySelector('#top_backToSubjects');
  const topCloseBtn = topbar.querySelector('#top_closePdf');
  const topLoadingSpinner = topbar.querySelector('#top_loadingSpinner');
  const topPageCount = topbar.querySelector('#top_pageCount');
  const topDocTitle = topbar.querySelector('#top_docTitle');

  // wire topbar buttons - ensure they take user back to the subject's PDF list (Option A)
  if (topBackBtn) {
    topBackBtn.addEventListener('click', () => {
      try { if (currentPdfDoc) { currentPdfDoc.destroy(); currentPdfDoc = null; } } catch (e) {}
      clearChildren(pdfViewerDiv);
      hidePdfViewer();
      // Show dashboard and load the subject's PDF list so user returns to same subject
      if (currentViewingSubject) {
        showElement(dashboardDiv);
        loadPdfsBySubject(currentViewingSubject);
      } else {
        showDashboard();
      }
    });
  }
  if (topCloseBtn) {
    topCloseBtn.addEventListener('click', () => {
      try { if (currentPdfDoc) { currentPdfDoc.destroy(); currentPdfDoc = null; } } catch (e) {}
      clearChildren(pdfViewerDiv);
      hidePdfViewer();
      if (currentViewingSubject) {
        // show subject list (keeps same behavior as opening the subject)
        showElement(dashboardDiv);
        loadPdfsBySubject(currentViewingSubject);
      } else {
        showDashboard();
      }
    });
  }

  const canvasWrap = createEl('div', { id: 'pdfCanvasWrap' });
  canvasWrap.style.width = "100%";
  canvasWrap.style.maxWidth = "1200px";
  canvasWrap.style.margin = "18px auto";
  canvasWrap.style.display = "flex";
  canvasWrap.style.flexDirection = "column";
  canvasWrap.style.alignItems = "center";
  canvasWrap.style.gap = "22px";
  canvasWrap.style.padding = "12px";
  pdfViewerDiv.appendChild(canvasWrap);

  // show viewer
  showPdfViewer();

  // set doc title in topbar if available
  if (topDocTitle) topDocTitle.textContent = currentViewingPdfTitle || "";

  // Load the PDF via pdfjs
  let loadingTask;
  try {
    loadingTask = window.pdfjsLib.getDocument({ url, withCredentials: false });
  } catch (e) {
    console.error("pdfjs getDocument failed:", e);
    alert("Could not start loading the PDF.");
    return;
  }

  try {
    currentPdfDoc = await loadingTask.promise;
  } catch (err) {
    console.error("Error loading PDF:", err);
    alert("Failed to load PDF: " + (err.message || err));
    clearChildren(pdfViewerDiv);
    hidePdfViewer();
    return;
  }

  // Now render pages sequentially
  const total = currentPdfDoc.numPages || 0;
  if (topPageCount) topPageCount.textContent = `0 / ${total}`;

  // Show spinner + page count while rendering
  if (topLoadingSpinner) topLoadingSpinner.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Rendering...`;

  // render pages
  for (let pageNum = 1; pageNum <= total; pageNum++) {
    // if viewer closed externally, break
    if (!pdfViewerDiv || pdfViewerDiv.classList.contains("hidden")) break;

    // update page count UI
    if (topPageCount) topPageCount.textContent = `${pageNum} / ${total}`;

    try {
      const page = await currentPdfDoc.getPage(pageNum);

      // compute scale to fit to window width nicely
      const initialViewport = page.getViewport({ scale: 1.5 });
      // choose canvas width up to 92vw but not exceeding page width
      const maxWidth = Math.min(initialViewport.width, Math.floor(window.innerWidth * 0.92));
      const scale = maxWidth / initialViewport.width;
      const renderViewport = page.getViewport({ scale: initialViewport.scale * scale / (initialViewport.scale) }); // simplify scale in practice
      // safer: compute final scale from ratio
      const finalScale = (maxWidth / initialViewport.width) * 1.0 * 1.0; // base multiplier 1; adjust if you want crispness

      const viewport = page.getViewport({ scale: finalScale });

      // create canvas of computed size
      const canvas = document.createElement("canvas");
      canvas.className = "pageCanvas";
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      canvas.style.maxWidth = "92vw";
      canvas.style.borderRadius = "10px";
      canvas.style.background = "#fff";
      canvas.style.boxShadow = "0 10px 40px rgba(0,0,0,0.25)";

      const ctx = canvas.getContext("2d");
      // white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: ctx,
        viewport
      };

      const renderTask = page.render(renderContext);
      currentPdfRenderTasks.push(renderTask);

      // show small per-page loader overlay (optional)
      const pageLoader = createEl('div', { className: 'page-loader' }, `<i class="fas fa-spinner fa-spin"></i>`);
      // we don't show loader overlay on canvas to keep things simple; spinner in topbar suffices

      try {
        await renderTask.promise;
      } catch (renderErr) {
        console.warn("Render error for page", pageNum, renderErr);
        continue; // try next page
      }

      // watermark: draw centered rotated text (user email)
      if (watermarkText) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        // font size relative to width
        const fontSize = Math.max(18, Math.floor(canvas.width / 22));
        ctx.font = `900 ${fontSize}px Arial`;
        ctx.fillStyle = "#ff2323ff";
        // center & rotate
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-0.5);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(watermarkText, 0, 0);
        ctx.restore();
      }

      canvasWrap.appendChild(canvas);

      // brief pause to keep UI smooth on big docs
      await new Promise(r => setTimeout(r, 40));
    } catch (pageErr) {
      console.error("Page rendering failed:", pageErr);
    }
  }

  // rendering done - update spinner
  if (topLoadingSpinner) topLoadingSpinner.innerHTML = `<i class="fas fa-check-circle"></i> Rendered`;

  // final adjustments: scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
  // clear task references
  currentPdfRenderTasks = [];
}

// ---------------- viewPdf public function ----------------
// Called by generated "View PDF" buttons. Accepts public URL (from Supabase) & title.
window.viewPdf = async (url, title) => {
  if (!currentUser || !currentUser.email) {
    alert("You must be logged in to view PDFs.");
    return;
  }

  currentViewingPdfTitle = title || "Document";

  // log view activity (best-effort)
  try {
    await supabase.from("activity_logs").insert([
      { user_email: currentUser.email, pdf_title: currentViewingPdfTitle, action: "Viewed" }
    ]);
  } catch (e) {
    console.warn("Activity log insert failed:", e);
  }

  // hide other views and render securely in-page with watermark = full email
  hideElement(dashboardDiv);
  hideElement(adminPanelDiv);

  // ensure viewer visible and empty then render
  clearChildren(pdfViewerDiv);
  showPdfViewer();
  // disable global copy/print etc already installed globally: they check viewer visibility

  try {
    await renderPdfInViewer(url, currentUser.email);
  } catch (err) {
    console.error("renderPdfInViewer error:", err);
    alert("Failed to render PDF.");
    hidePdfViewer();
    showDashboard();
  }
};

// ---------------- Wire static controls (if present in HTML) ----------------
if (staticBackToSubjectsBtn) {
  staticBackToSubjectsBtn.addEventListener("click", () => {
    try { if (currentPdfDoc) { currentPdfDoc.destroy(); currentPdfDoc = null; } } catch(e){}
    clearChildren(pdfViewerDiv);
    hidePdfViewer();
    showDashboard();
  });
}
if (staticClosePdfBtn) {
  staticClosePdfBtn.addEventListener("click", () => {
    try { if (currentPdfDoc) { currentPdfDoc.destroy(); currentPdfDoc = null; } } catch(e){}
    clearChildren(pdfViewerDiv);
    hidePdfViewer();
    if (currentViewingSubject) loadPdfsBySubject(currentViewingSubject);
    else showDashboard();
  });
}

// ---------------- Upload PDF (admin) ----------------
if (uploadPdfBtn) {
  uploadPdfBtn.addEventListener("click", async () => {
    const file = pdfFileInput?.files?.[0];
    const title = (pdfTitleInput?.value || "").trim();
    const subject = pdfSubjectSelect?.value;

    if (!file) return alert("❌ Please select a PDF file.");
    if (!title) return alert("❌ Please enter a PDF title.");
    if (!subject) return alert("❌ Please select a subject.");
    if (file.type !== "application/pdf") return alert("❌ Please select a valid PDF file.");

    uploadPdfBtn.disabled = true;
    const oldHtml = uploadPdfBtn.innerHTML;
    uploadPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      // get public url
      const { data: urlData } = supabase.storage.from("pdfs").getPublicUrl(fileName);
      const publicUrl = urlData?.publicUrl || urlData?.public_url || null;
      if (!publicUrl) throw new Error("Failed to obtain public URL for uploaded PDF.");

      const { data: insertData, error: insertError } = await supabase
        .from("pdfs")
        .insert([{ title, url: publicUrl, subject }]);

      if (insertError) throw insertError;

      alert(`✅ Uploaded: ${title}`);
      pdfFileInput.value = "";
      pdfTitleInput.value = "";
      if (pdfSubjectSelect) pdfSubjectSelect.value = "";
      await loadAnalytics();
      showDashboard();
    } catch (err) {
      console.error("Upload error:", err);
      alert("❌ Upload failed: " + (err.message || err));
    } finally {
      uploadPdfBtn.disabled = false;
      uploadPdfBtn.innerHTML = oldHtml;
    }
  });
}

// ---------------- Analytics & Admin helpers ----------------
async function loadAnalytics() {
  try {
    const { data: pdfs } = await supabase.from("pdfs").select("*");
    const { data: logs } = await supabase.from("activity_logs").select("*");
    const { data: profiles } = await supabase.from("user_profiles").select("*");
    const yesterdayISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase.from("activity_logs").select("*").gte("created_at", yesterdayISO);

    document.getElementById("totalUsers").textContent = profiles?.length || 0;
    document.getElementById("totalPdfs").textContent = pdfs?.length || 0;
    document.getElementById("totalViews").textContent = logs?.length || 0;
    document.getElementById("recentActivity").textContent = recent?.length || 0;
  } catch (e) {
    console.error("Analytics load error:", e);
  }
}

if (addUserBtn) {
  addUserBtn.addEventListener("click", async () => {
    const email = (newUserEmail?.value || "").trim().toLowerCase();
    const nickname = (newUserNickname?.value || "").trim();
    if (!email || !nickname) return alert("Enter both email and nickname");
    try {
      const { error } = await supabase.from("user_profiles").insert([{ email, nickname }]);
      if (error) throw error;
      alert(`✅ User profile created!\nEmail: ${email}\nNickname: ${nickname}\n\nNow add them in Supabase Auth Dashboard.`);
      newUserEmail.value = "";
      newUserNickname.value = "";
      loadUserManagement();
    } catch (err) {
      alert("Error creating profile: " + (err.message || err));
      console.error(err);
    }
  });
}

async function loadUserManagement() {
  try {
    const { data } = await supabase.from("user_profiles").select("*");
    document.getElementById("userManagementList").innerHTML = data?.map(p => `
      <div class="user-card">
        <div class="user-card-info">
          <strong><i class="fas fa-user"></i> ${p.nickname}</strong>
          <br><small>${p.email}</small>
        </div>
        <div class="user-card-actions">
          <button class="secondary-btn" onclick="window.viewActivity('${p.email}')"><i class="fas fa-chart-line"></i> Activity</button>
          <button class="delete-btn" onclick="window.deleteProfile('${p.email}')"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>
    `).join('') || '<p>No users yet</p>';
  } catch (e) {
    console.error("loadUserManagement error:", e);
  }
}

window.deleteProfile = async (email) => {
  if (!confirm(`Delete ${email}?`)) return;
  try {
    await supabase.from("user_profiles").delete().eq("email", email);
    alert("✅ Deleted");
    loadUserManagement();
  } catch (err) {
    alert("Delete failed: " + (err.message || err));
  }
};

window.viewActivity = async (email) => {
  try {
    const { data } = await supabase.from("activity_logs").select("*").eq("user_email", email).order("created_at", { ascending: false }).limit(20);
    alert(`Activity for ${email}:\n\n${data?.map(a => `${a.action}: ${a.pdf_title} - ${new Date(a.created_at).toLocaleString()}`).join('\n') || 'No activity'}`);
  } catch (err) {
    alert("Failed to fetch activity: " + (err.message || err));
  }
};

async function loadActivityLogs() {
  try {
    const { data } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50);
    document.getElementById("activityLogsList").innerHTML = data?.map(log => `
      <div class="activity-item">
        <span><i class="fas fa-user"></i> <strong>${log.user_email}</strong> ${log.action} <em>"${log.pdf_title}"</em></span>
        <small>${new Date(log.created_at).toLocaleString()}</small>
      </div>
    `).join('') || '<p>No activity yet</p>';
  } catch (err) {
    console.error("loadActivityLogs error:", err);
  }
}

// ---------------- Security: global context/keyboard/copy prevention if viewer is open ----------------
// (already installed above, but double-check and be defensive)
window.addEventListener("contextmenu", (e) => {
  if (pdfViewerDiv && !pdfViewerDiv.classList.contains("hidden")) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);
window.addEventListener("keydown", (e) => {
  if (pdfViewerDiv && !pdfViewerDiv.classList.contains("hidden")) {
    const blocked = ["p", "s", "u"];
    if ((e.ctrlKey || e.metaKey) && blocked.includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}, true);

// ---------------- Session check on load ----------------
(async function checkSessionOnLoad() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) showLogin();
    // if there is a session, onAuthStateChange already covers UI because we set handler above
  } catch (err) {
    console.warn("Session check failed:", err);
    showLogin();
  }
})();

// ---------------- Footer & Creator modal handlers ----------------
if (showYadneshInfo) {
  showYadneshInfo.addEventListener("click", (e) => {
    e.preventDefault();
    window.open("https://yadneshportfolio.vercel.app/", "_blank");
  });
}
if (closeCreatorModal) closeCreatorModal.addEventListener("click", () => creatorModal.classList.add("hidden"));
window.addEventListener("click", (event) => {
  if (event.target === creatorModal) creatorModal.classList.add("hidden");
});

// ---------------- Footer time display ----------------
function updateFooterTime() {
  const footerTime = document.getElementById("footerTime");
  if (!footerTime) return;
  const now = new Date();
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  footerTime.textContent = now.toLocaleTimeString() + " | " + now.toLocaleDateString(undefined, options);
}
setInterval(updateFooterTime, 1000);
updateFooterTime();

// ---------------- End of file ----------------
