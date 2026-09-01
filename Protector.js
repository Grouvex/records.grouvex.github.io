// ============================================
// PROTECTOR AUTOMÁTICO DE DUPLICADOS - VERSIÓN COMPLETA
// ============================================

(function() {
    'use strict';

    // ============ CONFIGURACIÓN ============
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

    // ============ ALMACENAMIENTO ============
    const backups = {
        variables: new Map(),
        funciones: new Map(),
        constantes: new Map(),
        ids: new Map(),
        clases: new Map(),
        objetos: new Map()
    };

    // ============ SISTEMA DE LOG ============
    const log = (mensaje, tipo = 'info') => {
        if (!CONFIG.debug) return;
        const iconos = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅',
            proteccion: '🛡️',
            script: '📜'
        };
        console.log(`${iconos[tipo] || '📌'} [Protector] ${mensaje}`);
    };

    // ============ 1. PREVENIR SCRIPTS DUPLICADOS ============
    const prevenirScriptsDuplicados = () => {
        if (!CONFIG.prevenirScriptsDuplicados) return;

        // Guardar los scripts originales
        const scriptsOriginales = Array.from(document.querySelectorAll('script[src]'));
        scriptsOriginales.forEach(script => {
            CONFIG.scriptsCargados.add(script.src);
        });

        log(`📜 ${CONFIG.scriptsCargados.size} scripts detectados inicialmente`, 'script');

        // Interceptar la creación de nuevos scripts
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName, options) {
            const elemento = originalCreateElement.call(this, tagName, options);

            if (tagName.toLowerCase() === 'script' && options && options.src) {
                // Si es un script con src, verificar duplicado
                const src = options.src;
                if (CONFIG.scriptsCargados.has(src)) {
                    log(`🛡️ Script duplicado detectado: ${src}`, 'proteccion');
                    // Retornar un script vacío que no haga nada
                    const scriptVacio = originalCreateElement.call(this, 'script');
                    scriptVacio.setAttribute('data-duplicado', 'true');
                    scriptVacio.setAttribute('data-src-original', src);
                    return scriptVacio;
                }
            }

            // Interceptar la asignación de src en scripts
            const originalSetAttribute = elemento.setAttribute;
            elemento.setAttribute = function(name, value) {
                if (name === 'src' && tagName.toLowerCase() === 'script') {
                    if (CONFIG.scriptsCargados.has(value)) {
                        log(`🛡️ Script duplicado detectado: ${value}`, 'proteccion');
                        // No agregar el script duplicado
                        return;
                    }
                    CONFIG.scriptsCargados.add(value);
                    log(`📜 Script cargado: ${value}`, 'script');
                }
                return originalSetAttribute.call(this, name, value);
            };

            // También interceptar la propiedad src
            const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
            if (originalSrcDescriptor) {
                Object.defineProperty(elemento, 'src', {
                    get: function() {
                        return originalSrcDescriptor.get.call(this);
                    },
                    set: function(value) {
                        if (CONFIG.scriptsCargados.has(value)) {
                            log(`🛡️ Script duplicado detectado: ${value}`, 'proteccion');
                            return;
                        }
                        CONFIG.scriptsCargados.add(value);
                        log(`📜 Script cargado: ${value}`, 'script');
                        originalSrcDescriptor.set.call(this, value);
                    }
                });
            }

            return elemento;
        };

        // Interceptar appendChild para scripts
        const originalAppendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function(child) {
            if (child.tagName === 'SCRIPT' && child.src) {
                if (CONFIG.scriptsCargados.has(child.src)) {
                    log(`🛡️ Script duplicado evitado: ${child.src}`, 'proteccion');
                    // No agregar el script duplicado
                    return child;
                }
                CONFIG.scriptsCargados.add(child.src);
                log(`📜 Script agregado: ${child.src}`, 'script');
            }
            return originalAppendChild.call(this, child);
        };

        // Interceptar insertBefore para scripts
        const originalInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function(newNode, referenceNode) {
            if (newNode.tagName === 'SCRIPT' && newNode.src) {
                if (CONFIG.scriptsCargados.has(newNode.src)) {
                    log(`🛡️ Script duplicado evitado: ${newNode.src}`, 'proteccion');
                    return newNode;
                }
                CONFIG.scriptsCargados.add(newNode.src);
                log(`📜 Script insertado: ${newNode.src}`, 'script');
            }
            return originalInsertBefore.call(this, newNode, referenceNode);
        };

        // También interceptar innerHTML para scripts en HTML
        const originalInnerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (originalInnerHTMLDescriptor) {
            Object.defineProperty(Element.prototype, 'innerHTML', {
                get: function() {
                    return originalInnerHTMLDescriptor.get.call(this);
                },
                set: function(value) {
                    // Buscar scripts en el HTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = value;
                    const scripts = tempDiv.querySelectorAll('script[src]');
                    
                    let htmlModificado = value;
                    scripts.forEach(script => {
                        const src = script.src;
                        if (CONFIG.scriptsCargados.has(src)) {
                            log(`🛡️ Script duplicado en HTML: ${src}`, 'proteccion');
                            // Eliminar el script duplicado del HTML
                            const regex = new RegExp(`<script[^>]*src=["']${src}["'][^>]*>[\\s\\S]*?<\\/script>`, 'gi');
                            htmlModificado = htmlModificado.replace(regex, '<!-- Script duplicado eliminado -->');
                        } else {
                            CONFIG.scriptsCargados.add(src);
                            log(`📜 Script en HTML: ${src}`, 'script');
                        }
                    });
                    
                    originalInnerHTMLDescriptor.set.call(this, htmlModificado);
                }
            });
        }
    };

    // ============ 2. PROTECTOR DE VARIABLES ============
    const protegerVariable = (nombre, valor, contexto = window) => {
        if (!CONFIG.prevenirVariablesDuplicadas) return valor;

        const exists = nombre in contexto;
        const original = contexto[nombre];

        if (exists && CONFIG.modoSeguro) {
            if (!backups.variables.has(nombre)) {
                backups.variables.set(nombre, {
                    original: original,
                    backups: [original],
                    timestamp: Date.now()
                });
            } else {
                const backup = backups.variables.get(nombre);
                if (backup.backups.length < CONFIG.maxBackup) {
                    backup.backups.push(original);
                }
            }

            const nuevoNombre = `${CONFIG.prefixDuplicados}${nombre}_${Date.now()}`;
            contexto[nuevoNombre] = valor;
            log(`🛡️ Variable duplicada "${nombre}" -> "${nuevoNombre}"`, 'proteccion');
            return contexto[nuevoNombre];
        } else if (!exists) {
            contexto[nombre] = valor;
            log(`✅ Variable creada: ${nombre}`, 'success');
            return valor;
        }

        return original;
    };

    // ============ 3. PROTECTOR DE FUNCIONES ============
    const protegerFuncion = (nombre, fn, contexto = window) => {
        if (!CONFIG.prevenirFuncionesDuplicadas) return fn;

        const exists = nombre in contexto;
        const original = contexto[nombre];

        if (exists && typeof original === 'function' && CONFIG.modoSeguro) {
            if (!backups.funciones.has(nombre)) {
                backups.funciones.set(nombre, {
                    original: original,
                    backups: [original],
                    timestamp: Date.now()
                });
            }

            const nuevaFuncion = function(...args) {
                log(`🛡️ Función "${nombre}" ejecutando ambas`, 'proteccion');
                let resultadoOriginal, resultadoNuevo;
                try {
                    resultadoOriginal = original.apply(this, args);
                } catch (e) {
                    log(`Error en original "${nombre}": ${e.message}`, 'error');
                }
                try {
                    resultadoNuevo = fn.apply(this, args);
                } catch (e) {
                    log(`Error en nueva "${nombre}": ${e.message}`, 'error');
                }
                return resultadoNuevo || resultadoOriginal;
            };

            Object.assign(nuevaFuncion, fn, original);
            const nuevoNombre = `${CONFIG.prefixDuplicados}${nombre}`;
            contexto[nuevoNombre] = fn;
            contexto[nombre] = nuevaFuncion;
            
            log(`🛡️ Función "${nombre}" combinada`, 'proteccion');
            return nuevaFuncion;
        } else if (!exists) {
            contexto[nombre] = fn;
            log(`✅ Función creada: ${nombre}`, 'success');
            return fn;
        }

        return original;
    };

    // ============ 4. PROTECTOR DE CONSTANTES ============
    const protegerConstante = (nombre, valor, contexto = window) => {
        if (!CONFIG.prevenirConstantesDuplicadas) return valor;

        const exists = nombre in contexto;

        if (exists && CONFIG.modoSeguro) {
            const nuevoNombre = `${CONFIG.prefixDuplicados}${nombre}_${Date.now()}`;
            Object.defineProperty(contexto, nuevoNombre, {
                value: valor,
                writable: false,
                configurable: false,
                enumerable: true
            });
            log(`🛡️ Constante duplicada "${nombre}" -> "${nuevoNombre}"`, 'proteccion');
            return contexto[nuevoNombre];
        } else if (!exists) {
            Object.defineProperty(contexto, nombre, {
                value: valor,
                writable: false,
                configurable: false,
                enumerable: true
            });
            log(`✅ Constante creada: ${nombre}`, 'success');
            return valor;
        }

        return contexto[nombre];
    };

    // ============ 5. PROTECTOR DE IDs ============
    const protegerID = (id, elemento) => {
        if (!CONFIG.prevenirIDsDuplicados) return elemento;

        const exists = document.getElementById(id);
        if (exists) {
            const nuevoId = `${id}_${Date.now()}`;
            elemento.id = nuevoId;
            if (!backups.ids.has(id)) {
                backups.ids.set(id, {
                    original: exists,
                    backups: [exists],
                    timestamp: Date.now()
                });
            }
            log(`🛡️ ID duplicado "${id}" -> "${nuevoId}"`, 'proteccion');
            return elemento;
        }

        elemento.id = id;
        log(`✅ ID creado: ${id}`, 'success');
        return elemento;
    };

    // ============ 6. PROTECTOR DE CLASES ============
    const protegerClase = (clase, elemento) => {
        if (!CONFIG.prevenirClasesDuplicadas) return elemento;

        const existe = document.querySelector(`.${clase}`);
        if (existe) {
            const nuevaClase = `${clase}_${Date.now()}`;
            elemento.classList.add(nuevaClase);
            if (!backups.clases.has(clase)) {
                backups.clases.set(clase, {
                    original: existe,
                    backups: [existe],
                    timestamp: Date.now()
                });
            }
            log(`🛡️ Clase duplicada "${clase}" -> "${nuevaClase}"`, 'proteccion');
            return elemento;
        }

        elemento.classList.add(clase);
        log(`✅ Clase creada: ${clase}`, 'success');
        return elemento;
    };

    // ============ 7. PROTECTOR DE OBJETOS ============
    const protegerObjeto = (nombre, objeto, contexto = window) => {
        if (!CONFIG.prevenirObjetosDuplicados) return objeto;

        const exists = nombre in contexto;
        const original = contexto[nombre];

        if (exists && typeof original === 'object' && CONFIG.modoSeguro) {
            const nuevoObjeto = { ...original, ...objeto };
            
            if (!backups.objetos.has(nombre)) {
                backups.objetos.set(nombre, {
                    original: original,
                    backups: [original],
                    timestamp: Date.now()
                });
            }

            const nuevoNombre = `${CONFIG.prefixDuplicados}${nombre}_${Date.now()}`;
            contexto[nuevoNombre] = objeto;
            contexto[nombre] = nuevoObjeto;
            
            log(`🛡️ Objeto "${nombre}" combinado`, 'proteccion');
            return nuevoObjeto;
        } else if (!exists) {
            contexto[nombre] = objeto;
            log(`✅ Objeto creado: ${nombre}`, 'success');
            return objeto;
        }

        return original;
    };

    // ============ 8. MONITOREO DE SCRIPTS EXISTENTES ============
    const monitorearScriptsExistentes = () => {
        // Escuchar cuando se agregan scripts dinámicamente
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.tagName === 'SCRIPT' && node.src) {
                        if (CONFIG.scriptsCargados.has(node.src)) {
                            log(`🛡️ Script duplicado detectado (MutationObserver): ${node.src}`, 'proteccion');
                            node.remove(); // Eliminar el script duplicado
                        } else {
                            CONFIG.scriptsCargados.add(node.src);
                            log(`📜 Script detectado: ${node.src}`, 'script');
                        }
                    }
                });
            });
        });

        observer.observe(document.head, {
            childList: true,
            subtree: true
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    };

    // ============ 9. INTERCEPTAR DECLARACIONES GLOBALES ============
    const interceptarDeclaraciones = () => {
        // Interceptar Object.defineProperty en window
        const originalDefineProperty = Object.defineProperty;
        Object.defineProperty = function(obj, prop, descriptor) {
            if (obj === window && CONFIG.modoSeguro) {
                const valor = descriptor.value;
                if (typeof valor === 'function' && !prop.startsWith('_')) {
                    log(`🛡️ Función interceptada: ${prop}`, 'info');
                    const fn = valor;
                    descriptor.value = function(...args) {
                        return fn.apply(this, args);
                    };
                }
            }
            return originalDefineProperty.call(this, obj, prop, descriptor);
        };
    };

    // ============ 10. API PÚBLICA ============
    const Protector = {
        config: (opciones) => {
            Object.assign(CONFIG, opciones);
            log('Configuración actualizada', 'info');
        },

        // Proteger todo tipo de recursos
        proteger: {
            variable: protegerVariable,
            funcion: protegerFuncion,
            constante: protegerConstante,
            id: protegerID,
            clase: protegerClase,
            objeto: protegerObjeto
        },

        // Restaurar backups
        restaurar: (tipo, nombre) => {
            const backupMap = backups[tipo + 's'];
            if (!backupMap) return false;
            
            const backup = backupMap.get(nombre);
            if (!backup) return false;
            
            window[nombre] = backup.original;
            backupMap.delete(nombre);
            log(`✅ Restaurado ${tipo}: ${nombre}`, 'success');
            return true;
        },

        // Obtener estado
        getEstado: () => ({
            scriptsCargados: Array.from(CONFIG.scriptsCargados),
            backups: Object.fromEntries(
                Object.entries(backups).map(([key, map]) => [key, Array.from(map.keys())])
            ),
            config: CONFIG
        }),

        // Limpiar
        limpiar: (tipo = null) => {
            if (tipo && backups[tipo]) {
                backups[tipo].clear();
                log(`🧹 Backups de ${tipo} limpiados`, 'info');
            } else {
                for (const mapa of Object.values(backups)) {
                    mapa.clear();
                }
                CONFIG.scriptsCargados.clear();
                log('🧹 Todos los backups limpiados', 'info');
            }
        },

        // Modo debug
        setDebug: (debug) => {
            CONFIG.debug = debug;
            log(`Debug: ${debug ? 'activado' : 'desactivado'}`, 'info');
        }
    };

    // ============ INICIALIZACIÓN ============
    log('🛡️ Iniciando Protector Ultra Completo...', 'info');

    // 1. Prevenir scripts duplicados
    prevenirScriptsDuplicados();

    // 2. Monitorear scripts existentes
    monitorearScriptsExistentes();

    // 3. Interceptar declaraciones
    interceptarDeclaraciones();

    // 4. Exponer API global
    window.Protector = Protector;
    window.$proteger = Protector.proteger;

    // 5. Alias cortos
    window.$var = Protector.proteger.variable;
    window.$fn = Protector.proteger.funcion;
    window.$const = Protector.proteger.constante;
    window.$id = Protector.proteger.id;
    window.$class = Protector.proteger.clase;
    window.$obj = Protector.proteger.objeto;

    log('✅ Protector Ultra Completo instalado', 'success');
    log(`📜 Scripts detectados: ${CONFIG.scriptsCargados.size}`, 'script');

})();
