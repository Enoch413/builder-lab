(function () {
  const params = new URLSearchParams(window.location.search);
  const isEmbedded = params.get("embed") === "1";
  const embedClass = "code-lab-embedded";

  if (!isEmbedded) {
    return;
  }

  const pageName = (window.location.pathname || "").split("/").pop().toLowerCase();
  document.documentElement.classList.add(embedClass);

  const baseCss = `
html.${embedClass},
html.${embedClass} body,
body.${embedClass}{
  min-height:0 !important;
  overflow-y:visible !important;
}
`;

  const rotationSetCss = `
html.${embedClass} .passage-tab-list,
html.${embedClass} .passage-editor-shell,
html.${embedClass} .passage-editor-body,
html.${embedClass} .p-card.open .p-card-body,
html.${embedClass} .assign-checklist,
html.${embedClass} .inline-answer-content,
html.${embedClass} .sidebar,
html.${embedClass} .main{
  max-height:none !important;
  height:auto !important;
  overflow:visible !important;
}

html.${embedClass} .passage-editor-shell,
html.${embedClass} .main,
html.${embedClass} .sidebar,
html.${embedClass} #class-screen{
  min-height:0 !important;
}
`;

  const style = document.createElement("style");
  style.textContent = baseCss + (pageName === "prep_set_builder.html" ? rotationSetCss : "");
  document.head.appendChild(style);

  const applyBodyClass = () => {
    if (document.body) {
      document.body.classList.add(embedClass);
    }
  };

  const postHeight = () => {
    const body = document.body;
    const html = document.documentElement;
    const height = Math.max(
      body ? body.scrollHeight : 0,
      html ? html.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      html ? html.offsetHeight : 0
    );

    window.parent.postMessage(
      {
        type: "CODE_LAB_EMBED_HEIGHT",
        height
      },
      "*"
    );
  };

  let frameRequest = 0;
  const scheduleHeightPost = () => {
    if (frameRequest) {
      cancelAnimationFrame(frameRequest);
    }

    frameRequest = requestAnimationFrame(() => {
      frameRequest = 0;
      postHeight();
    });
  };

  const startBridge = () => {
    applyBodyClass();
    scheduleHeightPost();

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => scheduleHeightPost());
      resizeObserver.observe(document.documentElement);
      if (document.body) {
        resizeObserver.observe(document.body);
      }
    }

    const mutationObserver = new MutationObserver(() => scheduleHeightPost());
    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    document.addEventListener("input", scheduleHeightPost, true);
    document.addEventListener("change", scheduleHeightPost, true);
    window.addEventListener("resize", scheduleHeightPost);
    window.addEventListener("load", scheduleHeightPost);
    window.addEventListener("message", event => {
      if (event.data && event.data.type === "CODE_LAB_EMBED_PING") {
        scheduleHeightPost();
      }
    });

    setTimeout(scheduleHeightPost, 80);
    setTimeout(scheduleHeightPost, 240);
    setTimeout(scheduleHeightPost, 800);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startBridge, { once: true });
  } else {
    startBridge();
  }
})();

(function () {
  const FIREBASE_SCRIPT_URLS = [
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
  ];
  const CONTEXT_KEYS = ["__BUILDER_LAB_AUTH_CONTEXT__", "__CODE_LAB_AUTH_CONTEXT__"];
  const CONFIG_KEYS = ["__FIREBASE_CONFIG__", "FIREBASE_CONFIG", "firebaseConfig", "__firebaseConfig"];
  const STORAGE_PREFIX = "builder-lab:last-class";

  let firebaseEnvPromise = null;
  const loadedScripts = {};

  function getParentWindow() {
    if (!window.parent || window.parent === window) {
      return null;
    }

    try {
      void window.parent.location.href;
      return window.parent;
    } catch (error) {
      return null;
    }
  }

  function getCandidateRoots() {
    const roots = [window];
    const parentWindow = getParentWindow();
    if (parentWindow) {
      roots.push(parentWindow);
    }
    return roots;
  }

  function uniqueStringList(values) {
    const result = [];
    const seen = new Set();

    (Array.isArray(values) ? values : []).forEach(function (value) {
      const normalized = String(value || "").trim();
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      result.push(normalized);
    });

    return result;
  }

  function getStoredContext() {
    const roots = getCandidateRoots();
    for (let rootIndex = 0; rootIndex < roots.length; rootIndex += 1) {
      const root = roots[rootIndex];
      for (let keyIndex = 0; keyIndex < CONTEXT_KEYS.length; keyIndex += 1) {
        const key = CONTEXT_KEYS[keyIndex];
        if (!root || !root[key]) {
          continue;
        }

        const context = root[key];
        const user = context.user || context.authUser || null;
        const profile = context.profile || context.userProfile || context;
        const uid = String(context.uid || (user && user.uid) || "").trim();

        if (!uid) {
          continue;
        }

        return {
          uid: uid,
          role: String(profile && profile.role || "").trim(),
          adminScope: String(profile && profile.adminScope || "").trim(),
          classIds: uniqueStringList(profile && profile.classIds),
          source: "host-context"
        };
      }
    }

    return null;
  }

  function discoverFirebaseConfig() {
    const roots = getCandidateRoots();
    for (let rootIndex = 0; rootIndex < roots.length; rootIndex += 1) {
      const root = roots[rootIndex];
      for (let keyIndex = 0; keyIndex < CONFIG_KEYS.length; keyIndex += 1) {
        const key = CONFIG_KEYS[keyIndex];
        if (!root || !root[key] || typeof root[key] !== "object") {
          continue;
        }
        return root[key];
      }
    }
    return null;
  }

  function hasInitializedFirebase(root) {
    return !!(
      root &&
      root.firebase &&
      typeof root.firebase.auth === "function" &&
      typeof root.firebase.firestore === "function" &&
      Array.isArray(root.firebase.apps) &&
      root.firebase.apps.length
    );
  }

  function loadScript(src) {
    if (loadedScripts[src]) {
      return loadedScripts[src];
    }

    loadedScripts[src] = new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-builder-lab-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === "1") {
          resolve();
          return;
        }
        existing.addEventListener("load", function () { resolve(); }, { once: true });
        existing.addEventListener("error", function (error) { reject(error); }, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.builderLabSrc = src;
      script.onload = function () {
        script.dataset.loaded = "1";
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return loadedScripts[src];
  }

  function ensureFirebaseCompat(config) {
    if (hasInitializedFirebase(window)) {
      return Promise.resolve(window.firebase);
    }

    return FIREBASE_SCRIPT_URLS.reduce(function (chain, src) {
      return chain.then(function () {
        return loadScript(src);
      });
    }, Promise.resolve()).then(function () {
      if (!window.firebase) {
        return null;
      }

      if (!Array.isArray(window.firebase.apps) || !window.firebase.apps.length) {
        window.firebase.initializeApp(config);
        return window.firebase;
      }

      return window.firebase;
    }).catch(function () {
      return null;
    });
  }

  function getFirebaseEnv() {
    if (firebaseEnvPromise) {
      return firebaseEnvPromise;
    }

    firebaseEnvPromise = Promise.resolve().then(function () {
      const roots = getCandidateRoots();
      for (let index = 0; index < roots.length; index += 1) {
        const root = roots[index];
        if (hasInitializedFirebase(root)) {
          return {
            firebase: root.firebase,
            source: root === window ? "window-firebase" : "parent-firebase"
          };
        }
      }

      const config = discoverFirebaseConfig();
      if (!config) {
        return null;
      }

      return ensureFirebaseCompat(config).then(function (firebase) {
        if (!firebase) {
          return null;
        }
        return {
          firebase: firebase,
          source: "local-firebase"
        };
      });
    }).catch(function () {
      return null;
    });

    return firebaseEnvPromise;
  }

  function waitForFirebaseUser(auth) {
    if (!auth || typeof auth.onAuthStateChanged !== "function") {
      return Promise.resolve(null);
    }

    if (auth.currentUser) {
      return Promise.resolve(auth.currentUser);
    }

    return new Promise(function (resolve) {
      let settled = false;
      let unsubscribe = null;

      function finish(user) {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
        resolve(user || null);
      }

      const timeoutId = setTimeout(function () {
        finish(auth.currentUser || null);
      }, 1500);

      try {
        unsubscribe = auth.onAuthStateChanged(function (user) {
          finish(user || null);
        }, function () {
          finish(auth.currentUser || null);
        });
      } catch (error) {
        finish(auth.currentUser || null);
      }
    });
  }

  function normalizeProfileContext(context) {
    if (!context || !context.uid) {
      return null;
    }

    return {
      uid: String(context.uid || "").trim(),
      role: String(context.role || "").trim(),
      adminScope: String(context.adminScope || "").trim(),
      classIds: uniqueStringList(context.classIds),
      source: String(context.source || "").trim()
    };
  }

  async function readCurrentProfileContext() {
    const firebaseEnv = await getFirebaseEnv();
    if (firebaseEnv && firebaseEnv.firebase) {
      try {
        const auth = firebaseEnv.firebase.auth();
        const user = await waitForFirebaseUser(auth);
        if (user && user.uid) {
          const snapshot = await firebaseEnv.firebase
            .firestore()
            .collection("users")
            .doc(user.uid)
            .get();

          const profile = snapshot && snapshot.exists ? (snapshot.data() || {}) : {};
          return normalizeProfileContext({
            uid: user.uid,
            role: profile.role,
            adminScope: profile.adminScope,
            classIds: profile.classIds,
            source: firebaseEnv.source
          });
        }
      } catch (error) {
        // Fall through to host-provided context and existing builder defaults.
      }
    }

    const directContext = normalizeProfileContext(getStoredContext());
    if (directContext) {
      return directContext;
    }

    return null;
  }

  function buildLastClassStorageKey(labName, uid) {
    return [STORAGE_PREFIX, String(labName || "").trim(), String(uid || "").trim()].join(":");
  }

  function readLastClassId(labName, uid) {
    try {
      return String(localStorage.getItem(buildLastClassStorageKey(labName, uid)) || "").trim();
    } catch (error) {
      return "";
    }
  }

  function rememberLastClassId(labName, uid, classId) {
    const normalizedClassId = String(classId || "").trim();
    const normalizedUid = String(uid || "").trim();
    const normalizedLabName = String(labName || "").trim();
    if (!normalizedClassId || !normalizedUid || !normalizedLabName) {
      return;
    }

    try {
      localStorage.setItem(buildLastClassStorageKey(normalizedLabName, normalizedUid), normalizedClassId);
    } catch (error) {
      // Ignore localStorage failures and keep fallback behaviour.
    }
  }

  function buildClassInfoMap(classes) {
    const map = new Map();
    (Array.isArray(classes) ? classes : []).forEach(function (classInfo) {
      const classId = String(classInfo && classInfo.id || "").trim();
      if (!classId || map.has(classId)) {
        return;
      }

      map.set(classId, {
        id: classId,
        name: String(classInfo && classInfo.name || classId).trim() || classId,
        password: String(classInfo && classInfo.password || "").trim()
      });
    });
    return map;
  }

  function pickPreferredClassId(profileClassIds, storedClassId) {
    const scopedIds = uniqueStringList(profileClassIds);
    if (!scopedIds.length) {
      return "";
    }
    if (scopedIds.length === 1) {
      return scopedIds[0];
    }
    return scopedIds.includes(storedClassId) ? storedClassId : scopedIds[0];
  }

  async function resolveLabAdminDefaults(options) {
    const settings = options || {};
    const labName = String(settings.labName || "").trim();
    const classes = Array.isArray(settings.classes) ? settings.classes : [];
    const fallbackClassIds = uniqueStringList(classes.map(function (classInfo) {
      return classInfo && classInfo.id;
    }));
    const profileContext = await readCurrentProfileContext();

    if (!profileContext || profileContext.role !== "admin") {
      return {
        applied: false,
        profile: profileContext,
        classIds: fallbackClassIds,
        defaultClassId: ""
      };
    }

    if (profileContext.adminScope === "all" && !profileContext.classIds.length) {
      return {
        applied: false,
        profile: profileContext,
        classIds: fallbackClassIds,
        defaultClassId: ""
      };
    }

    if (!profileContext.classIds.length) {
      return {
        applied: false,
        profile: profileContext,
        classIds: fallbackClassIds,
        defaultClassId: ""
      };
    }

    const classInfoMap = buildClassInfoMap(classes);
    const storedClassId = readLastClassId(labName, profileContext.uid);
    const defaultClassId = pickPreferredClassId(profileContext.classIds, storedClassId);
    const orderedClassIds = uniqueStringList([defaultClassId].concat(profileContext.classIds));
    const resolvedClasses = orderedClassIds.map(function (classId) {
      const existing = classInfoMap.get(classId);
      if (existing) {
        return existing;
      }
      return {
        id: classId,
        name: classId,
        password: ""
      };
    });

    return {
      applied: true,
      profile: profileContext,
      classIds: orderedClassIds,
      defaultClassId: defaultClassId,
      classes: resolvedClasses,
      storageKey: buildLastClassStorageKey(labName, profileContext.uid)
    };
  }

  window.builderLabAuth = {
    readCurrentProfileContext: readCurrentProfileContext,
    resolveLabAdminDefaults: resolveLabAdminDefaults,
    readLastClassId: readLastClassId,
    rememberLastClassId: rememberLastClassId,
    buildLastClassStorageKey: buildLastClassStorageKey
  };
})();
