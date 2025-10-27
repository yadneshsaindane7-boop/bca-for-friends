import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const { set: idbSet, get: idbGet, keys: idbKeys, del: idbDel } = window.idbKeyval;
// Supabase config
const supabaseUrl = "https://cvyqiwroddbbyqpyuayq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2eXFpd3JvZGRiYnlxcHl1YXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyOTU5NTQsImV4cCI6MjA3Njg3MTk1NH0.QT8li2H-32sE66UH2sZIBQlGye0dtfL_-LYgaR6yj8M";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// PDF.js setup
const script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
script.onload = () => {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
};
document.head.appendChild(script);

// App state
let currentUser = null;
let currentUserProfile = null;
let pdfDoc = null;

// Admin check
const isAdmin = (email) => email.trim().toLowerCase() === "yadneshsaindane7@gmail.com";

// PDF Viewer
const pdfViewerDiv = document.createElement("div");
pdfViewerDiv.id = "pdfViewer";
pdfViewerDiv.style.display = "none";
document.body.appendChild(pdfViewerDiv);

const closeBtn = document.createElement("button");
closeBtn.id = "closePdfBtn";
closeBtn.className = "primary-btn";
closeBtn.innerHTML = '<i class="fas fa-times"></i> Close PDF';
pdfViewerDiv.appendChild(closeBtn);

// Dark Mode
const savedTheme = localStorage.getItem("theme") || "light";
document.body.className = savedTheme === "dark" ? "dark-mode" : "light-mode";

// Wait for DOM
window.addEventListener('load', () => {
  console.log("App loaded");
  
  // DOM Elements
  const loginDiv = document.getElementById("login");
  const dashboardDiv = document.getElementById("dashboard");
  const adminPanelDiv = document.getElementById("adminPanel");
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  const loginBtn = document.getElementById("loginBtn");
  const loginMsg = document.getElementById("loginMsg");
  const userNicknameSpan = document.getElementById("userNickname");
  const logoutBtn = document.getElementById("logoutBtn");
  const profileBtn = document.getElementById("profileBtn");
  const darkModeToggle = document.getElementById("darkModeToggle");
  const profileModal = document.getElementById("profileModal");
  const closeProfileBtn = document.getElementById("closeProfileBtn");
  const pdfListDiv = document.getElementById("pdfList");
  const adminBtnContainer = document.getElementById("adminBtnContainer");
  const backToDashboardBtn = document.getElementById("backToDashboardBtn");

  // Admin elements
  const uploadPdfBtn = document.getElementById("uploadPdfBtn");
  const pdfTitleInput = document.getElementById("pdfTitle");
  const pdfFileInput = document.getElementById("pdfFile");
  const addUserBtn = document.getElementById("addUserBtn");
  const newUserEmail = document.getElementById("newUserEmail");
  const newUserNickname = document.getElementById("newUserNickname");

  // Update dark mode icon
  function updateDarkModeIcon() {
    const isDark = document.body.classList.contains("dark-mode");
    darkModeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
  updateDarkModeIcon();

  // Dark mode toggle
  darkModeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-mode");
    document.body.classList.toggle("light-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    updateDarkModeIcon();
  });

  // UI Functions
  function showLogin() {
    console.log("Showing login");
    loginDiv.className = "visible";
    dashboardDiv.className = "hidden";
    adminPanelDiv.className = "hidden";
    profileModal.className = "modal hidden";
    pdfViewerDiv.style.display = "none";
  }

  function showDashboard() {
    console.log("Showing dashboard");
    loginDiv.className = "hidden";
    dashboardDiv.className = "visible";
    adminPanelDiv.className = "hidden";
    profileModal.className = "modal hidden";
    pdfViewerDiv.style.display = "none";
    loadPdfs();
  }

  function showAdminPanel() {
    console.log("Showing admin panel");
    loginDiv.className = "hidden";
    dashboardDiv.className = "hidden";
    adminPanelDiv.className = "visible";
    pdfViewerDiv.style.display = "none";
    loadAnalytics();
    loadUserManagement();
    loadActivityLogs();
  }

  // Login
  async function performLogin() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      loginMsg.textContent = "Please enter your email and password.";
      loginMsg.style.color = "red";
      return;
    }
    loginMsg.textContent = "Logging in...";
    loginMsg.style.color = "blue";

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      loginMsg.textContent = "Login failed: " + error.message;
      loginMsg.style.color = "red";
    } else {
      loginMsg.textContent = "";
      emailInput.value = "";
      passwordInput.value = "";
    }
  }

  loginBtn.addEventListener("click", performLogin);
  passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") performLogin();
  });
  emailInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") passwordInput.focus();
  });

  // Auth State
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log("Auth:", event, session?.user?.email);
    
    if (session) {
      currentUser = session.user;
      
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("email", currentUser.email.toLowerCase())
        .maybeSingle();
      
      currentUserProfile = profile;
      userNicknameSpan.textContent = profile?.nickname || currentUser.email.split('@')[0];

      if (isAdmin(currentUser.email)) {
        adminBtnContainer.innerHTML = `<button id="openAdminBtn" class="primary-btn"><i class="fas fa-user-shield"></i> Admin Panel</button>`;
        document.getElementById("openAdminBtn").addEventListener("click", showAdminPanel);
      } else {
        adminBtnContainer.innerHTML = "";
      }

      showDashboard();
    } else {
      showLogin();
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });

  // Profile
  profileBtn.addEventListener("click", async () => {
    profileModal.className = "modal visible";
    document.getElementById("profileEmail").textContent = currentUser.email;
    document.getElementById("profileNickname").textContent = currentUserProfile?.nickname || "Not set";
    document.getElementById("profileJoined").textContent = new Date(currentUser.created_at).toLocaleDateString();
    
    const { data } = await supabase.from("activity_logs").select("*").eq("user_email", currentUser.email).order("created_at", { ascending: false }).limit(10);
    document.getElementById("userActivityList").innerHTML = data?.map(a => `
      <div class="activity-item">
        <span><i class="fas fa-eye"></i> ${a.action}: ${a.pdf_title}</span>
        <small>${new Date(a.created_at).toLocaleString()}</small>
      </div>
    `).join('') || '<p>No activity yet</p>';
  });

  closeProfileBtn.addEventListener("click", () => {
    profileModal.className = "modal hidden";
  });

  // PDFs
  async function loadPdfs() {
    pdfListDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    const { data } = await supabase.from("pdfs").select("*").order("created_at", { ascending: false });
    pdfListDiv.innerHTML = data?.map(pdf => `
      <div class="pdf-card">
        <h3><i class="fas fa-file-pdf"></i> ${pdf.title}</h3>
        <small>${new Date(pdf.created_at).toLocaleDateString()}</small>
        <button class="primary-btn" onclick="window.viewPdf('${pdf.url}', '${pdf.title}')">
          <i class="fas fa-eye"></i> View PDF
        </button>
      </div>
    `).join('') || '<p>No PDFs available</p>';
  }

  window.viewPdf = async (url, title) => {
    await supabase.from("activity_logs").insert([{ user_email: currentUser.email, pdf_title: title, action: "Viewed" }]);
    
    pdfViewerDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading PDF...</p>';
    const loadingTask = window.pdfjsLib.getDocument(url);
    pdfDoc = await loadingTask.promise;
    pdfViewerDiv.style.display = "flex";
    dashboardDiv.className = "hidden";
    adminPanelDiv.className = "hidden";

    pdfViewerDiv.innerHTML = "";
    pdfViewerDiv.appendChild(closeBtn);

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

      ctx.globalAlpha = 0.3;
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
  };

  closeBtn.addEventListener("click", () => showDashboard());
  backToDashboardBtn?.addEventListener("click", showDashboard);

  // Upload PDF - FIXED with better error handling
uploadPdfBtn.addEventListener("click", async () => {
  const file = pdfFileInput.files[0];
  const title = pdfTitleInput.value.trim();
  
  if (!file) {
    alert("❌ Please select a PDF file.");
    return;
  }
  
  if (!title) {
    alert("❌ Please enter a PDF title.");
    return;
  }

  // Check if file is PDF
  if (file.type !== 'application/pdf') {
    alert("❌ Please select a valid PDF file.");
    return;
  }

  console.log("Starting upload:", { title, fileName: file.name, size: file.size });
  
  uploadPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
  uploadPdfBtn.disabled = true;

  try {
    const fileName = `${Date.now()}_${file.name}`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("pdfs")
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    console.log("Upload successful:", uploadData);

    // Get public URL
    const { data: urlData } = supabase.storage.from("pdfs").getPublicUrl(fileName);
    
    if (!urlData || !urlData.publicUrl) {
      throw new Error("Failed to get public URL");
    }

    console.log("Public URL:", urlData.publicUrl);

    // Insert into database
    const { data: insertData, error: insertError } = await supabase
      .from("pdfs")
      .insert([{ title, url: urlData.publicUrl }]);

    if (insertError) {
      console.error("Database insert error:", insertError);
      throw insertError;
    }

    console.log("Database insert successful");

    alert(`✅ Uploaded: ${title}`);
    pdfFileInput.value = "";
    pdfTitleInput.value = "";
    loadAnalytics();
    
    // Refresh the page to show new PDF
    showDashboard();

  } catch (error) {
    console.error("Upload failed:", error);
    alert(`❌ Upload failed: ${error.message}\n\nPlease check:\n1. Storage bucket exists\n2. Bucket is public\n3. You have upload permissions`);
  } finally {
    uploadPdfBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload PDF';
    uploadPdfBtn.disabled = false;
  }
});


  // Analytics
  async function loadAnalytics() {
    const { data: pdfs } = await supabase.from("pdfs").select("*");
    const { data: logs } = await supabase.from("activity_logs").select("*");
    const { data: profiles } = await supabase.from("user_profiles").select("*");
    const { data: recent } = await supabase.from("activity_logs").select("*").gte("created_at", new Date(Date.now() - 24*60*60*1000).toISOString());

    document.getElementById("totalUsers").textContent = profiles?.length || 0;
    document.getElementById("totalPdfs").textContent = pdfs?.length || 0;
    document.getElementById("totalViews").textContent = logs?.length || 0;
    document.getElementById("recentActivity").textContent = recent?.length || 0;
  }

  // User Management
  addUserBtn.addEventListener("click", async () => {
    const email = newUserEmail.value.trim().toLowerCase();
    const nickname = newUserNickname.value.trim();
    if (!email || !nickname) return alert("Enter both email and nickname");

    const { error } = await supabase.from("user_profiles").insert([{ email, nickname }]);
    if (error) return alert("Error: " + error.message);

    alert(`✅ User profile created!\nEmail: ${email}\nNickname: ${nickname}\n\nNow add them in Supabase Auth Dashboard.`);
    newUserEmail.value = "";
    newUserNickname.value = "";
    loadUserManagement();
  });

  async function loadUserManagement() {
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
  }

  window.deleteProfile = async (email) => {
    if (!confirm(`Delete ${email}?`)) return;
    await supabase.from("user_profiles").delete().eq("email", email);
    alert("✅ Deleted");
    loadUserManagement();
  };

  window.viewActivity = async (email) => {
    const { data } = await supabase.from("activity_logs").select("*").eq("user_email", email).order("created_at", { ascending: false }).limit(20);
    alert(`Activity for ${email}:\n\n${data?.map(a => `${a.action}: ${a.pdf_title} - ${new Date(a.created_at).toLocaleString()}`).join('\n') || 'No activity'}`);
  };

  async function loadActivityLogs() {
    const { data } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50);
    document.getElementById("activityLogsList").innerHTML = data?.map(log => `
      <div class="activity-item">
        <span><i class="fas fa-user"></i> <strong>${log.user_email}</strong> ${log.action} <em>"${log.pdf_title}"</em></span>
        <small>${new Date(log.created_at).toLocaleString()}</small>
      </div>
    `).join('') || '<p>No activity yet</p>';
  }

  // Security
  window.addEventListener("contextmenu", e => e.preventDefault());
  window.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && ["p", "s"].includes(e.key.toLowerCase())) e.preventDefault();
  });

  // Initialize
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) showLogin();
  });
});
// --- Footer Modal (Creator Info) ---
const showYadneshInfo = document.getElementById('showYadneshInfo');
const creatorModal = document.getElementById('creatorModal');
const closeCreatorModal = document.getElementById('closeCreatorModal');

showYadneshInfo.addEventListener('click', (e) => {
  e.preventDefault();
  creatorModal.classList.remove('hidden');
});

closeCreatorModal.addEventListener('click', () => {
  creatorModal.classList.add('hidden');
});

window.addEventListener('click', (event) => {
  if (event.target === creatorModal) {
    creatorModal.classList.add('hidden');
  }
});

// --- Real-Time Date and Time ---
function updateFooterTime() {
  const footerTime = document.getElementById('footerTime');
  const now = new Date();
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  footerTime.textContent =
    now.toLocaleTimeString() +
    " | " +
    now.toLocaleDateString(undefined, options);
}
setInterval(updateFooterTime, 1000);
updateFooterTime();
// -- OFFLINE PDF SUPPORT (IndexedDB) --
const { set: idbSet, get: idbGet, keys: idbKeys, del: idbDel } = idbKeyval;

// Save a PDF from URL using title as key
async function savePdfOffline(title, url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    await idbSet(title, blob);
    alert(`Saved "${title}" for offline use!`);
    showOfflinePdfsList(); // refresh list
  } catch (e) {
    alert("Offline save failed. " + e.message);
  }
}

// Get all saved PDF titles
async function getOfflinePdfTitles() {
  return await idbKeys();
}

// Get PDF Blob URL by title
async function getOfflinePdfUrl(title) {
  const blob = await idbGet(title);
  return blob ? URL.createObjectURL(blob) : null;
}

// List all Offline PDFs in the UI
async function showOfflinePdfsList() {
  const offlineListDiv = document.getElementById("offlinePdfList");
  if(!offlineListDiv) return;
  const keys = await getOfflinePdfTitles();
  offlineListDiv.innerHTML = (keys.length === 0) 
    ? "<p>No offline PDFs yet</p>"
    : keys.map(title => `
        <div class="offline-pdf-card">
          <span>${title}</span>
          <button onclick="openOfflinePdf('${title}')">Read Offline</button>
          <button onclick="removeOfflinePdf('${title}')"><i class="fas fa-trash"></i></button>
        </div>
      `).join("");
}
window.openOfflinePdf = async function(title) {
  const url = await getOfflinePdfUrl(title);
  url ? openPdfURL(url, title) : alert("PDF not cached offline.");
};
window.removeOfflinePdf = async function(title) {
  await idbDel(title);
  showOfflinePdfsList();
};

// Modify your PDF view logic to offer "Save Offline" when online
window.viewPdf = async function(url, title) {
  // ... your analytics/activity code ...
  pdfViewerDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Loading PDF...</p>`;
  if(navigator.onLine) {
    pdfViewerDiv.innerHTML += `<button onclick="savePdfOffline('${title}', '${url}')">Save for Offline</button>`;
  }
  const loadingTask = window.pdfjsLib.getDocument(url);
  pdfDoc = await loadingTask.promise;
  // ... your rendering code ...
  pdfViewerDiv.innerHTML = `<p><i class="fas fa-spinner fa-spin"></i> Loading PDF...</p>`;

// Add Save for Offline button only if online
if (navigator.onLine) {
  pdfViewerDiv.innerHTML += `<button onclick="savePdfOffline('${title}', '${url}')" class="primary-btn" style="margin: 15px 0;">
    <i class="fas fa-cloud-download-alt"></i> Save for Offline
  </button>`;
}

}
// On dashboard load:
showOfflinePdfsList();
