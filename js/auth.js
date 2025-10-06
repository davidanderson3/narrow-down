// js/auth.js
import "https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth-compat.js";
import "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore-compat.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { clearDecisionsCache, clearGoalOrderCache } from './cache.js';

export let currentUser = null;

function parseInlineFirebaseConfig() {
  if (typeof globalThis !== 'undefined') {
    const candidates = [globalThis.__FIREBASE_CONFIG__, globalThis.window?.__FIREBASE_CONFIG__];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object') {
        return candidate;
      }
    }
  }

  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="firebase-config"]');
    if (meta?.content) {
      try {
        const parsed = JSON.parse(meta.content);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (err) {
        console.error('Failed to parse firebase-config meta tag:', err);
      }
    }
  }

  return null;
}

function isValidConfig(cfg) {
  return !!cfg && typeof cfg === 'object';
}

function showFirebaseWarning(message) {
  if (typeof document === 'undefined') return;
  if (document.querySelector('.firebase-config-warning')) return;
  const banner = document.createElement('div');
  banner.className = 'firebase-config-warning';
  banner.textContent = message;
  document.body.appendChild(banner);
}

const persistenceValue = (() => {
  try {
    const persistence = firebase?.auth?.Auth?.Persistence;
    if (persistence?.LOCAL) return persistence.LOCAL;
  } catch {}
  return 'LOCAL';
})();

function applyAuthPersistence(instance) {
  if (!instance?.setPersistence) return;
  try {
    const result = instance.setPersistence(persistenceValue);
    if (typeof result?.catch === 'function') {
      result.catch(err => {
        console.error('Failed to set auth persistence:', err);
      });
    }
  } catch (err) {
    console.error('Failed to set auth persistence:', err);
  }
}

function createNoopQuerySnapshot() {
  return {
    empty: true,
    size: 0,
    docs: [],
    forEach() {},
    metadata: { fromCache: true, hasPendingWrites: false }
  };
}

function createNoopDocSnapshot(id = null) {
  return {
    id,
    exists: false,
    data() {
      return undefined;
    }
  };
}

function createNoopDb(message) {
  const log = (...args) => console.warn('[firestore disabled]', ...args);

  const createCollection = (segments) => ({
    doc(id) {
      return createDoc([...segments, id]);
    },
    async get() {
      log('collection.get()', segments.join('/'));
      return createNoopQuerySnapshot();
    },
    orderBy() {
      return createQuery(segments);
    },
    limit() {
      return createQuery(segments);
    },
    onSnapshot(optionsOrCb, maybeCb) {
      const cb = typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb;
      if (typeof cb === 'function') {
        setTimeout(() => cb(createNoopQuerySnapshot()), 0);
      }
      log('collection.onSnapshot()', segments.join('/'));
      return () => {};
    }
  });

  const createQuery = (segments) => ({
    async get() {
      log('query.get()', segments.join('/'));
      return createNoopQuerySnapshot();
    },
    orderBy() {
      return createQuery(segments);
    },
    limit() {
      return createQuery(segments);
    },
    onSnapshot(optionsOrCb, maybeCb) {
      const cb = typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb;
      if (typeof cb === 'function') {
        setTimeout(() => cb(createNoopQuerySnapshot()), 0);
      }
      log('query.onSnapshot()', segments.join('/'));
      return () => {};
    }
  });

  const createDoc = (segments) => ({
    async get() {
      log('doc.get()', segments.join('/'));
      return createNoopDocSnapshot(segments[segments.length - 1]);
    },
    async set() {
      log('doc.set()', segments.join('/'));
    },
    async update() {
      log('doc.update()', segments.join('/'));
    },
    async delete() {
      log('doc.delete()', segments.join('/'));
    },
    collection(name) {
      return createCollection([...segments, name]);
    }
  });

  const db = {
    collection(name) {
      return createCollection([name]);
    },
    collectionGroup() {
      return {
        async get() {
          log('collectionGroup.get()');
          return createNoopQuerySnapshot();
        }
      };
    },
    batch() {
      log('batch()');
      return {
        set() {},
        update() {},
        delete() {},
        async commit() {}
      };
    }
  };

  if (message) log(message);
  return db;
}

function createStubAuth(message) {
  const listeners = new Set();
  const notify = () => listeners.forEach(cb => {
    try {
      cb(null);
    } catch (err) {
      console.error('Auth listener failed:', err);
    }
  });

  setTimeout(() => notify(), 0);

  return {
    currentUser: null,
    setPersistence() {
      return Promise.resolve();
    },
    onAuthStateChanged(callback) {
      if (typeof callback === 'function') {
        listeners.add(callback);
        try {
          callback(null);
        } catch (err) {
          console.error('Auth listener failed:', err);
        }
      }
      return () => listeners.delete(callback);
    },
    async signInWithPopup() {
      const error = new Error(message || 'Firebase is not configured.');
      error.code = 'missing-config';
      throw error;
    },
    async signOut() {
      return Promise.resolve();
    }
  };
}

const firebaseConfig = parseInlineFirebaseConfig();
const hasFirebaseConfig = isValidConfig(firebaseConfig);
const firebaseConfigMessage = typeof globalThis !== 'undefined' && globalThis.__FIREBASE_CONFIG_ERROR__
  ? globalThis.__FIREBASE_CONFIG_ERROR__
  : 'Firebase configuration was not provided. Set FIREBASE_CONFIG or related environment variables.';

let auth;
let db;
let authReadyPromise = null;
let awaitAuthUserImpl;
let initAuthImpl;

if (hasFirebaseConfig) {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  applyAuthPersistence(auth);

  initializeFirestore(firebase.app(), {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });

  db = firebase.firestore();

  awaitAuthUserImpl = function awaitAuthUserReal() {
    if (!authReadyPromise) {
      authReadyPromise = new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(user => {
          currentUser = user;
          unsubscribe();
          resolve(user);
        });
      });
    }
    return authReadyPromise;
  };

  initAuthImpl = function initAuthReal({ loginBtn, logoutBtn, userEmail, bottomLoginBtn, bottomLogoutBtn } = {}, onLogin = () => {}) {
    const safeSet = (el, key, value) => {
      if (el) el[key] = value;
    };

    const usesSingleBottomBtn = bottomLogoutBtn && !bottomLoginBtn;

    const loginButtons = [loginBtn].filter(Boolean);
    if (!usesSingleBottomBtn && bottomLoginBtn) loginButtons.push(bottomLoginBtn);

    const logoutButtons = [logoutBtn].filter(Boolean);
    if (!usesSingleBottomBtn && bottomLogoutBtn) logoutButtons.push(bottomLogoutBtn);

    const updateBottomBtn = (user) => {
      if (!bottomLogoutBtn || !usesSingleBottomBtn) return;
      const img = bottomLogoutBtn.querySelector('img');
      if (img) {
        img.src = user ? 'assets/sign-out.svg' : 'assets/sign-in.svg';
        img.alt = user ? 'Sign Out' : 'Sign In';
      }
      bottomLogoutBtn.onclick = user ? logoutAction : loginAction;
      bottomLogoutBtn.style.display = 'inline-block';
    };

    const loginAction = async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        const result = await firebase.auth().signInWithPopup(provider);
        currentUser = result.user;
        clearDecisionsCache();
        clearGoalOrderCache();
        safeSet(userEmail, 'textContent', currentUser.email);
        updateBottomBtn(currentUser);
        // onAuthStateChanged will trigger onLogin
      } catch (err) {
        console.error('Login failed:', err);
      }
    };

    loginButtons.forEach(btn => btn && (btn.onclick = loginAction));

    const logoutAction = async () => {
      await auth.signOut();
      currentUser = null;
      clearDecisionsCache();
      clearGoalOrderCache();
      safeSet(userEmail, 'textContent', '');
      loginButtons.forEach(b => safeSet(b, 'style', 'display: inline-block'));
      logoutButtons.forEach(b => safeSet(b, 'style', 'display: none'));
      updateBottomBtn(null);
      // onAuthStateChanged will trigger onLogin
    };

    logoutButtons.forEach(btn => btn && (btn.onclick = logoutAction));

    auth.onAuthStateChanged(user => {
      currentUser = user;
      clearDecisionsCache();
      clearGoalOrderCache();
      safeSet(userEmail, 'textContent', user?.email || '');
      loginButtons.forEach(b => safeSet(b, 'style', user ? 'display:none' : 'display:inline-block'));
      logoutButtons.forEach(b => safeSet(b, 'style', user ? 'display:inline-block' : 'display:none'));
      updateBottomBtn(user);
      if (user) {
        try { localStorage.removeItem('budgetConfig'); } catch (e) { /* ignore */ }
      }
      onLogin(user);
    });
  };
} else {
  auth = createStubAuth(firebaseConfigMessage);
  db = createNoopDb(firebaseConfigMessage);
  authReadyPromise = Promise.resolve(null);
  applyAuthPersistence(auth);

  awaitAuthUserImpl = () => Promise.resolve(null);

  initAuthImpl = function initAuthStub({ loginBtn, logoutBtn, userEmail, bottomLoginBtn, bottomLogoutBtn } = {}, onLogin = () => {}) {
    showFirebaseWarning(firebaseConfigMessage);

    const buttons = [loginBtn, bottomLoginBtn].filter(Boolean);
    const logoutButtons = [logoutBtn, bottomLogoutBtn].filter(Boolean);

    const handleMissingConfig = () => {
      alert('Sign-in is disabled because Firebase is not configured.');
    };

    buttons.forEach(btn => {
      if (!btn) return;
      btn.style.display = 'inline-block';
      btn.onclick = handleMissingConfig;
      btn.disabled = false;
    });

    logoutButtons.forEach(btn => {
      if (!btn) return;
      btn.style.display = 'none';
      btn.onclick = null;
    });

    if (userEmail) {
      userEmail.textContent = '';
    }

    if (bottomLogoutBtn && !bottomLoginBtn) {
      const img = bottomLogoutBtn.querySelector('img');
      if (img) {
        img.src = 'assets/sign-in.svg';
        img.alt = 'Sign In';
      }
      bottomLogoutBtn.style.display = 'inline-block';
      bottomLogoutBtn.onclick = handleMissingConfig;
    }

    onLogin(null);
  };
}

export { auth, db };

export function getCurrentUser() {
  return auth.currentUser;
}

export function awaitAuthUser() {
  return awaitAuthUserImpl();
}

export function initAuth({ loginBtn, logoutBtn, userEmail, bottomLoginBtn, bottomLogoutBtn }, onLogin) {
  return initAuthImpl({ loginBtn, logoutBtn, userEmail, bottomLoginBtn, bottomLogoutBtn }, onLogin);
}

