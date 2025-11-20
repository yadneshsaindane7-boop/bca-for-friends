import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Supabase config
const supabaseUrl = "https://cvyqiwroddbbyqpyuayq.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2eXFpd3JvZGRiYnlxcHl1YXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyOTU5NTQsImV4cCI6MjA3Njg3MTk1NH0.QT8li2H-32sE66UH2sZIBQlGye0dtfL_-LYgaR6yj8M";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --------- CONSTANTS ---------
const SUBJECTS = [
  "Data Structure",
  "Data Communication",
  "Income Tax",
  "IKS",
  "Marathi",
  "C++",
];

// --------- PDF.js setup ---------
const script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
script.onload = () => {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
};
document.head.appendChild(script);

// PDF.js ready helper
function waitForPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve();
    let tries = 0;
    const interval = setInterval(() => {
      if (window.pdfjsLib) {
        clearInterval(interval);
        resolve();
      } else if (++tries > 50) {
        clearInterval(interval);
        reject(new Error("PDF viewer failed to load. Please refresh."));
      }
    }, 100);
  });
}

// --------- App state ---------
let currentUser = null;
let currentUserProfile = null;
let pdfDoc = null;
let currentPage = 1;
let currentScale = 1.0;
let renderTask = null;
let currentSubject = null;

// Admin check
const isAdmin = (email) =>
  email?.trim().toLowerCase() === "yadneshsaindane7@gmail.com";

// --------- PDF Viewer root ---------
const pdfViewerDiv = document.createElement("div");
pdfViewerDiv.id = "pdfViewer";
pdfViewerDiv.style.display = "none";
document.body.appendChild(pdfViewerDiv);

const closeBtn = document.createElement("button");
closeBtn.id = "closePdfBtn";
closeBtn.className = "primary-btn";
closeBtn.innerHTML = '<i class="fas fa-times"></i> Close PDF';
pdfViewerDiv.appendChild(closeBtn);

const pdfCanvasContainer = document.createElement("div");
pdfCanvasContainer.id = "pdfCanvasContainer";
pdfCanvasContainer.style.width = "100%";
pdfCanvasContainer.style.display = "flex";
pdfCanvasContainer.style.flexDirection = "column";
pdfCanvasContainer.style.alignItems = "center";
pdfViewerDiv.appendChild(pdfCanvasContainer);

const pdfToolbar = document.createElement("div");
pdfToolbar.id = "pdfToolbar";
pdfToolbar.style.position = "sticky";
pdfToolbar.style.bottom = "0";
pdfToolbar.style.width = "100%";
pdfToolbar.style.display = "flex";
pdfToolbar.style.justifyContent = "center";
pdfToolbar.style.alignItems = "center";
pdfToolbar.style.gap = "8px";
pdfToolbar.style.padding = "8px 10px";
pdfToolbar.style.background = "rgba(0,0,0,0.7)";
pdfToolbar.style.zIndex = "10001";
pdfToolbar.style.flexWrap = "wrap";
pdfViewerDiv.appendChild(pdfToolbar);

// --------- Dark Mode initial ---------
const savedTheme = localStorage.getItem("theme") || "light";
document.body.className = savedTheme === "dark" ? "dark-mode" : "light-mode";

// --------- MAIN APP ---------
window.addEventListener("load", () => {
  console.log("App loaded");

  // DOM elements
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
  const pdfSubjectSelect = document.getElementById("pdfSubject");
  const addUserBtn = document.getElementById("addUserBtn");
  const newUserEmail = document.getElementById("newUserEmail");
  const newUserNickname = document.getElementById("newUserNickname");

  // Footer / creator
  const showYadneshInfo = document.getElementById("showYadneshInfo");
  const creatorModal = document.getElementById("creatorModal");
  const closeCreatorModal = document.getElementById("closeCreatorModal");

  // Populate subject dropdown in admin panel
  if (pdfSubjectSelect) {
    pdfSubjectSelect.innerHTML =
      '<option value="">Select Subject</option>' +
      SUBJECTS.map((s) => `<option value="${s}">${s}</option>`).join("");
  }

  // --- Dark mode toggle ---
  function updateDarkModeIcon() {
    const isDark = document.body.classList.contains("dark-mode");
    darkModeToggle.innerHTML = isDark
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  }
  updateDarkModeIcon();

  darkModeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-mode");
    document.body.classList.toggle("light-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    updateDarkModeIcon();
  });

  // --- UI helpers ---
  function showLogin() {
    loginDiv.className = "visible";
    dashboardDiv.className = "hidden";
    adminPanelDiv.className = "hidden";
    profileModal.className = "modal hidden";
    pdfViewerDiv.style.display = "none";
  }

  function showDashboard() {
    loginDiv.className = "hidden";
    dashboardDiv.className = "visible";
    adminPanelDiv.className = "hidden";
    profileModal.className = "modal hidden";
    pdfViewerDiv.style.display = "none";
    currentSubject = null;
    loadSubjects(); // <-- show subjects grid, not PDFs directly
  }

  function showAdminPanel() {
    loginDiv.className = "hidden";
    dashboardDiv.className = "hidden";
    adminPanelDiv.className = "visible";
    pdfViewerDiv.style.display = "none";
    loadAnalytics();
    loadUserManagement();
    loadActivityLogs();
  }

  // --- Login ---
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

  // --- Auth state ---
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
      userNicknameSpan.textContent =
        profile?.nickname || currentUser.email.split("@")[0];

      if (isAdmin(currentUser.email)) {
        adminBtnContainer.innerHTML = `
          <button id="openAdminBtn" class="primary-btn">
            <i class="fas fa-user-shield"></i> Admin Panel
          </button>`;
        document
          .getElementById("openAdminBtn")
          .addEventListener("click", showAdminPanel);
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

  // --- Profile modal ---
  profileBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    profileModal.className = "modal visible";
    document.getElementById("profileEmail").textContent = currentUser.email;
    document.getElementById("profileNickname").textContent =
      currentUserProfile?.nickname || "Not set";
    document.getElementById("profileJoined").textContent =
      new Date(currentUser.created_at).toLocaleDateString();

    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("user_email", currentUser.email)
      .order("created_at", { ascending: false })
      .limit(10);

    document.getElementById("userActivityList").innerHTML =
      data
        ?.map(
          (a) => `
        <div class="activity-item">
          <span><i class="fas fa-eye"></i> ${a.action}: ${a.pdf_title}</span>
          <small>${new Date(a.created_at).toLocaleString()}</small>
        </div>
      `
        )
        .join("") || "<p>No activity yet</p>";
  });

  closeProfileBtn.addEventListener("click", () => {
    profileModal.className = "modal hidden";
  });

  // --------- SUBJECT DASHBOARD ---------

  // Show subject cards instead of PDFs directly
  async function loadSubjects() {
    pdfListDiv.innerHTML =
      '<p><i class="fas fa-spinner fa-spin"></i> Loading subjects...</p>';

    // Get all pdfs with subject
    const { data, error } = await supabase
      .from("pdfs")
      .select("id, subject");

    if (error) {
      console.error(error);
      pdfListDiv.innerHTML = "<p>Error loading subjects.</p>";
      return;
    }

    // Build counts
    const subjectCounts = new Map();
    // Initialize with fixed subjects (so even 0 PDFs show)
    SUBJECTS.forEach((s) => subjectCounts.set(s, 0));

    data?.forEach((row) => {
      const subj = row.subject || "";
      if (!subj) return;
      if (!subjectCounts.has(subj)) subjectCounts.set(subj, 0);
      subjectCounts.set(subj, subjectCounts.get(subj) + 1);
    });

    // Ordered subjects: first fixed ones, then any extra subjects
    const extras = [];
    subjectCounts.forEach((_, key) => {
      if (!SUBJECTS.includes(key)) extras.push(key);
    });

    const orderedSubjects = [...SUBJECTS, ...extras];

    pdfListDiv.innerHTML =
      orderedSubjects
        .map((subj) => {
          const count = subjectCounts.get(subj) || 0;
          return `
        <div class="pdf-card">
          <h3><i class="fas fa-book"></i> ${subj}</h3>
          <small>${count} PDF(s)</small>
          <button class="primary-btn"
            onclick="window.showSubject('${subj.replace(/'/g, "\\'")}')">
            <i class="fas fa-eye"></i> View PDFs
          </button>
        </div>
      `;
        })
        .join("") || "<p>No subjects available.</p>";
  }

  // Expose for onclick
  window.showSubject = async (subject) => {
    currentSubject = subject;
    await loadPdfsBySubject(subject);
  };

  // Load PDFs for a specific subject
  async function loadPdfsBySubject(subject) {
    pdfListDiv.innerHTML = `
      <div class="dashboard-header" style="margin-bottom:14px;">
        <div class="user-info">
          <i class="fas fa-book"></i>
          <h2>${subject}</h2>
        </div>
        <button id="backToSubjectsBtnInner" class="secondary-btn">
          <i class="fas fa-arrow-left"></i> All Subjects
        </button>
      </div>
      <div id="subjectPdfGrid" class="grid">
        <p><i class="fas fa-spinner fa-spin"></i> Loading PDFs...</p>
      </div>
    `;

    const grid = document.getElementById("subjectPdfGrid");
    const backBtnInner = document.getElementById("backToSubjectsBtnInner");
    backBtnInner.onclick = () => {
      currentSubject = null;
      loadSubjects();
    };

    const { data, error } = await supabase
      .from("pdfs")
      .select("*")
      .eq("subject", subject)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      grid.innerHTML = "<p>Error loading PDFs for this subject.</p>";
      return;
    }

    grid.innerHTML =
      data
        ?.map(
          (pdf) => `
        <div class="pdf-card">
          <h3><i class="fas fa-file-pdf"></i> ${pdf.title}</h3>
          <small>${new Date(pdf.created_at).toLocaleDateString()}</small>
          <button class="primary-btn" 
            onclick="window.viewPdf('${pdf.url}', '${pdf.title.replace(/'/g, "\\'")}')">
            <i class="fas fa-eye"></i> View PDF
          </button>
        </div>
      `
        )
        .join("") || "<p>No PDFs in this subject yet.</p>";
  }

  // --------- PDF Viewer (same as before, works for any subject) ---------
  window.viewPdf = async (url, title) => {
    try {
      await waitForPdfJs();
    } catch (err) {
      alert(err.message);
      return;
    }

    // Log activity
    if (currentUser?.email) {
      await supabase.from("activity_logs").insert([
        { user_email: currentUser.email, pdf_title: title, action: "Viewed" },
      ]);
    }

    // Hide main views, show viewer
    loginDiv.className = "hidden";
    dashboardDiv.className = "hidden";
    adminPanelDiv.className = "hidden";

    pdfViewerDiv.style.display = "flex";
    pdfViewerDiv.style.background = "rgba(0, 0, 0, 0.9)";
    pdfViewerDiv.scrollTop = 0;

    // Reset viewer UI
    pdfCanvasContainer.innerHTML = "";
    pdfToolbar.innerHTML = "";
    pdfViewerDiv.prepend(closeBtn);

    // Load PDF (streaming)
    const loadingTask = window.pdfjsLib.getDocument({
      url,
      disableStream: false,
      enableXfa: false,
    });
    pdfDoc = await loadingTask.promise;

    const isMobile = window.innerWidth <= 768;
    const baseScale = isMobile ? 0.9 : 1.3;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5);
    currentScale = baseScale * dpr;
    currentPage = 1;

    // Create single reusable canvas
    const canvas = document.createElement("canvas");
    canvas.className = "pageCanvas";
    canvas.style.maxWidth = "95vw";
    canvas.style.height = "auto";
    canvas.style.margin = "16px auto";
    pdfCanvasContainer.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const pageIndicator = document.createElement("span");
    pageIndicator.style.color = "#fff";
    pageIndicator.style.fontSize = "0.9rem";

    const prevBtn = document.createElement("button");
    prevBtn.className = "primary-btn small-btn";
    prevBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';

    const nextBtn = document.createElement("button");
    nextBtn.className = "primary-btn small-btn";
    nextBtn.innerHTML = '<i class="fas fa-arrow-right"></i>';

    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.className = "primary-btn small-btn";
    zoomOutBtn.innerHTML = '<i class="fas fa-search-minus"></i>';

    const zoomInBtn = document.createElement("button");
    zoomInBtn.className = "primary-btn small-btn";
    zoomInBtn.innerHTML = '<i class="fas fa-search-plus"></i>';

    pdfToolbar.appendChild(prevBtn);
    pdfToolbar.appendChild(nextBtn);
    pdfToolbar.appendChild(zoomOutBtn);
    pdfToolbar.appendChild(zoomInBtn);
    pdfToolbar.appendChild(pageIndicator);

    async function renderPage() {
      if (renderTask && typeof renderTask.cancel === "function") {
        try {
          renderTask.cancel();
        } catch (e) {
          console.warn("Render cancel failed:", e);
        }
      }

      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: currentScale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      renderTask = page.render({ canvasContext: ctx, viewport });

      try {
        await renderTask.promise;
      } catch (e) {
        if (e?.name === "RenderingCancelledException") return;
        console.error("Render error:", e);
        return;
      }

      // Watermark
      if (currentUser?.email) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.font = `${28 * (isMobile ? 0.8 : 1)}px Arial`;
        ctx.fillStyle = "#c62828";
        ctx.textAlign = "center";
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-0.3);
        ctx.fillText(currentUser.email, 0, 0);
        ctx.restore();
      }

      pageIndicator.textContent = `Page ${currentPage} of ${pdfDoc.numPages}`;
    }

    prevBtn.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderPage();
      }
    };

    nextBtn.onclick = () => {
      if (currentPage < pdfDoc.numPages) {
        currentPage++;
        renderPage();
      }
    };

    zoomInBtn.onclick = () => {
      const maxScale = isMobile ? 2.0 * dpr : 2.4 * dpr;
      currentScale = Math.min(currentScale * 1.15, maxScale);
      renderPage();
    };

    zoomOutBtn.onclick = () => {
      const minScale = 0.75 * dpr;
      currentScale = Math.max(currentScale / 1.15, minScale);
      renderPage();
    };

    await renderPage();
  };

  closeBtn.addEventListener("click", () => showDashboard());
  backToDashboardBtn?.addEventListener("click", showDashboard);

  // --------- Upload PDF (now includes subject) ---------
  uploadPdfBtn.addEventListener("click", async () => {
    const file = pdfFileInput.files[0];
    const title = pdfTitleInput.value.trim();
    const subject = pdfSubjectSelect?.value || "";

    if (!file) {
      alert("❌ Please select a PDF file.");
      return;
    }
    if (!title) {
      alert("❌ Please enter a PDF title.");
      return;
    }
    if (!subject) {
      alert("❌ Please select a subject.");
      return;
    }
    if (file.type !== "application/pdf") {
      alert("❌ Please select a valid PDF file.");
      return;
    }

    uploadPdfBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    uploadPdfBtn.disabled = true;

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("pdfs")
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) throw new Error("Failed to get public URL");

      const { error: insertError } = await supabase.from("pdfs").insert([
        { title, url: urlData.publicUrl, subject },
      ]);

      if (insertError) throw insertError;

      alert(`✅ Uploaded: ${title}`);
      pdfFileInput.value = "";
      pdfTitleInput.value = "";
      if (pdfSubjectSelect) pdfSubjectSelect.value = "";
      loadAnalytics();
      showDashboard();
    } catch (error) {
      console.error("Upload failed:", error);
      alert(
        `❌ Upload failed: ${error.message}\n\nPlease check:\n1. Storage bucket exists\n2. Bucket is public\n3. You have upload permissions`
      );
    } finally {
      uploadPdfBtn.innerHTML =
        '<i class="fas fa-cloud-upload-alt"></i> Upload PDF';
      uploadPdfBtn.disabled = false;
    }
  });

  // --------- Analytics ---------
  async function loadAnalytics() {
    const { data: pdfs } = await supabase.from("pdfs").select("*");
    const { data: logs } = await supabase.from("activity_logs").select("*");
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("*");
    const { data: recent } = await supabase
      .from("activity_logs")
      .select("*")
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );

    document.getElementById("totalUsers").textContent =
      profiles?.length || 0;
    document.getElementById("totalPdfs").textContent = pdfs?.length || 0;
    document.getElementById("totalViews").textContent = logs?.length || 0;
    document.getElementById("recentActivity").textContent =
      recent?.length || 0;
  }

  // --------- User Management ---------
  addUserBtn.addEventListener("click", async () => {
    const email = newUserEmail.value.trim().toLowerCase();
    const nickname = newUserNickname.value.trim();
    if (!email || !nickname) return alert("Enter both email and nickname");

    const { error } = await supabase
      .from("user_profiles")
      .insert([{ email, nickname }]);
    if (error) return alert("Error: " + error.message);

    alert(
      `✅ User profile created!\nEmail: ${email}\nNickname: ${nickname}\n\nNow add them in Supabase Auth Dashboard.`
    );
    newUserEmail.value = "";
    newUserNickname.value = "";
    loadUserManagement();
  });

  async function loadUserManagement() {
    const { data } = await supabase.from("user_profiles").select("*");
    document.getElementById("userManagementList").innerHTML =
      data
        ?.map(
          (p) => `
        <div class="user-card">
          <div class="user-card-info">
            <strong><i class="fas fa-user"></i> ${p.nickname}</strong>
            <br><small>${p.email}</small>
          </div>
          <div class="user-card-actions">
            <button class="secondary-btn" onclick="window.viewActivity('${p.email}')">
              <i class="fas fa-chart-line"></i> Activity
            </button>
            <button class="delete-btn" onclick="window.deleteProfile('${p.email}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `
        )
        .join("") || "<p>No users yet</p>";
  }

  window.deleteProfile = async (email) => {
    if (!confirm(`Delete ${email}?`)) return;
    await supabase.from("user_profiles").delete().eq("email", email);
    alert("✅ Deleted");
    loadUserManagement();
  };

  window.viewActivity = async (email) => {
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("user_email", email)
      .order("created_at", { ascending: false })
      .limit(20);
    alert(
      `Activity for ${email}:\n\n${
        data
          ?.map(
            (a) =>
              `${a.action}: ${a.pdf_title} - ${new Date(
                a.created_at
              ).toLocaleString()}`
          )
          .join("\n") || "No activity"
      }`
    );
  };

  async function loadActivityLogs() {
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    document.getElementById("activityLogsList").innerHTML =
      data
        ?.map(
          (log) => `
        <div class="activity-item">
          <span><i class="fas fa-user"></i> <strong>${log.user_email}</strong> ${log.action} <em>"${log.pdf_title}"</em></span>
          <small>${new Date(log.created_at).toLocaleString()}</small>
        </div>
      `
        )
        .join("") || "<p>No activity yet</p>";
  }

  // --------- Security ---------
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown", (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      ["p", "s"].includes(e.key.toLowerCase())
    ) {
      e.preventDefault();
    }
  });

  // --------- Auth init ---------
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) showLogin();
  });

  // --------- Creator modal / footer ---------
  if (showYadneshInfo) {
    showYadneshInfo.addEventListener("click", (e) => {
      e.preventDefault();
      window.open("https://yadneshportfolio.vercel.app/", "_blank");
    });
  }

  if (closeCreatorModal && creatorModal) {
    closeCreatorModal.addEventListener("click", () => {
      creatorModal.classList.add("hidden");
    });

    window.addEventListener("click", (event) => {
      if (event.target === creatorModal) {
        creatorModal.classList.add("hidden");
      }
    });
  }

  // --- Real-Time Date and Time ---
  function updateFooterTime() {
    const footerTime = document.getElementById("footerTime");
    if (!footerTime) return;
    const now = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    footerTime.textContent =
      now.toLocaleTimeString() +
      " | " +
      now.toLocaleDateString(undefined, options);
  }
  setInterval(updateFooterTime, 1000);
  updateFooterTime();
});
