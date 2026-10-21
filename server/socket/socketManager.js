const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const {
  getRoom,
  getRoomSnapshot,
  addParticipant,
  applyDocumentUpdate,
  removeParticipant,
  updateRoomState,
  loadRoomFromDB,
} = require('./roomStore');
const RoomModel = require('../models/Room');
const MessageModel = require('../models/Message');
const { registerTerminalHandlers } = require('./terminalManager');
const { registerDebugHandlers } = require('./debugManager');

function normalizeRoomId(roomId) {
  return String(roomId || '').trim().toUpperCase();
}



function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function verifySocketUser(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return next(new Error('Authentication required.'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = {
      userId: decoded.userId,
      name: decoded.name,
      email: decoded.email,
    };

    return next();
  } catch (error) {
    return next(new Error('Invalid or expired token.'));
  }
}

function emitParticipants(io, roomId) {
  const snapshot = getRoomSnapshot(roomId);
  if (!snapshot) {
    return;
  }

  io.to(roomId).emit('room-users', snapshot.participants);
}

const ASSIGNABLE_ROLES = ['editor', 'viewer'];
const roomRoleByUser = new Map();

function resolveMemberRole(roomData, userId) {
  const targetId = String(userId || '').trim();
  if (!targetId) {
    return 'editor';
  }
  if (roomData && String(roomData.createdBy || '') === targetId) {
    return 'host';
  }
  const members = Array.isArray(roomData?.members) ? roomData.members : [];
  const record = members.find((member) => String(member?.userId || '') === targetId);
  if (record && ASSIGNABLE_ROLES.includes(record.role)) {
    return record.role;
  }
  return 'editor';
}

function setStoredRole(roomId, userId, role) {
  const targetId = String(userId || '').trim();
  if (!roomId || !targetId || !role) {
    return;
  }
  if (!roomRoleByUser.has(roomId)) {
    roomRoleByUser.set(roomId, new Map());
  }
  roomRoleByUser.get(roomId).set(targetId, role);
}

function socketIsViewer(socket) {
  return socket?.data?.role === 'viewer';
}

const FILE_LOCK_TIMEOUT_MS = 45000;
const roomLocks = new Map();


const userSockets = new Map();
const NotificationModel = require('../models/Notification');
const UserModel = require('../models/User');

function trackUserSocket(userId, socketId) {
  const id = String(userId || '');
  if (!id) return;
  if (!userSockets.has(id)) userSockets.set(id, new Set());
  userSockets.get(id).add(socketId);
}

function untrackUserSocket(userId, socketId) {
  const id = String(userId || '');
  const set = userSockets.get(id);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(id);
}

function emitToUser(io, userId, event, payload) {
  const set = userSockets.get(String(userId || ''));
  if (!set) return;
  for (const socketId of set) {
    io.to(socketId).emit(event, payload);
  }
}


function extractMentions(content) {
  const mentions = new Set();
  const re = /@([A-Za-z0-9_.-]{2,32})/g;
  let m;
  const text = String(content || '');
  while ((m = re.exec(text)) !== null) {
    mentions.add(m[1].toLowerCase());
  }
  return [...mentions];
}

async function recordRoomMembership(roomId, participant) {
  const userId = String(participant?.userId || '').trim();
  if (!roomId || !userId) {
    return;
  }

  const username = String(participant?.username || '').trim();
  const now = new Date();

  try {
    const updateResult = await RoomModel.updateOne(
      {
        roomId,
        'members.userId': userId,
      },
      {
        $set: {
          'members.$.username': username,
          'members.$.role': participant?.role || 'editor',
          'members.$.lastVisitedAt': now,
        },
      }
    );

    if (updateResult.matchedCount > 0) {
      return;
    }

    await RoomModel.updateOne(
      {
        roomId,
        'members.userId': { $ne: userId },
      },
      {
        $push: {
          members: {
            userId,
            username,
            role: participant?.role || 'editor',
            joinedAt: now,
            lastVisitedAt: now,
          },
        },
      }
    );
  } catch (error) {
    console.error('Failed to record room membership:', error);
  }
}

function serializeRoomLocks(roomId) {
  const locks = roomLocks.get(roomId);
  if (!locks) {
    return {};
  }

  return Object.fromEntries(
    Array.from(locks.entries()).map(([fileId, lock]) => [
      fileId,
      {
        fileId,
        userId: lock.userId,
        username: lock.username,
        socketId: lock.socketId,
        lockedAt: lock.lockedAt,
        expiresAt: lock.expiresAt,
      },
    ])
  );
}

function emitRoomLocks(io, roomId) {
  io.to(roomId).emit('file-locks-updated', {
    roomId,
    locks: serializeRoomLocks(roomId),
  });
}

function clearLockTimer(lock) {
  if (lock?.timer) {
    clearTimeout(lock.timer);
  }
}

function deleteRoomLock(io, roomId, fileId) {
  const locks = roomLocks.get(roomId);
  if (!locks || !locks.has(fileId)) {
    return false;
  }

  clearLockTimer(locks.get(fileId));
  locks.delete(fileId);

  if (locks.size === 0) {
    roomLocks.delete(roomId);
  }

  emitRoomLocks(io, roomId);
  return true;
}

function scheduleRoomLockExpiry(io, roomId, fileId) {
  const locks = roomLocks.get(roomId);
  const lock = locks?.get(fileId);
  if (!lock) {
    return;
  }

  clearLockTimer(lock);
  lock.expiresAt = Date.now() + FILE_LOCK_TIMEOUT_MS;
  lock.timer = setTimeout(() => {
    deleteRoomLock(io, roomId, fileId);
  }, FILE_LOCK_TIMEOUT_MS);
}

function upsertRoomLock(io, roomId, fileId, lockDetails) {
  let locks = roomLocks.get(roomId);
  if (!locks) {
    locks = new Map();
    roomLocks.set(roomId, locks);
  }

  const existingLock = locks.get(fileId);
  const nextLock = {
    ...existingLock,
    ...lockDetails,
    lockedAt: existingLock?.lockedAt ?? Date.now(),
  };

  locks.set(fileId, nextLock);
  scheduleRoomLockExpiry(io, roomId, fileId);
  emitRoomLocks(io, roomId);
}

function releaseLocksForSocket(io, socket) {
  const socketUserId = socket.data.participant?.userId || socket.data.user?.userId;
  if (!socketUserId) {
    return;
  }

  roomLocks.forEach((locks, roomId) => {
    const lockedFileIds = Array.from(locks.entries())
      .filter(([, lock]) => lock.userId === socketUserId || lock.socketId === socket.id)
      .map(([fileId]) => fileId);

    lockedFileIds.forEach((fileId) => {
      deleteRoomLock(io, roomId, fileId);
    });
  });
}

function createSocketServer(httpServer) {
  const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(verifySocketUser);

  io.on('connection', (socket) => {
    trackUserSocket(socket.data.user?.userId, socket.id);
    registerTerminalHandlers(io, socket);
    registerDebugHandlers(io, socket);
    
    
    socket.on('join-room', async ({ roomId } = {}) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      let room = getRoom(normalizedRoomId);

      if (!room) {
        room = await loadRoomFromDB(normalizedRoomId);
      }

      if (!normalizedRoomId || !room) {
        socket.emit('room-error', {
          message: 'Room not found. Check the invite code and try again.',
        });
        return;
      }

      if (socket.data.roomId && socket.data.roomId !== normalizedRoomId) {
        socket.leave(socket.data.roomId);
        removeParticipant(socket.data.roomId, socket.id);
        emitParticipants(io, socket.data.roomId);
      }

      socket.join(normalizedRoomId);
      socket.data.roomId = normalizedRoomId;

      let roomRole = resolveMemberRole(room, socket.data.user.userId);
      try {
        const dbRoom = await RoomModel.findOne({ roomId: normalizedRoomId })
          .select('createdBy members')
          .lean();
        if (dbRoom) {
          roomRole = resolveMemberRole(dbRoom, socket.data.user.userId);
        }
      } catch (roleError) {
        console.error('Failed to resolve room role:', roleError);
      }
      setStoredRole(normalizedRoomId, socket.data.user.userId, roomRole);
      socket.data.role = roomRole;

      const participant = {
        socketId: socket.id,
        userId: socket.data.user.userId,
        username: socket.data.user.name,
        role: roomRole,
        joinedAt: Date.now(),
      };

      const snapshot = addParticipant(normalizedRoomId, participant);
      const currentParticipant = snapshot.participants.find(
        (nextParticipant) => nextParticipant.socketId === socket.id
      );
      socket.data.participant = currentParticipant;

      await recordRoomMembership(normalizedRoomId, currentParticipant);

      socket.emit('room-joined', {
        room: {
          roomId: snapshot.roomId,
          roomName: snapshot.roomName,
          files: snapshot.files,
          activeFileId: snapshot.activeFileId,
          openTabs: snapshot.openTabs,
        },
        sharedDocs: snapshot.sharedDocs,
        fileLocks: serializeRoomLocks(normalizedRoomId),
        participant: currentParticipant,
      });

      socket.emit('room-role', { role: roomRole, roomId: normalizedRoomId });

      socket.to(normalizedRoomId).emit('user-joined', {
        userId: currentParticipant.userId,
        username: currentParticipant.username,
        cursorColor: currentParticipant.cursorColor,
        avatarGlyph: currentParticipant.avatarGlyph,
        role: currentParticipant.role,
      });
      emitParticipants(io, normalizedRoomId);

      
      try {
        const sysMsg = await MessageModel.create({
          roomId: normalizedRoomId,
          senderId: 'system',
          senderName: 'System',
          type: 'system',
          content: `${currentParticipant.username} joined the room.`
        });
        io.to(normalizedRoomId).emit('chat-message', sysMsg);
      } catch (err) {
        console.error('Error creating system join message', err);
      }
    });

    socket.on('set-member-role', async ({ userId, role } = {}) => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        return;
      }

      if (socket.data.role !== 'host') {
        socket.emit('room-role-error', { message: 'Only the host can change member roles.' });
        return;
      }

      const targetUserId = String(userId || '').trim();
      const nextRole = String(role || '').trim();
      if (!targetUserId || !ASSIGNABLE_ROLES.includes(nextRole)) {
        socket.emit('room-role-error', { message: 'Invalid member or role.' });
        return;
      }

      const liveRoom = getRoom(roomId);
      if (liveRoom && String(liveRoom.createdBy || '') === targetUserId) {
        socket.emit('room-role-error', { message: 'The host role cannot be changed.' });
        return;
      }

      const snapshot = getRoomSnapshot(roomId);
      let isKnownMember = Boolean(
        snapshot?.participants?.some((entry) => String(entry.userId) === targetUserId)
      );
      if (!isKnownMember) {
        try {
          const found = await RoomModel.findOne({ roomId, 'members.userId': targetUserId })
            .select('_id')
            .lean();
          isKnownMember = Boolean(found);
        } catch (lookupError) {
          console.error('Member role lookup error:', lookupError);
        }
      }
      if (!isKnownMember) {
        socket.emit('room-role-error', { message: 'That user is not a member of this room.' });
        return;
      }

      try {
        const updateResult = await RoomModel.updateOne(
          { roomId, 'members.userId': targetUserId },
          { $set: { 'members.$.role': nextRole } }
        );
        if (updateResult.matchedCount === 0) {
          await RoomModel.updateOne(
            { roomId },
            {
              $push: {
                members: {
                  userId: targetUserId,
                  username: '',
                  role: nextRole,
                  joinedAt: new Date(),
                  lastVisitedAt: new Date(),
                },
              },
            }
          );
        }
      } catch (persistError) {
        console.error('Failed to persist member role:', persistError);
        socket.emit('room-role-error', { message: 'Could not update the member role.' });
        return;
      }

      setStoredRole(roomId, targetUserId, nextRole);

      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach((targetSocketId) => {
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket && targetSocket.data.roomId === roomId) {
            targetSocket.data.role = nextRole;
          }
        });
      }
      emitToUser(io, targetUserId, 'room-role', { role: nextRole, roomId });

      updateRoomState(roomId, (room) => {
        room.participants.forEach((entry) => {
          if (String(entry.userId) === targetUserId) {
            entry.role = nextRole;
          }
        });
      });
      emitParticipants(io, roomId);
    });

    socket.on('leave-room', async () => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        return;
      }

      releaseLocksForSocket(io, socket);

      socket.leave(roomId);
      socket.data.roomId = null;
      const removal = removeParticipant(roomId, socket.id);
      socket.data.participant = null;
      socket.to(roomId).emit('user-left', {
        socketId: socket.id,
        userId: removal?.removedParticipant?.userId,
        username: removal?.removedParticipant?.username,
      });
      emitParticipants(io, roomId);

      if (removal?.removedParticipant?.username) {
        MessageModel.create({
          roomId,
          senderId: 'system',
          senderName: 'System',
          type: 'system',
          content: `${removal.removedParticipant.username} left the room.`
        }).then(sysMsg => io.to(roomId).emit('chat-message', sysMsg))
          .catch(err => console.error('Error creating system leave message', err));
      }
    });

    

    socket.on('send-chat-message', async ({ roomId, content, type = 'user', replyTo }) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      if (!activeRoomId || !content) return;

      try {
        const msgData = {
          roomId: activeRoomId,
          senderId: socket.data.user.userId || socket.data.participant?.userId || 'unknown-id',
          senderName: socket.data.participant?.username || socket.data.user?.name || 'Unknown User',
          type,
          content
        };
        if (replyTo && replyTo.messageId) {
          msgData.replyTo = {
            messageId: replyTo.messageId,
            senderName: replyTo.senderName || '',
            content: replyTo.content || ''
          };
        }
        const newMessage = await MessageModel.create(msgData);
        io.to(activeRoomId).emit('chat-message', newMessage);

        
        try {
          const mentionNames = extractMentions(content).filter(
            (n) => n !== String(msgData.senderName || '').toLowerCase()
          );
          if (mentionNames.length > 0) {
            const mentionedUsers = await UserModel.find({
              name: { $in: mentionNames.map((n) => new RegExp(`^${escapeRegExp(n)}$`, 'i')) },
            })
              .select('_id name')
              .lean();
            const senderId = String(msgData.senderId);
            for (const u of mentionedUsers) {
              const targetId = String(u._id);
              if (targetId === senderId) continue;
              const notif = await NotificationModel.create({
                userId: targetId,
                type: 'mention',
                title: `${msgData.senderName} mentioned you`,
                message: String(content).slice(0, 120),
                roomId: activeRoomId,
                fromUser: { userId: senderId, name: msgData.senderName },
                link: `/room/${activeRoomId}`,
              });
              emitToUser(io, targetId, 'notification', notif);
            }
          }
        } catch (mentionErr) {
          console.error('Mention notification error:', mentionErr.message);
        }
      } catch (err) {
        console.error('Error saving chat message:', err);
      }
    });

    socket.on('typing-indicator', ({ roomId, isTyping }) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      if (!activeRoomId) return;

      socket.to(activeRoomId).emit('user-typing', {
        userId: socket.data.user.userId,
        username: socket.data.user.name,
        isTyping
      });
    });

    socket.on('request-chat-history', async ({ roomId, limit = 50, beforeTimestamp }) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      if (!activeRoomId) return;

      try {
        const query = { roomId: activeRoomId };
        if (beforeTimestamp) {
          query.timestamp = { $lt: new Date(beforeTimestamp) };
        }
        const history = await MessageModel.find(query)
          .sort({ timestamp: -1 })
          .limit(limit);
        
        socket.emit('chat-history', history.reverse());
      } catch (err) {
        console.error('Error fetching chat history:', err);
      }
    });

    

    socket.on('edit-chat-message', async ({ messageId, content }) => {
      const activeRoomId = normalizeRoomId(socket.data.roomId);
      if (!activeRoomId || !messageId || !content) return;
      try {
        const msg = await MessageModel.findById(messageId);
        if (!msg || msg.roomId !== activeRoomId) return;
        
        const senderId = socket.data.user.userId || socket.data.participant?.userId;
        if (msg.senderId !== senderId) return;
        msg.content = content;
        msg.edited = true;
        await msg.save();
        io.to(activeRoomId).emit('chat-message-updated', msg);
      } catch (err) {
        console.error('Error editing message:', err);
      }
    });

    

    socket.on('delete-chat-message', async ({ messageId }) => {
      const activeRoomId = normalizeRoomId(socket.data.roomId);
      if (!activeRoomId || !messageId) return;
      try {
        const msg = await MessageModel.findById(messageId);
        if (!msg || msg.roomId !== activeRoomId) return;
        const senderId = socket.data.user.userId || socket.data.participant?.userId;
        if (msg.senderId !== senderId) return;
        msg.deleted = true;
        msg.content = 'This message was deleted.';
        await msg.save();
        io.to(activeRoomId).emit('chat-message-updated', msg);
      } catch (err) {
        console.error('Error deleting message:', err);
      }
    });

    

    socket.on('pin-chat-message', async ({ messageId }) => {
      const activeRoomId = normalizeRoomId(socket.data.roomId);
      if (!activeRoomId || !messageId) return;
      try {
        const msg = await MessageModel.findById(messageId);
        if (!msg || msg.roomId !== activeRoomId) return;
        msg.pinned = !msg.pinned;
        await msg.save();
        io.to(activeRoomId).emit('chat-message-updated', msg);
        
        const action = msg.pinned ? 'pinned' : 'unpinned';
        const sysName = socket.data.participant?.username || socket.data.user?.name || 'Someone';
        const sysMsg = await MessageModel.create({
          roomId: activeRoomId,
          senderId: 'system',
          senderName: 'System',
          type: 'system',
          content: `${sysName} ${action} a message.`
        });
        io.to(activeRoomId).emit('chat-message', sysMsg);
      } catch (err) {
        console.error('Error pinning message:', err);
      }
    });

    

    socket.on('react-chat-message', async ({ messageId, emoji }) => {
      const activeRoomId = normalizeRoomId(socket.data.roomId);
      if (!activeRoomId || !messageId || !emoji) return;
      try {
        const msg = await MessageModel.findById(messageId);
        if (!msg || msg.roomId !== activeRoomId) return;
        const userId = socket.data.user.userId || socket.data.participant?.userId;
        const username = socket.data.participant?.username || socket.data.user?.name || 'Unknown';
        if (!msg.reactions) msg.reactions = new Map();
        const existing = msg.reactions.get(emoji) || [];
        const alreadyReacted = existing.findIndex(r => r.userId === userId);
        if (alreadyReacted >= 0) {
          existing.splice(alreadyReacted, 1);
          if (existing.length === 0) msg.reactions.delete(emoji);
          else msg.reactions.set(emoji, existing);
        } else {
          existing.push({ userId, username });
          msg.reactions.set(emoji, existing);
        }
        msg.markModified('reactions');
        await msg.save();
        io.to(activeRoomId).emit('chat-message-updated', msg);
      } catch (err) {
        console.error('Error reacting to message:', err);
      }
    });

    

    socket.on('search-chat-messages', async ({ roomId, query }) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      if (!activeRoomId || !query) return;
      try {
        
        const safeQuery = escapeRegExp(String(query).slice(0, 200));
        const results = await MessageModel.find({
          roomId: activeRoomId,
          deleted: { $ne: true },
          $or: [
            { content: { $regex: safeQuery, $options: 'i' } },
            { senderName: { $regex: safeQuery, $options: 'i' } }
          ]
        }).sort({ timestamp: -1 }).limit(50);
        socket.emit('chat-search-results', results.reverse());
      } catch (err) {
        console.error('Error searching messages:', err);
      }
    });

    

    socket.on('sync-room-state', async (payload = {}) => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        return;
      }
      if (socketIsViewer(socket)) {
        return;
      }

      const snapshot = updateRoomState(roomId, (room) => {
        room.files = Array.isArray(payload.files)
          ? payload.files.map((file) => ({
              id: file.id,
              name: file.name,
              type: file.type || 'file',
              parentId: file.parentId || null,
              order: typeof file.order === 'number' ? file.order : 0,
              content: file.content ?? '',
              updatedAt: file.updatedAt ?? Date.now(),
            }))
          : room.files;
        room.activeFileId = payload.activeFileId || room.activeFileId;
        room.openTabs = Array.isArray(payload.openTabs)
          ? payload.openTabs
          : room.openTabs;
      });

      if (!snapshot) {
        socket.emit('room-error', { message: 'Unable to sync room state.' });
        return;
      }

      const validFileIds = new Set(snapshot.files.map((file) => file.id));
      const locks = roomLocks.get(roomId);
      if (locks) {
        Array.from(locks.keys()).forEach((fileId) => {
          if (!validFileIds.has(fileId)) {
            deleteRoomLock(io, roomId, fileId);
          }
        });
      }

      try {
        await RoomModel.updateOne(
          { roomId },
          {
            $set: { 
              files: snapshot.files.map(f => ({ 
                id: f.id, 
                name: f.name, 
                type: f.type || 'file', 
                parentId: f.parentId || null, 
                order: typeof f.order === 'number' ? f.order : 0, 
                content: f.content, 
                updatedAt: f.updatedAt 
              })),
              lastUpdated: Date.now()
            }
          }
        );
      } catch (err) {
        console.error('sync-room-state DB update error', err);
      }

      
      
      
      
      io.to(roomId).emit('room-state-updated', {
        files: snapshot.files,
        activeFileId: snapshot.activeFileId,
        openTabs: snapshot.openTabs,
        sharedDocs: snapshot.sharedDocs,
      });
    });

    socket.on('autosave', async ({ roomId, fileId, content } = {}) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      if (!activeRoomId || !fileId || content === undefined) return;
      if (socketIsViewer(socket)) return;

      try {
        await RoomModel.updateOne(
          { roomId: activeRoomId, "files.id": fileId },
          {
            $set: {
              "files.$.content": content,
              "files.$.updatedAt": Date.now(),
              lastUpdated: Date.now()
            }
          }
        );
      } catch (err) {
        console.error('Autosave Error:', err);
      }
    });

    socket.on('save-version', async ({ roomId, fileId, content } = {}) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      if (!activeRoomId || !fileId || content === undefined) return;
      if (socketIsViewer(socket)) return;

      try {
        await RoomModel.updateOne(
          { roomId: activeRoomId },
          {
            $push: {
              versions: {
                content,
                fileId,
                timestamp: Date.now()
              }
            }
          }
        );
      } catch (err) {
        console.error('Save Version Error:', err);
      }
    });

    socket.on('request-file-lock', ({ roomId, fileId } = {}) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      const participant = socket.data.participant;
      const ownerUserId = participant?.userId || socket.data.user?.userId;
      const ownerName = participant?.username || socket.data.user?.name;

      if (!activeRoomId || !fileId || !ownerUserId) {
        return;
      }

      const existingLock = roomLocks.get(activeRoomId)?.get(fileId);
      if (existingLock && existingLock.userId !== ownerUserId) {
        socket.emit('lock-denied', {
          fileId,
          lockedBy: {
            userId: existingLock.userId,
            username: existingLock.username,
            socketId: existingLock.socketId,
            expiresAt: existingLock.expiresAt,
          },
        });
        return;
      }

      upsertRoomLock(io, activeRoomId, fileId, {
        userId: ownerUserId,
        username: ownerName,
        socketId: socket.id,
      });
    });

    socket.on('release-file-lock', ({ roomId, fileId } = {}) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      const requesterUserId = socket.data.participant?.userId || socket.data.user?.userId;
      if (!activeRoomId || !fileId || !requesterUserId) {
        return;
      }

      const existingLock = roomLocks.get(activeRoomId)?.get(fileId);
      if (!existingLock || existingLock.userId !== requesterUserId) {
        return;
      }

      deleteRoomLock(io, activeRoomId, fileId);
    });

    socket.on('renew-file-lock', ({ roomId, fileId } = {}) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      const requesterUserId = socket.data.participant?.userId || socket.data.user?.userId;
      if (!activeRoomId || !fileId || !requesterUserId) {
        return;
      }

      const existingLock = roomLocks.get(activeRoomId)?.get(fileId);
      if (!existingLock || existingLock.userId !== requesterUserId) {
        return;
      }

      upsertRoomLock(io, activeRoomId, fileId, {
        userId: requesterUserId,
        username: existingLock.username,
        socketId: socket.id,
        lockedAt: existingLock.lockedAt,
      });
    });

    socket.on('code-change', ({ roomId, fileId, changes } = {}) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      if (!activeRoomId || !fileId || !changes) {
        return;
      }
      if (socketIsViewer(socket)) {
        return;
      }

      
      const senderId = socket.data.user.userId;
      
      
      
      
      const nextState = applyDocumentUpdate(activeRoomId, fileId, changes);
      if (!nextState) {
        return;
      }

      const senderName = socket.data.user.name;
      const senderColor = socket.data.participant?.cursorColor;
      const senderAvatarGlyph = socket.data.participant?.avatarGlyph;

      
      socket.to(activeRoomId).emit('remote-code-change', {
        fileId,
        changes,
        userId: senderId,
        username: senderName,
        cursorColor: senderColor,
        updatedAt: nextState.updatedAt,
      });

      
      
      socket.to(activeRoomId).emit('user-editing', {
        userId: senderId,
        username: senderName,
        cursorColor: senderColor,
        avatarGlyph: senderAvatarGlyph,
        fileId,
      });
    });

    socket.on('legacy-code-change', ({ fileId, content, updatedAt } = {}) => {
      const roomId = socket.data.roomId;
      if (!roomId || !fileId) {
        return;
      }
      if (socketIsViewer(socket)) {
        return;
      }

      const nextUpdatedAt = updatedAt ?? Date.now();
      updateRoomState(roomId, (room) => {
        room.files = room.files.map((file) =>
          file.id === fileId
            ? {
                ...file,
                content: content ?? '',
                updatedAt: nextUpdatedAt,
              }
            : file
        );
      });

      socket.to(roomId).emit('code-change', {
        fileId,
        content: content ?? '',
        updatedAt: nextUpdatedAt,
      });
    });

    socket.on('cursor-move', ({ roomId, position } = {}) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      if (!activeRoomId || !position) {
        return;
      }

      socket.to(activeRoomId).emit('cursor-update', {
        userId: socket.data.user.userId,
        username: socket.data.user.name,
        position,
        cursorColor: socket.data.participant?.cursorColor,
        avatarGlyph: socket.data.participant?.avatarGlyph,
        socketId: socket.id,
      });
    });

    socket.on('selection-change', ({ roomId, selectionRange } = {}) => {
      const activeRoomId = normalizeRoomId(roomId || socket.data.roomId);
      if (!activeRoomId || !selectionRange) {
        return;
      }

      socket.to(activeRoomId).emit('selection-update', {
        userId: socket.data.user.userId,
        username: socket.data.user.name,
        selectionRange,
        cursorColor: socket.data.participant?.cursorColor,
        avatarGlyph: socket.data.participant?.avatarGlyph,
        socketId: socket.id,
      });
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      untrackUserSocket(socket.data.user?.userId, socket.id);
    registerTerminalHandlers(io, socket);
      releaseLocksForSocket(io, socket);
      if (!roomId) {
        return;
      }

      const removal = removeParticipant(roomId, socket.id);
      socket.to(roomId).emit('user-left', {
        socketId: socket.id,
        userId: removal?.removedParticipant?.userId,
        username: removal?.removedParticipant?.username,
      });
      emitParticipants(io, roomId);
    });
  });

  return io;
}

module.exports = { createSocketServer, escapeRegExp, resolveMemberRole, socketIsViewer, ASSIGNABLE_ROLES };
