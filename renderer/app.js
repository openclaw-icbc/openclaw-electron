// App State
const state = {
  connected: false,
  currentSessionKey: null,
  currentView: 'chat',
  sessions: [],
  messages: [],
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
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    sidebarViews: document.querySelectorAll('.sidebar-view'),
    contentViews: document.querySelectorAll('.content-view'),

    // Connection
    connectionIndicator: document.getElementById('connection-indicator'),

    // Chat
    newSessionBtn: document.getElementById('new-session-btn'),
    sessionsList: document.getElementById('sessions-list'),
    allSessionsList: document.getElementById('all-sessions-list'),
    currentSessionTitle: document.getElementById('current-session-title'),
    sessionStatus: document.getElementById('session-status'),
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),

    // Config
    configGatewayUrl: document.getElementById('config-gateway-url'),
    configGatewayToken: document.getElementById('config-gateway-token'),
    configGatewayPassword: document.getElementById('config-gateway-password'),
    testConnectionBtn: document.getElementById('test-connection-btn'),
    saveConfigBtn: document.getElementById('save-config-btn'),
    configStatus: document.getElementById('config-status'),

    // Logs
    logLevelFilter: document.getElementById('log-level-filter'),
    logLimit: document.getElementById('log-limit'),
    refreshLogsBtn: document.getElementById('refresh-logs-btn'),
    clearLogsBtn: document.getElementById('clear-logs-btn'),
    logsContent: document.getElementById('logs-content'),

    // Sessions view
    allSessionsContent: document.getElementById('all-sessions-content'),

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

// Navigation
function switchView(viewName) {
  state.currentView = viewName;

  // Update nav items
  elements.navItems.forEach(item => {
    if (item.dataset.view === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update sidebar views
  elements.sidebarViews.forEach(view => {
    view.classList.add('hidden');
  });
  const chatSidebar = document.getElementById('chat-sidebar');
  const sessionsSidebar = document.getElementById('sessions-sidebar');
  if (viewName === 'chat') {
    chatSidebar.classList.remove('hidden');
  } else if (viewName === 'sessions') {
    sessionsSidebar.classList.remove('hidden');
  }

  // Update content views
  elements.contentViews.forEach(view => {
    view.classList.add('hidden');
  });
  const contentView = document.getElementById(`${viewName}-view`);
  if (contentView) {
    contentView.classList.remove('hidden');
  }

  // Load view-specific content
  if (viewName === 'logs') {
    loadLogs();
  } else if (viewName === 'sessions') {
    loadAllSessions();
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
    url: elements.configGatewayUrl.value.trim(),
    token: elements.configGatewayToken.value.trim(),
    password: elements.configGatewayPassword.value.trim()
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
  elements.configStatus.textContent = message;
  elements.configStatus.className = `status ${type}`;
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
    url: elements.configGatewayUrl.value.trim(),
    token: elements.configGatewayToken.value.trim(),
    password: elements.configGatewayPassword.value.trim()
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
      // Already connected with same config, just save and switch to chat
      await saveConfig();
      switchView('chat');
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
  const success = await connectToGateway(config);
  if (success) {
    switchView('chat');
  }
}

function loadConfig() {
  elements.configGatewayUrl.value = state.config.url || 'ws://localhost:18789';
  elements.configGatewayToken.value = state.config.token || '';
  elements.configGatewayPassword.value = state.config.password || '';
  elements.configStatus.textContent = '';
  elements.configStatus.className = 'status';
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
  elements.allSessionsList.innerHTML = '';

  if (state.sessions.length === 0) {
    const emptyHtml = '<div class="empty-state"><h3>No sessions</h3><p>Create a new session to get started</p></div>';
    elements.sessionsList.innerHTML = emptyHtml;
    elements.allSessionsList.innerHTML = emptyHtml;
    return;
  }

  state.sessions.forEach(session => {
    const item = createSessionItem(session);
    elements.sessionsList.appendChild(item.cloneNode(true));
    elements.allSessionsList.appendChild(item);
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

  // Switch to chat view
  if (state.currentView !== 'chat') {
    switchView('chat');
  }
}

async function createNewSession() {
  console.log('=== createNewSession called ===');
  console.log('state.connected:', state.connected);

  if (!state.connected) {
    console.log('Not connected, showing error');
    showToast('Not connected to gateway. Please configure and connect first.', 'error');
    switchView('config');
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
    elements.allSessionsContent.innerHTML = '<div class="empty-state"><h3>Not connected to Gateway</h3><p>Please go to <strong>Config</strong> to set up your connection first</p></div>';
    return;
  }

  if (state.sessions.length === 0) {
    elements.allSessionsContent.innerHTML = '<div class="empty-state"><h3>No sessions</h3><p>Create a new session to get started</p></div>';
    return;
  }

  elements.allSessionsContent.innerHTML = '';

  for (const session of state.sessions) {
    const detail = document.createElement('div');
    detail.className = 'session-detail';

    const title = session.label || session.key;
    const createdAt = session.createdAt ? formatDate(session.createdAt) : 'Unknown';
    const messageCount = session.messageCount || 0;

    detail.innerHTML = `
      <div class="session-detail-header">
        <div>
          <div class="session-detail-title">${escapeHtml(title)}</div>
          <div class="session-detail-key">${escapeHtml(session.key)}</div>
        </div>
        <button class="btn btn-small btn-primary" data-session-key="${session.key}">Open Chat</button>
      </div>
      <div class="session-detail-info">
        <span>Created: ${createdAt}</span>
        <span> | </span>
        <span>Messages: ${messageCount}</span>
      </div>
    `;

    const openBtn = detail.querySelector('[data-session-key]');
    openBtn.addEventListener('click', () => selectSession(session.key));

    elements.allSessionsContent.appendChild(detail);
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
  const level = elements.logLevelFilter.value || undefined;
  const limit = parseInt(elements.logLimit.value) || 500;

  try {
    const logs = await window.electronAPI.getLogs({ level, limit });
    renderLogs(logs);
  } catch (error) {
    console.error('Failed to load logs:', error);
    elements.logsContent.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderLogs(logs) {
  elements.logsContent.innerHTML = '';

  if (!logs || logs.length === 0) {
    elements.logsContent.innerHTML = '<div class="empty-state"><h3>No logs</h3></div>';
    return;
  }

  logs.forEach(log => {
    const div = document.createElement('div');
    div.className = `log-entry ${log.level}`;
    div.textContent = `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`;
    elements.logsContent.appendChild(div);
  });

  // Scroll to bottom
  elements.logsContent.scrollTop = elements.logsContent.scrollHeight;
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

  // Navigation
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
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

  // Config
  elements.testConnectionBtn.addEventListener('click', testConnection);
  elements.saveConfigBtn.addEventListener('click', saveAndConnect);

  // Logs
  elements.refreshLogsBtn.addEventListener('click', loadLogs);
  elements.clearLogsBtn.addEventListener('click', clearLogs);
  elements.logLevelFilter.addEventListener('change', loadLogs);
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
