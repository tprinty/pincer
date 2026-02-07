/**
 * Pincer Popup Script
 */

// Elements
const statusIndicator = document.getElementById('status-indicator')!;
const statusText = document.getElementById('status-text')!;
const tabCount = document.getElementById('tab-count')!;
const connectBtn = document.getElementById('connect-btn')!;
const disconnectBtn = document.getElementById('disconnect-btn')!;
const sendContextBtn = document.getElementById('send-context-btn')!;
const gatewayUrlInput = document.getElementById('gateway-url') as HTMLInputElement;
const autoConnectCheckbox = document.getElementById('auto-connect') as HTMLInputElement;
const sendOnSwitchCheckbox = document.getElementById('send-on-switch') as HTMLInputElement;

/**
 * Update UI based on connection status
 */
function updateStatus(status: string, tabs: number) {
  statusIndicator.className = `status-indicator ${status}`;
  
  switch (status) {
    case 'connected':
      statusText.textContent = 'Connected';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'block';
      break;
    case 'connecting':
      statusText.textContent = 'Connecting...';
      break;
    default:
      statusText.textContent = 'Disconnected';
      connectBtn.style.display = 'block';
      disconnectBtn.style.display = 'none';
  }

  tabCount.textContent = `${tabs} tab${tabs !== 1 ? 's' : ''} tracked`;
}

/**
 * Load current status and config
 */
async function loadStatus() {
  const response = await chrome.runtime.sendMessage({ type: 'get_status' });
  
  updateStatus(response.status, response.tabCount);
  
  if (response.config) {
    gatewayUrlInput.value = response.config.gateway?.url || '';
    autoConnectCheckbox.checked = response.config.autoConnect ?? true;
    sendOnSwitchCheckbox.checked = response.config.sendOnTabSwitch ?? true;
  }
}

/**
 * Save config changes
 */
async function saveConfig() {
  await chrome.runtime.sendMessage({
    type: 'update_config',
    config: {
      gateway: {
        url: gatewayUrlInput.value,
      },
      autoConnect: autoConnectCheckbox.checked,
      sendOnTabSwitch: sendOnSwitchCheckbox.checked,
    },
  });
}

// Event listeners
connectBtn.addEventListener('click', async () => {
  await saveConfig();
  await chrome.runtime.sendMessage({ type: 'connect' });
  setTimeout(loadStatus, 500);
});

disconnectBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'disconnect' });
  setTimeout(loadStatus, 100);
});

sendContextBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    const context = await chrome.tabs.sendMessage(tab.id, { type: 'get_context' });
    await chrome.runtime.sendMessage({
      type: 'page_context',
      context,
    });
  }
});

// Settings change handlers
gatewayUrlInput.addEventListener('change', saveConfig);
autoConnectCheckbox.addEventListener('change', saveConfig);
sendOnSwitchCheckbox.addEventListener('change', saveConfig);

// Listen for status updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'status_update') {
    updateStatus(message.status, message.tabCount);
  }
});

// Initial load
loadStatus();
