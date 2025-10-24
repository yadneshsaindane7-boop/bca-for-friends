import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://cvyqiwroddbbyqpyuayq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2eXFpd3JvZGRiYnlxcHl1YXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyOTU5NTQsImV4cCI6MjA3Njg3MTk1NH0.QT8li2H-32sE66UH2sZIBQlGye0dtfL_-LYgaR6yj8M";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
}

function showDashboard() {
  loginDiv.style.display = "none";
  dashboardDiv.style.display = "block";
  adminPanelDiv.style.display = "none";
  loadPdfs();
}

function showAdminPanel() {
  loginDiv.style.display = "none";
  dashboardDiv.style.display = "none";
  adminPanelDiv.style.display = "block";
  loadWhitelist();
}

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
      emailRedirectTo: window.location.origin,
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
      <button onclick="window.open('${pdf.url}', '_blank')">View PDF</button>
    `;
    pdfListDiv.appendChild(card);
  });
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

// Initialize
showLogin();
