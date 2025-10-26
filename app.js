import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

// Initialize Supabase
const supabaseUrl = "https://cvyqiwroddbbyqpyuayq.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2eXFpd3JvZGRiYnlxcHl1YXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyOTU5NTQsImV4cCI6MjA3Njg3MTk1NH0.QT8li2H-32sE66UH2sZIBQlGye0dtfL_-LYgaR6yj8M";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Elements
const loginDiv = document.getElementById("login");
const dashboardDiv = document.getElementById("dashboard");
const adminPanelDiv = document.getElementById("adminPanel");
const emailInput = document.getElementById("emailInput");
const sendLinkBtn = document.getElementById("sendLinkBtn");
const loginMsg = document.getElementById("loginMsg");
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const pdfListDiv = document.getElementById("pdfList");
const pdfTitleInput = document.getElementById("pdfTitle");
const pdfFileInput = document.getElementById("pdfFile");
const uploadPdfBtn = document.getElementById("uploadPdfBtn");
const adminBtnContainer = document.getElementById("adminBtnContainer");
const backToDashboardBtn = document.getElementById("backToDashboardBtn");
const newEmailInput = document.getElementById("newEmailInput");
const addEmailBtn = document.getElementById("addEmailBtn");
const whitelistDisplay = document.getElementById("whitelistDisplay");

// Viewer elements
const pdfViewerDiv = document.createElement("div");
pdfViewerDiv.id = "pdfViewer";
pdfViewerDiv.style =
  "position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: none; flex-direction: column; align-items: center; justify-content: center;";
document.body.appendChild(pdfViewerDiv);

const pdfCanvas = document.createElement("canvas");
pdfCanvas.id = "pdfCanvas";
pdfCanvas.style = "max-width: 90%; max-height: 90%; border: 1px solid #fff;";
pdfViewerDiv.appendChild(pdfCanvas);

const closeBtn = document.createElement("button");
closeBtn.textContent = "Close Viewer";
closeBtn.style =
  "margin-top: 20px; padding: 10px 20px; background: #f44; color: #fff; border: none; border-radius: 8px;";
pdfViewerDiv.appendChild(closeBtn);

let pdfDoc = null;
let currentUser = null;

// Check admin
function isAdmin(email) {
  return email === "yadneshsaindane7@gmail.com";
}

// UI control functions
function showLogin() {
  loginDiv.style.display = "block";
  dashboardDiv.style.display = "none";
  adminPanelDiv.style.display = "none";
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
  loadWhitelist();
}
closeBtn.onclick = () => {
  pdfViewerDiv.style.display = "none";
  dashboardDiv.style.display = "block";
};

// Send magic link
sendLinkBtn.onclick = async () => {
  const email = emailInput.value.trim();
  if (!email) return alert("Please enter your email");
  loginMsg.textContent = "Sending magic link...";
  try {
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: "https://bca-for-friends.vercel.app" },
    });
    loginMsg.style.color = "green";
    loginMsg.textContent = "Check your email for a login link.";
  } catch (e) {
    loginMsg.style.color = "red";
    loginMsg.textContent = e.message;
  }
};

// Auth state
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    currentUser = session.user;
    userEmailSpan.textContent = currentUser.email;
    const { data, error } = await supabase
      .from("whitelist")
      .select("*")
      .eq("email", currentUser.email)
      .single();
    if (!data && !isAdmin(currentUser.email)) {
      alert("Your email is not whitelisted. Please contact admin.");
      await supabase.auth.signOut();
      return;
    }
    if (isAdmin(currentUser.email)) {
      adminBtnContainer.innerHTML =
        '<button id="openAdminBtn">Admin Panel</button>';
      document
        .getElementById("openAdminBtn")
        .addEventListener("click", showAdminPanel);
    } else adminBtnContainer.innerHTML = "";
    showDashboard();
  } else {
    showLogin();
  }
});

// Logout
logoutBtn.onclick = () => supabase.auth.signOut();

// Load PDFs
async function loadPdfs() {
  pdfListDiv.innerHTML = "Loading PDFs...";
  const { data, error } = await supabase
    .from("pdfs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return (pdfListDiv.innerHTML = error.message);
  if (!data.length)
    return (pdfListDiv.innerHTML = "<p>No PDFs uploaded yet.</p>");

  pdfListDiv.innerHTML = "";
  data.forEach((pdf) => {
    const div = document.createElement("div");
    div.className = "pdf-card";
    div.innerHTML = `<h4>${pdf.title}</h4><small>${new Date(
      pdf.created_at
    ).toLocaleString()}</small><br>
    <button>View PDF</button>`;
    div.querySelector("button").onclick = () => viewPdf(pdf.url, pdf.title);
    pdfListDiv.appendChild(div);
  });
}

// Upload PDF
uploadPdfBtn.onclick = async () => {
  const file = pdfFileInput.files[0];
  const title = pdfTitleInput.value.trim();
  if (!file || !title) return alert("Enter title and select a file!");
  uploadPdfBtn.disabled = true;
  uploadPdfBtn.textContent = "Uploading...";
  try {
    const name = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("pdfs")
      .upload(name, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("pdfs").getPublicUrl(name);
    await supabase.from("pdfs").insert([{ title, url: data.publicUrl }]);
    alert("Uploaded successfully!");
    pdfTitleInput.value = "";
    pdfFileInput.value = "";
    showDashboard();
  } catch (e) {
    alert("Upload failed: " + e.message);
  } finally {
    uploadPdfBtn.textContent = "Upload PDF";
    uploadPdfBtn.disabled = false;
  }
};

// View PDF securely
async function viewPdf(url, title) {
  pdfViewerDiv.style.display = "flex";
  dashboardDiv.style.display = "none";
  const task = pdfjsLib.getDocument(url);
  pdfDoc = await task.promise;
  const page = await pdfDoc.getPage(1);
  const context = pdfCanvas.getContext("2d");
  const viewport = page.getViewport({ scale: 1.4 });
  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;

  // Add watermark with user email
  context.globalAlpha = 0.2;
  context.font = "bold 32px Arial";
  context.fillStyle = "#ff3333";
  context.save();
  context.translate(viewport.width / 2, viewport.height / 2);
  context.rotate(-0.35);
  context.textAlign = "center";
  context.fillText(currentUser.email, 0, 0);
  context.restore();
}

// Whitelist management
addEmailBtn.onclick = async () => {
  const email = newEmailInput.value.trim();
  if (!email) return alert("Enter an email.");
  try {
    await supabase.from("whitelist").insert([{ email }]);
    alert("Added to whitelist!");
    newEmailInput.value = "";
    loadWhitelist();
  } catch (e) {
    alert("Failed: " + e.message);
  }
};

async function loadWhitelist() {
  const { data, error } = await supabase.from("whitelist").select("*");
  whitelistDisplay.innerHTML = error
    ? error.message
    : data.map((e) => `<li>${e.email}</li>`).join("");
}

// Security Enhancements
window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && ["p", "s"].includes(e.key.toLowerCase()))
    e.preventDefault();
  if (e.key === "PrintScreen") e.preventDefault();
});

// Initialize
showLogin();
