export function showFeedback(element, message, type) {
    element.textContent = message;
    element.className = `feedback ${type}`;
}

export function renderConteoTable(conteoTableBody, conteoFisico, deleteCallback) {
    conteoTableBody.innerHTML = '';
    conteoFisico.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.descripcion}</td>
            <td>${item.ubicacion}</td>
            <td>${item.cantidadFisica}</td>
            <td><button class="btn-delete" data-index="${index}">✖</button></td>
        `;
        row.querySelector('.btn-delete').addEventListener('click', () => deleteCallback(index));
        conteoTableBody.appendChild(row);
    });
}

export function populateSubinventarioSelect(subinventarioSelect, subinventarios) {
    subinventarioSelect.innerHTML = '<option value="">-- Elige un subinventario --</option>';
    if (!subinventarios || subinventarios.length === 0) return;

    const uniqueSubinventarios = [...new Set(subinventarios)];

    uniqueSubinventarios.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = sub;
        subinventarioSelect.appendChild(option);
    });
}

export function updateFileName(fileNameEl, file) {
    fileNameEl.textContent = file ? file.name : 'Ningún archivo seleccionado';
}

export function clearSelectedAuditUI(
    selectedAuditInfoConteo,
    selectedAuditInfoReporte,
    conteoWrapper,
    reporteWrapper,
    conteoTab,
    reporteTab
) {
    document.querySelectorAll('.audit-item').forEach(el => el.classList.remove('active'));
    selectedAuditInfoConteo.innerHTML = '<p>No hay ninguna auditoría seleccionada.</p>';
    selectedAuditInfoReporte.innerHTML = '<p>Selecciona una auditoría desde la pestaña de gestión para ver esta sección.</p>';
    conteoWrapper.classList.add('hidden');
    reporteWrapper.classList.add('hidden');
    conteoTab.disabled = true;
    reporteTab.disabled = true;
}

export function selectAuditUI(
    audit,
    selectedAuditInfoConteo,
    selectedAuditInfoReporte,
    conteoWrapper,
    reporteWrapper,
    conteoTab,
    reporteTab,
    finalizeAuditButton,
    subinventarioSelect,
    conteoFormSection
) {
    document.querySelectorAll('.audit-item').forEach(el => el.classList.remove('active'));
    const auditElement = document.querySelector(`.select-audit-btn[data-id="${audit.id}"]`)?.closest('.audit-item');
    if(auditElement) auditElement.classList.add('active');

    const auditInfoHTML = `<h3>Auditoría Seleccionada: <span class="highlight">${audit.name}</span></h3>`;
    selectedAuditInfoConteo.innerHTML = auditInfoHTML;
    selectedAuditInfoReporte.innerHTML = auditInfoHTML;

    conteoWrapper.classList.remove('hidden');
    reporteWrapper.classList.remove('hidden');
    conteoTab.disabled = false;
    reporteTab.disabled = false;

    populateSubinventarioSelect(subinventarioSelect, audit.subinventarios || []);
    conteoFormSection.classList.add('hidden');

    if (audit.status === 'completed') {
        finalizeAuditButton.disabled = true;
        conteoWrapper.classList.add('hidden');
    } else {
        finalizeAuditButton.disabled = false;
    }
}

export function renderAudits(auditsListEl, audits, selectAuditCallback, archiveAuditCallback) {
    auditsListEl.innerHTML = '';
    if (audits.length === 0) {
        auditsListEl.innerHTML = '<p>No hay auditorías activas. ¡Crea la primera!</p>';
        return;
    }

    audits.forEach(audit => {
        const auditEl = document.createElement('div');
        auditEl.className = `audit-item status-${audit.status}`;
        auditEl.innerHTML = `
            <div class="audit-info">
                <span class="audit-name">${audit.name}</span>
                <span class="audit-meta">Creada por ${audit.createdBy} el ${new Date(audit.createdAt.seconds * 1000).toLocaleDateString()}</span>
                <span class="audit-meta">(${audit.itemCount} artículos)</span>
            </div>
            <div class="audit-actions">
                <span class="audit-status">${audit.status === 'in-progress' ? 'En Progreso' : 'Finalizada'}</span>
                <button class="btn btn-secondary btn-sm select-audit-btn" data-id="${audit.id}">Seleccionar</button>
                <button class="btn btn-warning btn-sm archive-audit-btn" data-id="${audit.id}">Archivar</button>
            </div>
        `;
        auditsListEl.appendChild(auditEl);
    });

    document.querySelectorAll('.select-audit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => selectAuditCallback(e.target.dataset.id));
    });

    document.querySelectorAll('.archive-audit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => archiveAuditCallback(e.target.dataset.id));
    });
}

export function showLoader() {
    document.getElementById('loader-overlay').classList.remove('hidden');
}

export function hideLoader() {
    document.getElementById('loader-overlay').classList.add('hidden');
}

export function updateDashboard(stats, activity) {
    const statsContainer = document.getElementById('dashboard-stats');
    const activityFeedEl = document.getElementById('dashboard-activity-feed');

    // Render Stats
    statsContainer.innerHTML = `
        <div class="stat-card">
            <h4>Sesiones de Conteo</h4>
            <p>${stats.sessions}</p>
        </div>
        <div class="stat-card">
            <h4>Unidades Contadas</h4>
            <p>${stats.units.toLocaleString('es-CO')}</p>
        </div>
        <div class="stat-card">
            <h4>Referencias Únicas</h4>
            <p>${stats.references}</p>
        </div>
        <div class="stat-card">
            <h4>Subinventarios Auditados</h4>
            <p>${stats.subinventories}</p>
        </div>
    `;

    // Render Activity Feed
    activityFeedEl.innerHTML = '';
    if (activity.length === 0) {
        activityFeedEl.innerHTML = '<li class="activity-item">No hay actividad reciente.</li>';
        return;
    }

    activity.slice(0, 5).forEach(item => { // Show latest 5 activities
        const li = document.createElement('li');
        li.className = 'activity-item';
        const totalItems = item.items.reduce((sum, curr) => sum + curr.cantidadFisica, 0);
        li.innerHTML = `
            <div>
                <span class="auditor">${item.auditor}</span> guardó un conteo en
                <span class="subinventory">${item.subinventario}</span>
            </div>
            <div class="details">
                ${totalItems} unidades en ${item.items.length} referencias. - ${new Date(item.conteoDate.seconds * 1000).toLocaleString('es-CO')}
            </div>
        `;
        activityFeedEl.appendChild(li);
    });
}

export function manageLoadMoreButton(container, lastVisible, callback) {
    container.innerHTML = ''; // Clear previous button
    if (lastVisible) {
        const button = document.createElement('button');
        button.id = 'load-more-btn';
        button.className = 'btn btn-secondary';
        button.textContent = 'Cargar Más Artículos';
        button.addEventListener('click', callback);
        container.appendChild(button);
    }
}

// --- Gestión de Costos ---

export function renderCostsTable(costsTableBody, costs, deleteCallback, saveCallback) {
    costsTableBody.innerHTML = '';
    if (!costs || costs.length === 0) {
        costsTableBody.innerHTML = '<tr><td colspan="5">No hay costos definidos. Sube un archivo para empezar.</td></tr>';
        return;
    }

    // Ordenar costos por referencia (ID)
    costs.sort((a, b) => a.id.localeCompare(b.id));

    costs.forEach(costItem => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', costItem.id); // The ID is the 'referencia'
        
        const costo = typeof costItem.costo === 'number' ? costItem.costo.toFixed(2) : 'N/A';
        const tecnologia = costItem.tecnologia || '';
        const naturaleza = costItem.naturaleza || '';

        row.innerHTML = `
            <td>${costItem.id}</td>
            <td data-field="costo">${costo}</td>
            <td data-field="tecnologia">${tecnologia}</td>
            <td data-field="naturaleza">${naturaleza}</td>
            <td class="actions">
                <button class="btn-icon edit-cost-btn" title="Editar">✏️</button>
                <button class="btn-icon delete-cost-btn" title="Eliminar">🗑️</button>
            </td>
        `;
        costsTableBody.appendChild(row);
    });

    // Usar delegación de eventos para manejar clics en botones
    if (!costsTableBody.dataset.listenerAttached) {
        costsTableBody.addEventListener('click', (e) => {
            const target = e.target;
            const row = target.closest('tr');
            if (!row) return;

            const id = row.dataset.id;

            // Botón Editar
            if (target.closest('.edit-cost-btn')) {
                const costCell = row.querySelector('td[data-field="costo"]');
                const techCell = row.querySelector('td[data-field="tecnologia"]');
                const natureCell = row.querySelector('td[data-field="naturaleza"]');

                // Store original values before creating inputs
                row.dataset.originalCost = costCell.textContent;
                row.dataset.originalTech = techCell.textContent;
                row.dataset.originalNature = natureCell.textContent;

                const currentCost = parseFloat(costCell.textContent) || 0;
                const currentTech = techCell.textContent;
                const currentNature = natureCell.textContent;

                costCell.innerHTML = `<input type="number" class="input-base" value="${currentCost.toFixed(2)}" step="0.01">`;
                techCell.innerHTML = `<input type="text" class="input-base" value="${currentTech}">`;
                natureCell.innerHTML = `<input type="text" class="input-base" value="${currentNature}">`;
                
                const actionCell = row.querySelector('.actions');
                actionCell.innerHTML = '<button class="btn-icon save-cost-btn" title="Guardar">💾</button> <button class="btn-icon cancel-edit-btn" title="Cancelar">❌</button>';
            }

            // Botón Guardar
            if (target.closest('.save-cost-btn')) {
                const costInput = row.querySelector('td[data-field="costo"] input');
                const techInput = row.querySelector('td[data-field="tecnologia"] input');
                const natureInput = row.querySelector('td[data-field="naturaleza"] input');

                const newCost = parseFloat(costInput.value);
                const newTech = techInput.value;
                const newNature = natureInput.value;

                if (costInput && techInput && natureInput && !isNaN(newCost)) {
                    const dataToUpdate = {
                        costo: newCost,
                        tecnologia: newTech,
                        naturaleza: newNature
                    };
                    if (typeof saveCallback === 'function') {
                        saveCallback(id, dataToUpdate);
                    }
                } else {
                    showCostsUploadStatus('El costo ingresado no es válido.', 'error');
                }
            }

            // Botón Cancelar
            if (target.closest('.cancel-edit-btn')) {
                // Restore from data attributes
                row.querySelector('td[data-field="costo"]').textContent = row.dataset.originalCost;
                row.querySelector('td[data-field="tecnologia"]').textContent = row.dataset.originalTech;
                row.querySelector('td[data-field="naturaleza"]').textContent = row.dataset.originalNature;

                const actionCell = row.querySelector('.actions');
                actionCell.innerHTML = `
                    <button class="btn-icon edit-cost-btn" title="Editar">✏️</button>
                    <button class="btn-icon delete-cost-btn" title="Eliminar">🗑️</button>
                `;
            }

            // Botón Eliminar
            if (target.closest('.delete-cost-btn')) {
                if (confirm(`¿Estás seguro de que quieres eliminar la referencia "${id}"?`)) {
                    if (typeof deleteCallback === 'function') {
                        deleteCallback(id);
                    }
                }
            }
        });
        costsTableBody.dataset.listenerAttached = 'true';
    }
}

export function showCostsUploadStatus(message, type = 'success') {
    const statusEl = document.getElementById('costs-upload-status');
    statusEl.textContent = message;
    statusEl.className = `feedback ${type}`;
    if (message) {
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'feedback';
        }, 5000);
    }
}

export function updateCostsFileName(fileName) {
    document.getElementById('costs-file-name').textContent = fileName || 'Ningún archivo seleccionado';
}

export function filterCostsTable(searchInput, tableBody) {
    const filter = searchInput.value.toUpperCase();
    const rows = tableBody.getElementsByTagName('tr');
    for (let i = 0; i < rows.length; i++) {
        const refCell = rows[i].getElementsByTagName('td')[0];
        if (refCell) {
            if (refCell.textContent.toUpperCase().indexOf(filter) > -1) {
                rows[i].style.display = '';
            } else {
                rows[i].style.display = 'none';
            }
        }
    }
}