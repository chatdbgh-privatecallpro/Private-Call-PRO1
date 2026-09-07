import { ChatMessage, GoogleDriveAccount, UserAccount } from '../types';

const STORAGE_KEYS = {
  LOCAL_MESSAGES: 'chat_messages',
  LOCAL_BACKUP_VAULT: 'local_chat_backup_vault',
  GOOGLE_DRIVE_BACKUPS: 'google_drive_cloud_backups',
};

export interface ChatBackupPayload {
  version: string;
  timestamp: string;
  userId: string;
  userName: string;
  linkedEmail?: string;
  totalMessages: number;
  messages: ChatMessage[];
  appInfo: {
    name: string;
    build: string;
  };
}

export const driveBackupService = {
  // 1. Primary Local Chat Storage Getters & Setters
  getLocalMessages(): ChatMessage[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOCAL_MESSAGES);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Error reading local messages:', e);
    }
    return [];
  },

  saveLocalMessages(messages: ChatMessage[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_MESSAGES, JSON.stringify(messages));
    } catch (e) {
      console.warn('Error saving local messages:', e);
    }
  },

  // 2. Build complete backup payload
  generateBackupPayload(user: UserAccount, messages: ChatMessage[]): ChatBackupPayload {
    const userMessages = messages.filter(
      (m) =>
        m.senderUserId === user.id ||
        m.receiverUserId === user.id ||
        (user.sellerId && m.developerId === user.sellerId) ||
        !m.senderUserId // general inbox
    );

    return {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      linkedEmail: user.linkedGoogleAccount?.email || 'local_device_storage',
      totalMessages: userMessages.length,
      messages: userMessages,
      appInfo: {
        name: 'PTS Secure Chat',
        build: '2026.08.local-drive',
      },
    };
  },

  // 3. Perform Google Drive Backup (Simulates direct Drive Cloud API & provides downloadable file)
  async performGoogleDriveBackup(
    user: UserAccount,
    messages: ChatMessage[]
  ): Promise<{ success: boolean; backupPayload: ChatBackupPayload; backupId: string }> {
    const payload = this.generateBackupPayload(user, messages);
    const backupId = `GDRIVE-${Date.now()}`;

    // Store in local drive cache
    try {
      const existingDriveBackupsRaw = localStorage.getItem(STORAGE_KEYS.GOOGLE_DRIVE_BACKUPS);
      const existing = existingDriveBackupsRaw ? JSON.parse(existingDriveBackupsRaw) : [];
      existing.unshift({
        backupId,
        date: new Date().toLocaleString('bn-BD'),
        email: user.linkedGoogleAccount?.email || 'plabonbiswas130@gmail.com',
        payload,
      });
      // Keep last 10 backups
      localStorage.setItem(
        STORAGE_KEYS.GOOGLE_DRIVE_BACKUPS,
        JSON.stringify(existing.slice(0, 10))
      );
    } catch (e) {
      console.warn('Error saving drive backup snapshot:', e);
    }

    return {
      success: true,
      backupPayload: payload,
      backupId,
    };
  },

  // 4. Download local JSON backup file to phone storage
  downloadLocalBackupFile(payload: ChatBackupPayload): void {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    const filename = `pts_chat_backup_${payload.userName.replace(/\s+/g, '_')}_${Date.now()}.json`;
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  // 5. Restore messages from backup file / Drive payload
  restoreFromBackupPayload(payload: ChatBackupPayload, currentMessages: ChatMessage[]): ChatMessage[] {
    if (!payload || !Array.isArray(payload.messages)) {
      throw new Error('অবৈধ ব্যাকআপ ফাইল ফরম্যাট।');
    }

    const messageMap = new Map<string, ChatMessage>();
    currentMessages.forEach((m) => messageMap.set(m.id, m));
    payload.messages.forEach((m) => messageMap.set(m.id, m));

    const merged = Array.from(messageMap.values()).sort((a, b) => {
      const tA = a.createdAt || new Date(a.timestamp).getTime() || 0;
      const tB = b.createdAt || new Date(b.timestamp).getTime() || 0;
      return tA - tB;
    });

    this.saveLocalMessages(merged);
    return merged;
  },

  // 6. Link Gmail Account
  createGoogleAccount(email: string, name?: string): GoogleDriveAccount {
    return {
      email: email.trim().toLowerCase(),
      name: name?.trim() || email.split('@')[0] || 'Google User',
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${email}`,
      linkedAt: new Date().toLocaleDateString('bn-BD'),
      autoSyncDrive: true,
      lastDriveBackup: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
    };
  },
};
