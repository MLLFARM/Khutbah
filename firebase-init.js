// ======================================================
// إعداد Firebase (المصادقة + قاعدة البيانات السحابية)
// ======================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics, isSupported as analyticsIsSupported } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDDPgSn_F60aZACHWS1w_ex9eEjs9jsp1k",
    authDomain: "khutbah-65768.firebaseapp.com",
    projectId: "khutbah-65768",
    storageBucket: "khutbah-65768.firebasestorage.app",
    messagingSenderId: "842612049923",
    appId: "1:842612049923:web:dd333a70b63fe567eca636",
    measurementId: "G-4G5GHBTXWX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// تفعيل Analytics فقط إن كانت البيئة تدعمه (يفشل بصمت داخل بعض المتصفحات/الوضع الخاص)
analyticsIsSupported().then((ok) => { if (ok) getAnalytics(app); }).catch(() => {});

let unsubscribeSnapshot = null;

// إنشاء حساب جديد بالبريد وكلمة المرور
export function registerUser(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
}

// تسجيل الدخول بالبريد وكلمة المرور
export function loginUser(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

// تسجيل الخروج
export function logoutUser() {
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }
    return signOut(auth);
}

// مراقبة حالة تسجيل الدخول + الاشتراك بالتحديثات اللحظية لبيانات المستخدم
// onLogin(user) تُستدعى عند الدخول، onLogout() عند الخروج
// onCloudUpdate(data) تُستدعى كل مرة تتغيّر فيها البيانات في القاعدة (من أي جهاز)
export function watchAuth(onLogin, onLogout, onCloudUpdate) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            onLogin(user);
            const userDocRef = doc(db, "khutabUsers", user.uid);

            // إن لم يكن للمستخدم مستند بعد، أنشئه من البيانات المحلية الحالية (إن وجدت)
            try {
                const snap = await getDoc(userDocRef);
                if (!snap.exists()) {
                    const settings = JSON.parse(localStorage.getItem("imamSettings") || "{}");
                    const khutbahs = JSON.parse(localStorage.getItem("khutbahs") || "[]");
                    await setDoc(userDocRef, { settings, khutbahs, updatedAt: serverTimestamp() });
                }
            } catch (e) {
                console.error("تعذر تهيئة بيانات المستخدم في Firestore:", e);
            }

            unsubscribeSnapshot = onSnapshot(userDocRef, (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.settings) localStorage.setItem("imamSettings", JSON.stringify(data.settings));
                    if (data.khutbahs) localStorage.setItem("khutbahs", JSON.stringify(data.khutbahs));
                    onCloudUpdate(data);
                }
            }, (err) => {
                console.error("خطأ في الاشتراك اللحظي بقاعدة البيانات:", err);
            });
        } else {
            onLogout();
        }
    });
}

// رفع البيانات المحلية الحالية (localStorage) إلى Firestore
export async function pushToCloud() {
    const user = auth.currentUser;
    if (!user) return;
    const settings = JSON.parse(localStorage.getItem("imamSettings") || "{}");
    const khutbahs = JSON.parse(localStorage.getItem("khutbahs") || "[]");
    try {
        await setDoc(doc(db, "khutabUsers", user.uid), {
            settings,
            khutbahs,
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error("تعذر حفظ البيانات في السحابة:", e);
        throw e;
    }
}

// ترجمة رموز أخطاء Firebase لرسائل عربية مفهومة
export function getAuthErrorMessage(code) {
    const map = {
        "auth/email-already-in-use": "هذا البريد الإلكتروني مسجل مسبقاً.",
        "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
        "auth/weak-password": "كلمة المرور ضعيفة جداً (6 أحرف على الأقل).",
        "auth/user-not-found": "لا يوجد حساب بهذا البريد الإلكتروني.",
        "auth/wrong-password": "كلمة المرور غير صحيحة.",
        "auth/invalid-credential": "بيانات الدخول غير صحيحة، تحقق من البريد وكلمة المرور.",
        "auth/too-many-requests": "محاولات كثيرة جداً، الرجاء المحاولة لاحقاً.",
        "auth/network-request-failed": "تعذر الاتصال بالشبكة، تحقق من اتصالك بالإنترنت."
    };
    return map[code] || "حدث خطأ غير متوقع، الرجاء المحاولة مرة أخرى.";
}
