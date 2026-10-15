const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  senderId: {
    type: String,
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['user', 'system'],
    default: 'user'
  },
  content: {
    type: String,
    required: true
  },
  
  replyTo: {
    messageId: { type: mongoose.Schema.Types.ObjectId, default: null },
    senderName: { type: String, default: null },
    content: { type: String, default: null }
  },
  
  reactions: {
    type: Map,
    of: [{
      userId: String,
      username: String
    }],
    default: {}
  },
  
  pinned: {
    type: Boolean,
    default: false
  },
  
  edited: {
    type: Boolean,
    default: false
  },
  
  deleted: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});


messageSchema.index({ content: 'text', senderName: 'text' });

module.exports = mongoose.model('Message', messageSchema);
