// ============================================
// PUENTE HIGH-PERFORMANCE CON SWR, LOCALSTORAGE Y FLUENT EXTENSIONS
// ============================================
(function(global) {
  'use strict';

  const GAS_API_URL = 'https://grouvex-proxy.grouvex.workers.dev/';
  const CACHE_PREFIX = 'GAS_SWR_';

  const DEFAULTS = Object.freeze({
    timeout: 25000,
    retries: 3,
    delay: 1000
  });

  const FETCH_HEADERS = Object.freeze({ 'Content-Type': 'text/plain;charset=utf-8' });
  const inFlightRequests = new Map();

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms + (Math.random() * 150)));
  }

  // --- MÓDULO DE STORAGE CON SWR ---
  function getCachedItem(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function setCachedItem(key, data, ttlMs) {
    try {
      const payload = {
        data: data,
        expiry: Date.now() + ttlMs,
        hash: JSON.stringify(data)
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
    } catch (_) {}
  }

  /**
   * Ejecutor con reintentos y lógica Stale-While-Revalidate
   */
  async function executeWithRetry(functionName, args, config) {
    const maxRetries = config.retries ?? DEFAULTS.retries;
    const baseDelay = config.retryDelay ?? DEFAULTS.delay;
    const timeoutMs = config.timeout ?? DEFAULTS.timeout;
    const ttlMs = config.swrTtl || config.ttl || 0;
    const isSWR = Boolean(config.swrTtl);
    const payloadArray = Array.isArray(args) ? args : [args];

    const cacheKey = `${functionName}:${JSON.stringify(payloadArray)}`;
    const cachedEntry = ttlMs > 0 ? getCachedItem(cacheKey) : null;
    const now = Date.now();

    const notifyLoading = (isLoading) => {
      if (typeof config.onLoading === 'function') config.onLoading(isLoading);
    };

    const applyTransform = (data) => {
      return typeof config.transform === 'function' ? config.transform(data) : data;
    };

    // 0. ACTUALIZACIÓN OPTIMISTA
    if (config.optimisticData !== undefined && typeof config.optimisticFn === 'function') {
      config.optimisticFn(config.optimisticData);
    }

    notifyLoading(true);

    // 1. SI LA CACHÉ SIGUE FRESCA (DENTRO DEL TTL)
    if (cachedEntry && now <= cachedEntry.expiry) {
      console.log(`⚡ [Cache Hit Fresco] ${functionName}`);
      notifyLoading(false);
      const transformedData = applyTransform(cachedEntry.data);
      if (typeof config.success === 'function') {
        config.success(transformedData, config.userObj);
      }
      return transformedData;
    }

    // 2. SI SWR ESTÁ ACTIVO Y TENEMOS DATOS CADUCADOS (STALE)
    let staleDataReturned = false;
    let staleTransformedData = null;

    if (isSWR && cachedEntry) {
      console.log(`📦 [SWR Stale] Entregando caché guardada para '${functionName}' mientras se actualiza...`);
      staleDataReturned = true;
      staleTransformedData = applyTransform(cachedEntry.data);
      if (typeof config.success === 'function') {
        config.success(staleTransformedData, config.userObj);
      }
    }

    // 3. DEDUPLICACIÓN DE PETICIONES EN VUELO
    if (inFlightRequests.has(cacheKey)) {
      const inFlightPromise = inFlightRequests.get(cacheKey);
      return staleDataReturned ? staleTransformedData : inFlightPromise;
    }

    // 4. REVALIDACIÓN EN SEGUNDO PLANO (FETCH AL SERVIDOR)
    const task = (async () => {
      let lastError = null;

      try {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          if (config.signal) {
            config.signal.addEventListener('abort', () => controller.abort());
          }

          try {
            const response = await fetch(GAS_API_URL, {
              method: 'POST',
              mode: 'cors',
              headers: FETCH_HEADERS,
              body: JSON.stringify({ action: functionName, args: payloadArray }),
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const text = await response.text();
            let result;
            try {
              result = JSON.parse(text);
            } catch (_) {
              throw new Error("Respuesta no válida del servidor");
            }

            if (!result.success) throw new Error(result.error || "Error en el servidor");

            const newData = result.data;
            const newHash = JSON.stringify(newData);
            const hasChanged = !cachedEntry || cachedEntry.hash !== newHash;

            if (ttlMs > 0) {
              setCachedItem(cacheKey, newData, ttlMs);
            }

            if (config.invalidates) {
              global.google.script.clearCache(config.invalidates);
            }

            const transformedNewData = applyTransform(newData);

            if (staleDataReturned) {
              if (hasChanged) {
                console.log(`🔄 [SWR Update] ¡Los datos de '${functionName}' cambiaron! Actualizando UI...`);
                if (typeof config.onUpdate === 'function') {
                  config.onUpdate(transformedNewData, config.userObj);
                } else if (typeof config.success === 'function') {
                  config.success(transformedNewData, config.userObj);
                }
              } else {
                console.log(`✅ [SWR Verified] Los datos de '${functionName}' no sufrieron cambios en el servidor.`);
              }
              return transformedNewData;
            }

            if (typeof config.success === 'function') {
              config.success(transformedNewData, config.userObj);
            }

            return transformedNewData;

          } catch (error) {
            clearTimeout(timeoutId);
            const isAbort = error.name === 'AbortError';
            const isNetworkError = error instanceof TypeError || isAbort || error.message.includes('HTTP');

            lastError = isAbort ? new Error(`Timeout (${timeoutMs}ms)`) : error;
            if (!isNetworkError || attempt >= maxRetries) break;

            await wait(baseDelay * (1 << attempt));
          }
        }

        const finalErrMsg = lastError ? lastError.message : "Error tras reintentos";
        
        if (staleDataReturned) {
          console.warn(`⚠️ No se pudo revalidar '${functionName}', pero la UI mantendrá los datos en caché.`);
          return staleTransformedData;
        }

        if (typeof config.failure === 'function') {
          config.failure(finalErrMsg, config.userObj);
        }
        throw new Error(finalErrMsg);

      } finally {
        notifyLoading(false);
      }
    })();

    inFlightRequests.set(cacheKey, task);
    try {
      const freshData = await task;
      return staleDataReturned ? staleTransformedData : freshData;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }

  // --- MAPA DE MÉTODOS FLUENT (CONFIGURADORES LOCALES) ---
  const FLUENT_METHODS = {
    withSuccessHandler: (cfg, fn) => ({ ...cfg, success: fn }),
    withFailureHandler: (cfg, fn) => ({ ...cfg, failure: fn }),
    withUserObject: (cfg, obj) => ({ ...cfg, userObj: obj }),
    withTimeout: (cfg, ms) => ({ ...cfg, timeout: ms }),
    withRetries: (cfg, r, d) => ({ ...cfg, retries: r, retryDelay: d }),
    withCache: (cfg, ttlMs) => ({ ...cfg, ttl: ttlMs }),
    withSWR: (cfg, ttlMs) => ({ ...cfg, swrTtl: ttlMs }),
    onUpdate: (cfg, fn) => ({ ...cfg, onUpdate: fn }),
    invalidates: (cfg, pattern) => ({ ...cfg, invalidates: pattern }),
    withLoading: (cfg, fn) => ({ ...cfg, onLoading: fn }),
    transform: (cfg, fn) => ({ ...cfg, transform: fn }),
    withOptimistic: (cfg, data, updateFn) => ({ ...cfg, optimisticData: data, optimisticFn: updateFn }),
    withSignal: (cfg, signal) => ({ ...cfg, signal })
  };

  // --- CLASS RUNNER FLUENT ---
  class ScriptRunner {
    constructor(config = {}) {
      this._config = Object.freeze({ ...config });
  
      return new Proxy(this, {
        get: (target, prop) => {
          // 1. Ignorar símbolos y propiedades reservadas de Promesas / JS Runtime / Inspectores
          if (
            typeof prop === 'symbol' ||
            prop === 'then' ||
            prop === 'catch' ||
            prop === 'finally' ||
            prop === 'toJSON' ||
            prop === 'prototype' ||
            prop === 'constructor' ||
            prop === 'toString' ||
            prop === 'valueOf'
          ) {
            return undefined;
          }
  
          // 2. Si la propiedad existe nativamente en target
          if (prop in target) {
            return target[prop];
          }
  
          // 3. ¿Es un método configurador (builder)?
          if (Object.prototype.hasOwnProperty.call(FLUENT_METHODS, prop)) {
            return (...args) => {
              const nextConfig = FLUENT_METHODS[prop](target._config, ...args);
              return new ScriptRunner(nextConfig);
            };
          }
  
          // 4. Invocación de función remota (solo si es un string válido que no sea "undefined")
          if (typeof prop === 'string' && prop !== 'undefined') {
            return (...args) => executeWithRetry(prop, args, target._config);
          }
  
          return undefined;
        }
      });
    }
  }

  global.google = global.google || {};
  global.google.script = global.google.script || {};
  global.google.script.run = new ScriptRunner();

  // Limpieza de caché
  global.google.script.clearCache = function(pattern) {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          if (!pattern || key.includes(pattern)) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      console.log(`🧹 Caché SWR eliminada (${keysToRemove.length} elementos)`);
    } catch (e) {
      console.error(e);
    }
  };

})(typeof window !== 'undefined' ? window : this);
