// Global state
let projectData = [];
let filteredData = [];
let statusChart = null;
let budgetChart = null;

// Google Sheets JSONP URL
const SPREADSHEET_JSONP_URL = 'https://docs.google.com/spreadsheets/d/1UZZoN28xebSsuTpagoq_SeUjeBR9KTFekS0rtqIIjZY/gviz/tq';

// DOM Elements
const btnRefresh = document.getElementById('btn-refresh');
const refreshIcon = document.getElementById('refresh-icon');
const lastUpdatedText = document.getElementById('last-updated');
const searchInput = document.getElementById('search-input');
const filterWorkgroup = document.getElementById('filter-workgroup');
const filterStatus = document.getElementById('filter-status');
const tableBody = document.getElementById('project-table-body');
const filteredCountText = document.getElementById('filtered-count-text');

// KPI Elements
const valTotalProjects = document.getElementById('val-total-projects');
const valTotalBudget = document.getElementById('val-total-budget');
const valTotalSpent = document.getElementById('val-total-spent');
const valSpentPercent = document.getElementById('val-spent-percent');
const valTotalRemaining = document.getElementById('val-total-remaining');
const valRemainingPercent = document.getElementById('val-remaining-percent');
const valAvgProgress = document.getElementById('val-avg-progress');
const valProgressBarFill = document.getElementById('val-progress-bar-fill');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch
    fetchDashboardData();

    // Initialize document management system
    initDocumentSystem();

    // Event listeners
    btnRefresh.addEventListener('click', fetchDashboardData);
    searchInput.addEventListener('input', applyFilters);
    filterWorkgroup.addEventListener('change', applyFilters);
    filterStatus.addEventListener('change', applyFilters);
});

// Toast notification helper
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${icon}"></i>
        <span class="toast-message">${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });

    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Hide and remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// Fetch data from Google Sheet using JSONP script tag to bypass CORS / local file restrictions
function fetchDashboardData() {
    // Start loading states
    refreshIcon.classList.add('spin');
    btnRefresh.disabled = true;
    
    tableBody.innerHTML = `
        <tr>
            <td colspan="9" class="td-loading">
                <div class="loader-container">
                    <div class="spinner"></div>
                    <span>กำลังดึงข้อมูลโครงการล่าสุดจาก Google Sheet...</span>
                </div>
            </td>
        </tr>
    `;

    // Remove old script tag if exists
    const oldScript = document.getElementById('gviz-script');
    if (oldScript) {
        oldScript.remove();
    }

    // Create dynamic script tag
    const script = document.createElement('script');
    script.id = 'gviz-script';
    
    // Add cache buster and responseHandler callback name
    const callbackName = 'googleDocCallback';
    script.src = `${SPREADSHEET_JSONP_URL}?tqx=responseHandler:${callbackName}&t=${new Date().getTime()}`;
    
    // Define global callback handler
    window[callbackName] = function(res) {
        try {
            if (res.status === 'error') {
                throw new Error(res.errors[0].detailed_message || 'ดึงข้อมูลไม่สำเร็จ');
            }
            
            const table = res.table;
            if (!table || !table.rows || table.rows.length === 0) {
                throw new Error('ไม่พบข้อมูลโครงการใน Google Sheet');
            }
            
            // Map table cols and rows to the format we need
            const headers = table.cols.map(col => col.label ? col.label.trim() : '');
            
            const parsedRows = [headers];
            table.rows.forEach(row => {
                const parsedRow = row.c.map(cell => {
                    if (!cell) return '';
                    if (cell.v === null || cell.v === undefined) return '';
                    return String(cell.v);
                });
                parsedRows.push(parsedRow);
            });
            
            // Process the formatted rows
            processRawData(parsedRows);
            
            // Populate filter and apply
            populateWorkgroupFilter();
            populateProjectDropdown();
            applyFilters();
            
            // Update timestamp
            const now = new Date();
            const formattedDate = now.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            lastUpdatedText.textContent = `อัปเดตเมื่อ: ${formattedDate} น.`;
            showToast('ดึงข้อมูลโครงการจาก Google Sheet สำเร็จ', 'success');
            
        } catch (error) {
            handleFetchError(error);
        } finally {
            cleanupScript();
        }
    };
    
    // Handle script load error (e.g. network failure)
    script.onerror = function() {
        handleFetchError(new Error('ไม่สามารถโหลดสคริปต์ข้อมูลได้ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'));
        cleanupScript();
    };
    
    document.head.appendChild(script);
    
    function cleanupScript() {
        refreshIcon.classList.remove('spin');
        btnRefresh.disabled = false;
        try {
            delete window[callbackName];
        } catch(e) {}
    }
}

function handleFetchError(error) {
    console.error('Error fetching data:', error);
    tableBody.innerHTML = `
        <tr>
            <td colspan="9" class="td-empty">
                <div class="empty-container">
                    <i data-lucide="alert-circle" class="empty-icon text-orange"></i>
                    <span>ไม่สามารถโหลดข้อมูลได้: ${error.message}</span>
                    <small>โปรดตรวจสอบอินเทอร์เน็ต หรือตั้งค่าแชร์ลิงก์ Google Sheet ให้ทุกคนที่มีลิงก์เข้าดูได้</small>
                </div>
            </td>
        </tr>
    `;
    lucide.createIcons();
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    lastUpdatedText.textContent = 'การอัปเดตล้มเหลว';
}

// Process Raw parsed CSV rows into structured project data
function processRawData(rows) {
    const headers = rows[0].map(h => h.trim());
    
    // Find column indexes based on header names
    const colIdx = {
        id: headers.indexOf('รหัสโครงการ'),
        name: headers.indexOf('ชื่อโครงการ'),
        owner: headers.indexOf('ผู้รับผิดชอบ'),
        group: headers.indexOf('กลุ่มงาน'),
        budget: headers.indexOf('งบประมาณ'),
        spent: headers.indexOf('ใช้ไปแล้ว'),
        remain: headers.indexOf('คงเหลือ'),
        progress: headers.indexOf('ความคืบหน้า'),
        status: headers.indexOf('สถานะ')
    };

    projectData = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // Skip empty rows
        if (row.length < headers.length || !row[colIdx.name]) continue;

        const id = row[colIdx.id] ? row[colIdx.id].trim() : String(i);
        const name = row[colIdx.name].trim();
        const owner = row[colIdx.owner] ? row[colIdx.owner].trim() : 'ไม่ระบุ';
        const group = row[colIdx.group] ? row[colIdx.group].trim() : 'ทั่วไป';
        
        // Clean and parse numbers
        const cleanNumber = (val) => {
            if (!val) return 0;
            return parseFloat(val.replace(/,/g, '')) || 0;
        };

        const budget = cleanNumber(row[colIdx.budget]);
        
        // Spent could be empty, handle it as 0
        const spentValRaw = row[colIdx.spent];
        const spent = (spentValRaw === undefined || spentValRaw.trim() === '') ? 0 : cleanNumber(spentValRaw);
        
        // Remaining budget
        const remain = budget - spent;
        
        // Progress (percentage, scale 0-100 or 0-1)
        let progress = cleanNumber(row[colIdx.progress]);
        // If progress in sheet is written as 0.26 instead of 26, check if it's less than 1 and has decimals,
        // but looking at CSV, progress values are 12.35, 26.67, 100, 50, so they are already in percentage scale (0-100).
        if (progress > 100) progress = 100;
        if (progress < 0) progress = 0;

        const status = row[colIdx.status] ? row[colIdx.status].trim() : 'ยังไม่ดำเนินการ';

        projectData.push({
            id,
            name,
            owner,
            group,
            budget,
            spent,
            remain,
            progress,
            status
        });
    }
}

// Populate the workgroup filter dropdown with unique workgroups
function populateWorkgroupFilter() {
    const currentSelection = filterWorkgroup.value;
    
    // Get unique workgroups
    const workgroups = [...new Set(projectData.map(p => p.group))].sort();
    
    // Clear and keep "all"
    filterWorkgroup.innerHTML = '<option value="all">ทุกกลุ่มงาน</option>';
    
    workgroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        filterWorkgroup.appendChild(option);
    });

    // Restore selection if still exists
    if (workgroups.includes(currentSelection)) {
        filterWorkgroup.value = currentSelection;
    } else {
        filterWorkgroup.value = 'all';
    }
}

// Filter dataset based on search, workgroup, and status dropdowns
function applyFilters() {
    const searchQuery = searchInput.value.toLowerCase().trim();
    const selectedGroup = filterWorkgroup.value;
    const selectedStatus = filterStatus.value;

    filteredData = projectData.filter(project => {
        // Search Filter
        const matchesSearch = 
            project.name.toLowerCase().includes(searchQuery) ||
            project.owner.toLowerCase().includes(searchQuery) ||
            project.id.toLowerCase().includes(searchQuery);

        // Workgroup Filter
        const matchesGroup = selectedGroup === 'all' || project.group === selectedGroup;

        // Status Filter
        const matchesStatus = selectedStatus === 'all' || project.status === selectedStatus;

        return matchesSearch && matchesGroup && matchesStatus;
    });

    // Update Dashboard UI
    updateKPIs();
    renderCharts();
    renderTable();
}

// Format currency in Thai Baht format
function formatCurrency(number) {
    return new Intl.NumberFormat('th-TH', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}

// Update KPI stats cards
function updateKPIs() {
    // We calculate KPIs based on the filtered data set to make it responsive
    const totalProjects = filteredData.length;
    let totalBudget = 0;
    let totalSpent = 0;
    let totalProgressSum = 0;

    filteredData.forEach(p => {
        totalBudget += p.budget;
        totalSpent += p.spent;
        totalProgressSum += p.progress;
    });

    const totalRemaining = totalBudget - totalSpent;
    const avgProgress = totalProjects > 0 ? (totalProgressSum / totalProjects) : 0;
    
    const spentPercent = totalBudget > 0 ? (totalSpent / totalBudget * 100) : 0;
    const remainingPercent = totalBudget > 0 ? (totalRemaining / totalBudget * 100) : 0;

    // Set values in HTML
    valTotalProjects.textContent = totalProjects.toLocaleString('th-TH');
    valTotalBudget.textContent = formatCurrency(totalBudget) + ' บาท';
    valTotalSpent.textContent = formatCurrency(totalSpent) + ' บาท';
    valTotalRemaining.textContent = formatCurrency(totalRemaining) + ' บาท';
    valAvgProgress.textContent = avgProgress.toFixed(2) + '%';

    valSpentPercent.textContent = `${spentPercent.toFixed(1)}% ของงบประมาณ`;
    valRemainingPercent.textContent = `${remainingPercent.toFixed(1)}% คงเหลือ`;

    // Update overall progress bar fill width
    valProgressBarFill.style.width = `${avgProgress}%`;
}

// Render or update charts
function renderCharts() {
    // 1. Status Distribution Doughnut Chart
    const statusCounts = {
        'ยังไม่ดำเนินการ': 0,
        'อยู่ระหว่างดำเนินการ': 0,
        'ดำเนินการแล้ว': 0
    };
    
    filteredData.forEach(p => {
        if (statusCounts[p.status] !== undefined) {
            statusCounts[p.status]++;
        }
    });

    const ctxStatus = document.getElementById('chart-status').getContext('2d');
    
    if (statusChart) {
        statusChart.destroy();
    }

    statusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    '#9333ea', // ยังไม่ดำเนินการ: Purple
                    '#b45309', // อยู่ระหว่างดำเนินการ: Gold
                    '#db2777'  // ดำเนินการแล้ว: Pink
                ],
                borderWidth: 2,
                borderColor: '#ffffff', // Matches card background in light theme
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#581c87',
                        font: {
                            family: 'Prompt',
                            size: 11
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return ` ${label}: ${value} โครงการ (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });

    // 2. Budget vs Spent by Workgroup Bar Chart
    // Get workgroups in the filtered dataset
    const workgroups = [...new Set(filteredData.map(p => p.group))].sort();
    const budgetDataByGroup = {};
    const spentDataByGroup = {};

    workgroups.forEach(g => {
        budgetDataByGroup[g] = 0;
        spentDataByGroup[g] = 0;
    });

    filteredData.forEach(p => {
        budgetDataByGroup[p.group] += p.budget;
        spentDataByGroup[p.group] += p.spent;
    });

    const ctxBudget = document.getElementById('chart-budget-workgroup').getContext('2d');

    if (budgetChart) {
        budgetChart.destroy();
    }

    budgetChart = new Chart(ctxBudget, {
        type: 'bar',
        data: {
            labels: workgroups,
            datasets: [
                {
                    label: 'งบประมาณที่ได้รับ',
                    data: workgroups.map(g => budgetDataByGroup[g]),
                    backgroundColor: 'rgba(147, 51, 234, 0.75)', // Purple
                    borderColor: 'rgb(147, 51, 234)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'งบประมาณที่ใช้ไป',
                    data: workgroups.map(g => spentDataByGroup[g]),
                    backgroundColor: 'rgba(219, 39, 119, 0.75)', // Pink
                    borderColor: 'rgb(219, 39, 119)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#581c87',
                        font: {
                            family: 'Prompt',
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)} บาท`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(147, 51, 234, 0.05)'
                    },
                    ticks: {
                        color: '#581c87',
                        font: {
                            family: 'Prompt',
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(147, 51, 234, 0.08)'
                    },
                    ticks: {
                        color: '#581c87',
                        font: {
                            family: 'Prompt',
                            size: 10
                        },
                        callback: function(value) {
                            if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
                            if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
                            return value;
                        }
                    }
                }
            }
        }
    });
}

// Render data table
function renderTable() {
    tableBody.innerHTML = '';
    filteredCountText.textContent = `พบทั้งหมด ${filteredData.length.toLocaleString('th-TH')} รายการ จากโครงการทั้งหมด ${projectData.length.toLocaleString('th-TH')} รายการ`;

    if (filteredData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="td-empty">
                    <div class="empty-container">
                        <i data-lucide="folder-search" class="empty-icon"></i>
                        <span>ไม่พบข้อมูลโครงการที่ตรงกับเงื่อนไขการค้นหา</span>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    filteredData.forEach(project => {
        const tr = document.createElement('tr');
        
        // Status badge configuration
        let badgeClass = 'badge-info';
        if (project.status === 'ดำเนินการแล้ว') badgeClass = 'badge-success';
        if (project.status === 'อยู่ระหว่างดำเนินการ') badgeClass = 'badge-warning';

        // Progress bar color based on percentage
        let progressBarColor = 'linear-gradient(to right, #d8b4fe, #9333ea)'; // Purple (ยังไม่ดำเนินการ)
        if (project.progress > 0 && project.progress < 100) {
            progressBarColor = 'linear-gradient(to right, #fef08a, #d97706)'; // Gold (อยู่ระหว่างดำเนินการ)
        } else if (project.progress === 100) {
            progressBarColor = 'linear-gradient(to right, #fbcfe8, #db2777)'; // Pink (ดำเนินการแล้ว)
        }

        tr.innerHTML = `
            <td class="col-id text-center">${project.id}</td>
            <td class="col-name">${project.name}</td>
            <td class="col-owner">${project.owner}</td>
            <td class="col-group">${project.group}</td>
            <td class="col-budget text-right">${formatCurrency(project.budget)}</td>
            <td class="col-spent text-right">${formatCurrency(project.spent)}</td>
            <td class="col-remain text-right">${formatCurrency(project.remain)}</td>
            <td class="col-progress">
                <div class="table-progress-wrapper">
                    <div class="table-progress-bar-bg">
                        <div class="table-progress-bar-fill" style="width: ${project.progress}%; background: ${progressBarColor}"></div>
                    </div>
                    <span class="table-progress-text">${project.progress.toFixed(2)}%</span>
                </div>
            </td>
            <td class="col-status">
                <span class="badge ${badgeClass}">${project.status}</span>
            </td>
        `;

        tableBody.appendChild(tr);
    });

    // Re-initialize Lucide icons in table
    lucide.createIcons();
}

// ==========================================
// Procurement Document Management System
// ==========================================

const LOCAL_STORAGE_DOCS_KEY = 'kpru_procurement_docs';

const DEFAULT_DOCUMENTS = [
    {
        id: 'default_1',
        name: 'TOR_อบรมเชิงปฏิบัติการสร้างสื่อดิจิทัล.pdf',
        type: 'TOR / ข้อกำหนด',
        projectId: '1',
        projectName: 'อบรมเชิงปฏิบัติการสร้างสื่อดิจิทัล',
        date: '20/06/2026',
        size: '245 KB',
        isDefault: true
    },
    {
        id: 'default_2',
        name: 'ใบเสนอราคา_พัฒนาทักษะAI.pdf',
        type: 'ใบเสนอราคา',
        projectId: '2',
        projectName: 'พัฒนาทักษะการเรียนรู้ด้วย AI',
        date: '20/06/2026',
        size: '188 KB',
        isDefault: true
    }
];

let documentData = [];

// Initialize Document System
function initDocumentSystem() {
    loadDocuments();
    setupDocumentEvents();
    renderDocumentsTable();
}

// Load documents from LocalStorage or use default
function loadDocuments() {
    const stored = localStorage.getItem(LOCAL_STORAGE_DOCS_KEY);
    if (stored) {
        try {
            documentData = JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing stored documents, resetting to default', e);
            documentData = [...DEFAULT_DOCUMENTS];
            saveDocumentsToLocalStorage();
        }
    } else {
        documentData = [...DEFAULT_DOCUMENTS];
        saveDocumentsToLocalStorage();
    }
}

// Save documents list to LocalStorage
function saveDocumentsToLocalStorage() {
    localStorage.setItem(LOCAL_STORAGE_DOCS_KEY, JSON.stringify(documentData));
}

// Populate the related projects dropdown dynamically
function populateProjectDropdown() {
    const docProjectSelect = document.getElementById('doc-project');
    if (!docProjectSelect) return;
    
    docProjectSelect.innerHTML = '<option value="" disabled selected>เลือกโครงการ...</option>';
    
    projectData.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `[รหัส ${p.id}] ${p.name}`;
        // Store project name as attribute for easy retrieval
        option.setAttribute('data-name', p.name);
        docProjectSelect.appendChild(option);
    });
}

// Format file bytes into readable size
function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Setup Event Listeners for File Upload and Drag/Drop
function setupDocumentEvents() {
    const fileInput = document.getElementById('doc-file');
    const fileDropZone = document.getElementById('file-drop-zone');
    const fileNameDisplay = document.getElementById('file-name-display');
    const uploadForm = document.getElementById('upload-doc-form');

    if (!fileInput || !fileDropZone || !uploadForm) return;

    // Trigger file selection on click
    fileDropZone.addEventListener('click', () => fileInput.click());

    // Drag and drop events
    ['dragenter', 'dragover'].forEach(eventName => {
        fileDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            fileDropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            fileDropZone.classList.remove('dragover');
        }, false);
    });

    fileDropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        // Size limit check: 1.5MB = 1.5 * 1024 * 1024 bytes
        const sizeLimit = 1.5 * 1024 * 1024;
        if (file.size > sizeLimit) {
            showToast('ขนาดไฟล์เกิน 1.5 MB ไม่สามารถบันทึกใน LocalStorage ได้', 'error');
            fileInput.value = '';
            fileNameDisplay.textContent = 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์';
            return;
        }
        fileNameDisplay.textContent = `${file.name} (${formatBytes(file.size)})`;
    }

    // Form Submit Event
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const file = fileInput.files[0];
        const docProjectSelect = document.getElementById('doc-project');
        const docTypeSelect = document.getElementById('doc-type');

        if (!file) {
            showToast('โปรดเลือกไฟล์ก่อนทำการอัปโหลด', 'error');
            return;
        }

        const selectedOption = docProjectSelect.options[docProjectSelect.selectedIndex];
        const projectId = docProjectSelect.value;
        const projectName = selectedOption.getAttribute('data-name') || '';
        const docType = docTypeSelect.value;

        // Read file as Base64 Data URL
        const reader = new FileReader();
        reader.onload = function(evt) {
            const base64Data = evt.target.result;
            
            const newDoc = {
                id: 'doc_' + Date.now(),
                name: file.name,
                type: docType,
                projectId: projectId,
                projectName: projectName,
                date: new Date().toLocaleDateString('th-TH'),
                size: formatBytes(file.size),
                data: base64Data,
                isDefault: false
            };

            documentData.unshift(newDoc); // Add to top
            saveDocumentsToLocalStorage();
            renderDocumentsTable();
            showToast('อัปโหลดเอกสารจัดซื้อจัดจ้างสำเร็จ', 'success');

            // Reset form
            uploadForm.reset();
            fileNameDisplay.textContent = 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์';
        };

        reader.onerror = function() {
            showToast('เกิดข้อผิดพลาดในการอ่านไฟล์', 'error');
        };

        reader.readAsDataURL(file);
    });
}

// Render the documents table UI
function renderDocumentsTable() {
    const docTableBody = document.getElementById('document-table-body');
    if (!docTableBody) return;

    docTableBody.innerHTML = '';

    if (documentData.length === 0) {
        docTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="td-empty">
                    <div class="empty-container">
                        <i data-lucide="file-warning" class="empty-icon"></i>
                        <span>ไม่มีเอกสารจัดซื้อจัดจ้างในระบบ</span>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    documentData.forEach(doc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-doc-name">${doc.name}</td>
            <td class="col-doc-project">[รหัส ${doc.projectId}] ${doc.projectName}</td>
            <td class="col-doc-type">${doc.type}</td>
            <td class="col-doc-date text-center">${doc.date}</td>
            <td class="col-doc-size text-right">${doc.size}</td>
            <td class="col-doc-actions text-center">
                <div class="actions-cell-wrapper">
                    <button class="btn-icon-only btn-pink btn-download" data-id="${doc.id}" title="ดาวน์โหลดเอกสาร">
                        <i data-lucide="download"></i>
                    </button>
                    <button class="btn-icon-only btn-orange btn-delete" data-id="${doc.id}" title="ลบเอกสาร">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;

        // Event listeners for action buttons
        tr.querySelector('.btn-download').addEventListener('click', () => handleDownload(doc));
        tr.querySelector('.btn-delete').addEventListener('click', () => handleDelete(doc));

        docTableBody.appendChild(tr);
    });

    lucide.createIcons();
}

// Handle Document Download
function handleDownload(doc) {
    if (doc.isDefault) {
        // Generate mock file content
        const mockContent = `==================================================
เอกสารจัดซื้อจัดจ้าง โรงเรียนครุศาสตร์ มรภ.กำแพงเพชร
==================================================
ประเภทเอกสาร: ${doc.type}
วันที่อัปโหลดเข้าระบบ: ${doc.date}
ขนาดจำลอง: ${doc.size}
โครงการที่เกี่ยวข้อง: [รหัส ${doc.projectId}] ${doc.projectName}
ชื่อไฟล์ระบบ: ${doc.name}
--------------------------------------------------
เอกสารฉบับนี้เป็นข้อมูลจำลอง (Mock Document) เพื่อทดสอบ
การนำขึ้นระบบจัดซื้อจัดจ้างของส่วนบริหารโรงเรียนครุศาสตร์
มหาวิทยาลัยราชภัฏกำแพงเพชร

ขอรับรองความถูกต้องของระบบการตรวจสอบเอกสาร
==================================================`;
        const blob = new Blob([mockContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Download as text file to represent the mock
        a.download = doc.name.endsWith('.pdf') ? doc.name.replace('.pdf', '.txt') : doc.name + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('ดาวน์โหลดเอกสารตัวอย่างสำเร็จ', 'success');
    } else {
        // Download user uploaded base64 data
        try {
            const a = document.createElement('a');
            a.href = doc.data;
            a.download = doc.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast(`ดาวน์โหลด ${doc.name} สำเร็จ`, 'success');
        } catch (e) {
            console.error('Error downloading file', e);
            showToast('เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์', 'error');
        }
    }
}

// Handle Document Delete
function handleDelete(doc) {
    if (confirm(`คุณต้องการลบเอกสาร "${doc.name}" ใช่หรือไม่?`)) {
        documentData = documentData.filter(d => d.id !== doc.id);
        saveDocumentsToLocalStorage();
        renderDocumentsTable();
        showToast(`ลบเอกสาร "${doc.name}" เรียบร้อยแล้ว`, 'success');
    }
}
