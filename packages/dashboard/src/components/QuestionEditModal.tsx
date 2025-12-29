import { useState, useEffect } from 'react';
import { X, Save, Plus } from 'lucide-react';
import type { QuestionNode, QuestionOverride } from '../types';

interface QuestionEditModalProps {
  question: QuestionNode;
  isOpen: boolean;
  onClose: () => void;
  onSave: (override: QuestionOverride) => void;
}

export const QuestionEditModal = ({
  question,
  isOpen,
  onClose,
  onSave
}: QuestionEditModalProps) => {
  const [editTitle, setEditTitle] = useState(question.title);
  const [editScenario, setEditScenario] = useState(question.scenario);
  const [editMustInclude, setEditMustInclude] = useState<string[]>(question.rubric.mustInclude);
  const [editMustAvoid, setEditMustAvoid] = useState<string[]>(question.rubric.mustAvoid);
  const [newInclude, setNewInclude] = useState('');
  const [newAvoid, setNewAvoid] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEditTitle(question.title);
      setEditScenario(question.scenario);
      setEditMustInclude(question.rubric.mustInclude);
      setEditMustAvoid(question.rubric.mustAvoid);
    }
  }, [isOpen, question]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      title: editTitle,
      scenario: editScenario,
      rubric: {
        mustInclude: editMustInclude,
        mustAvoid: editMustAvoid
      },
      lastUpdated: Date.now()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{zIndex: 10000}} onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-md max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Edit Question</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="text-sm font-semibold text-zinc-400 mb-2 block">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-zinc-400 mb-2 block">Scenario</label>
            <textarea
              rows={4}
              value={editScenario}
              onChange={(e) => setEditScenario(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-emerald-500 mb-2 block">Must Include</label>
              <div className="space-y-2">
                {editMustInclude.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm">
                    <span className="flex-1 text-zinc-300">{item}</span>
                    <button
                      onClick={() => setEditMustInclude(editMustInclude.filter((_, idx) => idx !== i))}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newInclude}
                    onChange={(e) => setNewInclude(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newInclude.trim()) {
                        setEditMustInclude([...editMustInclude, newInclude.trim()]);
                        setNewInclude('');
                      }
                    }}
                    placeholder="Add item..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => {
                      if (newInclude.trim()) {
                        setEditMustInclude([...editMustInclude, newInclude.trim()]);
                        setNewInclude('');
                      }
                    }}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-red-500 mb-2 block">Must Avoid</label>
              <div className="space-y-2">
                {editMustAvoid.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm">
                    <span className="flex-1 text-zinc-300">{item}</span>
                    <button
                      onClick={() => setEditMustAvoid(editMustAvoid.filter((_, idx) => idx !== i))}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAvoid}
                    onChange={(e) => setNewAvoid(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newAvoid.trim()) {
                        setEditMustAvoid([...editMustAvoid, newAvoid.trim()]);
                        setNewAvoid('');
                      }
                    }}
                    placeholder="Add item..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                  <button
                    onClick={() => {
                      if (newAvoid.trim()) {
                        setEditMustAvoid([...editMustAvoid, newAvoid.trim()]);
                        setNewAvoid('');
                      }
                    }}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
