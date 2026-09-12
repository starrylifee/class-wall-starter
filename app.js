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
  updateDoc,
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

// ===================================================
// 교사(Teacher) UID 목록
// 교사로 지정할 계정의 Firebase Auth UID를 이 배열에 넣습니다.
// ===================================================
const TEACHER_UIDS = [
  // 예: "본인의_구글계정_Firebase_UID"
];

// 현재 로그인한 사용자 정보 및 역할 (teacher / student / guest)
let currentUser = null;
let currentUserRole = "guest";

// 사용자의 역할을 판별하는 함수 (교사면 teacher, 학생이면 student)
function getUserRole(user) {
  if (!user) return "guest";
  if (TEACHER_UIDS.includes(user.uid)) {
    return "teacher";
  }
  return "student";
}






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
        aiComment: data.aiComment || null,
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
  if (!currentUser) {
    alert("메모를 작성하려면 먼저 Google 계정으로 로그인해 주세요.");
    return;
  }

  try {
    const memoData = {
      text: text,
      createdAt: serverTimestamp(),
      uid: currentUser.uid,
      author: currentUser.displayName || "학생"
    };
    await addDoc(collection(db, "memos"), memoData);
  } catch (error) {
    console.error("메모 저장 실패:", error);
  }
}

// 메모를 지웁니다.
// Firestore의 해당 문서를 삭제합니다.
// 교사는 모든 메모를 지울 수 있고, 학생은 본인이 작성한 메모만 지울 수 있습니다.
async function deleteMemo(id) {
  const targetMemo = memos.find(function (m) {
    return m.id === id;
  });

  // 권한 검사: 교사이거나 본인의 메모인 경우만 삭제 허용
  const isTeacher = currentUserRole === "teacher";
  const isAuthor = targetMemo && currentUser && targetMemo.uid === currentUser.uid;

  if (!isTeacher && !isAuthor) {
    alert("다른 사람의 메모는 삭제할 수 없습니다.");
    return;
  }

  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모 삭제 실패:", error);
  }
}

// AI 코멘트 요청 함수 (교사 전용)
// Vercel 서버리스 함수(/api/gemini)를 호출하고 그 결과를 Firestore에 저장합니다.
async function requestAiComment(id, text) {
  if (currentUserRole !== "teacher") {
    alert("AI 코멘트는 선생님만 요청할 수 있습니다.");
    return;
  }

  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: text })
    });

    const data = await response.json();
    if (!response.ok) {
      alert("AI 코멘트 생성 실패: " + (data.error || "서버 오류"));
      return;
    }

    // Firestore 해당 메모 문서에 aiComment 필드 업데이트
    await updateDoc(doc(db, "memos", id), {
      aiComment: data.comment
    });
  } catch (error) {
    console.error("AI 코멘트 요청 오류:", error);
    alert("AI 코멘트 요청 중 오류가 발생했습니다.");
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
  currentUserRole = getUserRole(user);
  renderUserArea();
  render(); // 권한에 따라 삭제 버튼 표시 여부가 달라지므로 재렌더링
});

// 로그인 영역 화면 그리기
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  userArea.innerHTML = "";

  if (currentUser) {
    const roleLabel = currentUserRole === "teacher" ? " [선생님]" : " [학생]";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = (currentUser.displayName || "사용자") + roleLabel + " 님 환영합니다! ";

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

  // 삭제 권한 확인:
  // 1) 교사(teacher)는 모든 메모 삭제 가능
  // 2) 학생(student)은 자기가 쓴 메모만 삭제 가능
  const isTeacher = currentUserRole === "teacher";
  const isMyMemo = currentUser && memo.uid === currentUser.uid;
  const canDelete = isTeacher || isMyMemo;

  if (canDelete) {
    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "×";
    del.title = isTeacher && !isMyMemo ? "교사 권한으로 삭제" : "삭제";
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
    authorDiv.textContent = "작성자: " + memo.author;
    div.appendChild(authorDiv);
  }

  // AI 코멘트가 있는 경우 표시
  if (memo.aiComment) {
    const aiCommentDiv = document.createElement("div");
    aiCommentDiv.className = "ai-comment-box";
    aiCommentDiv.textContent = "🤖 AI 선생님: " + memo.aiComment;
    div.appendChild(aiCommentDiv);
  }

  // 교사(Teacher)에게만 AI 코멘트 생성 버튼 노출
  if (isTeacher) {
    const aiBtn = document.createElement("button");
    aiBtn.className = "ai-btn";
    aiBtn.textContent = memo.aiComment ? "✨ AI 코멘트 다시 달기" : "✨ AI 코멘트 달기";
    aiBtn.onclick = async function () {
      aiBtn.disabled = true;
      aiBtn.textContent = "⏳ 코멘트 생성 중...";
      await requestAiComment(memo.id, memo.text);
      aiBtn.disabled = false;
      aiBtn.textContent = "✨ AI 코멘트 다시 달기";
    };
    div.appendChild(aiBtn);
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


