import { useState, useEffect } from 'react';
import { Save, Plus, X } from 'lucide-react';
import type { Rubric } from '../types';

interface RubricEditorProps {
  rubric: Rubric;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (rubric: Rubric) => void;
}

export const RubricEditor = ({ 
  rubric, 
  isEditing, 
  onToggleEdit, 
  onSave 
}: RubricEditorProps) => {
  const [editedRubric, setEditedRubric] = useState<Rubric>(rubric);
  const [newIncludeItem, setNewIncludeItem] = useState('');
  const [newAvoidItem, setNewAvoidItem] = useState('');

  useEffect(() => {
    setEditedRubric(rubric);
  }, [rubric, isEditing]);

  const handleSave = () => {
    onSave(editedRubric);
  };

  const addIncludeItem = () => {
    if (newIncludeItem.trim()) {
      setEditedRubric({
        ...editedRubric,
        mustInclude: [...editedRubric.mustInclude, newIncludeItem.trim()]
      });
      setNewIncludeItem('');
    }
  };

  const addAvoidItem = () => {
    if (newAvoidItem.trim()) {
      setEditedRubric({
        ...editedRubric,
        mustAvoid: [...editedRubric.mustAvoid, newAvoidItem.trim()]
      });
      setNewAvoidItem('');
    }
  };

  const removeIncludeItem = (index: number) => {
    setEditedRubric({
      ...editedRubric,
      mustInclude: editedRubric.mustInclude.filter((_, i) => i !== index)
    });
  };

  const removeAvoidItem = (index: number) => {
    setEditedRubric({
      ...editedRubric,
      mustAvoid: editedRubric.mustAvoid.filter((_, i) => i !== index)
    });
  };

  if (!isEditing) {
    return (
      <div className="flex gap-6 text-xs text-zinc-500">
        <div className="flex-1">
          <span className="text-emerald-500 font-semibold block mb-1">Must Include:</span>
          <ul className="list-disc list-inside space-y-0.5">
            {rubric.mustInclude.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
        <div className="flex-1">
          <span className="text-red-500 font-semibold block mb-1">Must Avoid:</span>
          <ul className="list-disc list-inside space-y-0.5">
            {rubric.mustAvoid.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Edit Rubric</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditedRubric(rubric);
              onToggleEdit();
            }}
            className="px-3 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
          >
            <Save className="w-3 h-3" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-emerald-500 font-semibold text-sm mb-2">Must Include:</div>
          <div className="space-y-2">
            {editedRubric.mustInclude.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm">
                <span className="flex-1 text-zinc-300">{item}</span>
                <button
                  onClick={() => removeIncludeItem(i)}
                  className="text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newIncludeItem}
                onChange={(e) => setNewIncludeItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addIncludeItem()}
                placeholder="Add new item..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                onClick={addIncludeItem}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="text-red-500 font-semibold text-sm mb-2">Must Avoid:</div>
          <div className="space-y-2">
            {editedRubric.mustAvoid.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm">
                <span className="flex-1 text-zinc-300">{item}</span>
                <button
                  onClick={() => removeAvoidItem(i)}
                  className="text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newAvoidItem}
                onChange={(e) => setNewAvoidItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAvoidItem()}
                placeholder="Add new item..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
              />
              <button
                onClick={addAvoidItem}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
