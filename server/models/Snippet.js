const mongoose = require('mongoose');

const snippetSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: null, 
      index: true,
    },
    name: { type: String, required: true },
    prefix: { type: String, required: true, index: true }, 
    language: { type: String, required: true, index: true }, 
    category: { type: String, default: 'general' },
    description: { type: String, default: '' },
    code: { type: String, required: true }, 
    isBuiltIn: { type: Boolean, default: false },
    useCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

snippetSchema.index({ userId: 1, language: 1 });
snippetSchema.index({ prefix: 1, language: 1 });

module.exports = mongoose.model('Snippet', snippetSchema);
