import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";
import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9uMEWLK1lCDHFYx7OoBCGEqPfyckILEY",
  authDomain: "bca-notes-app.firebaseapp.com",
  projectId: "bca-notes-app",
  storageBucket: "bca-notes-app.appspot.com",
  messagingSenderId: "398238473147",
  appId: "1:398238473147:web:59de2cb556ef47abf9829e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM elements
const loginDiv = document.getElementById('login');
const dashboardDiv = document.getElementById('dashboard');
const adminPanelDiv = document.getElementById('adminPanel');
const pdfViewerDiv = document.getElementById('pdfViewer');
const userEmailSpan = document.getElementById('userEmail');
const adminBtnContainer = document.getElementById('adminBtnContainer');
const pdfListDiv = document.getElementById('pdfList');
const pdfTitleInput = document.getElementById('pdfTitle');
const pdfFileInput = document.getElementById('pdfFile');
const uploadPdfBtn = document.getElementById('uploadPdfBtn');
const newEmailInput = document.getElementById('newEmailInput');
const addEmailBtn = document.getElementById('addEmailBtn');
const whitelistDisplay = document.getElementById('whitelistDisplay');
const backToDashboardBtn = document.getElementById('backToDashboardBtn');
const emailInput = document.getElementById('emailInput');
const sendLinkBtn = document.getElementById('sendLinkBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginMsgP = document.getElementById('loginMsg');
const pdfCanvas = document.getElementById('pdfCanvas');
const wmDiv = document.getElementById('wm');
const pageNumDisplay = document.getElementById('pageNumDisplay');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const closeViewerBtn = document.getElementById('closeViewerBtn');

let currentUserEmail = null;
let currentPdfList = [];
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;

sendLinkBtn.onclick = async () => {
  loginMsgP.textContent = '';
  const email = emailInput.value.trim();
  if (!email) return alert('Enter email');
  const actionCodeSettings = {
    url: window.location.origin,
    handleCodeInApp: true,
  };
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    loginMsgP.style.color = 'green';
    loginMsgP.textContent = 'Login link sent! Check your email.';
  } catch (e) {
    loginMsgP.style.color = 'red';
    loginMsgP.textContent = 'Error sending link: ' + e.message;
  }
};

if (isSignInWithEmailLink(auth, window.location.href)) {
  let email = window.localStorage.getItem('emailForSignIn');
  if (!email) {
    email = prompt('Please provide your email for confirmation');
  }
  signInWithEmailLink(auth, email, window.location.href)
    .then(() => {
      window.localStorage.removeItem('emailForSignIn');
    })
    .catch(console.error);
}

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUserEmail = user.email;
    const allowed = await checkWhitelist(currentUserEmail);
    if (!allowed) {
      alert('Your email is not authorized to access this app.');
      signOut(auth);
      showLogin();
      return;
    }
    userEmailSpan.textContent = currentUserEmail;
    showDashboard();
    await loadPdfList();
    if (isAdmin(currentUserEmail)) {
      adminBtnContainer.innerHTML = '<button id="openAdminBtn">Open Admin Panel</button>';
      document.getElementById('openAdminBtn').onclick = showAdminPanel;
    } else {
      adminBtnContainer.innerHTML = '';
    }
  } else {
    currentUserEmail = null;
    showLogin();
  }
});

logoutBtn.onclick = () => {
  signOut(auth);
};

function showLogin() {
  loginDiv.style.display = 'block';
  dashboardDiv.style.display = 'none';
  adminPanelDiv.style.display = 'none';
  pdfViewerDiv.style.display = 'none';
}

function showDashboard() {
  loginDiv.style.display = 'none';
  dashboardDiv.style.display = 'block';
  adminPanelDiv.style.display = 'none';
  pdfViewerDiv.style.display = 'none';
  renderPdfList();
}

function showAdminPanel() {
  loginDiv.style.display = 'none';
  dashboardDiv.style.display = 'none';
  adminPanelDiv.style.display = 'block';
  pdfViewerDiv.style.display = 'none';
  listWhitelist();
}

function isAdmin(email) {
  return email === 'yadneshsaindane7@gmail.com';
}

async function checkWhitelist(email) {
  const docRef = doc(db, 'whitelist', email);
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
}

async function loadPdfList() {
  pdfListDiv.textContent = 'Loading PDFs...';
  const querySnap = await getDocs(collection(db, 'pdfs'));
  currentPdfList = [];
  querySnap.forEach(docSnap => currentPdfList.push({ id: docSnap.id, ...docSnap.data() }));
  renderPdfList();
}

function renderPdfList() {
  if (currentPdfList.length === 0) {
    pdfListDiv.innerHTML = '<p>No PDFs uploaded yet.</p>';
    return;
  }
  pdfListDiv.innerHTML = '';
  currentPdfList.forEach((pdf, index) => {
    const div = document.createElement('div');
    div.className = 'pdf-card';
    div.innerHTML = `
      <h4>${pdf.title || pdf.id}</h4>
      <small>Uploaded: ${pdf.uploadedAt?.toDate ? pdf.uploadedAt.toDate().toLocaleDateString() : ''}</small><br/>
      <button data-index="${index}">View</button>
    `;
    div.querySelector('button').onclick = () => viewPdf(index);
    pdfListDiv.appendChild(div);
  });
}

uploadPdfBtn.onclick = async () => {
  const file = pdfFileInput.files[0];
  const title = pdfTitleInput.value.trim();
  if (!file) return alert('Choose a PDF file first');
  if (!title) return alert('Enter PDF title');
  const storageRef = ref(storage, `pdfs/${Date.now()}_${file.name}`);
  try {
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await setDoc(doc(db, 'pdfs', storageRef.name), {
      title: title,
      url: url,
      uploadedAt: new Date(),
    });
    alert('PDF uploaded!');
    await loadPdfList();
    pdfTitleInput.value = '';
    pdfFileInput.value = '';
  } catch (e) {
    alert('Upload failed: ' + e.message);
  }
};

addEmailBtn.onclick = async () => {
  const email = newEmailInput.value.trim();
  if (!email) return alert('Enter email');
  try {
    await setDoc(doc(db, 'whitelist', email), { addedAt: new Date() });
    newEmailInput.value = '';
    listWhitelist();
    alert('Email added to whitelist');
  } catch (e) {
    alert('Failed: ' + e.message);
  }
};

async function listWhitelist() {
  whitelistDisplay.innerHTML = 'Loading whitelist...';
  const querySnap = await getDocs(collection(db, 'whitelist'));
  whitelistDisplay.innerHTML = '';
  querySnap.forEach(docSnap => {
    const li = document.createElement('li');
    li.textContent = docSnap.id;
    whitelistDisplay.appendChild(li);
  });
}

async function viewPdf(index) {
  const pdf = currentPdfList[index];
  showPdfViewer();
  wmDiv.textContent = currentUserEmail;
  try {
    const loadingTask = pdfjsLib.getDocument(pdf.url);
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    currentPage = 1;
    renderPage(currentPage);
  } catch (e) {
    alert('Failed to load PDF: ' + e.message);
    closePdfViewer();
  }
}

async function renderPage(num) {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: 1.4 });
  const context = pdfCanvas.getContext('2d');
  pdfCanvas.height = viewport.height;
  pdfCanvas.width = viewport.width;
  await page.render({ canvasContext: context, viewport: viewport }).promise;
  pageNumDisplay.textContent = `${num} / ${totalPages}`;
}

function showPdfViewer() {
  pdfViewerDiv.style.display = 'flex';
  dashboardDiv.style.display = 'none';
  adminPanelDiv.style.display = 'none';
}

function closePdfViewer() {
  pdfViewerDiv.style.display = 'none';
  dashboardDiv.style.display = 'block';
  pdfDoc = null;
}

prevPageBtn.onclick = () => {
  if (currentPage > 1) {
    currentPage--;
    renderPage(currentPage);
  }
};
nextPageBtn.onclick = () => {
  if (currentPage < totalPages) {
    currentPage++;
    renderPage(currentPage);
  }
};
closeViewerBtn.onclick = closePdfViewer;

// Prevent right-click, print, save, and PrintScreen keys
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['p', 's'].includes(e.key.toLowerCase())) e.preventDefault();
  if (e.key === 'PrintScreen') e.preventDefault();
});
