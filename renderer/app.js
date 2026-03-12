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
  },
  sessionsExpanded: true,
  thinkingMessageId: null,
  streamingMessageId: null, // Track the message currently being streamed
  streamingTimeout: null // Timeout to clear streaming state
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
    sessionsToggleBtn: document.getElementById('sessions-toggle-btn'),
    sessionsToggleIcon: document.getElementById('sessions-toggle-icon'),
    sessionsCount: document.querySelector('.sessions-count'),
    currentSessionTitle: document.getElementById('current-session-title'),
    sessionStatus: document.getElementById('session-status'),
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),

    // Settings dialog
    settingsBtn: document.getElementById('settings-btn'),
    settingsDialog: document.getElementById('settings-dialog'),
    settingsCloseBtn: document.getElementById('settings-close-btn'),
    settingsNavItems: document.querySelectorAll('.tabs-trigger'),
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
    toastContainer: document.getElementById('toast-container'),

    // Confirm Dialog
    confirmDialogOverlay: document.getElementById('confirm-dialog-overlay'),
    confirmDialogTitle: document.getElementById('confirm-dialog-title'),
    confirmDialogMessage: document.getElementById('confirm-dialog-message'),
    confirmDialogCancelBtn: document.getElementById('confirm-dialog-cancel-btn'),
    confirmDialogConfirmBtn: document.getElementById('confirm-dialog-confirm-btn')
  };

  console.log('Elements initialized:', Object.keys(elements));
}

// Utility Functions
function showLoading(message = '加载中...') {
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

// Update send button state based on input and session
function updateSendButtonState() {
  const hasContent = elements.messageInput.value.trim().length > 0;
  const hasSession = !!state.currentSessionKey;
  elements.sendBtn.disabled = !hasContent || !hasSession;
}

function toggleSessions() {
  state.sessionsExpanded = !state.sessionsExpanded;

  if (state.sessionsExpanded) {
    // Expand
    elements.sessionsList.style.maxHeight = 'none';
    elements.sessionsList.style.overflow = 'auto';
    elements.sessionsList.style.opacity = '1';
    elements.sessionsToggleIcon.style.transform = 'rotate(0deg)';
  } else {
    // Collapse
    elements.sessionsList.style.maxHeight = '0px';
    elements.sessionsList.style.overflow = 'hidden';
    elements.sessionsList.style.opacity = '0';
    elements.sessionsToggleIcon.style.transform = 'rotate(-90deg)';
  }

  // Save state to config
  try {
    window.electronAPI.saveConfig({
      gateway: state.config,
      sessionsExpanded: state.sessionsExpanded
    }).catch(err => console.error('Failed to save sessions state:', err));
  } catch (error) {
    console.error('Failed to save sessions state:', error);
  }
}

// Custom confirm dialog that returns a Promise
function showConfirmDialog(title, message, confirmButtonText = 'Confirm', cancelButtonText = 'Cancel') {
  return new Promise((resolve) => {
    // Set dialog content
    elements.confirmDialogTitle.textContent = title;
    elements.confirmDialogMessage.textContent = message;
    elements.confirmDialogConfirmBtn.textContent = confirmButtonText;
    elements.confirmDialogCancelBtn.textContent = cancelButtonText;

    // Show dialog
    elements.confirmDialogOverlay.classList.remove('hidden');

    // Handle confirm button click
    const handleConfirm = () => {
      elements.confirmDialogOverlay.classList.add('hidden');
      elements.confirmDialogConfirmBtn.removeEventListener('click', handleConfirm);
      elements.confirmDialogCancelBtn.removeEventListener('click', handleCancel);
      resolve(true);
    };

    // Handle cancel button click
    const handleCancel = () => {
      elements.confirmDialogOverlay.classList.add('hidden');
      elements.confirmDialogConfirmBtn.removeEventListener('click', handleConfirm);
      elements.confirmDialogCancelBtn.removeEventListener('click', handleCancel);
      resolve(false);
    };

    // Add event listeners
    elements.confirmDialogConfirmBtn.addEventListener('click', handleConfirm);
    elements.confirmDialogCancelBtn.addEventListener('click', handleCancel);
  });
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
  if (!timestamp) return 'Unknown';

  // Handle different timestamp formats
  let ts = timestamp;

  // If it's a number or numeric string
  if (typeof ts === 'number' || (typeof ts === 'string' && /^\d+$/.test(ts))) {
    ts = Number(ts);
    // If timestamp is in seconds (less than 10 digits), convert to milliseconds
    if (ts < 10000000000) {
      ts = ts * 1000;
    }
  }

  const date = new Date(ts);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Unknown';
  }

  const now = new Date();
  const diff = now - date;

  // Future dates
  if (diff < 0) {
    return date.toLocaleDateString();
  }

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;

  // Check if it's this year
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  return date.toLocaleDateString();
}

// Helper function to extract createdAt from session object
function getSessionCreatedAt(session) {
  if (!session || typeof session !== 'object') return null;

  const possibleFields = [
    'createdAt', 'created_at', 'createTime', 'create_time',
    'timestamp', 'ts', 'date', 'time', 'created'
  ];

  for (const field of possibleFields) {
    if (session[field] != null) {
      return session[field];
    }
  }

  return null;
}

// Helper function to extract messageCount from session object
function getSessionMessageCount(session) {
  if (!session || typeof session !== 'object') return 0;

  const possibleFields = [
    'messageCount', 'message_count', 'count', 'msgCount', 'msg_count',
    'messages', 'totalMessages', 'total_messages', 'msgCnt', 'messageCnt'
  ];

  for (const field of possibleFields) {
    if (session[field] != null) {
      const val = parseInt(session[field], 10);
      if (!isNaN(val)) return val;
    }
  }

  return 0;
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
  showLoading('正在连接网关...');

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
      elements.sessionStatus.textContent = '已连接';
      showToast('连接成功！', 'success');

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
      showToast('已经使用这些设置连接！', 'success');
      showConfigStatus('✅ 已连接！您可以开始聊天。', 'success');
      return;
    }

    // Config changed, need to reconnect
    const confirmReconnect = confirm('Configuration changed. Reconnect with new settings?');
    if (!confirmReconnect) {
      return;
    }
  }

  showLoading('正在测试连接...');

  try {
    // Test connection by actually connecting
    const result = await window.electronAPI.connectGateway(config);
    if (result.success) {
      state.config = config; // Update config
      showToast('连接测试成功！您现在已经连接。', 'success');
      showConfigStatus('✅ 已连接！对话列表已加载。您现在可以创建对话并开始聊天。', 'success');

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
    url: elements.settingsConfigGatewayUrl.value.trim(),
    token: elements.settingsConfigGatewayToken.value.trim(),
    password: elements.settingsConfigGatewayPassword.value.trim()
  };

  if (!config.url) {
    showToast('Please enter a Gateway URL', 'error');
    return;
  }

  // Save config
  try {
    await window.electronAPI.saveConfig({ gateway: config });
    state.config = config;
    showToast('配置保存成功！', 'success');
    showConfigStatus('✅ 配置已保存！', 'success');
  } catch (error) {
    showToast(`保存配置失败: ${error.message}`, 'error');
    showConfigStatus(`❌ 保存失败: ${error.message}`, 'error');
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
      showToast('已连接！配置已保存。', 'success');
      return;
    }
  }

  // Save config first
  try {
    await window.electronAPI.saveConfig({ gateway: config });
    state.config = config;
    showToast('配置已保存', 'success');
  } catch (error) {
    showToast(`保存配置失败: ${error.message}`, 'error');
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
      // Handle different possible response structures from gateway
      let sessions = [];
      if (Array.isArray(result.data)) {
        // Gateway may return array directly
        sessions = result.data;
      } else if (result.data.sessions && Array.isArray(result.data.sessions)) {
        // Expected structure: { sessions: [...] }
        sessions = result.data.sessions;
      } else if (result.data.items && Array.isArray(result.data.items)) {
        // Alternative: { items: [...] }
        sessions = result.data.items;
      } else if (result.data.data && Array.isArray(result.data.data)) {
        // Alternative: { data: [...] }
        sessions = result.data.data;
      }

      state.sessions = sessions;
      console.log('Loaded sessions:', state.sessions.length);
      console.log('First session data:', state.sessions[0]); // Debug: check session structure
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

  // Update session count
  if (elements.sessionsCount) {
    elements.sessionsCount.textContent = state.sessions.length;
  }

  if (state.sessions.length === 0) {
    const emptyHtml = '<div class="empty-state"><h3>暂无对话</h3><p>创建一个新对话开始使用</p></div>';
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
  item.className = 'session-detail';
  if (session.key === state.currentSessionKey) {
    item.classList.add('active');
  }
  item.style.cursor = 'pointer';
  item.title = '点击打开此对话';

  console.log('Creating session item for:', session); // Debug: check individual session

  const title = session.label || session.key;

  // Handle createdAt using helper function
  const createdAtValue = getSessionCreatedAt(session);
  const createdAt = createdAtValue ? formatDate(createdAtValue) : '未知';

  // Handle messageCount using helper function
  const messageCount = getSessionMessageCount(session);

  // Show last message preview if available
  let messagePreview = '';
  if (session.lastMessage && messageCount > 0) {
    messagePreview = escapeHtml(session.lastMessage.substring(0, 60));
    if (session.lastMessage.length > 60) {
      messagePreview += '...';
    }
  } else {
    messagePreview = '暂无消息';
  }

  item.innerHTML = `
    <div class="session-detail-header">
      <div>
        <div class="session-detail-title">${escapeHtml(title)}</div>
        <div class="session-detail-key">${messagePreview}</div>
      </div>
      <div class="session-detail-arrow">→</div>
    </div>
    <div class="session-detail-info">
      <span>创建时间: ${createdAt}</span>
      <span> | </span>
      <span>消息数: ${messageCount}</span>
    </div>
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
  updateSendButtonState(); // Update button state based on input content

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
    showToast('未连接到网关。请先配置并连接。', 'error');
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

  showToast('新对话已创建！发送一条消息开始聊天。', 'success');
}

async function loadAllSessions() {
  if (!state.connected) {
    elements.settingsAllSessionsContent.innerHTML = '<div class="empty-state"><h3>未连接到网关</h3><p>请前往 <strong>设置</strong> 配置连接</p></div>';
    return;
  }

  if (state.sessions.length === 0) {
    elements.settingsAllSessionsContent.innerHTML = '<div class="empty-state"><h3>暂无对话</h3><p>创建一个新对话开始使用</p></div>';
    return;
  }

  elements.settingsAllSessionsContent.innerHTML = '';

  for (const session of state.sessions) {
    const detail = document.createElement('div');
    detail.className = 'session-detail';
    detail.style.cursor = 'pointer';
    detail.title = 'Click to open this chat';

    const title = session.label || session.key;

    // Handle createdAt using helper function
    const createdAtValue = getSessionCreatedAt(session);
    const createdAt = createdAtValue ? formatDate(createdAtValue) : '未知';

    // Handle messageCount using helper function
    const messageCount = getSessionMessageCount(session);

    detail.innerHTML = `
      <div class="session-detail-header">
        <div>
          <div class="session-detail-title">${escapeHtml(title)}</div>
          <div class="session-detail-key">${escapeHtml(session.key)}</div>
        </div>
        <div class="session-detail-arrow">→</div>
      </div>
      <div class="session-detail-info">
        <span>创建时间: ${createdAt}</span>
        <span> | </span>
        <span>消息数: ${messageCount}</span>
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

    console.log('=== loadChatHistory result ===');
    console.log('Success:', result.success);
    console.log('Data:', result.data);

    if (result.success && result.data) {
      state.messages = result.data.messages || [];
      console.log('Loaded messages count:', state.messages.length);
      console.log('First message structure:', state.messages[0]);
      console.log('First message keys:', state.messages[0] ? Object.keys(state.messages[0]) : 'No messages');
      renderMessages();
    }
  } catch (error) {
    console.error('Failed to load chat history:', error);
  }
}

function renderMessages() {
  console.log('=== renderMessages called ===');
  console.log('Total messages to render:', state.messages.length);

  elements.chatMessages.innerHTML = '';

  if (state.messages.length === 0) {
    elements.chatMessages.innerHTML = '<div class="empty-state"><h3>暂无消息</h3><p>发送一条消息开始对话</p></div>';
    return;
  }

  state.messages.forEach((msg, index) => {
    console.log(`Rendering message ${index}:`, msg);
    const messageElement = createMessageElement(msg);
    elements.chatMessages.appendChild(messageElement);
  });

  // Scroll to bottom
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Create message DOM element
function createMessageElement(msg) {
  const div = document.createElement('div');

  // Try multiple possible field names for role
  let role = msg.role || msg.sender || msg.type || msg.author || 'unknown';
  console.log('createMessageElement - detected role:', role, 'from message:', msg);

  // Normalize role values
  if (role === 'bot' || role === 'ai' || role === 'model') {
    role = 'assistant';
  } else if (role === 'human' || role === 'user') {
    role = 'user';
  }

  div.className = `message ${role}`;
  div.dataset.messageId = msg.id || `${msg.timestamp}-${msg.role}`;

  const timestamp = msg.timestamp ? formatDate(msg.timestamp) : '';
  let content = '';

  // Extract content from message
  let messageContent = '';
  if (typeof msg.content === 'string') {
    messageContent = msg.content;
  } else if (Array.isArray(msg.content)) {
    messageContent = msg.content.map(block => {
      if (block.type === 'text') {
        return block.text || '';
      } else if (block.type === 'image') {
        return '[Image]';
      }
      return '';
    }).join('');
  } else if (msg.text) {
    messageContent = msg.text;
  } else {
    messageContent = JSON.stringify(msg.content);
  }

  console.log('createMessageElement - extracted content length:', messageContent.length);
  console.log('createMessageElement - final role:', role);

  // Render markdown for assistant messages, plain text for user messages
  if (role === 'assistant' && window.marked) {
    try {
      content = window.marked.parse(messageContent);
    } catch (e) {
      console.error('Markdown parse error:', e);
      content = escapeHtml(messageContent);
    }
  } else {
    content = escapeHtml(messageContent);
  }

  div.innerHTML = `
    <div class="message-header">
      <span class="message-role">${role.charAt(0).toUpperCase() + role.slice(1)}</span>
      <span class="message-time">${timestamp}</span>
    </div>
    <div class="message-content">${content}</div>
  `;

  return div;
}

async function sendMessage() {
  const message = elements.messageInput.value.trim();

  if (!message || !state.currentSessionKey) {
    return;
  }

  // Clear input immediately
  elements.messageInput.value = '';

  // Create user message object
  const userMessage = {
    role: 'user',
    content: message,
    timestamp: Date.now()
  };

  // Add to state messages
  state.messages.push(userMessage);

  // Render the message immediately
  renderSingleMessage(userMessage);

  // Display thinking indicator
  showThinkingIndicator();

  // Scroll to bottom to show the new message
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  // Disable send button while sending
  elements.sendBtn.disabled = true;

  try {
    const result = await window.electronAPI.sendMessage(state.currentSessionKey, message);
    console.log('Send result:', result);

    if (result.success) {
      console.log('Message sent, runId:', result.runId);
    } else {
      console.error('Failed to send message:', result.error);
      showToast(`发送消息失败: ${result.error}`, 'error');
      // Remove the message if sending failed
      state.messages.pop();
      renderMessages();
      hideThinkingIndicator();
      updateSendButtonState();
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showToast(`发送消息错误: ${error.message}`, 'error');
    // Remove the message if sending failed
    state.messages.pop();
    renderMessages();
    hideThinkingIndicator();
  } finally {
    updateSendButtonState();
  }
}

// Show thinking indicator
function showThinkingIndicator() {
  // Remove existing thinking indicator if any
  hideThinkingIndicator();

  // Clear any existing streaming state
  clearStreamingState();

  const thinkingDiv = document.createElement('div');
  state.thinkingMessageId = 'thinking-' + Date.now();
  thinkingDiv.id = state.thinkingMessageId;
  thinkingDiv.className = 'message assistant thinking';

  thinkingDiv.innerHTML = `
    <div class="message-header">
      <span class="message-role">Assistant</span>
      <span class="message-time">${formatDate(Date.now())}</span>
    </div>
    <div class="message-content">
      <div class="thinking-indicator">
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
      </div>
    </div>
  `;

  elements.chatMessages.appendChild(thinkingDiv);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Hide thinking indicator
function hideThinkingIndicator() {
  if (state.thinkingMessageId) {
    const thinkingElement = document.getElementById(state.thinkingMessageId);
    if (thinkingElement) {
      thinkingElement.remove();
    }
    state.thinkingMessageId = null;
  }
  // Note: Don't reset streamingMessageId here - streaming continues after thinking is hidden
}

// Clear streaming state
function clearStreamingState() {
  if (state.streamingMessageId) {
    console.log('💬 Streaming completed, resetting streamingMessageId');
    state.streamingMessageId = null;
  }
  if (state.streamingTimeout) {
    clearTimeout(state.streamingTimeout);
    state.streamingTimeout = null;
  }
}

// Reset streaming timeout
function resetStreamingTimeout() {
  if (state.streamingTimeout) {
    clearTimeout(state.streamingTimeout);
  }
  // Auto-clear streaming state after 3 seconds of no updates
  state.streamingTimeout = setTimeout(() => {
    console.log('⏰ Streaming timeout, clearing streaming state');
    clearStreamingState();
  }, 3000);
}

// Helper function to render a single message
function renderSingleMessage(msg) {
  // Remove empty state if present
  const emptyState = elements.chatMessages.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const messageElement = createMessageElement(msg);
  elements.chatMessages.appendChild(messageElement);
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
    elements.settingsLogsContent.innerHTML = `<div class="empty-state"><h3>错误</h3><p>${escapeHtml(error.message)}</p></div>`;
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
  const confirmed = await showConfirmDialog(
    'Clear Logs',
    'Are you sure you want to clear all logs?',
    'Clear',
    'Cancel'
  );

  if (confirmed) {
    try {
      await window.electronAPI.clearLogs();
      showToast('日志已清除', 'success');
      await loadLogs();
    } catch (error) {
      showToast(`清除日志失败: ${error.message}`, 'error');
    }
  }
}

// Cron Jobs
async function loadCronJobs() {
  if (!state.connected) {
    elements.settingsCronJobsContent.innerHTML = '<div class="empty-state"><h3>未连接到网关</h3><p>请前往 <strong>设置</strong> 配置连接</p></div>';
    return;
  }

  showLoading('正在加载定时任务...');

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
      showToast(`加载定时任务失败: ${result.error}`, 'error');
      elements.cronJobsContent.innerHTML = `<div class="empty-state"><h3>错误</h3><p>${escapeHtml(result.error)}</p></div>`;
    }
  } catch (error) {
    console.error('Failed to load cron jobs:', error);
    showToast(`加载定时任务错误: ${error.message}`, 'error');
    elements.settingsCronJobsContent.innerHTML = `<div class="empty-state"><h3>错误</h3><p>${escapeHtml(error.message)}</p></div>`;
  } finally {
    hideLoading();
  }
}

function renderCronJobsList() {
  elements.settingsCronJobsContent.innerHTML = '';

  if (state.cronJobs.length === 0) {
    elements.settingsCronJobsContent.innerHTML = `
      <div class="empty-state">
        <h3>暂无定时任务</h3>
        <p>点击 <strong>+ 添加任务</strong> 按钮创建您的第一个定时任务</p>
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
    <div class="cron-job-name">名称</div>
    <div class="cron-job-schedule">调度</div>
    <div class="cron-job-status">状态</div>
    <div class="cron-job-actions">操作</div>
  `;
  table.appendChild(header);

  // Table rows
  state.cronJobs.forEach(job => {
    const row = document.createElement('div');
    row.className = 'cron-job-row';

    const scheduleText = formatSchedule(job.schedule);
    const statusClass = job.enabled ? 'enabled' : 'disabled';
    const statusText = job.enabled ? '已启用' : '已禁用';

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
        <button class="btn btn-small btn-secondary cron-run-btn" data-id="${escapeHtml(job.id)}" title="立即运行">▶</button>
        <button class="btn btn-small btn-secondary cron-edit-btn" data-id="${escapeHtml(job.id)}" title="编辑">✏️</button>
        <button class="btn btn-small btn-secondary cron-delete-btn" data-id="${escapeHtml(job.id)}" title="删除">🗑</button>
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

  showLoading('正在运行任务...');

  try {
    const result = await window.electronAPI.runCronJob(jobId, 'force');

    if (result.success) {
      showToast('Task started successfully!', 'success');
    } else {
      showToast(`Failed to run task: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Failed to run cron job:', error);
    showToast(`运行任务错误: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteCronJob(jobId) {
  if (!confirm('Delete this scheduled task? This action cannot be undone.')) {
    return;
  }

  showLoading('正在删除任务...');

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
    showToast(`删除任务错误: ${error.message}`, 'error');
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
    showToast('未连接到网关。请先配置并连接。', 'error');
    openSettingsDialog('config');
    return;
  }

  showCronEditForm(null);
}

async function editCronJob(jobId) {
  if (!state.connected) {
    showToast('未连接到网关', 'error');
    return;
  }

  // Find the job in our state
  const job = state.cronJobs.find(j => j.id === jobId);
  if (!job) {
    showToast('Job not found', 'error');
    return;
  }

  showCronEditForm(job);
}

async function showCronEditForm(existingJob = null) {
  const isEdit = !!existingJob;

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

  // Pre-fill schedule values
  const defaultScheduleKind = existingJob?.schedule?.kind || 'every';
  const unitToMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  let defaultEveryAmount = 1;
  let defaultEveryUnit = 'm';
  if (existingJob?.schedule?.kind === 'every' && existingJob?.schedule?.everyMs) {
    const ms = existingJob.schedule.everyMs;
    // Find the best unit
    for (const [unit, unitMs] of Object.entries(unitToMs).reverse()) {
      if (ms % unitMs === 0) {
        defaultEveryUnit = unit;
        defaultEveryAmount = Math.floor(ms / unitMs);
        break;
      }
    }
  }
  const defaultAtValue = existingJob?.schedule?.kind === 'at' ? (existingJob?.schedule?.at || '') : '';
  const defaultCronExpr = existingJob?.schedule?.kind === 'cron' ? (existingJob?.schedule?.expr || '') : '';
  const defaultCronTz = existingJob?.schedule?.kind === 'cron' ? (existingJob?.schedule?.tz || '') : '';

  // Build agents options
  const agentsOptions = agents.map(agent =>
    `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.label || agent.id)} (${escapeHtml(agent.id)})</option>`
  ).join('');

  elements.settingsCronJobsContent.innerHTML = `
    <div class="cron-edit-form">
      <div class="cron-edit-header">
        <div>
          <button class="cron-back-btn" id="cron-back-btn">← 返回列表</button>
          <h4 style="margin-top: 1rem;">${isEdit ? '编辑任务' : '新建任务'}</h4>
        </div>
      </div>

      <form id="cron-edit-form-element">
        <div class="form-group">
          <label class="form-label">名称 *</label>
          <input type="text" name="name" class="input" value="${escapeHtml(defaultName)}" placeholder="例如：晨间简报" required>
        </div>

        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea name="description" class="textarea" rows="2" placeholder="此任务的可选说明">${escapeHtml(defaultDescription)}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" name="enabled" ${defaultEnabled ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
            已启用
          </label>
        </div>

        <div style="margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 2px solid hsl(var(--primary));">
          <h5 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.75rem;">调度 *</h5>

          <div class="form-group">
            <label class="form-label">调度类型 *</label>
            <select name="scheduleKind" class="select" id="schedule-kind-select" required>
              <option value="every" ${defaultScheduleKind === 'every' ? 'selected' : ''}>每隔（间隔）</option>
              <option value="at" ${defaultScheduleKind === 'at' ? 'selected' : ''}>指定时间</option>
              <option value="cron" ${defaultScheduleKind === 'cron' ? 'selected' : ''}>Cron</option>
            </select>
          </div>

          <!-- Every schedule -->
          <div class="form-group schedule-type-group" data-type="every" id="schedule-every-group" ${defaultScheduleKind !== 'every' ? 'style="display: none;"' : ''}>
            <label class="form-label">间隔 *</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="number" name="everyAmount" id="every-amount" class="input" value="${defaultEveryAmount}" min="1" style="flex: 1;">
              <select name="everyUnit" id="every-unit" class="select" style="width: auto;">
                <option value="m" ${defaultEveryUnit === 'm' ? 'selected' : ''}>分钟</option>
                <option value="h" ${defaultEveryUnit === 'h' ? 'selected' : ''}>小时</option>
                <option value="d" ${defaultEveryUnit === 'd' ? 'selected' : ''}>天</option>
              </select>
            </div>
          </div>

          <!-- At schedule -->
          <div class="form-group schedule-type-group" data-type="at" id="schedule-at-group" ${defaultScheduleKind !== 'at' ? 'style="display: none;"' : ''}>
            <label class="form-label">运行时间 *</label>
            <input type="datetime-local" name="atValue" id="at-value" class="input" value="${escapeHtml(defaultAtValue ? new Date(defaultAtValue).toISOString().slice(0, 16) : '')}">
            <small style="display: block; margin-top: 0.25rem; font-size: 0.75rem; color: hsl(var(--muted-foreground));">选择具体的日期和时间</small>
          </div>

          <!-- Cron schedule -->
          <div class="form-group schedule-type-group" data-type="cron" id="schedule-cron-group" ${defaultScheduleKind !== 'cron' ? 'style="display: none;"' : ''}>
            <label class="form-label">表达式 *</label>
            <input type="text" name="cronExpr" id="cron-expr" class="input" placeholder="0 7 * * *" value="${escapeHtml(defaultCronExpr)}">
            <small style="display: block; margin-top: 0.25rem; font-size: 0.75rem; color: hsl(var(--muted-foreground));">标准 Cron 格式</small>
          </div>

          <div class="form-group schedule-type-group" data-type="cron" id="schedule-cron-tz-group" ${defaultScheduleKind !== 'cron' ? 'style="display: none;"' : ''}>
            <label class="form-label">时区（可选）</label>
            <input type="text" name="cronTz" id="cron-tz" class="input" placeholder="例如：Asia/Shanghai" value="${escapeHtml(defaultCronTz)}">
          </div>

          <div class="form-group">
            <label class="form-label">唤醒模式</label>
            <select name="wakeMode" class="select">
              <option value="next-heartbeat" ${defaultWakeMode === 'next-heartbeat' ? 'selected' : ''}>下次心跳</option>
              <option value="immediate" ${defaultWakeMode === 'immediate' ? 'selected' : ''}>立即</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">会话密钥（可选）</label>
            <input type="text" name="sessionKey" class="input" value="${escapeHtml(defaultSessionKey)}" placeholder="留空以创建新会话">
          </div>

          <div class="form-group">
            <label class="form-label">会话</label>
            <select name="sessionTarget" class="select">
              <option value="main" ${defaultSessionTarget === 'main' ? 'selected' : ''}>主会话（发布系统事件）</option>
              <option value="isolated" ${defaultSessionTarget === 'isolated' ? 'selected' : ''}>隔离会话（运行助手任务）</option>
            </select>
            <small style="display: block; margin-top: 0.25rem; font-size: 0.75rem; color: hsl(var(--muted-foreground));">主会话发布系统事件，隔离会话运行独立的代理轮次</small>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 2px solid hsl(var(--primary));">
          <h5 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.75rem;">执行 *</h5>

          <div class="form-group">
            <label class="form-label">代理 ID *</label>
            <select name="agentId" class="select" required>
              ${agentsOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">执行内容</label>
            <select name="payloadKind" class="select" id="payloadKindSelect">
              <option value="systemEvent" ${defaultPayloadKind === 'systemEvent' ? 'selected' : ''}>发布消息到主时间线</option>
              <option value="agentTurn" ${defaultPayloadKind === 'agentTurn' ? 'selected' : ''}>运行助手任务（隔离）</option>
            </select>
            <small id="payload-kind-hint" style="display: block; margin-top: 0.25rem; font-size: 0.75rem; color: hsl(var(--muted-foreground));"></small>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 2px solid hsl(var(--primary));">
          <h5 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.75rem;">消息内容</h5>

          <div class="form-group">
            <label class="form-label" id="message-label">主时间线消息</label>
            <textarea name="message" class="textarea" rows="4" placeholder="输入要发送的消息内容">${escapeHtml(defaultMessage)}</textarea>
          </div>

          <div class="form-group agent-only-field">
            <label class="form-label">模型（可选）</label>
            <input type="text" name="model" class="input" value="${escapeHtml(defaultModel)}" placeholder="例如：openai/gpt-4">
          </div>

          <div class="form-group agent-only-field">
            <label class="form-label">思考（可选）</label>
            <textarea name="thinking" class="textarea" rows="2" placeholder="额外的思考上下文">${escapeHtml(defaultThinking)}</textarea>
          </div>

          <div class="form-group agent-only-field">
            <label class="form-label">超时（秒，可选）</label>
            <input type="number" name="timeout" class="input" value="${escapeHtml(defaultTimeout)}" placeholder="例如：90" min="1">
          </div>

          <div class="form-group agent-only-field">
            <label class="form-label">回退（逗号分隔，可选）</label>
            <input type="text" name="fallbacks" class="input" value="${escapeHtml(defaultFallbacks)}" placeholder="例如：fallback1, fallback2">
          </div>
        </div>

        <div id="advanced-options-section" style="margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 2px solid hsl(var(--primary));">
          <h5 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.75rem;">高级选项</h5>

          <div class="form-group agent-only-field">
            <label class="form-label">
              <input type="checkbox" name="lightContext" ${defaultLightContext ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
              轻量上下文
            </label>
            <small style="display: block; margin-top: 0.25rem; font-size: 0.75rem; color: hsl(var(--muted-foreground));">为此任务使用最小上下文</small>
          </div>

          <div class="form-group agent-only-field">
            <label class="form-label">
              <input type="checkbox" name="deliver" ${defaultDeliver ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
              启用投递
            </label>
            <small style="display: block; margin-top: 0.25rem; font-size: 0.75rem; color: hsl(var(--muted-foreground));">启用消息投递</small>
          </div>

          <div class="form-group agent-only-field">
            <label class="form-label">频道（可选）</label>
            <input type="text" name="channel" class="input" value="${escapeHtml(defaultChannel)}" placeholder="投递频道">
          </div>

          <div class="form-group agent-only-field">
            <label class="form-label">收件人（可选）</label>
            <input type="text" name="to" class="input" value="${escapeHtml(defaultTo)}" placeholder="收件人">
          </div>

          <div class="form-group agent-only-field">
            <label class="form-label">
              <input type="checkbox" name="bestEffortDeliver" ${defaultBestEffort ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
              尽力投递
            </label>
          </div>

          <div class="form-group agent-only-field">
            <label class="form-label">账户 ID（可选）</label>
            <input type="text" name="accountId" class="input" value="${escapeHtml(defaultAccountId)}" placeholder="投递用账户 ID">
          </div>

          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" name="deleteAfterRun" ${defaultDeleteAfterRun ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
              运行后删除
            </label>
            <small style="display: block; margin-top: 0.25rem; font-size: 0.75rem; color: hsl(var(--muted-foreground));">执行后自动删除此任务</small>
          </div>
        </div>

        <div class="cron-edit-actions">
          <button type="button" class="btn btn-secondary" id="cron-cancel-btn">取消</button>
          <button type="submit" class="btn btn-primary">${isEdit ? '更新任务' : '添加任务'}</button>
        </div>
      </form>
    </div>
  `;

  // Add event listeners
  document.getElementById('cron-back-btn').addEventListener('click', loadCronJobs);
  document.getElementById('cron-cancel-btn').addEventListener('click', loadCronJobs);

  // Handle schedule type change
  const scheduleKindSelect = document.getElementById('schedule-kind-select');
  const scheduleTypeGroups = document.querySelectorAll('.schedule-type-group');

  function updateScheduleTypeVisibility() {
    const selectedKind = scheduleKindSelect.value;
    scheduleTypeGroups.forEach(group => {
      if (group.dataset.type === selectedKind) {
        group.style.display = 'block';
      } else {
        group.style.display = 'none';
      }
    });
  }

  scheduleKindSelect.addEventListener('change', updateScheduleTypeVisibility);
  updateScheduleTypeVisibility(); // Initial state

  // Handle payload kind change - systemEvent has different fields than agentTurn
  const agentIdSelect = document.querySelector('[name="agentId"]');
  const payloadKindSelect = document.getElementById('payloadKindSelect');
  const payloadKindHint = document.getElementById('payload-kind-hint');

  const agentOnlyFields = document.querySelectorAll('.agent-only-field');
  const advancedOptionsHeader = document.querySelector('#advanced-options-section h5');
  const messageLabel = document.getElementById('message-label');

  function updatePayloadKindState() {
    const selectedPayloadKind = payloadKindSelect.value;
    const selectedAgent = agentIdSelect.value;

    if (selectedPayloadKind === 'systemEvent' || selectedAgent === 'main') {
      // systemEvent payload kind selected or main agent selected
      if (selectedAgent === 'main') {
        payloadKindSelect.value = 'systemEvent';
        payloadKindSelect.disabled = true;
        payloadKindHint.textContent = '主代理自动使用"发布消息到主时间线"';
        payloadKindHint.style.color = 'hsl(var(--primary))';
      } else {
        payloadKindSelect.disabled = false;
        payloadKindHint.textContent = '';
      }

      // Hide agent-only fields when using systemEvent
      agentOnlyFields.forEach(field => field.style.display = 'none');
      // Hide the Advanced Options header if all its fields are hidden
      if (advancedOptionsHeader) {
        advancedOptionsHeader.style.display = 'none';
      }

      // Update message label for systemEvent
      if (messageLabel) {
        messageLabel.textContent = '主时间线消息';
      }
    } else {
      // agentTurn payload kind
      payloadKindSelect.disabled = false;
      payloadKindHint.textContent = '';
      payloadKindHint.style.color = 'hsl(var(--muted-foreground))';

      // Show agent-only fields
      agentOnlyFields.forEach(field => field.style.display = '');
      if (advancedOptionsHeader) {
        advancedOptionsHeader.style.display = '';
      }

      // Update message label for agentTurn
      if (messageLabel) {
        messageLabel.textContent = '助手任务提示';
      }
    }
  }

  payloadKindSelect.addEventListener('change', updatePayloadKindState);
  agentIdSelect.addEventListener('change', updatePayloadKindState);
  updatePayloadKindState(); // Initial state

  document.getElementById('cron-edit-form-element').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous validation errors
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    const formData = new FormData(e.target);
    const agentId = formData.get('agentId');
    const payloadKind = formData.get('payloadKind');

    // Build payload based on payload kind
    let payload;
    if (payloadKind === 'systemEvent' || agentId === 'main') {
      // systemEvent payload has different structure
      payload = {
        kind: 'systemEvent',
        text: formData.get('message').trim() || ''
      };
      // systemEvent only supports limited optional fields
      const model = formData.get('model').trim();
      if (model) payload.model = model;
      const thinking = formData.get('thinking').trim();
      if (thinking) payload.thinking = thinking;
      const timeout = formData.get('timeout');
      if (timeout) payload.timeoutSeconds = parseInt(timeout);
      const fallbacks = formData.get('fallbacks').trim();
      if (fallbacks) payload.fallbacks = fallbacks.split(',').map(s => s.trim());
    } else {
      // Regular agentTurn payload
      payload = {
        kind: 'agentTurn',
        message: formData.get('message').trim(),
        model: formData.get('model').trim() || undefined,
        thinking: formData.get('thinking').trim() || undefined,
        timeoutSeconds: formData.get('timeout') ? parseInt(formData.get('timeout')) : undefined,
        fallbacks: formData.get('fallbacks').trim() ? formData.get('fallbacks').split(',').map(s => s.trim()) : undefined,
        lightContext: formData.get('lightContext') === 'on',
        deliver: formData.get('deliver') === 'on',
        channel: formData.get('channel').trim() || undefined,
        to: formData.get('to').trim() || undefined,
        bestEffortDeliver: formData.get('bestEffortDeliver') === 'on',
        accountId: formData.get('accountId').trim() || undefined
      };
    }

    const job = {
      name: formData.get('name').trim(),
      description: formData.get('description').trim(),
      enabled: formData.get('enabled') === 'on',
      agentId: agentId,
      sessionKey: formData.get('sessionKey').trim() || undefined,
      sessionTarget: formData.get('sessionTarget').trim() || 'main',
      wakeMode: formData.get('wakeMode'),
      deleteAfterRun: formData.get('deleteAfterRun') === 'on',
      payload: payload
    };

    // Validate required fields
    const errors = [];
    if (!job.name) {
      errors.push('名称为必填项');
      e.target.querySelector('[name="name"]').classList.add('input-error');
    }
    if (!job.agentId) {
      errors.push('代理 ID 为必填项');
      e.target.querySelector('[name="agentId"]').classList.add('input-error');
    }

    // Build schedule based on schedule kind
    const scheduleKind = formData.get('scheduleKind');
    let schedule = { kind: scheduleKind };
    const unitToMs = { m: 60000, h: 3600000, d: 86400000 };

    if (scheduleKind === 'every') {
      const everyAmount = parseInt(formData.get('everyAmount'));
      const everyUnit = formData.get('everyUnit');
      if (!everyAmount || everyAmount < 1) {
        errors.push('间隔必须至少为 1');
        document.getElementById('every-amount').classList.add('input-error');
      } else {
        schedule.everyMs = everyAmount * unitToMs[everyUnit];
      }
    } else if (scheduleKind === 'at') {
      const atValue = formData.get('atValue').trim();
      if (!atValue) {
        errors.push('指定时间调度需要设置运行时间');
        document.getElementById('at-value').classList.add('input-error');
      } else {
        schedule.at = new Date(atValue).toISOString();
      }
    } else if (scheduleKind === 'cron') {
      const cronExpr = formData.get('cronExpr').trim();
      if (!cronExpr) {
        errors.push('Cron 调度需要设置表达式');
        document.getElementById('cron-expr').classList.add('input-error');
      } else {
        schedule.expr = cronExpr;
        const cronTz = formData.get('cronTz').trim();
        if (cronTz) schedule.tz = cronTz;
      }
    }

    // If there are validation errors, show them and stop
    if (errors.length > 0) {
      showToast('验证错误：' + errors.join('；'), 'error');
      return;
    }

    job.schedule = schedule;

    if (isEdit) {
      job.id = existingJob.id;
    }

    showLoading(isEdit ? '正在更新定时任务...' : '正在创建定时任务...');

    try {
      let apiResult;
      if (isEdit) {
        const jobId = job.id;
        const { id, ...patch } = job;
        apiResult = await window.electronAPI.updateCronJob(jobId, patch);
      } else {
        apiResult = await window.electronAPI.addCronJob(job);
      }

      if (apiResult.success) {
        showToast(isEdit ? '任务更新成功！' : '定时任务创建成功！', 'success');
        await loadCronJobs();
      } else {
        showToast(`${isEdit ? '更新' : '创建'}任务失败：${apiResult.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to save cron job:', error);
      showToast(`${isEdit ? '更新' : '创建'}任务错误: ${error.message}`, 'error');
    } finally {
      hideLoading();
    }
  });
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
    elements.sessionStatus.textContent = '已断开连接';
    elements.messageInput.disabled = true;
    updateSendButtonState();
    showToast('已断开网关连接', 'warning');
  });

  window.electronAPI.onGatewayEvent((evt) => {
    console.log('=== Gateway event received ===');
    console.log('Event type:', evt.event);
    console.log('Event payload:', evt.payload);

    // Handle chat events
    if (evt.event === 'chat' && evt.payload) {
      const payload = evt.payload;
      console.log('Chat event payload keys:', Object.keys(payload));
      console.log('Chat event payload:', JSON.stringify(payload, null, 2));
      console.log('Current session key:', state.currentSessionKey);
      console.log('Payload session key:', payload.sessionKey);

      if (payload.sessionKey === state.currentSessionKey) {
        // NOTE: Don't hide thinking indicator here - let handleChatMessage handle it
        // Incrementally add or update message instead of reloading entire chat history
        handleChatMessage(payload);
      } else {
        console.log('Ignoring chat event for different session');
      }
    }
  });
}

// Handle incoming chat message (incremental update)
function handleChatMessage(payload) {
  console.log('=== Handling chat message ===');
  console.log('Full payload:', JSON.stringify(payload, null, 2));
  console.log('Payload keys:', Object.keys(payload));
  console.log('Current streamingMessageId:', state.streamingMessageId);

  // Handle different payload structures
  let messages = [];

  if (payload.messages && Array.isArray(payload.messages)) {
    // Payload contains an array of messages
    console.log('Payload contains messages array:', payload.messages.length);
    messages = payload.messages;
  } else if (payload.message) {
    // Payload contains a single message object
    console.log('Payload contains single message');
    messages = [payload.message];
  } else if (payload.content || payload.text) {
    // Payload itself is the message
    console.log('Payload itself is a message');
    messages = [payload];
  } else {
    console.warn('Unknown payload structure:', payload);
    return;
  }

  // Process each message
  messages.forEach(msg => {
    console.log('Processing message:', msg);
    console.log('Message fields:', Object.keys(msg));

    // Try multiple possible field names for role
    let role = msg.role || msg.sender || msg.type || msg.author || 'unknown';
    console.log('Detected role:', role);

    // Normalize role values
    if (role === 'bot' || role === 'ai' || role === 'model') {
      role = 'assistant';
    } else if (role === 'human') {
      role = 'user';
    }

    // Check if we're currently streaming an assistant message
    if (role === 'assistant' && state.streamingMessageId) {
      // We're in the middle of streaming, update the existing message
      console.log('🔄 Updating streaming message:', state.streamingMessageId);
      const existingElement = document.querySelector(`[data-message-id="${state.streamingMessageId}"]`);

      if (existingElement) {
        const messageElement = createMessageElement(msg);
        existingElement.innerHTML = messageElement.innerHTML;

        // Update in state
        const lastMsgIndex = state.messages.length - 1;
        if (lastMsgIndex >= 0) {
          const lastMsg = state.messages[lastMsgIndex];
          const lastMsgRole = lastMsg.role || lastMsg.sender || lastMsg.type || lastMsg.author || 'unknown';
          const lastRoleNorm = (lastMsgRole === 'bot' || lastMsgRole === 'ai' || lastMsgRole === 'model') ? 'assistant' : lastMsgRole;
          if (lastRoleNorm === 'assistant') {
            state.messages[lastMsgIndex] = msg;
          }
        }

        // Reset streaming timeout
        resetStreamingTimeout();

        // Scroll to bottom
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        return;
      } else {
        // Streaming element not found, reset streaming state
        console.log('⚠️ Streaming element not found, resetting streaming state');
        clearStreamingState();
      }
    }

    // Check if this looks like the start of a new streaming response
    if (role === 'assistant' && !state.streamingMessageId) {
      // Check if thinking indicator is visible OR if last message is from user (indicating stream start)
      const thinkingVisible = state.thinkingMessageId !== null;
      const lastMsg = state.messages[state.messages.length - 1];
      const lastMsgRole = lastMsg ? (lastMsg.role || lastMsg.sender || lastMsg.type || lastMsg.author || 'unknown') : 'unknown';
      const lastRoleNorm = (lastMsgRole === 'bot' || lastMsgRole === 'ai' || lastMsgRole === 'model') ? 'assistant' :
                          (lastMsgRole === 'human') ? 'user' : lastMsgRole;
      const lastWasUser = lastRoleNorm === 'user';

      console.log('🤔 Thinking visible?', thinkingVisible, 'Last message was user?', lastWasUser);

      if (thinkingVisible || lastWasUser) {
        // This is the start of streaming - remove thinking and set up streaming state
        console.log('🚀 Starting new streaming message');

        // Remove thinking indicator first
        hideThinkingIndicator();

        // Create streaming message ID
        const messageId = msg.id || `stream-${Date.now()}`;
        state.streamingMessageId = messageId;

        const messageElement = createMessageElement(msg);
        messageElement.dataset.messageId = messageId;

        elements.chatMessages.appendChild(messageElement);
        state.messages.push(msg);

        // Start streaming timeout
        resetStreamingTimeout();

        // Scroll to bottom
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        return;
      }
    }

    // If we get here and it's an assistant message without streaming state, check if last message is recent assistant
    if (role === 'assistant' && !state.streamingMessageId) {
      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg) {
        const lastMsgRole = lastMsg.role || lastMsg.sender || lastMsg.type || lastMsg.author || 'unknown';
        const lastRoleNorm = (lastMsgRole === 'bot' || lastMsgRole === 'ai' || lastMsgRole === 'model') ? 'assistant' : lastMsgRole;

        // If last message was assistant and was recent (within 5 seconds), treat as streaming update
        const lastTimestamp = lastMsg.timestamp || Date.now() / 1000;
        const isRecent = (Date.now() / 1000 - lastTimestamp) < 5;

        if (lastRoleNorm === 'assistant' && isRecent) {
          console.log('🔄 Last message was recent assistant, treating as streaming update');
          // Start streaming from the last message
          const messageId = lastMsg.id || `stream-${Date.now()}`;
          state.streamingMessageId = messageId;

          const existingElement = elements.chatMessages.lastElementChild;
          if (existingElement) {
            const messageElement = createMessageElement(msg);
            existingElement.innerHTML = messageElement.innerHTML;
            existingElement.dataset.messageId = messageId;
            state.messages[state.messages.length - 1] = msg;

            // Start streaming timeout
            resetStreamingTimeout();

            // Scroll to bottom
            elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
            return;
          }
        }
      }
    }

    // If not streaming, check for explicit ID match
    const messageId = msg.id || `${msg.timestamp}-${role}`;
    const existingElement = elements.chatMessages.querySelector(`[data-message-id="${messageId}"]`);

    if (existingElement) {
      // Update existing message (by explicit ID)
      console.log('🔄 Updating existing message by ID:', messageId);
      const messageElement = createMessageElement(msg);
      existingElement.innerHTML = messageElement.innerHTML;
    } else {
      // Add new message
      console.log('➕ Adding new message:', messageId);
      const messageElement = createMessageElement(msg);
      elements.chatMessages.appendChild(messageElement);

      // Add to state.messages
      state.messages.push(msg);

      // If this is not an assistant message, clear streaming state
      if (role !== 'assistant') {
        clearStreamingState();
      }
    }
  });

  // Scroll to bottom
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
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

  // Sessions toggle
  if (elements.sessionsToggleBtn) {
    elements.sessionsToggleBtn.addEventListener('click', toggleSessions);
  }

  // Send message
  elements.sendBtn.addEventListener('click', sendMessage);

  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      sendMessage();
    }
  });

  elements.messageInput.addEventListener('input', () => {
    updateSendButtonState();
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

      // Load sessions expanded state
      if (savedConfig.sessionsExpanded !== undefined) {
        state.sessionsExpanded = savedConfig.sessionsExpanded;
        // Apply the state
        if (!state.sessionsExpanded) {
          elements.sessionsList.style.maxHeight = '0px';
          elements.sessionsList.style.overflow = 'hidden';
          elements.sessionsList.style.opacity = '0';
          elements.sessionsToggleIcon.style.transform = 'rotate(-90deg)';
        }
      }
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }

  // Try to auto-connect if config exists
  if (state.config.url) {
    console.log('Attempting auto-connect...');
    await connectToGateway(state.config);
  }

  // Initialize send button state
  updateSendButtonState();
}

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
