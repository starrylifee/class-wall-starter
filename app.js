// ===================================================
// 우리 반 담벼락 - 시작점
// ===================================================

// Firebase SDK v9 모듈 불러오기 (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyD-TjMY85L7qX07MKVK58GsWZCFQVDQiGQ",
  authDomain: "class-wall-starter-71c46.firebaseapp.com",
  projectId: "class-wall-starter-71c46",
  storageBucket: "class-wall-starter-71c46.firebasestorage.app",
  messagingSenderId: "964367627154",
  appId: "1:964367627154:web:593f4562695ec9be93074b"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자 정보 (로그아웃 시 null)
let currentUser = null;





// --- 메모 목록 ---
// Firestore에서 불러온 메모 목록을 담는 배열입니다.
let memos = [];

// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore 연동: 실시간 읽기, 쓰기, 지우기
// ===================================================

// 메모를 읽어 옵니다.
// orderBy("createdAt")으로 작성 순서대로 정렬하고,
// 실시간(onSnapshot)으로 변경 사항을 감지하여 화면을 그립니다.
function loadMemos() {
  const q = query(collection(db, "memos"), orderBy("createdAt", "asc"));
  onSnapshot(q, function (snapshot) {
    memos = [];
    snapshot.forEach(function (docSnap) {
      const data = docSnap.data();
      memos.push({
        id: docSnap.id,
        text: data.text,
        uid: data.uid || null,
        author: data.author || "",
        createdAt: data.createdAt ? data.createdAt.toMillis?.() || data.createdAt : Date.now()
      });
    });
    render();
  });
  return memos;
}

// 메모를 새로 씁니다.
// Firestore의 memos 컬렉션에 새 문서를 추가합니다 (로그인 시 uid와 작성자 이름 함께 저장).
async function addMemo(text) {
  try {
    const memoData = {
      text: text,
      createdAt: serverTimestamp(),
      uid: currentUser ? currentUser.uid : null,
      author: currentUser ? (currentUser.displayName || "익명") : "익명"
    };
    await addDoc(collection(db, "memos"), memoData);
  } catch (error) {
    console.error("메모 저장 실패:", error);
  }
}

// 메모를 지웁니다.
// Firestore의 해당 문서를 삭제합니다.
async function deleteMemo(id) {
  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모 삭제 실패:", error);
  }
}



// ===================================================
// 로그인 / 로그아웃 처리
// ===================================================

// 구글 로그인 팝업 띄우기
async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("로그인 실패:", error);
  }
}

// 로그아웃
async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("로그아웃 실패:", error);
  }
}

// 로그인 상태 변경 감지
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea();
  render(); // 내 메모에만 삭제 버튼을 보이게 하기 위해 재렌더링
});

// 로그인 영역 화면 그리기
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  userArea.innerHTML = "";

  if (currentUser) {
    const nameSpan = document.createElement("span");
    nameSpan.textContent = (currentUser.displayName || "로그인 됨") + " 님 환영합니다! ";

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.onclick = logout;

    userArea.appendChild(nameSpan);
    userArea.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Google 계정으로 로그인";
    loginBtn.onclick = login;

    userArea.appendChild(loginBtn);
  }
}


// ===================================================
// 화면 그리기
// ===================================================

function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 삭제 버튼: 내가 쓴 메모이거나, uid 정보가 없는 기존 메모일 때만 표시
  const canDelete = !memo.uid || (currentUser && currentUser.uid === memo.uid);
  if (canDelete) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.onclick = function () {
      deleteMemo(memo.id);
    };
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 정보가 있으면 하단에 작게 표시
  if (memo.author) {
    const authorDiv = document.createElement("div");
    authorDiv.style.fontSize = "12px";
    authorDiv.style.color = "#888";
    authorDiv.style.marginTop = "8px";
    authorDiv.textContent = memo.author;
    div.appendChild(authorDiv);
  }

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.onkeydown = function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    addMemo(text);
    input.value = "";
  }
};


// 메모 실시간 불러오기 시작 및 입력창 포커스
loadMemos();
input.focus();


