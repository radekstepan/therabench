import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import Mustache from 'mustache';
import rubricDisplayTemplate from '../templates/rubric-display.mustache?raw';
import type { Rubric } from '../types';

interface RubricEditorProps {
  rubric: Rubric;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (rubric: Rubric) => void;
  onReset?: () => void;
}

export const RubricEditor = ({
  rubric,
  isEditing,
  onToggleEdit,
  onSave,
  onReset
}: RubricEditorProps) => {
  // Use template to render rubric content (handles both string criteria and array formats)
  const rubricContent = Mustache.render(rubricDisplayTemplate, {
    criteria: rubric.criteria || '',
    mustInclude: rubric.mustInclude || [],
    mustAvoid: rubric.mustAvoid || []
  });
  const [editedCriteria, setEditedCriteria] = useState<string>(rubricContent);

  useEffect(() => {
    setEditedCriteria(rubricContent);
  }, [rubric, isEditing]);

  const handleSave = () => {
    onSave({ criteria: editedCriteria });
  };

  if (!isEditing) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-md p-5">
        <div className="text-zinc-500 font-semibold text-xs uppercase tracking-wider mb-2">Evaluation Criteria</div>
        <div className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
          {rubricContent}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-md p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Edit Rubric Criteria</h3>
        <div className="flex gap-2">
          {onReset && (
            <button
              onClick={onReset}
              className="px-3 py-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
              title="Reset to original rubric"
            >
              Reset
            </button>
          )}
          <button
            onClick={() => {
              setEditedCriteria(rubricContent);
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

      <div>
        <textarea
          rows={6}
          value={editedCriteria}
          onChange={(e) => setEditedCriteria(e.target.value)}
          placeholder="Enter free-form evaluation criteria for the judge model..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors resize-none font-mono"
        />
        <p className="mt-2 text-[10px] text-zinc-500">
          Tip: Describe what the model response should include and what it should avoid in a cohesive paragraph or list.
        </p>
      </div>
    </div>
  );
};
