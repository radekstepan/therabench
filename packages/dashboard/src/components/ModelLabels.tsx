import { getModelLabels } from '../utils';

export const ModelLabels = ({ modelName }: { modelName: string }) => {
  const labels = getModelLabels(modelName);
  if (labels.length === 0) return null;

  return (
    <span className="flex-shrink-0 ml-2 flex items-center gap-1">
      {labels.map((label, idx) => (
        <span
          key={idx}
          className="flex-shrink-0 inline-block px-2 py-0.5 rounded text-[10px] font-medium border"
          style={{
            backgroundColor: `${label.color}20`,
            borderColor: `${label.color}40`,
            color: label.color
          }}
        >
          {label.text}
        </span>
      ))}
    </span>
  );
};
