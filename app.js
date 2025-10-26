import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// --- Supabase config ---
const supabaseUrl = "https://cvyqiwroddbbyqpyuayq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2eXFpd3JvZGRiYnlxcHl1YXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyOTU5NTQsImV4cCI6MjA3Njg3MTk1NH0.QT8li2H-32sE66UH2sZIBQlGye0dtfL_-LYgaR6yj8M";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- PDF.js worker setup ---
const script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
script.onload = () => {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
};
document.head.appendChild(script);

// --- DOM References ---
const loginDiv = document.getElementById("login"),
  dashboardDiv = document.getElementById("dashboard"),
  adminPanelDiv = document.getElementById("adminPanel"),
  emailInput = document.getElementById("emailInput"),
  passwordInput = document.getElementById("passwordInput"),
  loginBtn = document.getElementById("loginBtn"),
  loginMsg = document.getElementById("loginMsg"),
  userEmailSpan = document.getElementById("userEmail"),
  logoutBtn = document.getElementById("logoutBtn"),
  pdfListDiv = document.getElementById("pdfList"),
  pdfTitleInput = document.getElementById("pdfTitle"),
  pdfFileInput = document.getElementById("pdfFile"),
  uploadPdfBtn = document.getElementById("uploadPdfBtn"),
  adminBtnContainer = document.getElementById("adminBtnContainer"),
  backToDashboardBtn = document.getElementById("backToDashboardBtn"),
  newEmailInput = document.getElementById("newEmailInput"),
  addEmailBtn = document.getElementById("addEmailBtn"),
  whitelistDisplay = document.getElementById("whitelistDisplay");

if (!loginDiv || !dashboardDiv || !adminPanelDiv) {
  alert("HTML structure missing required divs. Please check your index.html.");
  throw new Error("Missing main divs");
}

// --- PDF viewer setup ---
const pdfViewerDiv = document.createElement("div");
pdfViewerDiv.id = "pdfViewer";
pdfViewerDiv.style.display = "none";
document.body.appendChild(pdfViewerDiv);

const closeBtn = document.createElement("button");
closeBtn.id = "closePdfBtn";
closeBtn.textContent = "Close PDF Viewer";
pdfViewerDiv.appendChild(closeBtn);

// --- App State ---
let currentUser = null;
let pdfDoc = null;

// --- Admin Email (lowercase for consistency) ---
const isAdmin = (email) => email.trim().toLowerCase() === "yadneshsaindane7@gmail.com";

// --- UI Show/Hide Functions ---
function showLogin() {
  loginDiv.style.display = "block";
  dashboardDiv.style.display = "none";
  adminPanelDiv.style.display = "none";
  pdfViewerDiv.style.display = "none";
}
function showDashboard() {
  loginDiv.style.display = "none";
  dashboardDiv.style.display = "block";
  adminPanelDiv.style.display = "none";
  pdfViewerDiv.style.display = "none";
  loadPdfs();
}
function showAdminPanel() {
  loginDiv.style.display = "none";
  dashboardDiv.style.display = "none";
  adminPanelDiv.style.display = "block";
  pdfViewerDiv.style.display = "none";
  loadWhitelist();
}
closeBtn.addEventListener("click", showDashboard);
if (backToDashboardBtn) backToDashboardBtn.addEventListener("click", showDashboard);

// --- Login Logic ---
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    loginMsg.textContent = "Please enter your email and password.";
    loginMsg.style.color = "red";
    return;
  }
  loginMsg.textContent = "Logging in...";
  loginMsg.style.color = "blue";

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    loginMsg.textContent = "Login failed: " + error.message;
    loginMsg.style.color = "red";
    return;
  }
  // Session event will handle the rest
});

// --- Auth State and Whitelist Check (with email normalization) ---
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log("Auth state changed:", event, session);
  if (session) {
    currentUser = session.user;
    userEmailSpan.textContent = currentUser.email;

    // Normalize email for whitelist check
    const normalizedEmail = currentUser.email.trim().toLowerCase();
    console.log("Normalized email for whitelist check:", normalizedEmail);

    const { data, error } = await supabase
      .from("whitelist")
      .select("*")
      .eq("email", normalizedEmail)
      .single();

    console.log("Whitelist lookup result:", data, "Error:", error);

    if (!data && !isAdmin(currentUser.email)) {
      alert("Your email is not whitelisted. Contact admin.");
      await supabase.auth.signOut();
      return;
    }

    if (isAdmin(currentUser.email)) {
      adminBtnContainer.innerHTML = `<button id="openAdminBtn">Admin Panel</button>`;
      document
        .getElementById("openAdminBtn")
        .addEventListener("click", showAdminPanel);
    } else adminBtnContainer.innerHTML = "";

    showDashboard();
  } else {
    showLogin();
  }
});

// --- Logout ---
logoutBtn.addEventListener("click", async () => await supabase.auth.signOut());

// --- PDFs ---
async function loadPdfs() {
  pdfListDiv.innerHTML = "Loading...";
  const { data } = await supabase
    .from("pdfs")
    .select("*")
    .order("created_at", { ascending: false }) || { data: [] };

  pdfListDiv.innerHTML = "";
  (data || []).forEach((pdf) => {
    const card = document.createElement("div");
    card.className = "pdf-card";
    card.innerHTML = `<h3>${pdf.title}</h3>
      <small>${new Date(pdf.created_at).toLocaleDateString()}</small><br>
      <button>View PDF</button>`;
    card.querySelector("button").addEventListener("click", () => viewPdf(pdf.url));
    pdfListDiv.appendChild(card);
  });
}

// --- PDF Viewer Logic ---
async function viewPdf(url) {
  showLoading(pdfViewerDiv, true);

  const loadingTask = window.pdfjsLib.getDocument(url);
  pdfDoc = await loadingTask.promise;
  pdfViewerDiv.style.display = "flex";
  dashboardDiv.style.display = "none";
  adminPanelDiv.style.display = "none";

  pdfViewerDiv.querySelectorAll("canvas.pageCanvas").forEach((c) => c.remove());

  for (let num = 1; num <= pdfDoc.numPages; num++) {
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: 1.2 });

    const canvas = document.createElement("canvas");
    canvas.className = "pageCanvas";
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    ctx.globalAlpha = 0.34;
    ctx.font = "bold 38px Arial";
    ctx.fillStyle = "#c62828";
    ctx.save();
    ctx.translate(viewport.width / 2, viewport.height / 2);
    ctx.rotate(-0.3);
    ctx.textAlign = "center";
    ctx.fillText(currentUser.email, 0, 0);
    ctx.restore();

    pdfViewerDiv.insertBefore(canvas, closeBtn);
  }

  showLoading(pdfViewerDiv, false);
}

// --- PDF Upload ---
uploadPdfBtn.addEventListener("click", async () => {
  const file = pdfFileInput.files[0];
  const title = pdfTitleInput.value.trim();
  if (!file || !title) return alert("Enter title and select file.");

  uploadPdfBtn.textContent = "Uploading...";
  uploadPdfBtn.disabled = true;

  const fileName = `${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("pdfs")
    .upload(fileName, file);

  if (uploadError) {
    uploadPdfBtn.textContent = "Upload PDF";
    uploadPdfBtn.disabled = false;
    return alert("Upload failed: " + uploadError.message);
  }

  const { data } = supabase.storage.from("pdfs").getPublicUrl(fileName);
  await supabase.from("pdfs").insert([{ title, url: data.publicUrl }]);

  alert(`Uploaded: ${title}`);
  pdfFileInput.value = "";
  pdfTitleInput.value = "";
  showDashboard();
  uploadPdfBtn.textContent = "Upload PDF";
  uploadPdfBtn.disabled = false;
});

// --- Whitelist Management (Admin) with email normalization ---
addEmailBtn.addEventListener("click", async () => {
  const email = newEmailInput.value.trim().toLowerCase();
  if (!email) return;
  await supabase.from("whitelist").insert([{ email }]);
  newEmailInput.value = "";
  loadWhitelist();
});

async function loadWhitelist() {
  const { data } = await supabase.from("whitelist").select("*");
  whitelistDisplay.innerHTML = (data || [])
    .map((e) => `<li>${e.email}</li>`)
    .join("");
}

// --- Loading Indicator Util ---
function showLoading(container, show) {
  if (show) container.insertAdjacentHTML("afterbegin", "<p>Loading PDF...</p>");
  else container.querySelectorAll("p").forEach((e) => e.remove());
}

// --- Security Controls (No Print/Save/Right-Click) ---
window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && ["p", "s"].includes(e.key.toLowerCase()))
    e.preventDefault();
});

// --- Show Session Dashboard if Already Logged In ---
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    currentUser = session.user;
    userEmailSpan.textContent = currentUser.email;
    showDashboard();
  } else {
    showLogin();
  }
}).catch((err) => {
  console.error("Session fetch error:", err);
  showLogin();
});
