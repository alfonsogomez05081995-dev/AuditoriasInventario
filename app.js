import { setupAuth } from './auth.js';
import * as firestoreService from './firestore-service.js';
import * as ui from './ui.js';

// --- DOM ELEMENTS ---
const domElements = {
    loginContainer: document.getElementById('login-container'),
    appContainer: document.getElementById('app-container'),
    userEmailEl: document.getElementById('user-email'),
    authErrorEl: document.getElementById('auth-error'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    logoutButton: document.getElementById('logout-button'),
    showRegisterLink: document.getElementById('show-register-link'),
    showLoginLink: document.getElementById('show-login-link'),
    loginFormContainer: document.getElementById('login-form-container'),
    registerFormContainer: document.getElementById('register-form-container'),
    tabs: document.querySelectorAll('.tab-item'),
    tabContents: document.querySelectorAll('.tab-content'),
    conteoTab: document.getElementById('conteo-tab'),
    reporteTab: document.getElementById('reporte-tab'),
    showCreateAuditModalButton: document.getElementById('show-create-audit-modal-button'),
    auditsListEl: document.getElementById('audits-list'),
    selectedAuditInfoConteo: document.getElementById('selected-audit-info-conteo'),
    conteoWrapper: document.getElementById('conteo-wrapper'),
    subinventarioSelect: document.getElementById('subinventario-select'),
    conteoFormSection: document.getElementById('conteo-form-section'),
    conteoForm: document.getElementById('conteo-form'),
    itemNameInput: document.getElementById('item-name-input'),
    itemDatalist: document.getElementById('item-datalist'),
    itemDescriptionInput: document.getElementById('item-description'),
    itemLocationInput: document.getElementById('item-location'),
    locationSelectorContainer: document.getElementById('location-selector-container'),
    locationSelector: document.getElementById('location-selector'),
    forceLocationBtn: document.getElementById('force-location-btn'),
    manualLocationInput: document.getElementById('manual-location-input'),
    conteoTableBody: document.querySelector('#conteo-table tbody'),
    confirmarConteoButton: document.getElementById('confirmar-conteo-button'),
    auditorNameInput: document.getElementById('auditor-name'),
    conteoStatusEl: document.getElementById('conteo-status'),
    selectedAuditInfoReporte: document.getElementById('selected-audit-info-reporte'),
    reporteWrapper: document.getElementById('reporte-wrapper'),
    exportButton: document.getElementById('export-button'),
    finalizeAuditButton: document.getElementById('finalize-audit-button'),
    reportStatusEl: document.getElementById('report-generation-status'),
    createAuditModal: document.getElementById('create-audit-modal'),
    closeModalButton: document.getElementById('close-modal-button'),
    createAuditForm: document.getElementById('create-audit-form'),
    auditNameInput: document.getElementById('audit-name-input'),
    excelFileInput: document.getElementById('excel-file-input'),
    fileNameEl: document.getElementById('file-name'),
    createAuditButton: document.getElementById('create-audit-button'),
    createAuditStatusEl: document.getElementById('create-audit-status'),
    sobranteModal: document.getElementById('sobrante-modal'),
    closeSobranteModalButton: document.getElementById('close-sobrante-modal-button'),
    sobranteForm: document.getElementById('sobrante-form'),
    sobranteItemName: document.getElementById('sobrante-item-name'),
    // Report Filters
    includeDetailed: document.getElementById('include-detailed'),
    includeNationalConsolidated: document.getElementById('include-national-consolidated'),
    includeSubinventoryConsolidated: document.getElementById('include-subinventory-consolidated'),
    filterSobrantes: document.getElementById('filter-sobrantes'),
    filterFaltantes: document.getElementById('filter-faltantes'),
    filterSinDiferencia: document.getElementById('filter-sin-diferencia'),
    filterReferencia: document.getElementById('filter-referencia'),
    filterLocalizador: document.getElementById('filter-localizador'),
    filterSubinventario: document.getElementById('filter-subinventario'),
};

// --- STATE MANAGEMENT ---
let inventarioAudit = [];
let conteoFisico = [];
let auditsCache = [];
let selectedAuditId = null;
let currentSubinventario = null;
let unsubscribeDashboard = null;

// --- APP INITIALIZATION ---
async function initializeAppState() {
    ui.showLoader();
    try {
        await loadAndRenderAudits();
        const storedAuditId = localStorage.getItem('selectedAuditId');
        if (storedAuditId && auditsCache.some(a => a.id === storedAuditId)) {
            await selectAudit(storedAuditId);
        }
        else {
            clearSelectedAudit();
        }
    }
    finally {
        ui.hideLoader();
    }
}

// --- AUTHENTICATION ---
setupAuth(domElements, initializeAppState);

// --- TABNAVIGATION ---
domElements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.disabled) return;
        domElements.tabs.forEach(item => item.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.tab);
        domElements.tabContents.forEach(content => content.classList.remove('active'));
        target.classList.add('active');
    });
});

// --- MODAL HANDLING ---
domElements.showCreateAuditModalButton.addEventListener('click', () => domElements.createAuditModal.classList.remove('hidden'));
domElements.closeModalButton.addEventListener('click', () => domElements.createAuditModal.classList.add('hidden'));
domElements.closeSobranteModalButton.addEventListener('click', () => domElements.sobranteModal.classList.add('hidden'));
window.addEventListener('click', (e) => {
    if (e.target === domElements.createAuditModal) domElements.createAuditModal.classList.add('hidden');
    if (e.target === domElements.sobranteModal) domElements.sobranteModal.classList.add('hidden');
});

// --- AUDIT MANAGEMENT ---
async function loadAndRenderAudits() {
    ui.showLoader();
    try {
        auditsCache = await firestoreService.loadAudits();
        const activeAudits = auditsCache.filter(audit => audit.status !== 'archived');
        ui.renderAudits(domElements.auditsListEl, activeAudits, selectAudit, handleArchiveAudit);
    }
    catch (error) {
        console.error("Error loading audits:", error);
        domElements.auditsListEl.innerHTML = `<p class="error">${error.message}</p>`;
    }
    finally {
        ui.hideLoader();
    }
}

async function handleArchiveAudit(auditId) {
    const auditToArchive = auditsCache.find(a => a.id === auditId);
    if (!auditToArchive)
        return;
    const confirmation = confirm(`¿Estás seguro de que quieres archivar la auditoría "${auditToArchive.name}"?\n\nNo podrás agregar más conteos, pero los datos no se eliminarán.`);
    if (!confirmation)
        return;
    ui.showLoader();
    try {
        await firestoreService.archiveAudit(auditId);
        if (selectedAuditId === auditId) {
            clearSelectedAudit();
        }
        await loadAndRenderAudits();
    }
    catch (error) {
        console.error("Error archiving audit:", error);
        alert(error.message);
    }
    finally {
        ui.hideLoader();
    }
}

domElements.createAuditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const auditName = domElements.auditNameInput.value.trim();
    const file = domElements.excelFileInput.files[0];
    if (!auditName || !file) {
        ui.showFeedback(domElements.createAuditStatusEl, 'Por favor, completa todos los campos.', 'error');
        return;
    }
    domElements.createAuditButton.disabled = true;
    ui.showLoader();
    try {
        ui.showFeedback(domElements.createAuditStatusEl, 'Procesando archivo Excel...', 'info');
        const inventoryData = await parseExcel(file);
        if (inventoryData.length === 0)
            throw new Error("El archivo Excel está vacío o no tiene el formato correcto.");
        const subinventarios = [...new Set(inventoryData.map(item => item.subinventario))].sort();
        await firestoreService.createAudit(auditName, inventoryData, subinventarios, (message) => {
            ui.showFeedback(domElements.createAuditStatusEl, message, 'info');
        });
        ui.showFeedback(domElements.createAuditStatusEl, '¡Auditoría creada con éxito!', 'success');
        domElements.createAuditForm.reset();
        ui.updateFileName(domElements.fileNameEl, null);
        setTimeout(() => {
            domElements.createAuditModal.classList.add('hidden');
            ui.showFeedback(domElements.createAuditStatusEl, '', 'info');
            loadAndRenderAudits();
        }, 1500);
    }
    catch (error) {
        console.error("Error creating audit:", error);
        ui.showFeedback(domElements.createAuditStatusEl, `Error: ${error.message}`, 'error');
    }
    finally {
        domElements.createAuditButton.disabled = false;
        ui.hideLoader();
    }
});

domElements.excelFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    ui.updateFileName(domElements.fileNameEl, file);
});

function parseExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                const rows = json.slice(1).filter(row => row.length > 0 && row[0]);
                const parsedData = rows.map(row => ({
                    nombre: row[0] || '',
                    descripcion: row[1] || '',
                    // row[2] is 'Nombre de entidad jurídica'
                    ubicacion: row[3] || '', // 'Ubicación de inventario de localizador'
                    subinventario: row[4] || '', // 'Subinventario'
                    // row[5] is 'Subinventory Description'
                    // row[6] is 'Organización de inventario - Nombre'
                    cantidadSistema: parseFloat(row[7]) || 0 // 'Cantidad'
                }));
                resolve(parsedData);
            }
            catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

async function selectAudit(auditId) {
    if (unsubscribeDashboard) {
        unsubscribeDashboard();
        unsubscribeDashboard = null;
    }

    const audit = auditsCache.find(a => a.id === auditId);
    if (!audit) {
        console.error("Selected audit not found in cache");
        clearSelectedAudit();
        return;
    }
    
    ui.showLoader(); // Show loader while we fetch items
    try {
        // Fetch all items to derive the subinventories
        const allItems = await firestoreService.loadAllInventoryItems(auditId);
        const derivedSubinventarios = [...new Set(allItems.map(item => item.subinventario))].sort();
        const modifiedAudit = { ...audit, subinventarios: derivedSubinventarios };

        localStorage.setItem('selectedAuditId', auditId);
        selectedAuditId = auditId;
        inventarioAudit = []; // Reset inventory on new audit selection.
        
        ui.selectAuditUI(modifiedAudit, domElements.selectedAuditInfoConteo, domElements.selectedAuditInfoReporte, domElements.conteoWrapper, domElements.reporteWrapper, domElements.conteoTab, domElements.reporteTab, domElements.finalizeAuditButton, domElements.subinventarioSelect, domElements.conteoFormSection);
        
        document.getElementById('dashboard-container').classList.remove('hidden');
        if (unsubscribeDashboard) unsubscribeDashboard();
        unsubscribeDashboard = firestoreService.listenToPhysicalCounts(auditId, handleDashboardUpdate);

        resetConteoForm();
    } catch (error) {
        console.error("Error selecting audit and deriving subinventories:", error);
        alert("Error al seleccionar la auditoría: " + error.message);
        clearSelectedAudit();
    } finally {
        ui.hideLoader();
    }
}

function clearSelectedAudit() {
    if (unsubscribeDashboard) {
        unsubscribeDashboard();
        unsubscribeDashboard = null;
    }
    localStorage.removeItem('selectedAuditId');
    selectedAuditId = null;
    inventarioAudit = [];
    ui.clearSelectedAuditUI(domElements.selectedAuditInfoConteo, domElements.selectedAuditInfoReporte, domElements.conteoWrapper, domElements.reporteWrapper, domElements.conteoTab, domElements.reporteTab);
    document.getElementById('dashboard-container').classList.add('hidden');
}

function handleDashboardUpdate(counts) {
    if (!counts) return;

    const totalUnits = counts.flatMap(c => c.items).reduce((sum, item) => sum + item.cantidadFisica, 0);
    const uniqueReferences = new Set(counts.flatMap(c => c.items).map(item => item.nombre)).size;
    const activeSubinventories = new Set(counts.map(c => c.subinventario)).size;

    const stats = {
        sessions: counts.length,
        units: totalUnits,
        references: uniqueReferences,
        subinventaries: activeSubinventories
    };

    ui.updateDashboard(stats, counts);
}

// --- PHYSICAL COUNT ---
domElements.subinventarioSelect.addEventListener('change', async (e) => {
    currentSubinventario = e.target.value;
    if (!currentSubinventario) {
        domElements.conteoFormSection.classList.add('hidden');
        return;
    }
    ui.showFeedback(domElements.conteoStatusEl, `Cargando artículos para ${currentSubinventario}...`, 'info');
    domElements.conteoFormSection.classList.remove('hidden');
    domElements.conteoForm.reset();
    ui.showLoader();
    try {
        inventarioAudit = await firestoreService.loadInventoryItemsBySubinventory(selectedAuditId, currentSubinventario);
        ui.showFeedback(domElements.conteoStatusEl, `${inventarioAudit.length} artículos cargados.`, 'success');
        prepareConteoForm();
    }
    catch (error) {
        console.error("Error loading inventory items by subinventory:", error);
        ui.showFeedback(domElements.conteoStatusEl, error.message, 'error');
    }
    finally {
        ui.hideLoader();
    }
});

function prepareConteoForm() {
    const uniqueItems = [...new Map(inventarioAudit.map(item => [item.nombre, item])).values()];
    domElements.itemDatalist.innerHTML = '';
    uniqueItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.nombre;
        domElements.itemDatalist.appendChild(option);
    });
    resetConteoForm();
}

function resetConteoForm() {
    conteoFisico = [];
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
    domElements.conteoForm.reset();
    domElements.auditorNameInput.value = '';
    domElements.itemLocationInput.disabled = true;
}

function handleDeleteConteoItem(index) {
    conteoFisico.splice(index, 1);
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
}

domElements.itemNameInput.addEventListener('change', () => {
    const selectedItemName = domElements.itemNameInput.value;
    // Use filter to get all items matching the name in the current subinventory
    const items = inventarioAudit.filter(item => item.nombre === selectedItemName && item.subinventario === currentSubinventario);

    // Clear previous options and reset related fields
    domElements.itemLocationInput.innerHTML = '';
    domElements.itemDescriptionInput.value = '';
    domElements.manualLocationInput.value = '';

    if (items.length > 0) {
        // All items with the same name should have the same description
        domElements.itemDescriptionInput.value = items[0].descripcion;
        
        // Populate the select with all found locations
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.ubicacion;
            option.textContent = item.ubicacion;
            domElements.itemLocationInput.appendChild(option);
        });

        // Enable the location selector
        domElements.itemLocationInput.disabled = false;
    } else {
        // If no item is found, keep the location selector disabled
        domElements.itemLocationInput.disabled = true;
    }
});

domElements.conteoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = domElements.itemNameInput.value;
    const ubicacionOriginal = domElements.itemLocationInput.value;
    const ubicacionFisica = domElements.manualLocationInput.value;

    const newItem = {
        nombre: nombre,
        descripcion: domElements.itemDescriptionInput.value,
        ubicacion: ubicacionFisica,
        ubicacionOriginal: ubicacionOriginal,
        cantidadFisica: parseInt(document.getElementById('item-quantity').value, 10),
        localizadorForzado: true
    };

    if (!newItem.nombre || !newItem.ubicacion || isNaN(newItem.cantidadFisica)) {
        alert('Por favor, completa todos los campos del artículo.');
        return;
    }

    const itemExists = inventarioAudit.some(item => item.nombre === newItem.nombre && item.subinventario === currentSubinventario);
    if (!itemExists) {
        domElements.sobranteItemName.textContent = newItem.nombre;
        domElements.sobranteModal.classList.remove('hidden');
        return;
    }

    conteoFisico.push(newItem);
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
    domElements.conteoForm.reset();
    domElements.itemNameInput.focus();
    resetLocationInputs();
});

function resetLocationInputs() {
    domElements.itemLocationInput.value = '';
    domElements.manualLocationInput.value = '';
}

domElements.sobranteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newItem = {
        nombre: domElements.sobranteItemName.textContent,
        descripcion: document.getElementById('sobrante-description').value,
        ubicacion: document.getElementById('sobrante-location').value,
        cantidadFisica: parseInt(document.getElementById('sobrante-quantity').value, 10),
        isSobrante: true
    };

    if (!newItem.ubicacion || isNaN(newItem.cantidadFisica)) {
        alert('Por favor, completa la ubicación y la cantidad.');
        return;
    }

    conteoFisico.push(newItem);
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
    domElements.sobranteModal.classList.add('hidden');
    domElements.sobranteForm.reset();
    domElements.conteoForm.reset();
    domElements.itemNameInput.focus();
    resetLocationInputs();
});

domElements.confirmarConteoButton.addEventListener('click', async () => {
    const auditor = domElements.auditorNameInput.value.trim();
    if (conteoFisico.length === 0) {
        ui.showFeedback(domElements.conteoStatusEl, 'No hay registros para guardar.', 'error');
        return;
    }
    if (!auditor) {
        ui.showFeedback(domElements.conteoStatusEl, 'Debes ingresar tu nombre para confirmar.', 'error');
        return;
    }
    if (!selectedAuditId) {
        ui.showFeedback(domElements.conteoStatusEl, 'Error: No hay auditoría seleccionada.', 'error');
        return;
    }
    ui.showFeedback(domElements.conteoStatusEl, 'Guardando conteo...', 'info');
    ui.showLoader();
    try {
        await firestoreService.savePhysicalCount(selectedAuditId, currentSubinventario, auditor, conteoFisico);
        ui.showFeedback(domElements.conteoStatusEl, `Conteo para ${currentSubinventario} guardado con éxito.`, 'success');
        resetConteoForm();
        domElements.conteoFormSection.classList.add('hidden');
        domElements.subinventarioSelect.value = '';
    }
    catch (error) {
        console.error("Error saving physical count:", error);
        ui.showFeedback(domElements.conteoStatusEl, error.message, 'error');
    }
    finally {
        ui.hideLoader();
    }
});

// --- REPORTING & FINALIZING ---
domElements.finalizeAuditButton.addEventListener('click', async () => {
    if (!selectedAuditId)
        return;
    const confirmation = confirm(`¿Estás seguro de que quieres finalizar esta auditoría? Una vez finalizada, no se podrán agregar más conteos. Esta acción es irreversible.`);
    if (!confirmation)
        return;
    ui.showLoader();
    try {
        await firestoreService.finalizeAudit(selectedAuditId);
        ui.showFeedback(domElements.reportStatusEl, 'Auditoría finalizada y archivada con éxito.', 'success');
        await loadAndRenderAudits();
        clearSelectedAudit();
    }
    catch (error) {
        console.error("Error finalizing audit:", error);
        ui.showFeedback(domElements.reportStatusEl, error.message, 'error');
    }
    finally {
        ui.hideLoader();
    }
});

domElements.exportButton.addEventListener('click', async () => {
    if (!selectedAuditId) {
        ui.showFeedback(domElements.reportStatusEl, 'No hay auditoría seleccionada.', 'error');
        return;
    }

    const filters = {
        includeDetailed: domElements.includeDetailed.checked,
        includeNationalConsolidated: domElements.includeNationalConsolidated.checked,
        includeSubinventoryConsolidated: domElements.includeSubinventoryConsolidated.checked,
        sobrantes: domElements.filterSobrantes.checked,
        faltantes: domElements.filterFaltantes.checked,
        sinDiferencia: domElements.filterSinDiferencia.checked,
        referencia: domElements.filterReferencia.value.trim(),
        localizador: domElements.filterLocalizador.value.trim(),
        subinventario: domElements.filterSubinventario.value.trim(),
    };

    if (!filters.includeDetailed && !filters.includeNationalConsolidated && !filters.includeSubinventoryConsolidated) {
        ui.showFeedback(domElements.reportStatusEl, 'Debes seleccionar al menos un tipo de reporte para generar.', 'error');
        return;
    }

    ui.showFeedback(domElements.reportStatusEl, 'Generando reportes filtrados...', 'info');
    ui.showLoader();
    try {
        const audit = auditsCache.find(a => a.id === selectedAuditId);
        if (!audit) throw new Error("Auditoría no encontrada");

        const allSystemItems = await firestoreService.loadAllInventoryItems(selectedAuditId);
        const allCountSessions = await firestoreService.getPhysicalCountsForReport(selectedAuditId);

        if (allCountSessions.length === 0) {
            ui.showFeedback(domElements.reportStatusEl, 'No se han encontrado conteos físicos para esta auditoría.', 'error');
            return;
        }

        const reports = generateReportData(allSystemItems, allCountSessions, audit.subinventarios, filters);

        const fileName = `Reporte_Auditoria_${audit.name.replace(/\s+/g, '_')}.xlsx`;
        const wb = XLSX.utils.book_new();

        if (filters.includeDetailed && reports.detailed) {
            XLSX.utils.book_append_sheet(wb, reports.detailed, 'Reporte Detallado');
        }
        if (filters.includeNationalConsolidated && reports.nationalConsolidated) {
            XLSX.utils.book_append_sheet(wb, reports.nationalConsolidated, 'ReporteNacionalConsolidado');
        }
        if (filters.includeSubinventoryConsolidated && reports.subinventoryReports) {
            reports.subinventoryReports.forEach(subReport => {
                const safeSheetName = subReport.sheetName.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 31);
                XLSX.utils.book_append_sheet(wb, subReport.worksheet, safeSheetName);
            });
        }
        if (reports.forcedLocators) {
            XLSX.utils.book_append_sheet(wb, reports.forcedLocators, 'Localizadores Forzados');
        }

        XLSX.writeFile(wb, fileName);

        ui.showFeedback(domElements.reportStatusEl, 'Reporte generado y descargado.', 'success');
    }
    catch (error) {
        console.error("Error generating report:", error);
        ui.showFeedback(domElements.reportStatusEl, error.message, 'error');
    }
    finally {
        ui.hideLoader();
    }
});

function generateReportData(systemInventory, countSessions, subinventarios, filters) {
    // Create a map of all system locations for easy lookup
    const systemLocationsMap = new Map();
    systemInventory.forEach(item => {
        const key = `${item.nombre}_${item.subinventario}`.toLowerCase();
        if (!systemLocationsMap.has(key)) {
            systemLocationsMap.set(key, []);
        }
        systemLocationsMap.get(key).push(item.ubicacion);
    });

    // 1. Sort sessions to create a sequential count number
    const sortedSessions = countSessions.sort((a, b) => a.conteoDate.toMillis() - b.conteoDate.toMillis());
    const sessionsWithCountNumber = sortedSessions.map((session, index) => ({ ...session, numeroConteo: index + 1 }));

    // 2. Flatten all physical counts and combine with session data
    const flatPhysicalCounts = sessionsWithCountNumber.flatMap(session =>
        session.items.map(item => ({
            ...item,
            auditor: session.auditor,
            subinventario: session.subinventario,
            idConteo: session.id,
            numeroConteo: session.numeroConteo
        }))
    );

    // 3. Create the detailed data map (base for all reports)
    const detailedData = {};
    systemInventory.forEach(item => {
        const key = `${item.nombre}_${item.subinventario}_${item.ubicacion}`.toLowerCase();
        detailedData[key] = {
            'ID Conteo': 'N/A',
            '# Conteo': 'N/A',
            'Auditor': 'N/A',
            'Desajuste de Localizador': 'NO', // New Column
            'Subinventario': item.subinventario,
            'Referencia': item.nombre,
            'Descripción': item.descripcion,
            'Localizador en Sistema': item.ubicacion,
            'Localizador Físico': item.ubicacion, // Initially the same
            'Cantidad Sistema': item.cantidadSistema,
            'Cantidad Física': 0,
            'Estado': 'FALTANTE',
            'ID_Documento_Firestore': 'N/A'
        };
    });

    flatPhysicalCounts.forEach(item => {
        // Use the original location selected in the dropdown for matching
        const key = `${item.nombre}_${item.subinventario}_${item.ubicacionOriginal}`.toLowerCase();
        
        if (detailedData[key]) {
            detailedData[key]['Cantidad Física'] += item.cantidadFisica;
            detailedData[key]['ID Conteo'] = item.auditor;
            detailedData[key]['# Conteo'] = item.numeroConteo;
            detailedData[key]['Auditor'] = item.auditor;
            
            // New logic for locator mismatch
            const systemLocs = systemLocationsMap.get(`${item.nombre}_${item.subinventario}`.toLowerCase()) || [];
            const physicalLoc = item.ubicacion; // This is the forced location
            if (systemLocs.includes(physicalLoc)) {
                detailedData[key]['Desajuste de Localizador'] = 'NO';
            } else {
                detailedData[key]['Desajuste de Localizador'] = 'SI';
            }

            detailedData[key]['Localizador Físico'] = physicalLoc;
            detailedData[key]['Estado'] = ''; // Clear status, will be recalculated
            detailedData[key]['ID_Documento_Firestore'] = item.idConteo;
        } else {
            // This is a "sobrante" (surplus) item
            const sobranteKey = `${item.nombre}_${item.subinventario}_${item.ubicacion}`.toLowerCase();
            detailedData[sobranteKey] = {
                'ID Conteo': item.auditor,
                '# Conteo': item.numeroConteo,
                'Auditor': item.auditor,
                'Desajuste de Localizador': 'SI', // Always a mismatch for sobrantes
                'Subinventario': item.subinventario,
                'Referencia': item.nombre,
                'Descripción': item.descripcion || '',
                'Localizador en Sistema': 'N/A',
                'Localizador Físico': item.ubicacion,
                'Cantidad Sistema': 0,
                'Cantidad Física': item.cantidadFisica,
                'Estado': 'SOBRANTE',
                'ID_Documento_Firestore': item.idConteo
            };
        }
    });

    let detailedReport = Object.values(detailedData).map(item => {
        const diferencia = item['Cantidad Física'] - item['Cantidad Sistema'];
        if (item.Estado === '') {
            if (diferencia > 0) item.Estado = 'SOBRANTE';
            else if (diferencia < 0) item.Estado = 'FALTANTE';
            else item.Estado = 'OK';
        }
        return {
            ...item,
            'Diferencia': diferencia
        }
    });

    // APPLY FILTERS
    if (filters.sobrantes && !filters.faltantes && !filters.sinDiferencia) {
        detailedReport = detailedReport.filter(item => item.Diferencia > 0);
    }
    if (filters.faltantes && !filters.sobrantes && !filters.sinDiferencia) {
        detailedReport = detailedReport.filter(item => item.Diferencia < 0);
    }
    if (filters.sinDiferencia && !filters.sobrantes && !filters.faltantes) {
        detailedReport = detailedReport.filter(item => item.Diferencia === 0);
    }
    if (filters.referencia) {
        detailedReport = detailedReport.filter(item => item.Referencia.toLowerCase().includes(filters.referencia.toLowerCase()));
    }
    if (filters.localizador) {
        detailedReport = detailedReport.filter(item => item['Localizador Físico'].toLowerCase().includes(filters.localizador.toLowerCase()));
    }
    if (filters.subinventario) {
        detailedReport = detailedReport.filter(item => item.Subinventario.toLowerCase().includes(filters.subinventario.toLowerCase()));
    }

    const finalReports = {};

    // This report is now redundant or needs to be re-evaluated, the main detailed report has the new column.
    // For now, we will rely on the "Desajuste de Localizador" column in the main report.
    
    if (filters.includeDetailed) {
        finalReports.detailed = XLSX.utils.json_to_sheet(detailedReport);
    }

    if (filters.includeNationalConsolidated) {
        const nationalConsolidatedData = {};
        detailedReport.forEach(item => {
            const key = item.Referencia.toLowerCase();
            if (!nationalConsolidatedData[key]) {
                nationalConsolidatedData[key] = {
                    'Referencia': item.Referencia,
                    'Descripción': item.Descripción,
                    'Subinventarios': new Set(),
                    'Cantidad Sistema': 0,
                    'Cantidad Física': 0,
                    'Estados': new Set(),
                    'Desajustes de Localizador': new Set(),
                };
            }
            nationalConsolidatedData[key]['Cantidad Sistema'] += item['Cantidad Sistema'];
            nationalConsolidatedData[key]['Cantidad Física'] += item['Cantidad Física'];
            nationalConsolidatedData[key]['Subinventarios'].add(item.Subinventario);
            nationalConsolidatedData[key]['Estados'].add(item.Estado);
            nationalConsolidatedData[key]['Desajustes de Localizador'].add(item['Desajuste de Localizador']);
        });
        const nationalConsolidatedReport = Object.values(nationalConsolidatedData).map(item => ({
            'Referencia': item.Referencia,
            'Descripción': item.Descripción,
            'Subinventarios': [...item.Subinventarios].join(', '),
            'Cantidad Sistema': item['Cantidad Sistema'],
            'Cantidad Física': item['Cantidad Física'],
            'Diferencia': item['Cantidad Física'] - item['Cantidad Sistema'],
            'Resumen de Estados': [...item.Estados].join(', '),
            'Contiene Desajustes de Localizador': [...item['Desajustes de Localizador']].includes('SI') ? 'Sí' : 'No',
        }));
        finalReports.nationalConsolidated = XLSX.utils.json_to_sheet(nationalConsolidatedReport);
    }

    if (filters.includeSubinventoryConsolidated) {
        const subinventoryReports = subinventarios.map(sub => {
            const subInventoryItems = detailedReport.filter(item => item.Subinventario === sub);
            if (subInventoryItems.length === 0) return null;

            const subInventorySessions = sessionsWithCountNumber.filter(session => session.subinventario === sub);
            const auditors = [...new Set(subInventorySessions.map(s => s.auditor))].join(', ');
            const sessionCount = subInventorySessions.length;

            const consolidatedData = {};
            subInventoryItems.forEach(item => {
                const key = item.Referencia.toLowerCase();
                if (!consolidatedData[key]) {
                    consolidatedData[key] = {
                        'Referencia': item.Referencia,
                        'Descripción': item.Descripción,
                        'Cantidad Sistema': 0,
                        'Cantidad Física': 0,
                        'Estados': new Set(),
                        'Desajustes de Localizador': new Set(),
                    };
                }
                consolidatedData[key]['Cantidad Sistema'] += item['Cantidad Sistema'];
                consolidatedData[key]['Cantidad Física'] += item['Cantidad Física'];
                consolidatedData[key]['Estados'].add(item.Estado);
                consolidatedData[key]['Desajustes de Localizador'].add(item['Desajuste de Localizador']);
            });
            const reportData = Object.values(consolidatedData).map(item => ({
                'Referencia': item.Referencia,
                'Descripción': item.Descripción,
                'Cantidad Sistema': item['Cantidad Sistema'],
                'Cantidad Física': item['Cantidad Física'],
                'Diferencia': item['Cantidad Física'] - item['Cantidad Sistema'],
                'Resumen de Estados': [...item.Estados].join(', '),
                'Contiene Desajustes de Localizador': [...item['Desajustes de Localizador']].includes('SI') ? 'Sí' : 'No',
            }));

            const header = [
                { A: 'Subinventario', B: sub },
                { A: 'Auditores', B: auditors },
                { A: 'Sesiones de Conteo', B: sessionCount },
                { A: '' },
            ];
            const worksheet = XLSX.utils.json_to_sheet(reportData, { origin: 'A5' });
            XLSX.utils.sheet_add_json(worksheet, header, { skipHeader: true, origin: 'A1' });
            return { sheetName: `Consolidado_${sub}`, worksheet: worksheet };
        }).filter(Boolean);
        finalReports.subinventoryReports = subinventoryReports;
    }

    return finalReports;
}
