// Banco de dados SQLite via sql.js (WASM) + persistência no IndexedDB
// Substitui o localStorage como camada de persistência

const IDB_NAME = 'focus_sqlite';
const IDB_STORE = 'store';
const IDB_KEY = 'db';
const WASM_URL = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm';

let _db = null;
let _persistTimer = null;

function _idbOpen() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

async function _loadFromIDB() {
    try {
        const idb = await _idbOpen();
        return new Promise((resolve) => {
            const tx = idb.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
}

async function _saveToIDB(data) {
    try {
        const idb = await _idbOpen();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(data, IDB_KEY);
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
    } catch (e) { console.error('[DB] Erro ao salvar no IndexedDB:', e); }
}

// Debounce das escritas para evitar múltiplos saves consecutivos
function _schedulePersist() {
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
        if (_db) _saveToIDB(_db.export());
    }, 300);
}

// Migra dados existentes do localStorage para o SQLite (roda uma única vez)
function _migrarLocalStorage() {
    const keys = ['perfil', 'tarefas', 'habitos', 'metas', 'chat'];
    let migrated = false;
    for (const key of keys) {
        const raw = localStorage.getItem('focus_' + key);
        if (raw !== null) {
            _db.run('INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)', [key, raw]);
            migrated = true;
        }
    }
    if (migrated) {
        keys.forEach(k => localStorage.removeItem('focus_' + k));
        console.log('[DB] Dados migrados do localStorage para SQLite.');
    }
}

export async function initDB() {
    // initSqlJs é exposto globalmente pelo script CDN carregado no app.html
    const SQL = await window.initSqlJs({ locateFile: () => WASM_URL });

    const saved = await _loadFromIDB();
    _db = saved ? new SQL.Database(saved) : new SQL.Database();
    _db.run('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)');

    _migrarLocalStorage();
    await _saveToIDB(_db.export());

    console.log('[DB] SQLite inicializado com sucesso.');
}

export const DB = {
    get(key) {
        if (!_db) return null;
        try {
            const result = _db.exec('SELECT value FROM kv WHERE key = ?', [key]);
            if (result.length && result[0].values.length) {
                return JSON.parse(result[0].values[0][0]);
            }
            return null;
        } catch { return null; }
    },

    set(key, value) {
        if (!_db) return;
        try {
            _db.run('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
            _schedulePersist();
        } catch (e) { console.error('[DB] set:', e); }
    }
};
