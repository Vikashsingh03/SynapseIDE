import * as Y from 'yjs';

function encodeUpdate(update) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < update.length; i += chunkSize) {
    binary += String.fromCharCode(...update.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

function decodeUpdate(encoded) {
  const binary = atob(encoded);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

export class RoomYjsManager {
  constructor({ socket, roomId, userId, onFileContent, onDocReplaced, canEditFile }) {
    this.socket = socket;
    this.roomId = roomId;
    this.userId = userId;
    this.onFileContent = onFileContent;
    this.onDocReplaced = onDocReplaced;
    this.canEditFile = canEditFile;
    this.docs = new Map();
    this.remoteOrigin = Symbol('remote');
    this.localSeedOrigin = Symbol('local-seed');
  }

  ensureDoc(fileId) {
    if (this.docs.has(fileId)) return this.docs.get(fileId);

    const doc = new Y.Doc();
    const text = doc.getText('content');

    
    const textObserver = () => this.onFileContent?.(fileId, text.toString());
    text.observe(textObserver);

    
    
    doc.on('update', (update, origin) => {
      if (origin === this.remoteOrigin || origin === this.localSeedOrigin) return;
      this.socket.emit('code-change', {
        roomId: this.roomId,
        fileId,
        changes: encodeUpdate(update),
        userId: this.userId,
      });
    });

    const entry = { doc, text, textObserver, seeded: false, locallySeeded: false };
    this.docs.set(fileId, entry);
    return entry;
  }

  




  applySharedStates(sharedDocs = {}, files = []) {
    files.forEach((file) => {
      const encodedState = sharedDocs[file.id];
      if (!encodedState) return;

      let entry = this.docs.get(file.id);

      
      
      
      
      
      if (entry && entry.locallySeeded) {
        entry.text.unobserve(entry.textObserver);
        entry.doc.destroy();
        this.docs.delete(file.id);
        entry = null;
        this.onDocReplaced?.(file.id);
      }

      entry = this.ensureDoc(file.id);

      
      Y.applyUpdate(entry.doc, decodeUpdate(encodedState), this.remoteOrigin);
      entry.seeded = true;
      entry.locallySeeded = false;
      this.onFileContent?.(file.id, entry.text.toString());
    });
  }

  





  getText(fileId) {
    return this.ensureDoc(fileId).text;
  }

  




  seedNewFile(fileId, content) {
    const entry = this.ensureDoc(fileId);
    if (entry.seeded || !content) return;
    if (entry.text.length > 0) {
      entry.seeded = true;
      entry.locallySeeded = true;
      this.onFileContent?.(fileId, entry.text.toString());
      return;
    }

    entry.doc.transact(() => {
      entry.text.insert(0, content);
    }, this.localSeedOrigin);
    entry.seeded = true;
    entry.locallySeeded = true;
    this.onFileContent?.(fileId, entry.text.toString());
  }

  applyRemoteUpdate(fileId, encodedUpdate) {
    if (!encodedUpdate) return;
    const entry = this.ensureDoc(fileId);
    Y.applyUpdate(entry.doc, decodeUpdate(encodedUpdate), this.remoteOrigin);
    entry.seeded = true;
    entry.locallySeeded = false;
    this.onFileContent?.(fileId, entry.text.toString());
  }

  destroy() {
    this.docs.forEach((entry) => {
      entry.text.unobserve(entry.textObserver);
      entry.doc.destroy();
    });
    this.docs.clear();
  }
}
