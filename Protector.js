// ============================================
// PROTECTOR AUTOMÁTICO DE DUPLICADOS - CORREGIDO
// ============================================

(function() {
    'use strict';

    // Guardar referencias originales ANTES de modificar nada para evitar recursión
    const _createElement = document.createElement.bind(document);
    const _appendChild = Node.prototype.appendChild;
    const _insertBefore = Node.prototype.insertBefore;
    const _defineProperty = Object.defineProperty;
    
    const nativeInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');

    const CONFIG = {
        debug: true,
        modoSeguro: true,
        prevenirScriptsDuplicados: true,
        prevenirVariablesDuplicadas: true,
        prevenirFuncionesDuplicadas: true,
        prevenirConstantesDuplicadas: true,
        prevenirIDsDuplicados: true,
        prevenirClasesDuplicadas: true,
        prevenirObjetosDuplicados: true,
        prefixDuplicados: '_dup_',
        maxBackup: 5,
        scriptsCargados: new Set()
    };

    const backups = {
        variables: new Map(),
        funciones: new Map(),
        constantes: new Map(),
        ids: new Map(),
        clases: new Map(),
        objetos: new Map()
    };

    const log = (mensaje, tipo = 'info') => {
        if (!CONFIG.debug) return;
        const iconos = {
            info: 'ℹ️', warning: '⚠️', error: '❌', success: '✅', proteccion: '🛡️', script: '📜'
        };
        console.log(`${iconos[tipo] || '📌'} [Protector] ${mensaje}`);
    };

    const prevenirScriptsDuplicados = () => {
        if (!CONFIG.prevenirScriptsDuplicados) return;

        // Registrar scripts existentes
        document.querySelectorAll('script[src]').forEach(script => {
            CONFIG.scriptsCargados.add(script.src);
        });

        log(`📜 ${CONFIG.scriptsCargados.size} scripts detectados inicialmente`, 'script');

        // Interceptar createElement de forma segura usando _createElement
        document.createElement = function(tagName, options) {
            const elemento = _createElement(tagName, options);
            if (tagName && tagName.toLowerCase() === 'script') {
                // Interceptar setAttribute en scripts creados dinámicamente
                const originalSetAttribute = elemento.setAttribute;
                elemento.setAttribute = function(name, value) {
                    if (name === 'src') {
                        if (CONFIG.scriptsCargados.has(value)) {
                            log(`🛡️ Script duplicado evitado: ${value}`, 'proteccion');
                            return;
                        }
                        CONFIG.scriptsCargados.add(value);
                    }
                    return originalSetAttribute.call(this, name, value);
                };
            }
            return elemento;
        };

        // Interceptar appendChild de forma segura
        Node.prototype.appendChild = function(child) {
            if (child && child.tagName === 'SCRIPT' && child.src) {
                if (CONFIG.scriptsCargados.has(child.src)) {
                    log(`🛡️ Script duplicado evitado en appendChild: ${child.src}`, 'proteccion');
                    return child;
                }
                CONFIG.scriptsCargados.add(child.src);
            }
            return _appendChild.call(this, child);
        };

        // Interceptar insertBefore de forma segura
        Node.prototype.insertBefore = function(newNode, referenceNode) {
            if (newNode && newNode.tagName === 'SCRIPT' && newNode.src) {
                if (CONFIG.scriptsCargados.has(newNode.src)) {
                    log(`🛡️ Script duplicado evitado en insertBefore: ${newNode.src}`, 'proteccion');
                    return newNode;
                }
                CONFIG.scriptsCargados.add(newNode.src);
            }
            return _insertBefore.call(this, newNode, referenceNode);
        };
    };

    // ============ API PÚBLICA Y RESTO DE MÓDULOS ============
    const Protector = {
        config: (opciones) => Object.assign(CONFIG, opciones),
        restaurar: (tipo, nombre) => {
            const backupMap = backups[tipo + 's'];
            if (!backupMap) return false;
            const backup = backupMap.get(nombre);
            if (!backup) return false;
            window[nombre] = backup.original;
            backupMap.delete(nombre);
            return true;
        },
        getEstado: () => ({ scriptsCargados: Array.from(CONFIG.scriptsCargados) }),
        limpiar: () => {
            for (const mapa of Object.values(backups)) mapa.clear();
            CONFIG.scriptsCargados.clear();
        }
    };

    // Inicialización segura
    log('🛡️ Iniciando Protector Corregido...', 'info');
    prevenirScriptsDuplicados();
    window.Protector = Protector;

    log('✅ Protector instalado correctamente sin bucles', 'success');
})();
