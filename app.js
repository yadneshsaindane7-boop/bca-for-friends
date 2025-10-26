import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://cvyqiwroddbbyqpyuayq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2eXFpd3JvZGRiYnlxcHl1YXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyOTU5NTQsImV4cCI6MjA3Njg3MTk1NH0.QT8li2H-32sE66UH2sZIBQlGye0dtfL_-LYgaR6yj8M";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configure PDF.js Worker - THIS WAS MISSING!
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
script.onload = () => {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
};
document.head.appendChild(script);

// DOM Elements
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

// Create PDF Viewer Elements
const pdfViewerDiv = document.createElement("div");
pdfViewerDiv.id = "pdfViewer";
pdfViewerDiv.style.display = "none";
document.body.appendChild(pdfViewerDiv);

const pdfCanvas = document.createElement("canvas");
pdfCanvas.id = "pdfCanvas";
pdfViewerDiv.appendChild(pdfCanvas);

const closeBtn = document.createElement("button");
closeBtn.textContent = "Close PDF";
closeBtn.id = "closePdfBtn";
pdfViewerDiv.appendChild(closeBtn);

let pdfDoc = null;
let currentUser = null;

// Check if user is admin
function isAdmin(email) {
  return email === 'yadneshsaindane7@gmail.com';
}

// Show/Hide sections
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

// Close PDF viewer
closeBtn.addEventListener("click", () => {
  pdfViewerDiv.style.display = "none";
  showDashboard();
});

// Send magic link
sendLinkBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    loginMsg.textContent = "Please enter your email";
    loginMsg.style.color = "red";
    return;
  }

  loginMsg.textContent = "Sending magic link...";
  loginMsg.style.color = "blue";

  const { error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo: 'https://bca-for-friends.vercel.app',
    },
  });

  if (error) {
    loginMsg.textContent = "Error: " + error.message;
    loginMsg.style.color = "red";
  } else {
    loginMsg.textContent = "Magic link sent! Check your email.";
    loginMsg.style.color = "green";
  }
});

// Monitor auth state
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    currentUser = session.user;
    userEmailSpan.textContent = currentUser.email;
    
    // Check if user is in whitelist
    const { data, error } = await supabase
      .from('whitelist')
      .select('*')
      .eq('email', currentUser.email)
      .single();
    
    if (!data && !isAdmin(currentUser.email)) {
      alert('Your email is not whitelisted. Please contact admin.');
      await supabase.auth.signOut();
      return;
    }
    
    // Show admin button if admin
    if (isAdmin(currentUser.email)) {
      adminBtnContainer.innerHTML = '<button id="openAdminBtn" style="margin:10px;">Admin Panel</button>';
      document.getElementById('openAdminBtn').addEventListener('click', showAdminPanel);
    } else {
      adminBtnContainer.innerHTML = '';
    }
    
    showDashboard();
  } else {
    currentUser = null;
    showLogin();
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

// Back to dashboard
backToDashboardBtn.addEventListener("click", showDashboard);

// Load PDFs
async function loadPdfs() {
  pdfListDiv.innerHTML = "Loading PDFs...";
  
  const { data, error } = await supabase
    .from('pdfs')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    pdfListDiv.innerHTML = "Error loading PDFs: " + error.message;
    return;
  }
  
  if (!data || data.length === 0) {
    pdfListDiv.innerHTML = "<p>No PDFs uploaded yet.</p>";
    return;
  }
  
  pdfListDiv.innerHTML = "";
  data.forEach(pdf => {
    const card = document.createElement("div");
    card.className = "pdf-card";
    card.innerHTML = `
      <h3>${pdf.title}</h3>
      <small>Uploaded: ${new Date(pdf.created_at).toLocaleDateString()}</small><br/>
      <button class="view-pdf-btn">View PDF</button>
    `;
    
    // Add click event to view PDF securely
    card.querySelector('.view-pdf-btn').addEventListener('click', () => {
      viewPdf(pdf.url, pdf.title);
    });
    
    pdfListDiv.appendChild(card);
  });
}

// FIXED: Secure PDF Viewer with Watermark
async function viewPdf(url, title) {
  try {
    console.log("Loading PDF from:", url);
    
    // Show viewer
    pdfViewerDiv.style.display = "flex";
    dashboardDiv.style.display = "none";
    
    // Wait for PDF.js to load
    if (!window.pdfjsLib) {
      await new Promise(resolve => {
        const checkPdfJs = setInterval(() => {
          if (window.pdfjsLib) {
            clearInterval(checkPdfJs);
            resolve();
          }
        }, 100);
      });
    }
    
    // Load PDF document
    const loadingTask = window.pdfjsLib.getDocument(url);
    pdfDoc = await loadingTask.promise;
    
    // Get first page
    const page = await pdfDoc.getPage(1);
    const context = pdfCanvas.getContext("2d");
    const viewport = page.getViewport({ scale: 1.2 });
    
    // Set canvas size
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    
    // Clear canvas with white background
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);
    
    // Render PDF page
    await page.render({ canvasContext: context, viewport }).promise;
    
    // Add watermark with user email
    context.globalAlpha = 0.15;
    context.font = "bold 24px Arial";
    context.fillStyle = "#ff0000";
    context.save();
    context.translate(viewport.width / 2, viewport.height / 2);
    context.rotate(-0.3);
    context.textAlign = "center";
    context.fillText(currentUser.email, 0, 0);
    context.restore();
    context.globalAlpha = 1.0;
    
    console.log("PDF rendered successfully");
    
  } catch (error) {
    console.error("PDF render error:", error);
    alert("Error loading PDF: " + error.message);
    showDashboard();
  }
}

// Upload PDF
uploadPdfBtn.addEventListener("click", async () => {
  const file = pdfFileInput.files[0];
  const title = pdfTitleInput.value.trim();
  
  if (!file) {
    alert("Please select a PDF file");
    return;
  }
  
  if (!title) {
    alert("Please enter a title");
    return;
  }
  
  uploadPdfBtn.textContent = "Uploading...";
  uploadPdfBtn.disabled = true;
  
  try {
    // Generate unique filename
    const fileName = `${Date.now()}_${file.name}`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('pdfs')
      .getPublicUrl(fileName);
    
    const publicURL = urlData.publicUrl;
    
    // Save to database
    const { error: dbError } = await supabase
      .from('pdfs')
      .insert([{ title, url: publicURL }]);
    
    if (dbError) throw dbError;
    
    alert("PDF uploaded successfully!");
    pdfTitleInput.value = "";
    pdfFileInput.value = "";
    showDashboard();
    
  } catch (error) {
    alert("Upload failed: " + error.message);
  } finally {
    uploadPdfBtn.textContent = "Upload PDF";
    uploadPdfBtn.disabled = false;
  }
});

// Load whitelist
async function loadWhitelist() {
  whitelistDisplay.innerHTML = "Loading...";
  
  const { data, error } = await supabase
    .from('whitelist')
    .select('*')
    .order('added_at', { ascending: false });
  
  if (error) {
    whitelistDisplay.innerHTML = "Error: " + error.message;
    return;
  }
  
  whitelistDisplay.innerHTML = "";
  data.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.email;
    whitelistDisplay.appendChild(li);
  });
}

// Add email to whitelist
addEmailBtn.addEventListener("click", async () => {
  const email = newEmailInput.value.trim();
  
  if (!email) {
    alert("Please enter an email");
    return;
  }
  
  const { error } = await supabase
    .from('whitelist')
    .insert([{ email }]);
  
  if (error) {
    alert("Error: " + error.message);
  } else {
    alert("Email added to whitelist!");
    newEmailInput.value = "";
    loadWhitelist();
  }
});

// Security Features
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['p', 's', 'a'].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
  if (e.key === 'PrintScreen') {
    e.preventDefault();
  }
});

// Initialize
showLogin();
