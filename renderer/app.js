// App State
const state = {
  connected: false,
  currentSessionKey: null,
  sessions: [],
  messages: [],
  cronJobs: [],
  config: {
    url: 'ws://localhost:18789',
    token: '',
    password: ''
  }
};

// DOM Elements
let elements = {};

// Initialize DOM elements
function initializeElements() {
  console.log('=== INITIALIZING DOM ELEMENTS ===');
  elements = {
    // Title Bar
    minimizeBtn: document.getElementById('minimize-btn'),
    maximizeBtn: document.getElementById('maximize-btn'),
    closeBtn: document.getElementById('close-btn'),

    // Layout
    sidebar: document.getElementById('sidebar'),
    resizer: document.getElementById('resizer'),

    // Connection
    connectionIndicator: document.getElementById('connection-indicator'),

    // Chat
    newSessionBtn: document.getElementById('new-session-btn'),
    sessionsList: document.getElementById('sessions-list'),
    currentSessionTitle: document.getElementById('current-session-title'),
    sessionStatus: document.getElementById('session-status'),
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),

    // Settings dialog
    settingsBtn: document.getElementById('settings-btn'),
    settingsDialog: document.getElementById('settings-dialog'),
    settingsCloseBtn: document.getElementById('settings-close-btn'),
    settingsNavItems: document.querySelectorAll('.settings-nav-item'),
    settingsContentViews: document.querySelectorAll('.settings-content-view'),

    // Settings - Sessions
    settingsAllSessionsContent: document.getElementById('settings-all-sessions-content'),

    // Settings - Cron
    settingsAddCronBtn: document.getElementById('settings-add-cron-btn'),
    settingsCronJobsContent: document.getElementById('settings-cron-jobs-content'),

    // Settings - Config
    settingsConfigGatewayUrl: document.getElementById('settings-config-gateway-url'),
    settingsConfigGatewayToken: document.getElementById('settings-config-gateway-token'),
    settingsConfigGatewayPassword: document.getElementById('settings-config-gateway-password'),
    settingsTestConnectionBtn: document.getElementById('settings-test-connection-btn'),
    settingsSaveConfigBtn: document.getElementById('settings-save-config-btn'),
    settingsConfigStatus: document.getElementById('settings-config-status'),

    // Settings - Logs
    settingsLogLevelFilter: document.getElementById('settings-log-level-filter'),
    settingsLogLimit: document.getElementById('settings-log-limit'),
    settingsRefreshLogsBtn: document.getElementById('settings-refresh-logs-btn'),
    settingsClearLogsBtn: document.getElementById('settings-clear-logs-btn'),
    settingsLogsContent: document.getElementById('settings-logs-content'),

    // Loading
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingMessage: document.getElementById('loading-message'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  console.log('Elements initialized:', Object.keys(elements));
}

// Utility Functions
function showLoading(message = 'Loading...') {
  elements.loadingMessage.textContent = message;
  elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  elements.loadingOverlay.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Custom prompt dialog (replaces browser's prompt() which doesn't work in Electron)
function showPrompt(title, message, defaultValue = '') {
  return new Promise((resolve) => {
    // Create modal dialog
    const overlay = document.createElement('div');
    overlay.className = 'prompt-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'prompt-dialog';
    dialog.innerHTML = `
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <input type="text" class="prompt-input" value="${escapeHtml(defaultValue)}" placeholder="Enter value...">
      <div class="prompt-buttons">
        <button class="btn btn-secondary prompt-cancel">Cancel</button>
        <button class="btn btn-primary prompt-ok">OK</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const input = dialog.querySelector('.prompt-input');
    const okBtn = dialog.querySelector('.prompt-ok');
    const cancelBtn = dialog.querySelector('.prompt-cancel');

    // Focus input
    setTimeout(() => input.focus(), 100);

    // Handle OK
    const handleOk = () => {
      document.body.removeChild(overlay);
      resolve(input.value);
    };

    // Handle Cancel
    const handleCancel = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };

    // Event listeners
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleOk();
      if (e.key === 'Escape') handleCancel();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleCancel();
    });
  });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Settings Dialog
function openSettingsDialog(viewName = 'sessions') {
  elements.settingsDialog.classList.remove('hidden');
  switchSettingsView(viewName);
}

function closeSettingsDialog() {
  elements.settingsDialog.classList.add('hidden');
}

function switchSettingsView(viewName) {
  // Update nav items
  elements.settingsNavItems.forEach(item => {
    if (item.dataset.settingsView === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update content views - remove active class from all, add to target
  elements.settingsContentViews.forEach(view => {
    view.classList.remove('active');
  });
  const contentView = document.getElementById(`settings-${viewName}-view`);
  if (contentView) {
    contentView.classList.add('active');
  }

  // Load view-specific content
  if (viewName === 'logs') {
    loadLogs();
  } else if (viewName === 'sessions') {
    loadAllSessions();
  } else if (viewName === 'cron') {
    loadCronJobs();
  } else if (viewName === 'config') {
    loadConfig();
  }
}

// Gateway Connection
async function connectToGateway(config) {
  showLoading('Connecting to Gateway...');

  try {
    console.log('Connecting to gateway with config:', {
      url: config.url,
      hasToken: !!config.token,
      hasPassword: !!config.password
    });

    const result = await window.electronAPI.connectGateway(config);
    console.log('Connection result:', result);

    if (result.success) {
      state.connected = true;
      state.config = config;
      elements.connectionIndicator.classList.remove('offline');
      elements.connectionIndicator.classList.add('online');
      elements.sessionStatus.textContent = 'Connected';
      showToast('Connected successfully!', 'success');

      // Load sessions after connection
      await loadSessions();
      return true;
    } else {
      showToast(`Connection failed: ${result.error}`, 'error');
      return false;
    }
  } catch (error) {
    console.error('Connection error:', error);
    showToast(`Connection error: ${error.message}`, 'error');
    return false;
  } finally {
    hideLoading();
  }
}

async function testConnection() {
  const config = {
    url: elements.settingsConfigGatewayUrl.value.trim(),
    token: elements.settingsConfigGatewayToken.value.trim(),
    password: elements.settingsConfigGatewayPassword.value.trim()
  };

  if (!config.url) {
    showToast('Please enter a Gateway URL', 'error');
    return;
  }

  // Check if already connected with same settings
  if (state.connected) {
    const configChanged =
      config.url !== state.config.url ||
      config.token !== state.config.token ||
      config.password !== state.config.password;

    if (!configChanged) {
      showToast('Already connected with these settings!', 'success');
      showConfigStatus('✅ Already connected! You can start chatting.', 'success');
      return;
    }

    // Config changed, need to reconnect
    const confirmReconnect = confirm('Configuration changed. Reconnect with new settings?');
    if (!confirmReconnect) {
      return;
    }
  }

  showLoading('Testing connection...');

  try {
    // Test connection by actually connecting
    const result = await window.electronAPI.connectGateway(config);
    if (result.success) {
      state.config = config; // Update config
      showToast('Connection test successful! You are now connected.', 'success');
      showConfigStatus('✅ Connected! Sessions loaded. You can now create sessions and chat.', 'success');

      // IMPORTANT: Load sessions after successful connection
      console.log('Connection successful, loading sessions...');
      await loadSessions();
      console.log('Sessions loaded, count:', state.sessions.length);
    } else {
      showToast(`Connection test failed: ${result.error}`, 'error');
      showConfigStatus(`❌ Connection failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showToast(`Connection test error: ${error.message}`, 'error');
    showConfigStatus(`❌ Connection test error: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

function showConfigStatus(message, type) {
  elements.settingsConfigStatus.textContent = message;
  elements.settingsConfigStatus.className = `status ${type}`;
}

async function saveConfig() {
  const config = {
    url: elements.configGatewayUrl.value.trim(),
    token: elements.configGatewayToken.value.trim(),
    password: elements.configGatewayPassword.value.trim()
  };

  if (!config.url) {
    showToast('Please enter a Gateway URL', 'error');
    return;
  }

  // Save config
  try {
    await window.electronAPI.saveConfig({ gateway: config });
    state.config = config;
    showToast('Configuration saved successfully!', 'success');
    showConfigStatus('✅ Configuration saved!', 'success');
  } catch (error) {
    showToast(`Failed to save config: ${error.message}`, 'error');
    showConfigStatus(`❌ Failed to save: ${error.message}`, 'error');
  }
}

async function saveAndConnect() {
  const config = {
    url: elements.settingsConfigGatewayUrl.value.trim(),
    token: elements.settingsConfigGatewayToken.value.trim(),
    password: elements.settingsConfigGatewayPassword.value.trim()
  };

  if (!config.url) {
    showToast('Please enter a Gateway URL', 'error');
    return;
  }

  // Check if already connected with same settings
  if (state.connected) {
    const configChanged =
      config.url !== state.config.url ||
      config.token !== state.config.token ||
      config.password !== state.config.password;

    if (!configChanged) {
      // Already connected with same config, just save
      await saveConfig();
      showToast('Already connected! Configuration saved.', 'success');
      return;
    }
  }

  // Save config first
  try {
    await window.electronAPI.saveConfig({ gateway: config });
    state.config = config;
    showToast('Configuration saved', 'success');
  } catch (error) {
    showToast(`Failed to save config: ${error.message}`, 'error');
    return;
  }

  // Connect
  await connectToGateway(config);
}

function loadConfig() {
  elements.settingsConfigGatewayUrl.value = state.config.url || 'ws://localhost:18789';
  elements.settingsConfigGatewayToken.value = state.config.token || '';
  elements.settingsConfigGatewayPassword.value = state.config.password || '';
  elements.settingsConfigStatus.textContent = '';
  elements.settingsConfigStatus.className = 'status';
}

// Sessions
async function loadSessions() {
  if (!state.connected) {
    console.log('Not connected, skipping session load');
    return;
  }

  try {
    console.log('Loading sessions...');
    const result = await window.electronAPI.listSessions({
      limit: 100,
      includeLastMessage: true
    });

    console.log('Sessions result:', result);

    if (result.success && result.data) {
      state.sessions = result.data.sessions || [];
      console.log('Loaded sessions:', state.sessions.length);
      renderSessionsList();

      // Auto-select first session if available and no session is currently selected
      if (state.sessions.length > 0 && !state.currentSessionKey) {
        console.log('Auto-selecting first session:', state.sessions[0].key);
        await selectSession(state.sessions[0].key);
      }
    } else {
      console.error('Failed to load sessions:', result.error);
    }
  } catch (error) {
    console.error('Failed to load sessions:', error);
  }
}

function renderSessionsList() {
  elements.sessionsList.innerHTML = '';

  if (state.sessions.length === 0) {
    const emptyHtml = '<div class="empty-state"><h3>No sessions</h3><p>Create a new session to get started</p></div>';
    elements.sessionsList.innerHTML = emptyHtml;
    return;
  }

  state.sessions.forEach(session => {
    const sidebarItem = createSessionItem(session);
    elements.sessionsList.appendChild(sidebarItem);
  });
}

function createSessionItem(session) {
  const item = document.createElement('div');
  item.className = 'session-item';
  if (session.key === state.currentSessionKey) {
    item.classList.add('active');
  }

  // Improve title display - show a more friendly format for agent:main:main style keys
  let title = session.label || session.key;
  if (!session.label && session.key.includes(':')) {
    // If no label, show a more readable format
    const parts = session.key.split(':');
    if (parts.length >= 3) {
      title = `${parts[0]} - ${parts[1]} (${parts[2]})`;
    }
  }

  const lastMessage = session.lastMessage || 'No messages yet';
  const timestamp = session.lastMessageTimestamp ? formatDate(session.lastMessageTimestamp) : '';

  item.innerHTML = `
    <div class="session-title">${escapeHtml(title)}</div>
    <div class="session-info">${escapeHtml(lastMessage.substring(0, 50))}${lastMessage.length > 50 ? '...' : ''}</div>
    ${timestamp ? `<div class="session-info">${timestamp}</div>` : ''}
  `;

  item.addEventListener('click', () => selectSession(session.key));
  return item;
}

async function selectSession(sessionKey) {
  console.log('=== selectSession called ===');
  console.log('Session key:', sessionKey);
  console.log('Current state.connected:', state.connected);

  state.currentSessionKey = sessionKey;

  const session = state.sessions.find(s => s.key === sessionKey);

  // Improve title display
  let title = session?.label || sessionKey;
  if (!session?.label && sessionKey.includes(':')) {
    const parts = sessionKey.split(':');
    if (parts.length >= 3) {
      title = `${parts[0]} - ${parts[1]} (${parts[2]})`;
    }
  }

  elements.currentSessionTitle.textContent = title;

  renderSessionsList();
  await loadChatHistory();

  // Enable message input
  console.log('Before: messageInput.disabled =', elements.messageInput.disabled);
  elements.messageInput.disabled = false;
  elements.messageInput.focus(); // Auto focus the input
  elements.sendBtn.disabled = false;

  console.log('After: messageInput.disabled =', elements.messageInput.disabled);
  console.log('messageInput.readOnly =', elements.messageInput.readOnly);

  // Double-check disabled is removed
  setTimeout(() => {
    console.log('Delayed check: messageInput.disabled =', elements.messageInput.disabled);
    if (elements.messageInput.disabled) {
      console.error('ERROR: messageInput is still disabled! Force enabling...');
      elements.messageInput.disabled = false;
      elements.messageInput.removeAttribute('disabled');
    }
  }, 100);
}

async function createNewSession() {
  console.log('=== createNewSession called ===');
  console.log('state.connected:', state.connected);

  if (!state.connected) {
    console.log('Not connected, showing error');
    showToast('Not connected to gateway. Please configure and connect first.', 'error');
    openSettingsDialog('config');
    return;
  }

  console.log('Connected, prompting for label...');
  const label = await showPrompt('New Chat', 'Enter session label (optional):', '');
  console.log('Label result:', label);

  if (label === null) {
    console.log('User cancelled');
    return;
  }

  // Generate a new session key
  // Format: agent:<agentId>:<label or timestamp>
  const agentId = 'main'; // Default agent
  const sessionLabel = label && label.trim() ? label.trim().replace(/\s+/g, '-').toLowerCase() : Date.now().toString();
  const sessionKey = `agent:${agentId}:${sessionLabel}`;

  console.log('Generated session key:', sessionKey);

  // Create a temporary session entry in the state
  const newSession = {
    key: sessionKey,
    label: label || `Chat ${sessionLabel}`,
    createdAt: Date.now(),
    messageCount: 0
  };

  // Add to sessions list
  state.sessions.unshift(newSession);
  renderSessionsList();

  // Select the new session
  await selectSession(sessionKey);

  showToast('New chat created! Send a message to start.', 'success');
}

async function loadAllSessions() {
  if (!state.connected) {
    elements.settingsAllSessionsContent.innerHTML = '<div class="empty-state"><h3>Not connected to Gateway</h3><p>Please go to <strong>Config</strong> to set up your connection first</p></div>';
    return;
  }

  if (state.sessions.length === 0) {
    elements.settingsAllSessionsContent.innerHTML = '<div class="empty-state"><h3>No sessions</h3><p>Create a new session to get started</p></div>';
    return;
  }

  elements.settingsAllSessionsContent.innerHTML = '';

  for (const session of state.sessions) {
    const detail = document.createElement('div');
    detail.className = 'session-detail';
    detail.style.cursor = 'pointer';
    detail.title = 'Click to open this chat';

    const title = session.label || session.key;
    const createdAt = session.createdAt ? formatDate(session.createdAt) : 'Unknown';
    const messageCount = session.messageCount || 0;

    detail.innerHTML = `
      <div class="session-detail-header">
        <div>
          <div class="session-detail-title">${escapeHtml(title)}</div>
          <div class="session-detail-key">${escapeHtml(session.key)}</div>
        </div>
        <div class="session-detail-arrow">→</div>
      </div>
      <div class="session-detail-info">
        <span>Created: ${createdAt}</span>
        <span> | </span>
        <span>Messages: ${messageCount}</span>
      </div>
    `;

    // Make the entire card clickable
    detail.addEventListener('click', (e) => {
      console.log('Session card clicked:', session.key);
      selectSession(session.key);
      closeSettingsDialog(); // Close settings dialog after selecting a session
    });

    elements.settingsAllSessionsContent.appendChild(detail);
  }
}

// Chat
async function loadChatHistory() {
  if (!state.currentSessionKey) return;

  try {
    const result = await window.electronAPI.getChatHistory(state.currentSessionKey, 200);

    if (result.success && result.data) {
      state.messages = result.data.messages || [];
      renderMessages();
    }
  } catch (error) {
    console.error('Failed to load chat history:', error);
  }
}

function renderMessages() {
  elements.chatMessages.innerHTML = '';

  if (state.messages.length === 0) {
    elements.chatMessages.innerHTML = '<div class="empty-state"><h3>No messages yet</h3><p>Start a conversation by sending a message</p></div>';
    return;
  }

  state.messages.forEach(msg => {
    const div = document.createElement('div');
    const role = msg.role || 'unknown';

    div.className = `message ${role}`;

    const timestamp = msg.timestamp ? formatDate(msg.timestamp) : '';
    let content = '';

    if (typeof msg.content === 'string') {
      content = escapeHtml(msg.content);
    } else if (Array.isArray(msg.content)) {
      content = msg.content.map(block => {
        if (block.type === 'text') {
          return escapeHtml(block.text || '');
        } else if (block.type === 'image') {
          return '[Image]';
        }
        return '';
      }).join('<br>');
    } else {
      content = JSON.stringify(msg.content);
    }

    div.innerHTML = `
      <div class="message-header">
        <span class="message-role">${role.charAt(0).toUpperCase() + role.slice(1)}</span>
        <span class="message-time">${timestamp}</span>
      </div>
      <div class="message-content">${content}</div>
    `;

    elements.chatMessages.appendChild(div);
  });

  // Scroll to bottom
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function sendMessage() {
  const message = elements.messageInput.value.trim();

  if (!message || !state.currentSessionKey) {
    return;
  }

  elements.messageInput.value = '';
  elements.sendBtn.disabled = true;

  try {
    const result = await window.electronAPI.sendMessage(state.currentSessionKey, message);
    console.log('Send result:', result);

    if (result.success) {
      console.log('Message sent, runId:', result.runId);
    } else {
      console.error('Failed to send message:', result.error);
      showToast(`Failed to send message: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showToast(`Error sending message: ${error.message}`, 'error');
  } finally {
    elements.sendBtn.disabled = false;
  }
}

// Logs
async function loadLogs() {
  const level = elements.settingsLogLevelFilter.value || undefined;
  const limit = parseInt(elements.settingsLogLimit.value) || 500;

  try {
    const logs = await window.electronAPI.getLogs({ level, limit });
    renderLogs(logs);
  } catch (error) {
    console.error('Failed to load logs:', error);
    elements.settingsLogsContent.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderLogs(logs) {
  elements.settingsLogsContent.innerHTML = '';

  if (!logs || logs.length === 0) {
    elements.settingsLogsContent.innerHTML = '<div class="empty-state"><h3>No logs</h3></div>';
    return;
  }

  logs.forEach(log => {
    const div = document.createElement('div');
    div.className = `log-entry ${log.level}`;
    div.textContent = `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`;
    elements.settingsLogsContent.appendChild(div);
  });

  // Scroll to bottom
  elements.settingsLogsContent.scrollTop = elements.settingsLogsContent.scrollHeight;
}

async function clearLogs() {
  if (confirm('Are you sure you want to clear all logs?')) {
    try {
      await window.electronAPI.clearLogs();
      showToast('Logs cleared successfully', 'success');
      await loadLogs();
    } catch (error) {
      showToast(`Failed to clear logs: ${error.message}`, 'error');
    }
  }
}

// Cron Jobs
async function loadCronJobs() {
  if (!state.connected) {
    elements.settingsCronJobsContent.innerHTML = '<div class="empty-state"><h3>Not connected to Gateway</h3><p>Please go to <strong>Config</strong> to set up your connection first</p></div>';
    return;
  }

  showLoading('Loading scheduled tasks...');

  try {
    const result = await window.electronAPI.listCronJobs({
      includeDisabled: true,
      limit: 100
    });

    if (result.success && result.data) {
      state.cronJobs = result.data.jobs || [];
      console.log('Loaded cron jobs:', state.cronJobs.length);
      renderCronJobsList();
    } else {
      console.error('Failed to load cron jobs:', result.error);
      showToast(`Failed to load cron jobs: ${result.error}`, 'error');
      elements.cronJobsContent.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(result.error)}</p></div>`;
    }
  } catch (error) {
    console.error('Failed to load cron jobs:', error);
    showToast(`Error loading cron jobs: ${error.message}`, 'error');
    elements.settingsCronJobsContent.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(error.message)}</p></div>`;
  } finally {
    hideLoading();
  }
}

function renderCronJobsList() {
  elements.settingsCronJobsContent.innerHTML = '';

  if (state.cronJobs.length === 0) {
    elements.settingsCronJobsContent.innerHTML = `
      <div class="empty-state">
        <h3>No scheduled tasks</h3>
        <p>Click the <strong>+ Add Task</strong> button to create your first scheduled task</p>
      </div>
    `;
    return;
  }

  // Create table for cron jobs
  const table = document.createElement('div');
  table.className = 'cron-jobs-table';

  // Table header
  const header = document.createElement('div');
  header.className = 'cron-jobs-header';
  header.innerHTML = `
    <div class="cron-job-name">Name</div>
    <div class="cron-job-schedule">Schedule</div>
    <div class="cron-job-status">Status</div>
    <div class="cron-job-actions">Actions</div>
  `;
  table.appendChild(header);

  // Table rows
  state.cronJobs.forEach(job => {
    const row = document.createElement('div');
    row.className = 'cron-job-row';

    const scheduleText = formatSchedule(job.schedule);
    const statusClass = job.enabled ? 'enabled' : 'disabled';
    const statusText = job.enabled ? 'Enabled' : 'Disabled';

    row.innerHTML = `
      <div class="cron-job-name">
        <div class="cron-job-title">${escapeHtml(job.name)}</div>
        ${job.description ? `<div class="cron-job-description">${escapeHtml(job.description)}</div>` : ''}
      </div>
      <div class="cron-job-schedule">${escapeHtml(scheduleText)}</div>
      <div class="cron-job-status">
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
      <div class="cron-job-actions">
        <button class="btn btn-small btn-secondary cron-run-btn" data-id="${escapeHtml(job.id)}" title="Run now">▶</button>
        <button class="btn btn-small btn-secondary cron-edit-btn" data-id="${escapeHtml(job.id)}" title="Edit">✏️</button>
        <button class="btn btn-small btn-secondary cron-delete-btn" data-id="${escapeHtml(job.id)}" title="Delete">🗑</button>
      </div>
    `;

    table.appendChild(row);
  });

  elements.settingsCronJobsContent.appendChild(table);

  // Add event listeners for action buttons
  table.querySelectorAll('.cron-run-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const jobId = e.target.dataset.id;
      await runCronJob(jobId);
    });
  });

  table.querySelectorAll('.cron-edit-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const jobId = e.target.dataset.id;
      await editCronJob(jobId);
    });
  });

  table.querySelectorAll('.cron-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const jobId = e.target.dataset.id;
      await deleteCronJob(jobId);
    });
  });
}

function formatSchedule(schedule) {
  if (!schedule) return 'Unknown';

  switch (schedule.kind) {
    case 'at':
      if (schedule.at) {
        // Check if it's a duration or absolute time
        if (/^\d+[smhd]$/.test(schedule.at)) {
          return `At: ${schedule.at}`;
        }
        try {
          const date = new Date(schedule.at);
          if (!isNaN(date.getTime())) {
            return `At: ${date.toLocaleString()}`;
          }
        } catch (e) {
          // fall through
        }
      }
      return `At: ${schedule.at || 'Unknown'}`;
    case 'every':
      if (schedule.everyMs) {
        const ms = schedule.everyMs;
        if (ms < 60000) return `Every ${ms / 1000}s`;
        if (ms < 3600000) return `Every ${Math.round(ms / 60000)}m`;
        if (ms < 86400000) return `Every ${Math.round(ms / 3600000)}h`;
        return `Every ${Math.round(ms / 86400000)}d`;
      }
      return 'Every: Unknown interval';
    case 'cron':
      let text = schedule.expr || 'Unknown';
      if (schedule.tz) {
        text += ` (${schedule.tz})`;
      }
      return text;
    default:
      return 'Unknown schedule type';
  }
}

async function runCronJob(jobId) {
  if (!confirm('Run this scheduled task now?')) {
    return;
  }

  showLoading('Running task...');

  try {
    const result = await window.electronAPI.runCronJob(jobId, 'force');

    if (result.success) {
      showToast('Task started successfully!', 'success');
    } else {
      showToast(`Failed to run task: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Failed to run cron job:', error);
    showToast(`Error running task: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteCronJob(jobId) {
  if (!confirm('Delete this scheduled task? This action cannot be undone.')) {
    return;
  }

  showLoading('Deleting task...');

  try {
    const result = await window.electronAPI.removeCronJob(jobId);

    if (result.success) {
      showToast('Task deleted successfully!', 'success');
      await loadCronJobs(); // Reload the list
    } else {
      showToast(`Failed to delete task: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Failed to delete cron job:', error);
    showToast(`Error deleting task: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function showAddCronJobDialog(existingJob = null) {
  const isEdit = !!existingJob;
  const title = isEdit ? 'Edit Scheduled Task' : 'Add Scheduled Task';
  const buttonText = isEdit ? 'Update Task' : 'Add Task';

  // Load agents list
  let agents = [];
  try {
    const result = await window.electronAPI.listAgents();
    if (result.success && result.data && result.data.agents) {
      agents = result.data.agents;
    }
  } catch (error) {
    console.error('Failed to load agents:', error);
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'prompt-overlay cron-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'cron-dialog';

    // Build agents options
    const agentsOptions = agents.map(agent =>
      `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.label || agent.id)} (${escapeHtml(agent.id)})</option>`
    ).join('');

    // Pre-fill values if editing
    const defaultName = existingJob?.name || '';
    const defaultDescription = existingJob?.description || '';
    const defaultEnabled = existingJob?.enabled !== undefined ? existingJob.enabled : true;
    const defaultAgentId = existingJob?.agentId || 'main';
    const defaultSessionKey = existingJob?.sessionKey || '';
    const defaultSessionTarget = existingJob?.sessionTarget || 'main';
    const defaultWakeMode = existingJob?.wakeMode || 'next-heartbeat';
    const defaultPayloadKind = existingJob?.payload?.kind || 'agentTurn';
    const defaultMessage = existingJob?.payload?.message || existingJob?.payload?.text || '';
    const defaultModel = existingJob?.payload?.model || '';
    const defaultThinking = existingJob?.payload?.thinking || '';
    const defaultTimeout = existingJob?.payload?.timeoutSeconds?.toString() || '';
    const defaultFallbacks = existingJob?.payload?.fallbacks?.join(', ') || '';
    const defaultLightContext = existingJob?.payload?.lightContext || false;
    const defaultDeliver = existingJob?.payload?.deliver || false;
    const defaultChannel = existingJob?.payload?.channel || '';
    const defaultTo = existingJob?.payload?.to || '';
    const defaultBestEffort = existingJob?.payload?.bestEffortDeliver || false;
    const defaultAccountId = existingJob?.payload?.accountId || '';
    const defaultDeleteAfterRun = existingJob?.deleteAfterRun || false;
    const defaultClearAgent = false;

    // Delivery defaults
    const defaultDeliveryMode = existingJob?.delivery?.mode || 'none';
    const defaultDeliveryChannel = existingJob?.delivery?.channel || 'last';
    const defaultDeliveryTo = existingJob?.delivery?.to || '';
    const defaultDeliveryAccountId = existingJob?.delivery?.accountId || '';
    const defaultDeliveryBestEffort = existingJob?.delivery?.bestEffort || false;

    // Failure alert defaults
    const defaultFailureAlertMode = existingJob?.failureAlert === false ? 'disabled' :
                                     (existingJob?.failureAlert?.after !== undefined ||
                                      existingJob?.failureAlert?.channel !== undefined ||
                                      existingJob?.failureAlert?.to !== undefined) ? 'custom' : 'inherit';
    const defaultFailureAlertAfter = existingJob?.failureAlert?.after?.toString() || '';
    const defaultFailureAlertCooldown = existingJob?.failureAlert?.cooldownMs ? Math.floor(existingJob.failureAlert.cooldownMs / 1000).toString() : '';
    const defaultFailureAlertChannel = existingJob?.failureAlert?.channel || 'last';
    const defaultFailureAlertTo = existingJob?.failureAlert?.to || '';
    const defaultFailureAlertDeliveryMode = existingJob?.failureAlert?.mode || 'announce';
    const defaultFailureAlertAccountId = existingJob?.failureAlert?.accountId || '';

    // Schedule defaults
    let defaultScheduleKind = 'every';
    let defaultEveryAmount = '1';
    let defaultEveryUnit = 'hours';
    let defaultAt = '';
    let defaultCronExpr = '';
    let defaultCronTz = '';
    let defaultScheduleExact = false;
    let defaultStaggerAmount = '';
    let defaultStaggerUnit = 'minutes';

    if (existingJob?.schedule) {
      const schedule = existingJob.schedule;
      if (schedule.kind === 'every') {
        defaultScheduleKind = 'every';
        // Convert milliseconds to amount + unit
        const ms = schedule.everyMs || 0;
        if (ms % 86400000 === 0) {
          defaultEveryAmount = (ms / 86400000).toString();
          defaultEveryUnit = 'days';
        } else if (ms % 3600000 === 0) {
          defaultEveryAmount = (ms / 3600000).toString();
          defaultEveryUnit = 'hours';
        } else {
          defaultEveryAmount = (ms / 60000).toString();
          defaultEveryUnit = 'minutes';
        }
      } else if (schedule.kind === 'at') {
        defaultScheduleKind = 'at';
        defaultAt = schedule.at || '';
      } else if (schedule.kind === 'cron') {
        defaultScheduleKind = 'cron';
        defaultCronExpr = schedule.expr || '';
        defaultCronTz = schedule.tz || '';
        defaultStaggerAmount = schedule.staggerMs ? (schedule.staggerMs / 1000).toString() : '';
      }
    }

    dialog.innerHTML = `
      <div class="cron-dialog-header">
        <h3>${title}</h3>
        <button class="cron-dialog-close">&times;</button>
      </div>
      <div class="cron-dialog-body">
        <!-- Basic Settings -->
        <div class="form-section">
          <h4>Basic Settings</h4>
          <div class="form-group">
            <label for="cron-name">Name *</label>
            <input type="text" id="cron-name" class="form-input" placeholder="My scheduled task" value="${escapeHtml(defaultName)}" required>
          </div>
          <div class="form-group">
            <label for="cron-description">Description</label>
            <input type="text" id="cron-description" class="form-input" placeholder="Optional description" value="${escapeHtml(defaultDescription)}">
          </div>
          <div class="form-group">
            <label for="cron-agent">Agent *</label>
            <select id="cron-agent" class="form-select" ${defaultClearAgent ? 'disabled' : ''}>
              ${agentsOptions || '<option value="main">main (default)</option>'}
            </select>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="cron-enabled" ${defaultEnabled ? 'checked' : ''}>
              Enabled
            </label>
          </div>
        </div>

        <!-- Schedule -->
        <div class="form-section">
          <h4>Schedule</h4>
          <div class="form-group">
            <label for="cron-schedule-kind">Schedule Type *</label>
            <select id="cron-schedule-kind" class="form-select">
              <option value="every" ${defaultScheduleKind === 'every' ? 'selected' : ''}>Every (interval)</option>
              <option value="at" ${defaultScheduleKind === 'at' ? 'selected' : ''}>At (specific time)</option>
              <option value="cron" ${defaultScheduleKind === 'cron' ? 'selected' : ''}>Cron Expression</option>
            </select>
          </div>

          <!-- Every schedule -->
          <div class="form-group schedule-type-group" data-type="every" ${defaultScheduleKind !== 'every' ? 'style="display:none"' : ''}>
            <label>Run every *</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="number" id="cron-every-amount" class="form-input" value="${defaultEveryAmount}" min="1" style="flex: 1;">
              <select id="cron-every-unit" class="form-select" style="flex: 1;">
                <option value="minutes" ${defaultEveryUnit === 'minutes' ? 'selected' : ''}>Minutes</option>
                <option value="hours" ${defaultEveryUnit === 'hours' ? 'selected' : ''}>Hours</option>
                <option value="days" ${defaultEveryUnit === 'days' ? 'selected' : ''}>Days</option>
              </select>
            </div>
          </div>

          <!-- At schedule -->
          <div class="form-group schedule-type-group" data-type="at" ${defaultScheduleKind !== 'at' ? 'style="display:none"' : ''}>
            <label for="cron-at">Run at *</label>
            <input type="text" id="cron-at" class="form-input" placeholder="20m or 2025-03-12T10:00:00Z" value="${escapeHtml(defaultAt)}">
            <small>Examples: 20m, 1h, 2d or ISO time string</small>
          </div>

          <!-- Cron schedule -->
          <div class="form-group schedule-type-group" data-type="cron" ${defaultScheduleKind !== 'cron' ? 'style="display:none"' : ''}>
            <label for="cron-expr">Cron Expression *</label>
            <input type="text" id="cron-expr" class="form-input" placeholder="0 * * * *" value="${escapeHtml(defaultCronExpr)}">
            <small>Format: minute hour day month weekday</small>
          </div>
          <div class="form-group schedule-type-group" data-type="cron" ${defaultScheduleKind !== 'cron' ? 'style="display:none"' : ''}>
            <label for="cron-tz">Timezone (optional)</label>
            <input type="text" id="cron-tz" class="form-input" placeholder="UTC" value="${escapeHtml(defaultCronTz)}">
            <small>Examples: UTC, America/New_York, Europe/London</small>
          </div>
          <div class="form-group schedule-type-group" data-type="cron" ${defaultScheduleKind !== 'cron' ? 'style="display:none"' : ''}>
            <label>
              <input type="checkbox" id="cron-schedule-exact" ${defaultScheduleExact ? 'checked' : ''}>
              Exact timing (disable stagger)
            </label>
          </div>
          <div class="form-group schedule-type-group" data-type="cron" ${defaultScheduleKind !== 'cron' ? 'style="display:none"' : ''}>
            <label for="cron-stagger-amount">Stagger window (optional)</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="number" id="cron-stagger-amount" class="form-input" value="${defaultStaggerAmount}" min="0" placeholder="30" style="flex: 1;" ${defaultScheduleExact ? 'disabled' : ''}>
              <select id="cron-stagger-unit" class="form-select" style="flex: 1;" ${defaultScheduleExact ? 'disabled' : ''}>
                <option value="seconds" ${defaultStaggerUnit === 'seconds' ? 'selected' : ''}>Seconds</option>
                <option value="minutes" ${defaultStaggerUnit === 'minutes' ? 'selected' : ''}>Minutes</option>
              </select>
            </div>
            <small>Randomize execution within this window to avoid thundering herd</small>
          </div>
        </div>

        <!-- Execution Settings -->
        <div class="form-section">
          <h4>Execution Settings</h4>
          <div class="form-group">
            <label for="cron-session-target">Session Target</label>
            <select id="cron-session-target" class="form-select">
              <option value="main" ${defaultSessionTarget === 'main' ? 'selected' : ''}>Main</option>
              <option value="isolated" ${defaultSessionTarget === 'isolated' ? 'selected' : ''}>Isolated</option>
            </select>
            <small>Main: reuse main session; Isolated: create separate session</small>
          </div>
          <div class="form-group">
            <label for="cron-session-key">Session Key (optional)</label>
            <input type="text" id="cron-session-key" class="form-input" placeholder="agent:main:my-session" value="${escapeHtml(defaultSessionKey)}">
            <small>Optional routing key for job delivery and wake routing</small>
          </div>
          <div class="form-group">
            <label for="cron-wake-mode">Wake Mode</label>
            <select id="cron-wake-mode" class="form-select">
              <option value="next-heartbeat" ${defaultWakeMode === 'next-heartbeat' ? 'selected' : ''}>Next Heartbeat</option>
              <option value="now" ${defaultWakeMode === 'now' ? 'selected' : ''}>Now</option>
            </select>
          </div>
          <div class="form-group">
            <label for="cron-payload-kind">Payload Type</label>
            <select id="cron-payload-kind" class="form-select">
              <option value="agentTurn" ${defaultPayloadKind === 'agentTurn' ? 'selected' : ''}>Agent Turn</option>
              <option value="systemEvent" ${defaultPayloadKind === 'systemEvent' ? 'selected' : ''}>System Event</option>
            </select>
          </div>
          <div class="form-group">
            <label for="cron-message">${defaultPayloadKind === 'systemEvent' ? 'Timeline Message' : 'Task Message'} *</label>
            <textarea id="cron-message" class="form-textarea" rows="3" placeholder="${defaultPayloadKind === 'systemEvent' ? 'System event message' : 'Task message for the agent'}" required>${escapeHtml(defaultMessage)}</textarea>
          </div>
          <div class="form-group payload-agent-turn-group" ${defaultPayloadKind !== 'agentTurn' ? 'style="display:none"' : ''}>
            <label for="cron-timeout">Timeout (seconds, optional)</label>
            <input type="number" id="cron-timeout" class="form-input" placeholder="300" value="${defaultTimeout}" min="1">
          </div>
          <div class="form-group payload-agent-turn-group" ${defaultPayloadKind !== 'agentTurn' ? 'style="display:none"' : ''}>
            <label for="cron-model">Model Override (optional)</label>
            <input type="text" id="cron-model" class="form-input" placeholder="provider/model" value="${escapeHtml(defaultModel)}">
            <small>Example: openai/gpt-4, claude/claude-3-5-sonnet</small>
          </div>
          <div class="form-group payload-agent-turn-group" ${defaultPayloadKind !== 'agentTurn' ? 'style="display:none"' : ''}>
            <label for="cron-thinking">Thinking Mode (optional)</label>
            <input type="text" id="cron-thinking" class="form-input" placeholder="low, medium, high" value="${escapeHtml(defaultThinking)}">
          </div>
          <div class="form-group payload-agent-turn-group" ${defaultPayloadKind !== 'agentTurn' ? 'style="display:none"' : ''}>
            <label for="cron-fallbacks">Fallback Models (optional, comma-separated)</label>
            <input type="text" id="cron-fallbacks" class="form-input" placeholder="openai/gpt-4, claude/claude-3-5-sonnet" value="${escapeHtml(defaultFallbacks)}">
          </div>
          <div class="form-group payload-agent-turn-group" ${defaultPayloadKind !== 'agentTurn' ? 'style="display:none"' : ''}>
            <label>
              <input type="checkbox" id="cron-light-context" ${defaultLightContext ? 'checked' : ''}>
              Light context
            </label>
            <small>Use lightweight bootstrap context for this agent job</small>
          </div>
        </div>

        <!-- Delivery Settings -->
        <div class="form-section">
          <h4>Delivery Settings</h4>
          <div class="form-group">
            <label for="cron-delivery-mode">Result Delivery</label>
            <select id="cron-delivery-mode" class="form-select">
              <option value="announce" ${defaultDeliveryMode === 'announce' ? 'selected' : ''}>Announce (default channel)</option>
              <option value="webhook" ${defaultDeliveryMode === 'webhook' ? 'selected' : ''}>Webhook (HTTP POST)</option>
              <option value="none" ${defaultDeliveryMode === 'none' ? 'selected' : ''}>None (internal only)</option>
            </select>
          </div>
          <div class="form-group delivery-channel-group" ${defaultDeliveryMode === 'none' ? 'style="display:none"' : ''}>
            <label for="cron-delivery-channel">${defaultDeliveryMode === 'webhook' ? 'Webhook URL' : 'Channel'}</label>
            ${defaultDeliveryMode === 'webhook'
              ? `<input type="text" id="cron-delivery-channel" class="form-input" placeholder="https://..." value="${escapeHtml(defaultDeliveryChannel)}">`
              : `<select id="cron-delivery-channel" class="form-select">
                  <option value="last" ${defaultDeliveryChannel === 'last' ? 'selected' : ''}>Last used channel</option>
                  <option value="telegram" ${defaultDeliveryChannel === 'telegram' ? 'selected' : ''}>Telegram</option>
                  <option value="discord" ${defaultDeliveryChannel === 'discord' ? 'selected' : ''}>Discord</option>
                </select>`
            }
          </div>
          <div class="form-group delivery-to-group" ${defaultDeliveryMode !== 'announce' ? 'style="display:none"' : ''}>
            <label for="cron-delivery-to">To (optional)</label>
            <input type="text" id="cron-delivery-to" class="form-input" placeholder="@username or #channel" value="${escapeHtml(defaultDeliveryTo)}">
            <small>Recipient for announcement</small>
          </div>
          <div class="form-group delivery-account-group" ${defaultDeliveryMode !== 'announce' ? 'style="display:none"' : ''}>
            <label for="cron-delivery-account-id">Account ID (optional)</label>
            <input type="text" id="cron-delivery-account-id" class="form-input" placeholder="default" value="${escapeHtml(defaultDeliveryAccountId)}">
            <small>For multi-account channel setups</small>
          </div>
          <div class="form-group" ${defaultDeliveryMode === 'none' ? 'style="display:none"' : ''}>
            <label>
              <input type="checkbox" id="cron-best-effort" ${defaultDeliveryBestEffort ? 'checked' : ''}>
              Best effort delivery
            </label>
          </div>
        </div>

        <!-- Failure Alert Settings -->
        <div class="form-section">
          <h4>Failure Alerts</h4>
          <div class="form-group">
            <label for="cron-failure-alert-mode">Failure Alert Mode</label>
            <select id="cron-failure-alert-mode" class="form-select">
              <option value="inherit" ${defaultFailureAlertMode === 'inherit' ? 'selected' : ''}>Inherit global setting</option>
              <option value="disabled" ${defaultFailureAlertMode === 'disabled' ? 'selected' : ''}>Disable for this job</option>
              <option value="custom" ${defaultFailureAlertMode === 'custom' ? 'selected' : ''}>Custom per-job settings</option>
            </select>
          </div>
          <div class="failure-alert-custom-group" ${defaultFailureAlertMode !== 'custom' ? 'style="display:none"' : ''}>
            <div class="form-group">
              <label for="cron-failure-alert-after">Alert After (consecutive errors)</label>
              <input type="number" id="cron-failure-alert-after" class="form-input" placeholder="2" value="${defaultFailureAlertAfter}" min="1">
              <small>Number of consecutive errors before alerting</small>
            </div>
            <div class="form-group">
              <label for="cron-failure-alert-cooldown">Cooldown (seconds)</label>
              <input type="number" id="cron-failure-alert-cooldown" class="form-input" placeholder="3600" value="${defaultFailureAlertCooldown}" min="1">
              <small>Minimum seconds between alerts</small>
            </div>
            <div class="form-group">
              <label for="cron-failure-alert-channel">Alert Channel</label>
              <select id="cron-failure-alert-channel" class="form-select">
                <option value="last" ${defaultFailureAlertChannel === 'last' ? 'selected' : ''}>Last used channel</option>
                <option value="telegram" ${defaultFailureAlertChannel === 'telegram' ? 'selected' : ''}>Telegram</option>
                <option value="discord" ${defaultFailureAlertChannel === 'discord' ? 'selected' : ''}>Discord</option>
              </select>
            </div>
            <div class="form-group">
              <label for="cron-failure-alert-to">Alert To (optional)</label>
              <input type="text" id="cron-failure-alert-to" class="form-input" placeholder="+1555... or chat id" value="${escapeHtml(defaultFailureAlertTo)}">
            </div>
            <div class="form-group">
              <label for="cron-failure-alert-delivery-mode">Alert Mode</label>
              <select id="cron-failure-alert-delivery-mode" class="form-select">
                <option value="announce" ${defaultFailureAlertDeliveryMode === 'announce' ? 'selected' : ''}>Announce (via channel)</option>
                <option value="webhook" ${defaultFailureAlertDeliveryMode === 'webhook' ? 'selected' : ''}>Webhook (HTTP POST)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="cron-failure-alert-account-id">Alert Account ID (optional)</label>
              <input type="text" id="cron-failure-alert-account-id" class="form-input" placeholder="default" value="${escapeHtml(defaultFailureAlertAccountId)}">
            </div>
          </div>
        </div>

        <!-- Other Settings -->
        <div class="form-section">
          <h4>Other Settings</h4>
          <div class="form-group">
            <label>
              <input type="checkbox" id="cron-delete-after-run" ${defaultDeleteAfterRun ? 'checked' : ''}>
              Delete after run
            </label>
            <small>Automatically delete this task after it runs once</small>
          </div>
        </div>
      </div>
      <div class="cron-dialog-footer">
        <button class="btn btn-secondary cron-cancel">Cancel</button>
        <button class="btn btn-primary cron-ok">${buttonText}</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const closeBtn = dialog.querySelector('.cron-dialog-close');
    const cancelBtn = dialog.querySelector('.cron-cancel');
    const okBtn = dialog.querySelector('.cron-ok');

    const scheduleKindSelect = dialog.querySelector('#cron-schedule-kind');
    const scheduleTypeGroups = dialog.querySelectorAll('.schedule-type-group');
    const agentIdSelect = dialog.querySelector('#cron-agent');
    const payloadKindSelect = dialog.querySelector('#cron-payload-kind');
    const payloadAgentTurnGroups = dialog.querySelectorAll('.payload-agent-turn-group');
    const deliveryModeSelect = dialog.querySelector('#cron-delivery-mode');
    const deliveryChannelGroup = dialog.querySelector('.delivery-channel-group');
    const deliveryToGroup = dialog.querySelector('.delivery-to-group');
    const deliveryAccountGroup = dialog.querySelector('.delivery-account-group');
    const failureAlertModeSelect = dialog.querySelector('#cron-failure-alert-mode');
    const failureAlertCustomGroup = dialog.querySelector('.failure-alert-custom-group');
    const scheduleExactCheckbox = dialog.querySelector('#cron-schedule-exact');
    const staggerAmountInput = dialog.querySelector('#cron-stagger-amount');
    const staggerUnitSelect = dialog.querySelector('#cron-stagger-unit');

    // Helper function to validate and fix payload kind based on agent
    const validatePayloadKind = () => {
      if (agentIdSelect.value === 'main' && payloadKindSelect.value === 'agentTurn') {
        showToast('Note: "main" agent requires "System Event" payload type. Auto-switching...', 'info');
        payloadKindSelect.value = 'systemEvent';
        payloadKindSelect.dispatchEvent(new Event('change'));
      }
    };

    // Handle agent change to validate payload kind
    agentIdSelect.addEventListener('change', validatePayloadKind);

    // Only validate on initial load when editing (not for new tasks)
    if (isEdit && agentIdSelect.value === 'main' && payloadKindSelect.value === 'agentTurn') {
      setTimeout(validatePayloadKind, 100);
    }

    // Handle schedule type change
    scheduleKindSelect.addEventListener('change', (e) => {
      const kind = e.target.value;
      scheduleTypeGroups.forEach(group => {
        group.style.display = group.dataset.type === kind ? 'block' : 'none';
      });
    });

    // Handle payload kind change
    payloadKindSelect.addEventListener('change', (e) => {
      const kind = e.target.value;
      const isAgentTurn = kind === 'agentTurn';
      payloadAgentTurnGroups.forEach(group => {
        group.style.display = isAgentTurn ? 'block' : 'none';
      });

      const messageLabel = dialog.querySelector('#cron-message').previousElementSibling;
      if (messageLabel) {
        messageLabel.textContent = isAgentTurn ? 'Task Message *' : 'Timeline Message *';
      }
    });

    // Handle delivery mode change
    deliveryModeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      deliveryChannelGroup.style.display = mode === 'none' ? 'none' : 'block';
      deliveryToGroup.style.display = mode === 'announce' ? 'block' : 'none';
      deliveryAccountGroup.style.display = mode === 'announce' ? 'block' : 'none';
    });

    // Handle failure alert mode change
    failureAlertModeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      failureAlertCustomGroup.style.display = mode === 'custom' ? 'block' : 'none';
    });

    // Handle schedule exact checkbox
    scheduleExactCheckbox.addEventListener('change', (e) => {
      const exact = e.target.checked;
      staggerAmountInput.disabled = exact;
      staggerUnitSelect.disabled = exact;
    });

    const closeDialog = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };

    const submitDialog = async () => {
      // Basic fields
      const name = dialog.querySelector('#cron-name').value.trim();
      const description = dialog.querySelector('#cron-description').value.trim();
      const enabled = dialog.querySelector('#cron-enabled').checked;
      let agentId = dialog.querySelector('#cron-agent').value;
      const sessionKey = dialog.querySelector('#cron-session-key').value.trim();
      const sessionTarget = dialog.querySelector('#cron-session-target').value;
      const wakeMode = dialog.querySelector('#cron-wake-mode').value;
      const deleteAfterRun = dialog.querySelector('#cron-delete-after-run').checked;

      // Schedule fields
      const scheduleKind = scheduleKindSelect.value;
      let payloadKind = payloadKindSelect.value;

      // IMPORTANT: If agentId is "main", payload must be "systemEvent"
      if (agentId === 'main' && payloadKind === 'agentTurn') {
        showToast('Note: "main" agent requires "System Event" payload type. Auto-switching...', 'info');
        payloadKind = 'systemEvent';
      }

      let schedule = { kind: scheduleKind };

      if (scheduleKind === 'every') {
        const everyAmount = parseInt(dialog.querySelector('#cron-every-amount').value);
        const everyUnit = dialog.querySelector('#cron-every-unit').value;
        if (!everyAmount || everyAmount < 1) {
          showToast('Please enter a valid interval amount', 'error');
          return;
        }
        // Convert to milliseconds
        const unitToMs = { minutes: 60000, hours: 3600000, days: 86400000 };
        schedule.everyMs = everyAmount * unitToMs[everyUnit];
      } else if (scheduleKind === 'at') {
        const at = dialog.querySelector('#cron-at').value.trim();
        if (!at) {
          showToast('Please enter a time or duration', 'error');
          return;
        }
        schedule.at = at;
      } else if (scheduleKind === 'cron') {
        const expr = dialog.querySelector('#cron-expr').value.trim();
        if (!expr) {
          showToast('Please enter a cron expression', 'error');
          return;
        }
        schedule.expr = expr;
        const tz = dialog.querySelector('#cron-tz').value.trim();
        if (tz) schedule.tz = tz;

        const scheduleExact = dialog.querySelector('#cron-schedule-exact').checked;
        if (!scheduleExact) {
          const staggerAmount = dialog.querySelector('#cron-stagger-amount').value;
          const staggerUnit = dialog.querySelector('#cron-stagger-unit').value;
          if (staggerAmount) {
            const unitToMs = { seconds: 1000, minutes: 60000 };
            schedule.staggerMs = parseInt(staggerAmount) * unitToMs[staggerUnit];
          }
        }
      }

      // Payload fields (payloadKind was already declared above)
      const message = dialog.querySelector('#cron-message').value.trim();
      const timeout = dialog.querySelector('#cron-timeout').value;
      const model = dialog.querySelector('#cron-model').value.trim();
      const thinking = dialog.querySelector('#cron-thinking').value.trim();
      const fallbacks = dialog.querySelector('#cron-fallbacks').value.trim();
      const lightContext = dialog.querySelector('#cron-light-context').checked;

      if (!name) {
        showToast('Please enter a task name', 'error');
        return;
      }
      if (!message) {
        showToast('Please enter a message', 'error');
        return;
      }

      // Build payload object
      let payload;
      if (payloadKind === 'systemEvent') {
        payload = { kind: 'systemEvent', text: message };
      } else {
        payload = { kind: 'agentTurn', message };
        if (model) payload.model = model;
        if (thinking) payload.thinking = thinking;
        if (timeout) payload.timeoutSeconds = parseInt(timeout);
        if (fallbacks) payload.fallbacks = fallbacks.split(',').map(s => s.trim()).filter(s => s);
        if (lightContext) payload.lightContext = true;
      }

      // Delivery fields
      const deliveryMode = deliveryModeSelect.value;
      const deliveryChannel = dialog.querySelector('#cron-delivery-channel')?.value.trim();
      const deliveryTo = dialog.querySelector('#cron-delivery-to')?.value.trim();
      const deliveryAccountId = dialog.querySelector('#cron-delivery-account-id')?.value.trim();
      const deliveryBestEffort = dialog.querySelector('#cron-best-effort')?.checked;

      let delivery;
      if (deliveryMode !== 'none') {
        delivery = { mode: deliveryMode };
        if (deliveryMode === 'announce') {
          if (deliveryChannel) delivery.channel = deliveryChannel;
          if (deliveryTo) delivery.to = deliveryTo;
          if (deliveryAccountId) delivery.accountId = deliveryAccountId;
          if (deliveryBestEffort) delivery.bestEffort = true;
        } else if (deliveryMode === 'webhook') {
          if (deliveryChannel) delivery.to = deliveryChannel; // webhook uses 'to' for URL
        }
      }

      // Failure alert fields
      const failureAlertMode = failureAlertModeSelect.value;
      let failureAlert;
      if (failureAlertMode === 'disabled') {
        failureAlert = false;
      } else if (failureAlertMode === 'custom') {
        const failureAfter = dialog.querySelector('#cron-failure-alert-after').value;
        const failureCooldown = dialog.querySelector('#cron-failure-alert-cooldown').value;
        const failureChannel = dialog.querySelector('#cron-failure-alert-channel').value;
        const failureTo = dialog.querySelector('#cron-failure-alert-to').value.trim();
        const failureDeliveryMode = dialog.querySelector('#cron-failure-alert-delivery-mode').value;
        const failureAccountId = dialog.querySelector('#cron-failure-alert-account-id').value.trim();

        failureAlert = {};
        if (failureAfter) failureAlert.after = parseInt(failureAfter);
        if (failureCooldown) failureAlert.cooldownMs = parseInt(failureCooldown) * 1000;
        if (failureChannel) failureAlert.channel = failureChannel;
        if (failureTo) failureAlert.to = failureTo;
        if (failureDeliveryMode) failureAlert.mode = failureDeliveryMode;
        if (failureAccountId) failureAlert.accountId = failureAccountId;
      }

      // Build job object
      const job = {
        name,
        description: description || undefined,
        enabled,
        schedule,
        agentId,
        sessionKey: sessionKey || undefined,
        sessionTarget,
        wakeMode,
        payload,
        delivery,
        failureAlert,
        deleteAfterRun: deleteAfterRun || undefined,
      };

      // Add ID if editing
      if (isEdit && existingJob?.id) {
        job.id = existingJob.id;
      }

      document.body.removeChild(overlay);
      resolve({ job, isEdit });
    };

    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);
    okBtn.addEventListener('click', submitDialog);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });

    // Focus on name input
    setTimeout(() => dialog.querySelector('#cron-name').focus(), 100);
  });
}

async function addCronJob() {
  if (!state.connected) {
    showToast('Not connected to gateway. Please configure and connect first.', 'error');
    openSettingsDialog('config');
    return;
  }

  const result = await showAddCronJobDialog();

  if (!result) {
    return; // User cancelled
  }

  const { job, isEdit } = result;

  showLoading(isEdit ? 'Updating scheduled task...' : 'Creating scheduled task...');

  try {
    let apiResult;
    if (isEdit) {
      // For update, Gateway expects { jobId, patch } format
      const jobId = job.id;
      const { id, ...patch } = job; // Remove id from job to create patch
      apiResult = await window.electronAPI.updateCronJob(jobId, patch);
    } else {
      apiResult = await window.electronAPI.addCronJob(job);
    }

    if (apiResult.success) {
      showToast(isEdit ? 'Task updated successfully!' : 'Scheduled task created successfully!', 'success');
      await loadCronJobs(); // Reload the list
    } else {
      showToast(`Failed to ${isEdit ? 'update' : 'create'} task: ${apiResult.error}`, 'error');
    }
  } catch (error) {
    console.error('Failed to save cron job:', error);
    showToast(`Error ${isEdit ? 'updating' : 'creating'} task: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function editCronJob(jobId) {
  if (!state.connected) {
    showToast('Not connected to gateway', 'error');
    return;
  }

  // Find the job in our state
  const job = state.cronJobs.find(j => j.id === jobId);
  if (!job) {
    showToast('Job not found', 'error');
    return;
  }

  const result = await showAddCronJobDialog(job);

  if (!result) {
    return; // User cancelled
  }

  const { job: updatedJob } = result;

  showLoading('Updating scheduled task...');

  try {
    // Gateway expects { jobId, patch } format
    const { id, ...patch } = updatedJob; // Remove id from job to create patch
    const apiResult = await window.electronAPI.updateCronJob(jobId, patch);

    if (apiResult.success) {
      showToast('Task updated successfully!', 'success');
      await loadCronJobs(); // Reload the list
    } else {
      showToast(`Failed to update task: ${apiResult.error}`, 'error');
    }
  } catch (error) {
    console.error('Failed to update cron job:', error);
    showToast(`Error updating task: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// Gateway Events
function setupGatewayEventListeners() {
  window.electronAPI.onGatewayConnected(async (hello) => {
    console.log('Gateway connected event received:', hello);
    state.connected = true;
    elements.connectionIndicator.classList.remove('offline');
    elements.connectionIndicator.classList.add('online');
    elements.sessionStatus.textContent = 'Connected';

    // Load sessions after connection
    console.log('Loading sessions after connection event...');
    await loadSessions();
    console.log('Sessions loaded, count:', state.sessions.length);
  });

  window.electronAPI.onGatewayDisconnected((reason) => {
    console.log('Gateway disconnected:', reason);
    state.connected = false;
    state.currentSessionKey = null;
    elements.connectionIndicator.classList.remove('online');
    elements.connectionIndicator.classList.add('offline');
    elements.sessionStatus.textContent = 'Disconnected';
    elements.messageInput.disabled = true;
    elements.sendBtn.disabled = true;
    showToast('Disconnected from gateway', 'warning');
  });

  window.electronAPI.onGatewayEvent((evt) => {
    console.log('Gateway event:', evt);

    // Handle chat events
    if (evt.event === 'chat' && evt.payload) {
      const payload = evt.payload;
      if (payload.sessionKey === state.currentSessionKey) {
        // Reload chat history when we receive a chat event for current session
        loadChatHistory();
      }
    }
  });
}

// Event Listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');

  // Title bar controls
  elements.minimizeBtn.addEventListener('click', async () => {
    try {
      await window.electronAPI.minimizeWindow();
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  });

  elements.maximizeBtn.addEventListener('click', async () => {
    try {
      const isMaximized = await window.electronAPI.isMaximized();
      if (isMaximized) {
        await window.electronAPI.unmaximizeWindow();
        updateMaximizeButton(false);
      } else {
        await window.electronAPI.maximizeWindow();
        updateMaximizeButton(true);
      }
    } catch (error) {
      console.error('Failed to toggle maximize:', error);
    }
  });

  elements.closeBtn.addEventListener('click', async () => {
    try {
      await window.electronAPI.closeWindow();
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  });

  // Settings dialog
  elements.settingsBtn.addEventListener('click', () => openSettingsDialog());
  elements.settingsCloseBtn.addEventListener('click', closeSettingsDialog);

  // Settings navigation
  elements.settingsNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.settingsView;
      switchSettingsView(view);
    });
  });

  // New session
  console.log('Setting up new session button listener...');
  console.log('newSessionBtn element:', elements.newSessionBtn);
  console.log('createNewSession function:', typeof createNewSession);

  if (elements.newSessionBtn) {
    elements.newSessionBtn.addEventListener('click', (e) => {
      console.log('New session button clicked!', e);
      createNewSession();
    });
  } else {
    console.error('ERROR: newSessionBtn element not found!');
  }

  // Send message
  elements.sendBtn.addEventListener('click', sendMessage);

  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      sendMessage();
    }
  });

  elements.messageInput.addEventListener('input', () => {
    const hasContent = elements.messageInput.value.trim();
    const hasSession = !!state.currentSessionKey;
    elements.sendBtn.disabled = !hasContent || !hasSession;
  });

  // Settings - Config
  elements.settingsTestConnectionBtn.addEventListener('click', testConnection);
  elements.settingsSaveConfigBtn.addEventListener('click', saveAndConnect);

  // Settings - Logs
  elements.settingsRefreshLogsBtn.addEventListener('click', loadLogs);
  elements.settingsClearLogsBtn.addEventListener('click', clearLogs);
  elements.settingsLogLevelFilter.addEventListener('change', loadLogs);

  // Settings - Cron
  elements.settingsAddCronBtn.addEventListener('click', addCronJob);

  // Close settings dialog when clicking outside
  elements.settingsDialog.addEventListener('click', (e) => {
    if (e.target === elements.settingsDialog) {
      closeSettingsDialog();
    }
  });

  // Resizer - Sidebar width adjustment
  setupResizer();
}

// Resizer functionality
function setupResizer() {
  const resizer = elements.resizer;
  const sidebar = elements.sidebar;

  if (!resizer || !sidebar) {
    console.error('Resizer or sidebar element not found');
    return;
  }

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  let widthTooltip = null;

  // Load saved sidebar width
  const savedWidth = localStorage.getItem('sidebarWidth');
  if (savedWidth) {
    const width = parseInt(savedWidth);
    if (width >= 200 && width <= 800) {
      sidebar.style.width = width + 'px';
    }
  }

  // Create width tooltip
  function createWidthTooltip() {
    if (widthTooltip) return;
    widthTooltip = document.createElement('div');
    widthTooltip.className = 'width-tooltip';
    document.body.appendChild(widthTooltip);
  }

  function updateWidthTooltip(x, y, width) {
    if (!widthTooltip) return;
    widthTooltip.textContent = `${width}px`;
    widthTooltip.style.left = `${x + 15}px`;
    widthTooltip.style.top = `${y + 15}px`;
  }

  function removeWidthTooltip() {
    if (widthTooltip) {
      widthTooltip.remove();
      widthTooltip = null;
    }
  }

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;

    sidebar.classList.add('resizing');
    resizer.classList.add('resizing');

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    createWidthTooltip();

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const newWidth = startWidth + deltaX;

    // Constrain width between min and max
    const minWidth = 200;
    const maxWidth = 800;
    const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    sidebar.style.width = constrainedWidth + 'px';

    // Update tooltip
    updateWidthTooltip(e.clientX, e.clientY, constrainedWidth);

    e.preventDefault();
  });

  document.addEventListener('mouseup', (e) => {
    if (!isResizing) return;

    isResizing = false;
    sidebar.classList.remove('resizing');
    resizer.classList.remove('resizing');

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    removeWidthTooltip();

    // Save the new width
    const finalWidth = sidebar.offsetWidth;
    localStorage.setItem('sidebarWidth', finalWidth.toString());
  });
}

// Update maximize/restore button
function updateMaximizeButton(isMaximized) {
  const maximizeBtn = elements.maximizeBtn;
  if (!maximizeBtn) return;

  if (isMaximized) {
    maximizeBtn.innerHTML = '<span>❐</span>';
    maximizeBtn.title = '还原';
  } else {
    maximizeBtn.innerHTML = '<span>□</span>';
    maximizeBtn.title = '最大化';
  }
}

// Initialize
async function init() {
  console.log('=== INIT FUNCTION CALLED ===');

  // 修复高DPI模糊问题 - 检测设备像素比
  const dpr = window.devicePixelRatio;
  console.log('Device Pixel Ratio:', dpr);
  console.log('Screen DPI:', window.screen.deviceXDPI || 'unknown');

  // 设置正确的缩放比例
  if (dpr > 1) {
    // 确保使用正确的设备像素比
    document.documentElement.style.setProperty('--device-pixel-ratio', dpr.toString());
  }

  // Initialize DOM elements first
  initializeElements();

  console.log('Current state:', state);

  setupEventListeners();
  setupGatewayEventListeners();

  // Load saved config
  try {
    const savedConfig = await window.electronAPI.getConfig();
    if (savedConfig && savedConfig.gateway) {
      state.config = {
        url: savedConfig.gateway.url || 'ws://localhost:18789',
        token: savedConfig.gateway.token || '',
        password: savedConfig.gateway.password || ''
      };
      console.log('Loaded config:', state.config);
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }

  // Try to auto-connect if config exists
  if (state.config.url) {
    console.log('Attempting auto-connect...');
    await connectToGateway(state.config);
  }
}

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
